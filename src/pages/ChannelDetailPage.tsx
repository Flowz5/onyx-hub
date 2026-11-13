import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChannelTabSelector, type ChannelActiveTab } from "../components/ChannelTabSelector";
import { FeedSearchBar, type PostSortOption } from "../components/FeedSearchBar";
import { PostCard } from "../components/PostCard";
import { TicketCard } from "../components/TicketCard";
import { CreatePostModal } from "../components/CreatePostModal";
import { CreateTicketModal } from "../components/CreateTicketModal";
import type { Channel } from "../types/channel";
import type { Post, NewPostFormData } from "../types/post";
import type { Ticket, NewTicketFormData, TicketStatus } from "../types/ticket";
import type { NotificationFocus } from "../types/notification";
import { getChannelById, updateChannelMembers } from "../services/channelService";
import {
  createPostInFirestore,
  updatePostInFirestore,
  deletePostFromFirestore,
  togglePostUpvote,
  subscribeToChannelPosts,
} from "../services/postService";
import {
  createTicketInFirestore,
  updateTicketInFirestore,
  updateTicketStatusInFirestore,
  deleteTicketFromFirestore,
  subscribeToChannelTickets,
} from "../services/ticketService";
import "./ChannelDetailPage.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowLeft, Lock, MessagesSquare, Plus, Ticket as TicketIcon, Users, CircleAlert } from "lucide-react";
import { ChannelMembersModal } from "../components/ChannelMembersModal";
import { AppTopbar } from "../components/AppTopbar";
import { MentionProvider, useChannelMentionCandidates } from "../context/MentionContext";
import { resolveMentionTargets } from "../types/mention";
import { deleteReceivedNotification } from "../services/notificationService";
import { canModerateChannel, setContentPinned, sortPinnedFirst } from "../services/moderationService";

// Page principale dédiée à la consultation intérieure d'un canal (Posts & Tickets)
export const ChannelDetailPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Post ou ticket ciblé par une notification (transmis dans l'état de navigation)
  const notificationFocus =
    (location.state as { notificationFocus?: NotificationFocus } | null)?.notificationFocus ?? null;

  // Données du canal
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isChannelLoading, setIsChannelLoading] = useState(true);

  // Catégorie active : "posts" (Discussions) ou "tickets" (Entraide)
  const [activeTab, setActiveTab] = useState<ChannelActiveTab>("posts");

  // Données des flux en temps réel
  const [posts, setPosts] = useState<Post[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // Canal dont les flux ont été reçus : distingue un flux vide d'un flux en cours de chargement,
  // y compris lors du passage d'un canal à un autre (la page n'est alors pas recréée)
  const [postsLoadedFor, setPostsLoadedFor] = useState<string | null>(null);
  const [ticketsLoadedFor, setTicketsLoadedFor] = useState<string | null>(null);
  const arePostsLoaded = postsLoadedFor !== null && postsLoadedFor === channelId;
  const areTicketsLoaded = ticketsLoadedFor !== null && ticketsLoadedFor === channelId;

  // Recherche et filtres du flux
  const [searchQuery, setSearchQuery] = useState("");
  const [postSort, setPostSort] = useState<PostSortOption>("latest");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | TicketStatus>("all");
  const [selectedTag, setSelectedTag] = useState("Tous");

  // États des modales de création
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  // Post ou ticket en cours d'édition (null en mode création)
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // Modale de gestion des membres (canal privé, créateur uniquement)
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Membres mentionnables avec « @ » dans les éditeurs du canal
  const mentionCandidates = useChannelMentionCandidates(channel);

  // Le canal est accessible une fois chargé ; sinon il est inexistant ou réservé à ses membres
  const hasChannelAccess = Boolean(channel);
  const isChannelOwner = Boolean(channel && user && channel.creatorId === user.uid);
  // Modération du canal : son créateur et le compte administrateur
  const isModerator = canModerateChannel(channel, user);

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

  // Arrivée depuis une notification : bon onglet et filtres réinitialisés pour afficher la carte ciblée
  useEffect(() => {
    if (!notificationFocus) return;
    setActiveTab(notificationFocus.tab);
    setSearchQuery("");
    setSelectedTag("Tous");
    setTicketStatusFilter("all");
    // L'état de navigation est un nouvel objet à chaque navigation, même vers la même cible
  }, [notificationFocus]);

  // Cible de la notification introuvable une fois le flux chargé : contenu supprimé entre-temps
  const isFocusTargetMissing = Boolean(
    notificationFocus &&
      (notificationFocus.tab === "posts"
        ? arePostsLoaded && !posts.some((post) => post.id === notificationFocus.targetId)
        : areTicketsLoaded && !tickets.some((ticket) => ticket.id === notificationFocus.targetId))
  );

  // La notification devenue orpheline est retirée de la liste de l'utilisateur
  const orphanNotificationId = isFocusTargetMissing ? notificationFocus?.notificationId : undefined;
  useEffect(() => {
    if (!orphanNotificationId) return;
    deleteReceivedNotification(orphanNotificationId).catch((error) =>
      console.warn("Suppression de la notification orpheline :", error)
    );
  }, [orphanNotificationId]);

  // Mise en avant d'une carte du flux lorsqu'elle est la cible de la notification
  const getCardFocus = (id: string): "card" | "thread" | null => {
    if (!notificationFocus || notificationFocus.targetId !== id) return null;
    return notificationFocus.openThread ? "thread" : "card";
  };

  // 2. Écoute en temps réel des posts du canal
  useEffect(() => {
    if (!channelId || !hasChannelAccess) return;
    const unsubscribe = subscribeToChannelPosts(
      channelId,
      (loadedPosts) => {
        setPosts(loadedPosts);
        setPostsLoadedFor(channelId);
      },
      (err) => console.error("Erreur écoute des posts :", err)
    );
    return () => unsubscribe();
  }, [channelId, hasChannelAccess]);

  // 3. Écoute en temps réel des tickets du canal
  useEffect(() => {
    if (!channelId || !hasChannelAccess) return;
    const unsubscribe = subscribeToChannelTickets(
      channelId,
      (loadedTickets) => {
        setTickets(loadedTickets);
        setTicketsLoadedFor(channelId);
      },
      (err) => console.error("Erreur écoute des tickets :", err)
    );
    return () => unsubscribe();
  }, [channelId, hasChannelAccess]);

  // Agrégation des tags du flux, triés par importance :
  // les tags du canal en premier, puis les autres par nombre d'utilisations décroissant
  const availableTags = useMemo(() => {
    const usage = new Map<string, number>();
    const countTag = (tag: string) => usage.set(tag, (usage.get(tag) || 0) + 1);
    posts.forEach((p) => p.tags.forEach(countTag));
    tickets.forEach((tk) => tk.tags.forEach(countTag));

    const channelTags = channel?.tags || [];
    const otherTags = Array.from(usage.keys())
      .filter((tag) => !channelTags.includes(tag))
      .sort((a, b) => (usage.get(b) || 0) - (usage.get(a) || 0) || a.localeCompare(b, "fr"));

    return [...channelTags, ...otherTags];
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
      list.sort((a, b) => b.upvotesCount - a.upvotesCount);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    // Les posts épinglés par un modérateur restent en tête, quel que soit le tri
    return sortPinnedFirst(list);
  }, [posts, searchQuery, selectedTag, postSort]);

  // Filtrage des tickets, les tickets épinglés restant en tête
  const filteredTickets = useMemo(() => {
    const list = tickets.filter((ticket) => {
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
    return sortPinnedFirst(list);
  }, [tickets, searchQuery, ticketStatusFilter, selectedTag]);

  // Valeurs initiales des modales en mode édition (références stables)
  const editingPostData = useMemo<NewPostFormData | null>(
    () =>
      editingPost
        ? { title: editingPost.title, content: editingPost.content, tags: editingPost.tags }
        : null,
    [editingPost]
  );

  const editingTicketData = useMemo<NewTicketFormData | null>(
    () =>
      editingTicket
        ? {
            title: editingTicket.title,
            description: editingTicket.description,
            priority: editingTicket.priority,
            tags: editingTicket.tags,
          }
        : null,
    [editingTicket]
  );

  // Ouverture des modales en mode édition
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setIsCreatePostModalOpen(true);
  };

  const handleEditTicket = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setIsCreateTicketModalOpen(true);
  };

  // Fermeture des modales et sortie du mode édition
  const closePostModal = () => {
    setIsCreatePostModalOpen(false);
    setEditingPost(null);
  };

  const closeTicketModal = () => {
    setIsCreateTicketModalOpen(false);
    setEditingTicket(null);
  };

  // Enregistrement d'un post : création ou modification selon le mode de la modale.
  // L'erreur est relayée à la modale, qui l'affiche à l'utilisateur ;
  // le flux est ensuite actualisé par l'écoute temps réel.
  const handlePostModalSubmit = async (data: NewPostFormData) => {
    if (!channelId || !user) {
      throw new Error("Utilisateur ou canal introuvable.");
    }
    try {
      if (editingPost) {
        await updatePostInFirestore(editingPost.id, data, editingPost.content);
      } else {
        await createPostInFirestore(
          channelId,
          data,
          user,
          resolveMentionTargets(data.content, mentionCandidates, [user.uid])
        );
        setActiveTab("posts");
      }
      closePostModal();
    } catch (err) {
      console.error("Erreur lors de l'enregistrement du post :", err);
      throw err;
    }
  };

  // Enregistrement d'un ticket : création ou modification selon le mode de la modale
  const handleTicketModalSubmit = async (data: NewTicketFormData) => {
    if (!channelId || !user) {
      throw new Error("Utilisateur ou canal introuvable.");
    }
    try {
      if (editingTicket) {
        await updateTicketInFirestore(editingTicket.id, data, editingTicket.description);
      } else {
        await createTicketInFirestore(
          channelId,
          data,
          user,
          resolveMentionTargets(data.description, mentionCandidates, [user.uid])
        );
        setActiveTab("tickets");
      }
      closeTicketModal();
    } catch (err) {
      console.error("Erreur lors de l'enregistrement du ticket :", err);
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

  // Épinglage d'un post ou d'un ticket par un modérateur du canal
  const handleTogglePin = async (kind: "posts" | "tickets", contentId: string, pinned: boolean) => {
    try {
      await setContentPinned(kind, contentId, pinned);
    } catch (err) {
      console.error("Erreur d'épinglage :", err);
      alert(pinned ? "Impossible d'épingler cet élément." : "Impossible de désépingler cet élément.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    if (!post || !user) return;
    try {
      await deletePostFromFirestore(post, user.uid);
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
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || !user) return;
    try {
      await deleteTicketFromFirestore(ticket, user.uid);
    } catch (err) {
      console.error("Erreur de suppression du ticket :", err);
      alert("Impossible de supprimer ce ticket.");
    }
  };

  // Enregistrement de la liste des membres puis mise à jour locale du canal affiché
  const handleSaveMembers = async (memberEmails: string[]) => {
    if (!channelId) return;
    await updateChannelMembers(channelId, memberEmails);
    setChannel((previous) => (previous ? { ...previous, memberEmails } : previous));
  };

  const channelDisplayName = channel?.name || channelId || "Canal";

  return (
    // Candidats aux mentions partagés avec les éditeurs (posts, tickets, réponses, commentaires)
    <MentionProvider candidates={mentionCandidates}>
      <div className="channel-detail-page-container">
        {/* Barre de navigation supérieure commune */}
        <AppTopbar />

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

        {/* Canal introuvable ou privé sans invitation */}
        {!isChannelLoading && !channel ? (
          <main className="channel-detail-main">
            {/* Réutilisation du style de carte vide du flux */}
            <div className="feed-scrollable-container">
            <section className="empty-feed-card">
              <span className="empty-icon">
                <Lock className="onyx-icon" size={36} strokeWidth={2} aria-hidden="true" />
              </span>
              <h4>Canal inaccessible</h4>
              <p>
                Ce canal n'existe pas ou il est privé. Demandez à son créateur de vous inviter
                avec l'adresse e-mail de votre compte.
              </p>
              <button type="button" className="empty-cta-btn" onClick={() => navigate("/channels")}>
                Retour aux canaux
              </button>
            </section>
            </div>
          </main>
        ) : (
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

            {/* Informations d'accès d'un canal privé et gestion des membres par le créateur */}
            {channel?.visibility === "private" && (
              <div className="private-access-row">
                <span className="members-summary">
                  <Users className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                  {channel.memberEmails.length} membre{channel.memberEmails.length > 1 ? "s" : ""} invité
                  {channel.memberEmails.length > 1 ? "s" : ""}
                </span>
                {isChannelOwner && (
                  <button
                    type="button"
                    className="manage-members-btn"
                    onClick={() => setIsMembersModalOpen(true)}
                  >
                    Gérer les membres
                  </button>
                )}
              </div>
            )}
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

          {/* Contenu ciblé par une notification mais supprimé depuis */}
          {isFocusTargetMissing && (
            <div className="missing-target-banner" role="status">
              <CircleAlert className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                {notificationFocus?.tab === "tickets" ? "Ce ticket" : "Ce post"} a été supprimé par son
                auteur. La notification a été retirée.
              </span>
            </div>
          )}

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
                      canModerate={isModerator}
                      onTogglePin={(postId, pinned) => handleTogglePin("posts", postId, pinned)}
                      onUpvote={handleUpvotePost}
                      onDelete={handleDeletePost}
                      onEdit={handleEditPost}
                      focus={getCardFocus(post.id)}
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
                      canModerate={isModerator}
                      onTogglePin={(ticketId, pinned) => handleTogglePin("tickets", ticketId, pinned)}
                      onUpdateStatus={handleUpdateTicketStatus}
                      onDelete={handleDeleteTicket}
                      onEdit={handleEditTicket}
                      focus={getCardFocus(ticket.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modales de création */}
          <CreatePostModal
            isOpen={isCreatePostModalOpen}
            onClose={closePostModal}
            onSubmit={handlePostModalSubmit}
            mode={editingPost ? "edit" : "create"}
            initialData={editingPostData}
            suggestedTags={channel?.tags}
          />

          <CreateTicketModal
            isOpen={isCreateTicketModalOpen}
            onClose={closeTicketModal}
            onSubmit={handleTicketModalSubmit}
            mode={editingTicket ? "edit" : "create"}
            initialData={editingTicketData}
            suggestedTags={channel?.tags}
          />

          {/* Modale de gestion des membres du canal privé */}
          {isChannelOwner && channel && (
            <ChannelMembersModal
              isOpen={isMembersModalOpen}
              onClose={() => setIsMembersModalOpen(false)}
              channelName={channel.name}
              initialEmails={channel.memberEmails}
              ownerEmail={user?.email}
              onSave={handleSaveMembers}
            />
          )}
        </main>
        )}
      </div>
    </MentionProvider>
  );
};
