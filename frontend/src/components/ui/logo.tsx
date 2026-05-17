import React from "react";

export function OrkestriLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="orkestri-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#C026D3" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
      
      {/* Background Rounded Square */}
      <rect width="120" height="120" rx="30" fill="url(#orkestri-grad)" />

      {/* The "Ok" Symbol */}
      <g stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* The 'O' */}
        <circle cx="44" cy="60" r="18" />
        
        {/* The 'k' stem */}
        <path d="M 72 35 L 72 78" />
        
        {/* The 'k' branches */}
        <path d="M 92 45 L 72 60 L 92 78" />
      </g>
    </svg>
  );
}
