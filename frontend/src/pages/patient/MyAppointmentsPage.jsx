import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const STATUS_LABELS = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED_BY_PATIENT: "Cancelled by you",
  CANCELLED_BY_DOCTOR: "Cancelled by doctor",
  CANCELLED_BY_LEAVE: "Cancelled (doctor on leave)",
  NO_SHOW: "No-show",
};

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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/appointments/mine", { token });
      setAppointments(data.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

  }, []);

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
      {loading && <p>Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {!loading && appointments.length === 0 && <p className="muted">No appointments yet.</p>}

        {appointments.map((appointment) => (
          <div key={appointment.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{appointment.doctorProfile.user.name}</strong>
                <span className="muted"> · {appointment.doctorProfile.specialisation}</span>
                <p className="muted">{formatSlotTime(appointment.slotStart)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span>{STATUS_LABELS[appointment.status] ?? appointment.status}</span>
                {appointment.status === "BOOKED" && (
                  <div>
                    <button
                      className="button-danger"
                      onClick={() => handleCancel(appointment.id)}
                      disabled={cancellingId === appointment.id}
                    >
                      {cancellingId === appointment.id ? "Cancelling..." : "Cancel"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {appointment.preVisitSummary && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h3 style={{ fontSize: "15px", margin: "0 0 4px" }}>
                  Pre-visit summary
                  {appointment.preVisitSummary.isFallback && (
                    <span className="muted"> (AI summary unavailable — showing basic info)</span>
                  )}
                </h3>
                <p className="muted">Urgency: {appointment.preVisitSummary.urgencyLevel}</p>
                <p>{appointment.preVisitSummary.chiefComplaint}</p>
              </div>
            )}

            {appointment.postVisitSummary && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h3 style={{ fontSize: "15px", margin: "0 0 4px" }}>
                  Visit summary
                  {appointment.postVisitSummary.isFallback && (
                    <span className="muted"> (AI summary unavailable)</span>
                  )}
                </h3>
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
                <h3 style={{ fontSize: "15px", margin: "0 0 4px" }}>Prescription</h3>
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
          </div>
        ))}
      </div>
    </div>
  );
}
