import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, EmptyState, ErrorState, LoadingState, Tag } from "../../components/ui";
import { STATUS_LABELS, STATUS_TAG_VARIANT } from "../../lib/statusTags";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function PatientAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/appointments/mine", { token })
      .then((data) => {
        const found = data.appointments.find((a) => a.id === appointmentId);
        setAppointment(found ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, appointmentId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!appointment) return <EmptyState label="Appointment not found." />;

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/patient/appointments")}>
        ← My appointments
      </Button>
      <h1>Visit summary — {formatDate(appointment.slotStart)}</h1>
      <p className="muted">
        {appointment.doctorProfile.user.name} · {appointment.doctorProfile.specialisation}{" "}
        <Tag variant={STATUS_TAG_VARIANT[appointment.status] ?? "neutral"}>
          {STATUS_LABELS[appointment.status] ?? appointment.status}
        </Tag>
      </p>
      <hr className="hr" />

      <div className="split">
        <div className="split-left">
          <span className="kicker">In plain language</span>
          {appointment.postVisitSummary ? (
            <>
              <p style={{ fontSize: "17px", lineHeight: 1.5, maxWidth: "58ch", whiteSpace: "pre-wrap" }}>
                {appointment.postVisitSummary.summaryText}
              </p>
              {appointment.postVisitSummary.followUpSteps?.length > 0 && (
                <>
                  <hr className="hr" />
                  <h3>Follow-up steps</h3>
                  <ol style={{ fontSize: "15px", paddingLeft: "20px" }}>
                    {appointment.postVisitSummary.followUpSteps.map((step, i) => (
                      <li key={i} style={{ marginBottom: "var(--space-2)" }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <hr className="hr" />
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Tag variant="outline">AI generated</Tag>
                <span className="muted" style={{ fontSize: "12px" }}>
                  Written from the doctor&apos;s clinical notes.
                  {appointment.postVisitSummary.isFallback && " (AI unavailable — showing basic info)"}
                </span>
              </div>
            </>
          ) : (
            <EmptyState label="The visit summary will appear here after your appointment is completed." />
          )}

          {appointment.preVisitSummary && (
            <>
              <hr className="hr" />
              <span className="kicker">Pre-visit summary</span>
              <p className="muted">Urgency: {appointment.preVisitSummary.urgencyLevel}</p>
              <p>{appointment.preVisitSummary.chiefComplaint}</p>
            </>
          )}
        </div>

        <div className="split-right">
          <span className="kicker">Prescription</span>
          {appointment.postVisitNote?.prescriptions?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Dose</th>
                  <th>Frequency</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {appointment.postVisitNote.prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 800 }}>{p.drugName}</td>
                    <td>{p.dosage}</td>
                    <td>{p.frequency}</td>
                    <td className="tabular">{p.durationDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState label="No prescriptions on this visit." />
          )}

          {appointment.postVisitNote?.prescriptions?.length > 0 && (
            <>
              <h3 style={{ marginTop: "var(--space-4)" }}>Medication reminders</h3>
              <p className="muted" style={{ fontSize: "12px" }}>
                Reminder times are generated automatically from each prescription&apos;s frequency and sent
                by email.
              </p>
            </>
          )}
        </div>
      </div>

      <hr className="hr" />
      <Link to="/patient/appointments" className="muted">
        Back to all appointments
      </Link>
    </div>
  );
}
