const posterStyle = {
  background: "var(--color-accent)",
  color: "var(--color-bg)",
  minHeight: "100svh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "var(--space-8)",
};

const lightDivider = "color-mix(in srgb, var(--color-bg) 40%, transparent)";

const STATS = [
  { label: "Hold window", value: "5 min" },
  { label: "Double bookings", value: "0" },
  { label: "AI summaries", value: "2" },
];

export default function AuthLayout({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100svh" }} className="auth-grid">
      <div style={posterStyle}>
        <span style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          Healthcare Appointment Manager
        </span>
        <div>
          <h1 style={{ color: "var(--color-bg)", fontSize: "54px", maxWidth: "14ch" }}>
            Symptoms in advance. Summaries after. Nothing lost between.
          </h1>
          <hr style={{ border: "none", borderTop: `2px solid ${lightDivider}`, margin: "var(--space-6) 0" }} />
          <div style={{ display: "flex", gap: 0 }}>
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  borderLeft: i > 0 ? `1px solid ${lightDivider}` : "none",
                  padding: "0 var(--space-4)",
                  paddingLeft: i === 0 ? 0 : "var(--space-4)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: 0.8,
                  }}
                >
                  {stat.label}
                </span>
                <span className="tabular" style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "22px" }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Patient · Doctor · Admin portals
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "var(--space-8)" }}>
        <div style={{ maxWidth: "480px", width: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
