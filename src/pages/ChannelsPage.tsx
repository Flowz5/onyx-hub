import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChannelSearchBar } from "../components/ChannelSearchBar";
import { ChannelRow } from "../components/ChannelRow";
import { CreateChannelModal } from "../components/CreateChannelModal";
import { AppTopbar } from "../components/AppTopbar";
import type { Channel, NewChannelFormData } from "../types/channel";
import {
  createChannelInFirestore,
  updateChannelInFirestore,
  deleteChannelFromFirestore,
  subscribeToChannels,
} from "../services/channelService";
import { isSuperAdmin } from "../services/moderationService";
import "./ChannelsPage.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Plus } from "lucide-react";

// Liste des tags thématiques initiaux
const DEFAULT_TAGS: string[] = [
  "Tous",
  "Dev Web",
  "Cybersécurité",
  "Réseaux & Système",
  "Bases de Données",
  "Général",
];

// Page principale affichant l'espace de gestion et de consultation des canaux
export const ChannelsPage: React.FC = () => {
  const { user } = useAuth();
  // Compte administrateur : accès aux canaux privés et suppression de tout canal
  const isAdmin = isSuperAdmin(user);
  const navigate = useNavigate();

  // État local pour la requête de recherche textuelle globale
  const [searchQuery, setSearchQuery] = useState("");

  // État local pour le tag actuellement sélectionné
  const [selectedTag, setSelectedTag] = useState("Tous");

  // Filtre d'affichage : "all" (Tous les canaux) ou "mine" (Canaux créés par moi)
  const [filterScope, setFilterScope] = useState<"all" | "mine">("all");

  // État d'ouverture de la modale de création de canal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Canal en cours d'édition (null en mode création)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // État de chargement initial des données Firestore
  const [isLoading, setIsLoading] = useState(true);

  // Liste actuelle des canaux persistée depuis Firestore
  const [channels, setChannels] = useState<Channel[]>([]);

  // Écoute en temps réel des canaux depuis la base de données Firestore
  // Seuls les canaux publics, créés par l'utilisateur ou partagés avec lui sont récupérés
  const userId = user?.uid;
  const userEmail = user?.email;
  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    const unsubscribe = subscribeToChannels(
      { uid: userId, email: userEmail },
      (firestoreChannels) => {
        setChannels(firestoreChannels);
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur lors de la synchronisation Firestore :", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, userEmail]);

  // Agrégation des tags triés par importance : "Tous", puis les tags par défaut,
  // puis les tags personnalisés par nombre de canaux les utilisant (décroissant)
  const availableTags = useMemo(() => {
    const usage = new Map<string, number>();
    channels.forEach((channel) => {
      channel.tags.forEach((tag) => usage.set(tag, (usage.get(tag) || 0) + 1));
    });

    const customTags = Array.from(usage.keys())
      .filter((tag) => !DEFAULT_TAGS.includes(tag))
      .sort((a, b) => (usage.get(b) || 0) - (usage.get(a) || 0) || a.localeCompare(b, "fr"));

    return [...DEFAULT_TAGS, ...customTags];
  }, [channels]);

  // Nombre de canaux créés par l'utilisateur connecté
  const myChannelsCount = useMemo(() => {
    if (!user) return 0;
    return channels.filter(
      (channel) =>
        channel.creatorId === user.uid ||
        channel.createdBy === user.email ||
        channel.createdBy === user.displayName
    ).length;
  }, [channels, user]);

  // Filtrage combiné : recherche textuelle, tag sélectionné et périmètre (Tous / Mes canaux)
  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      // Correspondance texte (nom ou description)
      const matchesSearch =
        channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Correspondance du tag sélectionné
      const matchesTag =
        selectedTag === "Tous" || channel.tags.includes(selectedTag);

      // Correspondance du périmètre (tous ou créés par l'utilisateur connecté)
      const isOwner =
        (user?.uid && channel.creatorId === user.uid) ||
        (user?.email && channel.createdBy === user.email) ||
        (user?.displayName && channel.createdBy === user.displayName);

      const matchesScope = filterScope === "all" || Boolean(isOwner);

      return matchesSearch && matchesTag && matchesScope;
    });
  }, [channels, searchQuery, selectedTag, filterScope, user]);

  // Navigation vers la page détaillée du canal sélectionné
  const handleSelectChannel = (channelId: string) => {
    navigate(`/channels/${channelId}`);
  };

  // Suppression d'un canal dans Firestore
  const handleDeleteChannel = async (channelId: string) => {
    try {
      await deleteChannelFromFirestore(channelId);
    } catch (error) {
      console.error("Erreur lors de la suppression dans Firestore :", error);
      alert("Une erreur est survenue lors de la suppression du canal.");
    }
  };

  // Réinitialisation de l'ensemble des filtres
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedTag("Tous");
    setFilterScope("all");
  };

  // Ouverture de la modale en mode édition pour un canal créé par l'utilisateur
  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setIsCreateModalOpen(true);
  };

  // Fermeture de la modale et sortie du mode édition
  const handleCloseChannelModal = () => {
    setIsCreateModalOpen(false);
    setEditingChannel(null);
  };

  // Valeurs initiales du formulaire en mode édition (référence stable pour la modale)
  const editingInitialData = useMemo<NewChannelFormData | null>(
    () =>
      editingChannel
        ? {
            name: editingChannel.name,
            description: editingChannel.description,
            tags: editingChannel.tags,
            visibility: editingChannel.visibility,
            memberEmails: editingChannel.memberEmails,
          }
        : null,
    [editingChannel]
  );

  // Enregistrement du canal : création ou mise à jour selon le mode de la modale.
  // L'erreur est relayée à la modale, qui l'affiche à l'utilisateur.
  const handleChannelModalSubmit = async (data: NewChannelFormData) => {
    if (!user) {
      throw new Error("Utilisateur non connecté.");
    }
    try {
      if (editingChannel) {
        await updateChannelInFirestore(editingChannel.id, data);
      } else {
        await createChannelInFirestore(data, user);
      }
      handleCloseChannelModal();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du canal dans Firestore :", error);
      throw error;
    }
  };

  return (
    <div className="channels-page-container">
      {/* Barre de navigation supérieure commune */}
      <AppTopbar />

      {/* Contenu principal de l'espace channels */}
      <main className="channels-main-content">
        {/* Composant réutilisable de recherche et de sélection de tags */}
        <ChannelSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          availableTags={availableTags}
        />

        {/* En-tête de section avec toggle de filtrage et bouton de création */}
        <div className="channels-section-header">
          <div className="section-title-group">
            <div className="title-with-badge">
              <h3>Canaux de discussion</h3>
              <span className="channels-count-badge">
                {filteredChannels.length} {filteredChannels.length > 1 ? "canaux" : "canal"}
              </span>
            </div>
            <p>Accédez aux espaces d'échange ou démarrez un nouveau sujet d'entraide.</p>
          </div>

          <div className="section-actions-group">
            {/* Bouton Toggle : Tous les canaux vs Mes canaux */}
            <div className="scope-toggle-group" role="group" aria-label="Filtrer les canaux">
              <button
                type="button"
                className={`scope-toggle-btn ${filterScope === "all" ? "active" : ""}`}
                onClick={() => setFilterScope("all")}
              >
                Tous les canaux
              </button>
              <button
                type="button"
                className={`scope-toggle-btn ${filterScope === "mine" ? "active" : ""}`}
                onClick={() => setFilterScope("mine")}
              >
                Mes canaux
                {myChannelsCount > 0 && (
                  <span className="my-count-pill">{myChannelsCount}</span>
                )}
              </button>
            </div>

            {/* Bouton de création de canal */}
            <button
              type="button"
              className="create-channel-btn"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <span className="btn-icon"><Plus className="onyx-icon" size={17} strokeWidth={2} aria-hidden="true" /></span>
              <span>Créer un canal</span>
            </button>
          </div>
        </div>

        {/* Liste des canaux sous forme de lignes horizontales ou affichage état vide */}
        {isLoading ? (
          <div className="empty-channels-state">
            <div className="empty-icon-wrapper">
              <span className="pulse-dot" style={{ width: 14, height: 14, borderRadius: "50%", background: "#FCA311", display: "inline-block", boxShadow: "0 0 12px #FCA311" }} />
            </div>
            <h4>Synchronisation avec Firestore...</h4>
            <p>Chargement des canaux de discussion en temps réel.</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="empty-channels-state">
            <div className="empty-icon-wrapper">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="13" y2="11" />
              </svg>
            </div>

            {searchQuery || selectedTag !== "Tous" || filterScope === "mine" ? (
              <>
                <h4>Aucun canal correspondant</h4>
                <p>Aucun canal ne correspond à vos filtres et critères de recherche actuels.</p>
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={handleResetFilters}
                >
                  Réinitialiser les filtres
                </button>
              </>
            ) : (
              <>
                <h4>Aucun canal pour le moment</h4>
                <p>
                  Soyez le premier à créer un canal pour échanger des cours, poser des questions ou ouvrir des tickets d'assistance.
                </p>
                <button
                  type="button"
                  className="create-first-channel-btn"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  + Créer le premier canal
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="channels-list-view">
            {filteredChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                currentUserId={user?.uid}
                currentUserEmail={user?.email || ""}
                onSelectChannel={handleSelectChannel}
                onDeleteChannel={handleDeleteChannel}
                onEditChannel={handleEditChannel}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

        {/* Modale interactive de création de canal */}
        <CreateChannelModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseChannelModal}
          onSubmit={handleChannelModalSubmit}
          currentUserEmail={user?.email}
          mode={editingChannel ? "edit" : "create"}
          initialData={editingInitialData}
        />
      </main>
    </div>
  );
};



