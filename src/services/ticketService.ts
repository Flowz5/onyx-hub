// =====================================================================
// SERVICE FIRESTORE DÉDIÉ AUX TICKETS D'AIDE ET D'ASSISTANCE
// =====================================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Ticket, NewTicketFormData, TicketStatus } from "../types/ticket";

const TICKETS_COLLECTION = "tickets";

// Création d'un ticket d'aide rattaché à un canal
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
  };

  const docRef = await addDoc(collection(db, TICKETS_COLLECTION), ticketData);
  return docRef.id;
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

// Suppression d'un ticket
export const deleteTicketFromFirestore = async (
  ticketId: string
): Promise<void> => {
  const ticketDocRef = doc(db, TICKETS_COLLECTION, ticketId);
  await deleteDoc(ticketDocRef);
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

  return onSnapshot(
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
        };
      });
      onTicketsUpdate(tickets);
    },
    (error) => {
      console.warn("Écoute ordonnée des tickets échouée, fallback requête simple :", error);
      // Fallback si l'index composé (channelId + createdAt) n'est pas encore créé
      const fallbackQuery = query(ticketsRef, where("channelId", "==", channelId));
      return onSnapshot(
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
};
