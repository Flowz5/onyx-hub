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
import type { Ticket, NewTicketFormData, TicketStatus } from "../types/ticket";

const TICKETS_COLLECTION = "tickets";
const CHANNELS_COLLECTION = "channels";
const USERS_COLLECTION = "users";

// Création d'un ticket d'aide rattaché à un canal.
// L'écriture est atomique : le ticket est créé et le compteur du canal incrémenté dans le même lot.
export const createTicketInFirestore = async (
  channelId: string,
  formData: NewTicketFormData,
  user: { uid: string; displayName?: string | null; email?: string | null }
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

// Modification d'un ticket par son auteur (sujet, description, priorité et tags)
export const updateTicketInFirestore = async (
  ticketId: string,
  formData: NewTicketFormData
): Promise<void> => {
  await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    tags: formData.tags,
  });
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

// Suppression d'un ticket par son auteur et décrémentation atomique des compteurs du canal et du profil
export const deleteTicketFromFirestore = async (
  ticketId: string,
  channelId: string,
  authorId: string
): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(doc(db, TICKETS_COLLECTION, ticketId));
  batch.update(doc(db, CHANNELS_COLLECTION, channelId), {
    ticketsCount: increment(-1),
  });
  await addProfileCounterStep(batch, authorId, "ticketsCount", -1);
  await batch.commit();
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
        const data = docSnap.data();
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
            const data = docSnap.data();
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
