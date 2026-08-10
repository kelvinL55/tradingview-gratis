import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "h-7 w-7", size = 28 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Trading_KL Logo"
      className={className}
    >
      <defs>
        {/* Fondo */}
        <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#071426" />
          <stop offset="55%" stopColor="#050D1C" />
          <stop offset="100%" stopColor="#020711" />
        </linearGradient>

        {/* Azul eléctrico */}
        <linearGradient id="blueGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#19D3FF" />
          <stop offset="45%" stopColor="#078BFF" />
          <stop offset="100%" stopColor="#235CFF" />
        </linearGradient>

        {/* Amarillo / dorado */}
        <linearGradient id="yellowGradient" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFF200" />
          <stop offset="55%" stopColor="#FFD500" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>

        {/* Borde */}
        <linearGradient id="borderGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D9FF" />
          <stop offset="50%" stopColor="#0798FF" />
          <stop offset="100%" stopColor="#185DFF" />
        </linearGradient>

        {/* Glow azul */}
        <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glow amarillo */}
        <filter id="yellowGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo del icono */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="12"
        fill="url(#bgGradient)"
        stroke="url(#borderGradient)"
        strokeWidth="2"
        filter="url(#blueGlow)"
      />

      {/* Detalle interior sutil */}
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="9"
        fill="none"
        stroke="#168CFF"
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {/* Parte izquierda de la K */}
      <path
        d="
          M18 15
          Q18 13 20 14
          L24 17
          L24 32
          L20 39
          L20 49
          L18 48
          Z
        "
        fill="url(#yellowGradient)"
        filter="url(#yellowGlow)"
      />

      {/* Rayo / diagonal principal */}
      <path
        d="
          M46 12
          L28 29
          L34 32
          L23 48
          L43 29
          L36 29
          Z
        "
        fill="url(#yellowGradient)"
        filter="url(#yellowGlow)"
      />

      {/* L azul */}
      <path
        d="
          M36 35
          L36 45
          Q36 49 40 49
          L51 49
          Q53 49 52 47
          L49 44
          L42 44
          Q40 44 40 42
          L40 32
          Z
        "
        fill="url(#blueGradient)"
      />

      {/* Brillo pequeño sobre la L */}
      <path
        d="
          M37 35
          L39 33
          L39 42
          Q39 45 42 45
        "
        fill="none"
        stroke="#54DBFF"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}
