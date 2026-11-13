// =====================================================================
// SERVICE FIRESTORE DÉDIÉ AUX TICKETS D'AIDE ET D'ASSISTANCE
// =====================================================================

import {
  collection,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  increment,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { addProfileCounterStep } from "./profileService";
import { addModeratedCounterStep } from "./moderationService";
import { addMentionNotifications } from "./notificationService";
import { cleanupAfterDeletion, deleteParentWithThread, deleteRemovedImages } from "./cleanupService";
import type { MentionTarget } from "../types/mention";
import type { Ticket, NewTicketFormData, TicketStatus } from "../types/ticket";

const TICKETS_COLLECTION = "tickets";
const CHANNELS_COLLECTION = "channels";
const USERS_COLLECTION = "users";

// Création d'un ticket d'aide rattaché à un canal.
// L'écriture est atomique : le ticket est créé et le compteur du canal incrémenté dans le même lot.
export const createTicketInFirestore = async (
  channelId: string,
  formData: NewTicketFormData,
  user: { uid: string; displayName?: string | null; email?: string | null },
  // Étudiants mentionnés dans la description, notifiés dans le même lot
  mentions: MentionTarget[] = []
): Promise<string> => {
  const ticketData = {
    channelId,
    title: formData.title,
    description: formData.description,
    status: "open",
    priority: formData.priority,
    tags: formData.tags,
    authorId: user.uid,
    authorName: user.displayName || user.email || "Étudiant",
    createdAt: serverTimestamp(),
    repliesCount: 0,
    solutionReplyId: null,
  };

  // Génération préalable de la référence afin de l'inclure dans le lot d'écriture
  const ticketDocRef = doc(collection(db, TICKETS_COLLECTION));
  const batch = writeBatch(db);
  batch.set(ticketDocRef, ticketData);
  batch.update(doc(db, CHANNELS_COLLECTION, channelId), {
    ticketsCount: increment(1),
  });
  // Compteur de tickets du profil de l'auteur
  await addProfileCounterStep(batch, user.uid, "ticketsCount", 1);
  addMentionNotifications(
    batch,
    "tickets",
    ticketDocRef.id,
    null,
    { title: formData.title, channelId },
    { uid: user.uid, name: ticketData.authorName },
    mentions
  );
  await batch.commit();

  return ticketDocRef.id;
};

// Mise à jour de l'état d'avancement d'un ticket (ouvert, en cours, résolu)
export const updateTicketStatusInFirestore = async (
  ticketId: string,
  newStatus: TicketStatus
): Promise<void> => {
  const ticketDocRef = doc(db, TICKETS_COLLECTION, ticketId);
  await updateDoc(ticketDocRef, {
    status: newStatus,
  });
};

// Modification d'un ticket par son auteur (sujet, description, priorité et tags).
// Les images retirées de la description sont ensuite supprimées.
export const updateTicketInFirestore = async (
  ticketId: string,
  formData: NewTicketFormData,
  previousDescription: string
): Promise<void> => {
  await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    tags: formData.tags,
  });
  await deleteRemovedImages(previousDescription, formData.description).catch((error) =>
    console.warn("Nettoyage des images retirées du ticket :", error)
  );
};

// Marquage (ou retrait) d'une réponse comme solution par l'auteur du ticket.
// Le marquage d'une solution fait passer le ticket au statut « Résolu ».
// Dans le même lot, l'auteur de la nouvelle solution est crédité et l'auteur de l'ancienne décrédité ;
// lastSolutionTicketId permet aux règles Firestore de vérifier ce changement sur le ticket.
export const setTicketSolution = async (
  ticketId: string,
  reply: { id: string; authorId: string } | null,
  previousSolutionAuthorId: string | null
): Promise<void> => {
  const nextSolutionAuthorId = reply?.authorId ?? null;
  const batch = writeBatch(db);
  batch.update(doc(db, TICKETS_COLLECTION, ticketId), {
    solutionReplyId: reply?.id ?? null,
    solutionAuthorId: nextSolutionAuthorId,
    ...(reply ? { status: "resolved" } : {}),
  });

  if (previousSolutionAuthorId !== nextSolutionAuthorId) {
    const adjustments: [string | null, number][] = [
      [previousSolutionAuthorId, -1],
      [nextSolutionAuthorId, 1],
    ];
    for (const [uid, step] of adjustments) {
      if (!uid) continue;
      // Un étudiant sans profil (jamais reconnecté depuis la création des profils) n'est pas crédité
      const profile = await getDoc(doc(db, USERS_COLLECTION, uid));
      if (!profile.exists()) continue;
      if (step < 0 && (profile.data().solutionsCount || 0) <= 0) continue;
      batch.update(doc(db, USERS_COLLECTION, uid), {
        solutionsCount: increment(step),
        lastSolutionTicketId: ticketId,
      });
    }
  }

  await batch.commit();
};

// Suppression d'un ticket par son auteur ou par un modérateur du canal, avec ses réponses,
// décrémentation des compteurs du canal et du profil de l'auteur, puis nettoyage
// de ses images (et de celles des réponses de l'auteur) et des notifications qu'il a générées
export const deleteTicketFromFirestore = async (ticket: Ticket, deleterId: string): Promise<void> => {
  const authorId = ticket.authorId;
  const deletedReplies = await deleteParentWithThread("tickets", "replies", ticket.id, async (batch) => {
    batch.update(doc(db, CHANNELS_COLLECTION, ticket.channelId), {
      ticketsCount: increment(-1),
    });
    // Le compteur d'un autre étudiant n'est modifiable que par la voie de modération
    if (deleterId === authorId) {
      await addProfileCounterStep(batch, authorId, "ticketsCount", -1);
    } else {
      await addModeratedCounterStep(batch, authorId, "ticketsCount", ticket.id);
    }
  });
  const ownContents = deletedReplies
    .filter((reply) => reply.authorId === authorId)
    .map((reply) => reply.content);
  await cleanupAfterDeletion(authorId, ticket.id, ticket.channelId, [ticket.description, ...ownContents]);
};

// Écoute en temps réel des tickets d'un canal
export const subscribeToChannelTickets = (
  channelId: string,
  onTicketsUpdate: (tickets: Ticket[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const ticketsRef = collection(db, TICKETS_COLLECTION);
  const ticketsQuery = query(
    ticketsRef,
    where("channelId", "==", channelId),
    orderBy("createdAt", "desc")
  );

  // Référence vers l'écouteur de repli, afin de pouvoir le désabonner lui aussi
  let fallbackUnsubscribe: Unsubscribe | null = null;

  const mainUnsubscribe = onSnapshot(
    ticketsQuery,
    (snapshot) => {
      const tickets: Ticket[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data({ serverTimestamps: "estimate" });
        return {
          id: docSnap.id,
          channelId: data.channelId || channelId,
          title: data.title || "",
          description: data.description || "",
          status: (data.status as TicketStatus) || "open",
          priority: data.priority || "medium",
          tags: data.tags || [],
          authorId: data.authorId || "",
          authorName: data.authorName || "Étudiant",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          repliesCount: data.repliesCount || 0,
          solutionReplyId: data.solutionReplyId ?? null,
          solutionAuthorId: data.solutionAuthorId ?? null,
          pinnedAt: data.pinnedAt?.toDate ? data.pinnedAt.toDate().toISOString() : null,
        };
      });
      onTicketsUpdate(tickets);
    },
    (error) => {
      console.warn("Écoute ordonnée des tickets échouée, fallback requête simple :", error);
      // Fallback si l'index composé (channelId + createdAt) n'est pas encore créé
      const fallbackQuery = query(ticketsRef, where("channelId", "==", channelId));
      fallbackUnsubscribe = onSnapshot(
        fallbackQuery,
        (fallbackSnap) => {
          const fallbackTickets: Ticket[] = fallbackSnap.docs.map((docSnap) => {
            const data = docSnap.data({ serverTimestamps: "estimate" });
            return {
              id: docSnap.id,
              channelId: data.channelId || channelId,
              title: data.title || "",
              description: data.description || "",
              status: (data.status as TicketStatus) || "open",
              priority: data.priority || "medium",
              tags: data.tags || [],
              authorId: data.authorId || "",
              authorName: data.authorName || "Étudiant",
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
              repliesCount: data.repliesCount || 0,
          solutionReplyId: data.solutionReplyId ?? null,
          solutionAuthorId: data.solutionAuthorId ?? null,
          pinnedAt: data.pinnedAt?.toDate ? data.pinnedAt.toDate().toISOString() : null,
            };
          });
          // Tri côté client
          fallbackTickets.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          onTicketsUpdate(fallbackTickets);
        },
        (err) => {
          console.error("Erreur écoute des tickets :", err);
          if (onError) onError(err);
        }
      );
    }
  );

  // Désabonnement global : écouteur principal et écouteur de repli éventuel
  return () => {
    mainUnsubscribe();
    if (fallbackUnsubscribe) fallbackUnsubscribe();
  };
};
