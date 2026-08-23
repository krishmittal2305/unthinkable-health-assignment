import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AiStatusBanner, Button, Card, EmptyState, ErrorState, LoadingState, Pill } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";

const STATUS_LABELS = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED_BY_PATIENT: "Cancelled by you",
  CANCELLED_BY_DOCTOR: "Cancelled by doctor",
  CANCELLED_BY_LEAVE: "Cancelled (doctor on leave)",
  NO_SHOW: "No-show",
};

const STATUS_TONE = {
  BOOKED: "blue",
  COMPLETED: "green",
  CANCELLED_BY_PATIENT: "orange",
  CANCELLED_BY_DOCTOR: "orange",
  CANCELLED_BY_LEAVE: "red",
  NO_SHOW: "pink",
};

const URGENCY_TONE = { LOW: "green", MEDIUM: "yellow", HIGH: "red" };

function formatSlotTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyAppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch("/api/appointments/mine", { token });
      setAppointments(data.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  usePolling(load, 25000);

  async function handleCancel(appointmentId) {
    if (!confirm("Cancel this appointment?")) return;
    setCancellingId(appointmentId);
    try {
      await apiFetch(`/api/appointments/${appointmentId}/cancel`, { method: "POST", token });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <h1>My appointments</h1>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {!loading && appointments.length === 0 && <EmptyState label="No appointments yet." />}

        {appointments.map((appointment) => (
          <Card key={appointment.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{appointment.doctorProfile.user.name}</strong>
                <span className="muted"> · {appointment.doctorProfile.specialisation}</span>
                <p className="muted">{formatSlotTime(appointment.slotStart)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Pill tone={STATUS_TONE[appointment.status] ?? "blue"}>
                  {STATUS_LABELS[appointment.status] ?? appointment.status}
                </Pill>
                {appointment.status === "BOOKED" && (
                  <div style={{ marginTop: "8px" }}>
                    <Button
                      variant="danger"
                      onClick={() => handleCancel(appointment.id)}
                      disabled={cancellingId === appointment.id}
                    >
                      {cancellingId === appointment.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {appointment.preVisitSummary && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h3>Pre-visit summary</h3>
                {appointment.preVisitSummary.isFallback && (
                  <AiStatusBanner message="AI summary unavailable — showing basic info" />
                )}
                <p style={{ marginBottom: "6px" }}>
                  <Pill tone={URGENCY_TONE[appointment.preVisitSummary.urgencyLevel] ?? "blue"}>
                    {appointment.preVisitSummary.urgencyLevel}
                  </Pill>
                </p>
                <p>{appointment.preVisitSummary.chiefComplaint}</p>
              </div>
            )}

            {appointment.postVisitSummary && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h3>Visit summary</h3>
                {appointment.postVisitSummary.isFallback && <AiStatusBanner message="AI summary unavailable" />}
                <p style={{ whiteSpace: "pre-wrap" }}>{appointment.postVisitSummary.summaryText}</p>
                {appointment.postVisitSummary.followUpSteps?.length > 0 && (
                  <ul>
                    {appointment.postVisitSummary.followUpSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {appointment.postVisitNote?.prescriptions?.length > 0 && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h3>Prescription</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Drug</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointment.postVisitNote.prescriptions.map((p) => (
                      <tr key={p.id}>
                        <td>{p.drugName}</td>
                        <td>{p.dosage}</td>
                        <td>{p.frequency}</td>
                        <td>{p.durationDays} day(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
