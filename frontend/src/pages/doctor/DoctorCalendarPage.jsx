import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AiStatusBanner, Button, Card, ErrorState } from "../../components/ui";

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
      <h1>Google Calendar</h1>

      {status === "connected" && (
        <Card>
          <p>Your Google Calendar is connected. New bookings and cancellations will sync automatically.</p>
        </Card>
      )}

      {status === "error" && (
        <Card>
          <AiStatusBanner message={reason ? `Connection failed: ${reason}` : "Connection failed."} />
          <p className="muted">You can try connecting again below.</p>
        </Card>
      )}

      <Card>
        <h2>Connect your calendar</h2>
        <p className="muted">
          Connecting lets booked appointments create a Google Calendar event automatically, with the
          patient added as an attendee. Booking and cancellation always work whether or not this is
          connected.
        </p>
        {connectError && <ErrorState message={connectError} />}
        <div style={{ marginTop: "12px" }}>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? "Redirecting..." : "Connect Google Calendar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
