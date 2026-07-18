import React, { useEffect, useRef, useState } from "react";
import type { Node } from "../../types";
import type { LiteratureType } from "../LiteratureExtract/LiteratureMetadataForm";
import LiteratureMetadataCard from "../LiteratureExtract/LiteratureMetadataCard";

interface LiteratureHoverCardProps {
  literature: {
    key: string;
    title: string;
    authors?: string[];
    year?: number;
    url?: string;
    fileName?: string;
    type?: string;
    journal?: string;
    doi?: string;
    keywords?: string[];
    abstract?: string;
    nodes: Node[];
  };
  position: { x: number; y: number };
  onNodeClick?: (node: Node) => void;
  isDark?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const LiteratureHoverCard: React.FC<LiteratureHoverCardProps> = ({
  literature,
  position,
  isDark = false,
  onMouseEnter,
  onMouseLeave,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x + 8;
    let adjustedY = position.y;

    // Check right boundary
    if (adjustedX + rect.width > viewportWidth - 16) {
      adjustedX = position.x - rect.width - 8;
    }

    // Check bottom boundary
    if (adjustedY + rect.height > viewportHeight - 16) {
      adjustedY = viewportHeight - rect.height - 16;
    }

    // Ensure not above viewport
    if (adjustedY < 16) {
      adjustedY = 16;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position]);

  return (
    <div
      ref={cardRef}
      className="fixed z-tooltip transition-opacity duration-200 animate-in fade-in zoom-in-95"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        maxWidth: "calc(100vw - 32px)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="w-[320px]">
      <LiteratureMetadataCard
        metadata={{
          title: literature.title,
          authors: literature.authors || [],
          year: literature.year,
          journal: literature.journal,
          type: (literature.type || "paper") as LiteratureType,
          doi: literature.doi,
          keywords: literature.keywords || [],
        }}
        isDark={isDark || false}
      />
      </div>
    </div>
  );
};

export default LiteratureHoverCard;
