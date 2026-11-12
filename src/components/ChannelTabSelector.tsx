import React from "react";
import "./ChannelTabSelector.scss";

export type ChannelActiveTab = "posts" | "tickets";

interface ChannelTabSelectorProps {
  activeTab: ChannelActiveTab;
  onTabChange: (tab: ChannelActiveTab) => void;
  postsCount: number;
  ticketsCount: number;
}

// Composant réutilisable pour basculer entre le flux de posts et l'espace de tickets
export const ChannelTabSelector: React.FC<ChannelTabSelectorProps> = ({
  activeTab,
  onTabChange,
  postsCount,
  ticketsCount,
}) => {
  return (
    <div className="channel-tab-selector-component" role="tablist" aria-label="Catégories du canal">
      {/* Onglet Posts & Discussions */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "posts"}
        className={`tab-item ${activeTab === "posts" ? "active" : ""}`}
        onClick={() => onTabChange("posts")}
      >
        <span className="tab-icon">💬</span>
        <span className="tab-label">Posts & Discussions</span>
        <span className="tab-counter-badge">{postsCount}</span>
      </button>

      {/* Onglet Tickets d'entraide */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "tickets"}
        className={`tab-item ${activeTab === "tickets" ? "active" : ""}`}
        onClick={() => onTabChange("tickets")}
      >
        <span className="tab-icon">🎫</span>
        <span className="tab-label">Tickets d'entraide</span>
        <span className="tab-counter-badge tickets">{ticketsCount}</span>
      </button>
    </div>
  );
};
