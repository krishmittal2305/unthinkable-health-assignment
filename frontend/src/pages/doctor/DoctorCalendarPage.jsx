import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, ErrorState } from "../../components/ui";

export default function DoctorCalendarPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const reason = searchParams.get("reason");

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);

  async function handleConnect() {
    setConnectError(null);
    setConnecting(true);
    try {
      const data = await apiFetch("/api/doctor/calendar/connect", { token });
      window.location.href = data.authUrl;
    } catch (err) {
      setConnectError(err.message);
      setConnecting(false);
    }
  }

  return (
    <div>
      <span className="kicker">Integrations</span>
      <h1>Google Calendar</h1>
      <hr className="hr" />

      {status === "connected" && (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <span className="card-kicker">Connected</span>
          <p className="card-body">
            Your Google Calendar is connected. New bookings and cancellations will sync automatically.
          </p>
        </Card>
      )}

      {status === "error" && (
        <div
          style={{
            border: "1px solid var(--color-divider)",
            background: "var(--color-surface)",
            padding: "var(--space-3)",
            marginBottom: "var(--space-4)",
          }}
        >
          <p style={{ fontSize: "13px" }}>{reason ? `Connection failed: ${reason}` : "Connection failed."}</p>
          <p className="muted" style={{ fontSize: "12px" }}>You can try connecting again below.</p>
        </div>
      )}

      <Card>
        <span className="card-kicker">Connect your calendar</span>
        <p className="card-body">
          Connecting lets booked appointments create a Google Calendar event automatically, with the
          patient added as an attendee. Booking and cancellation always work whether or not this is
          connected.
        </p>
        {connectError && <ErrorState message={connectError} />}
        <div style={{ marginTop: "var(--space-3)" }}>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? "Redirecting..." : "Connect Google Calendar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
