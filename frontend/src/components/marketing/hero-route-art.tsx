/** Decorative SVG for hero / login brand column — theme via currentColor */
export function HeroRouteArt({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M20 200 Q80 120 140 140 T260 100"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="6 8"
        className="text-border-accent opacity-80"
      />
      <circle cx="20" cy="200" r="6" className="fill-accent-blue/40" />
      <circle cx="260" cy="100" r="8" className="fill-accent-amber/50" />
      <g className="text-accent-amber" transform="translate(175 118)">
        <path
          d="M4 2L22 8L22 18L4 24L4 2Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <rect x="8" y="10" width="10" height="6" rx="1" fill="currentColor" fillOpacity="0.5" />
      </g>
      <path
        d="M40 240h240"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-border-default opacity-50"
      />
    </svg>
  );
}
