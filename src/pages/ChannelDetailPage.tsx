import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { OnyxLogo } from "../components/OnyxLogo";
import { ChannelTabSelector, type ChannelActiveTab } from "../components/ChannelTabSelector";
import { FeedSearchBar, type PostSortOption } from "../components/FeedSearchBar";
import { PostCard } from "../components/PostCard";
import { TicketCard } from "../components/TicketCard";
import { CreatePostModal } from "../components/CreatePostModal";
import { CreateTicketModal } from "../components/CreateTicketModal";
import type { Channel } from "../types/channel";
import type { Post, NewPostFormData } from "../types/post";
import type { Ticket, NewTicketFormData, TicketStatus } from "../types/ticket";
import { getChannelById } from "../services/channelService";
import {
  createPostInFirestore,
  deletePostFromFirestore,
  togglePostUpvote,
  subscribeToChannelPosts,
} from "../services/postService";
import {
  createTicketInFirestore,
  updateTicketStatusInFirestore,
  deleteTicketFromFirestore,
  subscribeToChannelTickets,
} from "../services/ticketService";
import "./ChannelDetailPage.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowLeft, MessagesSquare, Plus, Ticket as TicketIcon } from "lucide-react";

// Page principale dédiée à la consultation intérieure d'un canal (Posts & Tickets)
export const ChannelDetailPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();

  // Données du canal
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isChannelLoading, setIsChannelLoading] = useState(true);

  // Catégorie active : "posts" (Discussions) ou "tickets" (Entraide)
  const [activeTab, setActiveTab] = useState<ChannelActiveTab>("posts");

  // Données des flux en temps réel
  const [posts, setPosts] = useState<Post[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Recherche et filtres du flux
  const [searchQuery, setSearchQuery] = useState("");
  const [postSort, setPostSort] = useState<PostSortOption>("latest");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | TicketStatus>("all");
  const [selectedTag, setSelectedTag] = useState("Tous");

  // États des modales de création
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);

  // 1. Chargement des informations du canal
  useEffect(() => {
    if (!channelId) return;

    let isMounted = true;
    setIsChannelLoading(true);

    getChannelById(channelId)
      .then((loadedChannel) => {
        if (isMounted) {
          setChannel(loadedChannel);
          setIsChannelLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erreur de récupération du canal :", err);
        if (isMounted) setIsChannelLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [channelId]);

  // 2. Écoute en temps réel des posts du canal
  useEffect(() => {
    if (!channelId) return;
    const unsubscribe = subscribeToChannelPosts(
      channelId,
      (loadedPosts) => setPosts(loadedPosts),
      (err) => console.error("Erreur écoute des posts :", err)
    );
    return () => unsubscribe();
  }, [channelId]);

  // 3. Écoute en temps réel des tickets du canal
  useEffect(() => {
    if (!channelId) return;
    const unsubscribe = subscribeToChannelTickets(
      channelId,
      (loadedTickets) => setTickets(loadedTickets),
      (err) => console.error("Erreur écoute des tickets :", err)
    );
    return () => unsubscribe();
  }, [channelId]);

  // Agrégation dynamique des tags disponibles dans le flux
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    if (channel?.tags) {
      channel.tags.forEach((t) => set.add(t));
    }
    posts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    tickets.forEach((tk) => tk.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [channel, posts, tickets]);

  // Filtrage et tri des posts
  const filteredPosts = useMemo(() => {
    const list = posts.filter((post) => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag =
        selectedTag === "Tous" || post.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });

    if (postSort === "popular") {
      return list.sort((a, b) => b.upvotesCount - a.upvotesCount);
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [posts, searchQuery, selectedTag, postSort]);

  // Filtrage des tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        ticketStatusFilter === "all" || ticket.status === ticketStatusFilter;
      const matchesTag =
        selectedTag === "Tous" || ticket.tags.includes(selectedTag);
      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [tickets, searchQuery, ticketStatusFilter, selectedTag]);

  // Actions de création : l'erreur est relayée à la modale, qui l'affiche à l'utilisateur.
  // Le nouvel élément apparaît ensuite dans le flux via l'écoute temps réel.
  const handleCreatePostSubmit = async (data: NewPostFormData) => {
    if (!channelId || !user) {
      throw new Error("Utilisateur ou canal introuvable.");
    }
    try {
      await createPostInFirestore(channelId, data, user);
      setIsCreatePostModalOpen(false);
      setActiveTab("posts");
    } catch (err) {
      console.error("Erreur lors de la création du post :", err);
      throw err;
    }
  };

  const handleCreateTicketSubmit = async (data: NewTicketFormData) => {
    if (!channelId || !user) {
      throw new Error("Utilisateur ou canal introuvable.");
    }
    try {
      await createTicketInFirestore(channelId, data, user);
      setIsCreateTicketModalOpen(false);
      setActiveTab("tickets");
    } catch (err) {
      console.error("Erreur lors de l'ouverture du ticket :", err);
      throw err;
    }
  };

  // Actions sur les posts
  const handleUpvotePost = async (postId: string, isCurrentlyUpvoted: boolean) => {
    if (!user) return;
    try {
      await togglePostUpvote(postId, user.uid, isCurrentlyUpvoted);
    } catch (err) {
      console.error("Erreur de vote sur le post :", err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!channelId) return;
    try {
      await deletePostFromFirestore(postId, channelId);
    } catch (err) {
      console.error("Erreur de suppression du post :", err);
      alert("Impossible de supprimer ce post.");
    }
  };

  // Actions sur les tickets
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      await updateTicketStatusInFirestore(ticketId, newStatus);
    } catch (err) {
      console.error("Erreur de mise à jour du statut :", err);
      alert("Impossible de modifier le statut du ticket.");
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!channelId) return;
    try {
      await deleteTicketFromFirestore(ticketId, channelId);
    } catch (err) {
      console.error("Erreur de suppression du ticket :", err);
      alert("Impossible de supprimer ce ticket.");
    }
  };

  const channelDisplayName = channel?.name || channelId || "Canal";

  return (
    <div className="channel-detail-page-container">
      {/* Barre de navigation supérieure */}
      <header className="channel-detail-topbar">
        <div className="topbar-brand" onClick={() => navigate("/channels")} role="button" tabIndex={0}>
          <OnyxLogo size={40} showHexHalo={false} />
          <div className="topbar-title">
            <span className="brand-name">ONYX <strong>HUB</strong></span>
            <span className="brand-badge">CLASSE ACTIVE</span>
          </div>
        </div>

        <div className="topbar-user-area">
          <div className="user-details">
            <span className="user-name">{user?.displayName || "Étudiant"}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button
            type="button"
            className="signout-header-btn"
            onClick={signOutUser}
            title="Se déconnecter"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Barre d'en-tête secondaire avec bouton retour */}
      <nav className="channel-sub-nav">
        <button
          type="button"
          className="back-to-channels-btn"
          onClick={() => navigate("/channels")}
        >
          <span className="back-arrow"><ArrowLeft className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" /></span>
          <span>Retour aux canaux</span>
        </button>
        <div className="current-channel-crumb">
          <span>Canal :</span>
          <strong>#{channelDisplayName}</strong>
          {channel && (
            <span className={`crumb-pill ${channel.visibility}`}>
              {channel.visibility === "private" ? "Privé" : "Public"}
            </span>
          )}
        </div>
      </nav>

      {/* Contenu principal : Flux du canal */}
      <main className="channel-detail-main">
        {/* En-tête informatif du canal */}
        <section className="channel-info-card">
          <div className="info-top-row">
            <h2>#{channelDisplayName}</h2>
            {channel?.tags && (
              <div className="info-tags-list">
                {channel.tags.map((tag) => (
                  <span key={tag} className="channel-header-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="channel-desc-text">
            {isChannelLoading
              ? "Chargement des détails du canal..."
              : channel?.description || "Espace d'échange et d'entraide entre étudiants."}
          </p>
        </section>

        {/* Sélecteur d'onglets (Posts vs Tickets) */}
        <ChannelTabSelector
          activeTab={activeTab}
          onTabChange={setActiveTab}
          postsCount={posts.length}
          ticketsCount={tickets.length}
        />

        {/* Barre de recherche et filtres de flux */}
        <FeedSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTab={activeTab}
          postSort={postSort}
          onPostSortChange={setPostSort}
          ticketStatusFilter={ticketStatusFilter}
          onTicketStatusFilterChange={setTicketStatusFilter}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          availableTags={availableTags}
          onOpenCreateModal={() => {
            if (activeTab === "posts") {
              setIsCreatePostModalOpen(true);
            } else {
              setIsCreateTicketModalOpen(true);
            }
          }}
        />

        {/* Flux déroulant : Liste des posts */}
        {activeTab === "posts" && (
          <div className="feed-scrollable-container">
            {filteredPosts.length === 0 ? (
              <div className="empty-feed-card">
                <span className="empty-icon"><MessagesSquare className="onyx-icon" size={40} strokeWidth={2} aria-hidden="true" /></span>
                <h4>Aucun post dans ce canal pour l'instant</h4>
                <p>
                  Soyez le premier à partager une astuce, une ressource ou poser une question !
                </p>
                <button
                  type="button"
                  className="empty-cta-btn"
                  onClick={() => setIsCreatePostModalOpen(true)}
                >
                  <Plus className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                  Créer le premier post
                </button>
              </div>
            ) : (
              <div className="feed-items-list">
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.uid}
                    onUpvote={handleUpvotePost}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flux déroulant : Liste des tickets d'aide */}
        {activeTab === "tickets" && (
          <div className="feed-scrollable-container">
            {filteredTickets.length === 0 ? (
              <div className="empty-feed-card">
                <span className="empty-icon"><TicketIcon className="onyx-icon" size={40} strokeWidth={2} aria-hidden="true" /></span>
                <h4>Aucun ticket d'assistance en attente</h4>
                <p>
                  Un problème sur un TP, un bug de code ou un point de cours bloquant ? Ouvrez un ticket !
                </p>
                <button
                  type="button"
                  className="empty-cta-btn"
                  onClick={() => setIsCreateTicketModalOpen(true)}
                >
                  <Plus className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                  Ouvrir un ticket d'aide
                </button>
              </div>
            ) : (
              <div className="feed-items-list">
                {filteredTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    currentUserId={user?.uid}
                    onUpdateStatus={handleUpdateTicketStatus}
                    onDelete={handleDeleteTicket}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modales de création */}
        <CreatePostModal
          isOpen={isCreatePostModalOpen}
          onClose={() => setIsCreatePostModalOpen(false)}
          onSubmit={handleCreatePostSubmit}
          suggestedTags={channel?.tags}
        />

        <CreateTicketModal
          isOpen={isCreateTicketModalOpen}
          onClose={() => setIsCreateTicketModalOpen(false)}
          onSubmit={handleCreateTicketSubmit}
          suggestedTags={channel?.tags}
        />
      </main>
    </div>
  );
};
