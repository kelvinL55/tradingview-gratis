import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "h-7 w-7", size = 28 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="tkl-blue-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2962FF" />
          <stop offset="1" stopColor="#00B0FF" />
        </linearGradient>
        <linearGradient id="tkl-bolt-grad" x1="12" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" />
          <stop offset="0.5" stopColor="#2962FF" />
          <stop offset="1" stopColor="#00B0FF" />
        </linearGradient>
        <linearGradient id="tkl-k-stem" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#90CAF9" />
        </linearGradient>
      </defs>

      {/* Hexagonal Tech Frame */}
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#0E131F" stroke="url(#tkl-blue-grad)" strokeWidth="1.5" />

      {/* Vertical Stem of K */}
      <rect x="7" y="7" width="3.5" height="18" rx="1.75" fill="url(#tkl-k-stem)" />

      {/* Lightning Bolt integrated with K arms */}
      <path
        d="M 23 7.5 C 23.5 7.5 24 8 23.6 8.5 L 14.5 15.5 L 18 16.5 C 18.6 16.6 18.8 17.4 18.3 17.8 L 9.5 24.5 C 9 24.9 8.4 24.3 8.7 23.8 L 17 17 L 13.5 15.5 C 12.9 15.3 12.8 14.5 13.3 14.1 L 22.2 7.2 C 22.4 7 22.7 7.5 23 7.5 Z"
        fill="url(#tkl-bolt-grad)"
      />
    </svg>
  );
}
