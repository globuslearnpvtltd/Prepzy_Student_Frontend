/**
 * NEET's chalkboard of physics / chemistry / biology notation, shown behind the lecture player until
 * playback starts (the player itself is the shared lecture player from @/features/learn/ui).
 */
export function FormulaBackdrop() {
  const formula = 'fill-on-brand font-serif';
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="800" height="450" className="fill-night-950" />
      <text x="40" y="70" fillOpacity="0.14" fontSize="26" className={formula} transform="rotate(-4 40 70)">E = mc²</text>
      <text x="640" y="60" fillOpacity="0.12" fontSize="20" className={formula} transform="rotate(3 640 60)">v = u + at</text>
      <text x="590" y="140" fillOpacity="0.1" fontSize="18" className={formula}>F = q(v × B)</text>
      <text x="30" y="230" fillOpacity="0.1" fontSize="18" className={formula}>λ = h / mv</text>
      <text x="330" y="34" fillOpacity="0.1" fontSize="16" className={formula}>T = 2π√(m/k)</text>
      <text x="470" y="250" fillOpacity="0.12" fontSize="20" className={formula}>PV = nRT</text>
      <text x="90" y="330" fillOpacity="0.1" fontSize="18" className={formula}>ΔG = ΔH − TΔS</text>
      <g transform="translate(700,300)" className="stroke-on-brand" strokeOpacity="0.14" fill="none" strokeWidth="1.5">
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" />
        <line x1="0" y1="-22" x2="0" y2="-32" />
        <line x1="19" y1="11" x2="30" y2="17" />
        <line x1="-19" y1="11" x2="-30" y2="17" />
      </g>
      <g className="stroke-on-brand" strokeOpacity="0.12" fill="none" strokeWidth="1.5">
        <path d="M120 380 C150 355, 150 405, 180 380 C210 355, 210 405, 240 380" />
        <path d="M120 380 C150 405, 150 355, 180 380 C210 405, 210 355, 240 380" />
        <line x1="135" y1="380" x2="165" y2="380" />
        <line x1="195" y1="380" x2="225" y2="380" />
      </g>
      <g className="stroke-on-brand" strokeOpacity="0.12" fill="none" strokeWidth="1.2">
        <line x1="380" y1="330" x2="620" y2="330" strokeDasharray="4 4" />
        <ellipse cx="470" cy="330" rx="10" ry="42" />
        <line x1="380" y1="300" x2="470" y2="330" />
        <line x1="470" y1="330" x2="600" y2="300" />
        <line x1="470" y1="330" x2="600" y2="360" />
      </g>
      <text x="230" y="130" fillOpacity="0.08" fontSize="42" className={formula}>∫</text>
      <text x="500" y="410" fillOpacity="0.09" fontSize="18" className={formula}>ω = √(k/m)</text>
    </svg>
  );
}
