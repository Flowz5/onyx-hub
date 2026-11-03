import React from "react";

interface OnyxLogoProps {
  size?: number;
  className?: string;
  showHexHalo?: boolean;
}

// Rendu vectoriel du logo géométrique Onyx
export const OnyxLogo: React.FC<OnyxLogoProps> = ({
  size = 96,
  className = "",
  showHexHalo = true,
}) => {
  return (
    <div
      className={`onyx-logo-wrapper ${className}`}
      style={{ width: size, height: size, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        {/* Anneaux hexagonaux concentriques en arrière-plan (style architectural / brut) */}
        {showHexHalo && (
          <>
            <polygon
              points="60,6 106,32 106,88 60,114 14,88 14,32"
              stroke="#FCA311"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.3"
            />
            <polygon
              points="60,16 97,37 97,83 60,104 23,83 23,37"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              opacity="0.2"
            />
          </>
        )}

        {/* Pierre précieuse d'Onyx à facettes isométriques */}
        <g filter="drop-shadow(0px 8px 24px rgba(0, 0, 0, 0.45))">
          {/* Facette supérieure illuminée (doré / orange vibrant de la palette) */}
          <polygon
            points="60,26 90,43 60,57 30,43"
            fill="#FCA311"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Facette latérale gauche (Bleu Prusse profond) */}
          <polygon
            points="30,43 60,57 60,94 30,76"
            fill="#14213D"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Facette latérale droite (Noir Onyx minéral) */}
          <polygon
            points="90,43 60,57 60,94 90,76"
            fill="#05080E"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Arête centrale réflective et point d'impact lumineux */}
          <line
            x1="60"
            y1="57"
            x2="60"
            y2="94"
            stroke="#FCA311"
            strokeWidth="2"
            opacity="0.8"
          />
          <circle cx="60" cy="57" r="3" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
};
