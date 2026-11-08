/** Logo Wema : le carré jaune « W » et le nom, en vectoriel (net à toute taille). */
export function WemaLogo({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 132 36"
      role="img"
      aria-label="Wema"
      className={className}
      fill="none"
    >
      <rect x="1" y="3" width="30" height="30" rx="9" fill="#FFC529" />
      <path
        d="M8.2 11.5h2.9l2.3 9.1 2.4-9.1h2.4l2.4 9.1 2.3-9.1h2.9l-3.8 13h-2.7l-2.3-8.6-2.3 8.6h-2.7z"
        fill="#1A1403"
      />
      <text
        x="40"
        y="25.5"
        fill="currentColor"
        fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.6"
      >
        Wema
      </text>
    </svg>
  );
}
