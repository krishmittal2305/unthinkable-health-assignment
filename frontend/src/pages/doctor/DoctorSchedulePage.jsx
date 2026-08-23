import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, ErrorState, LoadingState, Tag } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";
import { STATUS_LABELS, STATUS_TAG_VARIANT, URGENCY_BAR_CLASS, URGENCY_TAG_VARIANT } from "../../lib/statusTags";

function formatSlotTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DoctorSchedulePage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch("/api/doctor/appointments", { token });
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

  const highUrgency = appointments.filter((a) => a.preVisitSummary?.urgencyLevel === "HIGH").length;
  const awaitingNotes = appointments.filter((a) => a.status === "BOOKED" && !a.postVisitNote).length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div>
      <span className="kicker">Doctor</span>
      <h1>My schedule</h1>
      <p className="muted">Every appointment assigned to you, most recent first.</p>
      <hr className="hr" />

      <div className="stat-row">
        <div className="stat-cell">
          <span className="stat-label">Appointments</span>
          <span className="stat-value tabular">{appointments.length}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">High urgency</span>
          <span className="stat-value tabular">{highUrgency}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Awaiting notes</span>
          <span className="stat-value tabular">{awaitingNotes}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Completed</span>
          <span className="stat-value tabular">{completed}</span>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && appointments.length === 0 && <EmptyState label="No appointments yet." />}

      <div>
        {appointments.map((appointment) => {
          const urgency = appointment.preVisitSummary?.urgencyLevel;
          return (
            <Link
              key={appointment.id}
              to={`/doctor/appointments/${appointment.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "4px 72px minmax(140px, 1fr) minmax(180px, 2fr) auto auto",
                gap: "16px",
                alignItems: "center",
                borderBottom: "1px solid var(--color-divider)",
                padding: "var(--space-3) 0",
                color: "var(--color-text)",
                textDecoration: "none",
              }}
              className="schedule-row"
            >
              <span className={urgency ? URGENCY_BAR_CLASS[urgency] : ""} style={{ alignSelf: "stretch" }} />
              <span className="tabular" style={{ fontWeight: 800, fontSize: "13px" }}>
                {formatSlotTime(appointment.slotStart)}
              </span>
              <span style={{ fontSize: "15px" }}>{appointment.patient.name}</span>
              <span className="muted" style={{ fontSize: "13px" }}>
                {appointment.preVisitSummary?.chiefComplaint ?? "—"}
              </span>
              {urgency ? <Tag variant={URGENCY_TAG_VARIANT[urgency]}>{urgency}</Tag> : <span />}
              <Tag variant={STATUS_TAG_VARIANT[appointment.status] ?? "neutral"}>
                {STATUS_LABELS[appointment.status] ?? appointment.status}
              </Tag>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
