const TONE_VARS = {
  blue: { background: "var(--accent-blue)", color: "var(--on-blue)" },
  red: { background: "var(--accent-red)", color: "var(--on-red)" },
  pink: { background: "var(--accent-pink)", color: "var(--on-pink)" },
  green: { background: "var(--accent-green)", color: "var(--on-green)" },
  yellow: { background: "var(--accent-yellow)", color: "var(--on-yellow)" },
  orange: { background: "var(--accent-orange)", color: "var(--on-orange)" },
};

export default function Pill({ tone = "blue", children }) {
  return (
    <span className="pill" style={TONE_VARS[tone] ?? TONE_VARS.blue}>
      {children}
    </span>
  );
}
