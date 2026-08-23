import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, ErrorState, LoadingState, Tag } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";
import { STATUS_LABELS, STATUS_TAG_VARIANT } from "../../lib/statusTags";

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

  const leaveCancelled = appointments.filter((a) => a.status === "CANCELLED_BY_LEAVE");

  return (
    <div>
      <span className="kicker">Your visits</span>
      <h1>My appointments</h1>
      <hr className="hr" />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && appointments.length === 0 && <EmptyState label="No appointments yet." />}

      {!loading && appointments.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Doctor</th>
              <th>Specialisation</th>
              <th>Status</th>
              <th>AI summaries</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td className="tabular">{formatSlotTime(appointment.slotStart)}</td>
                <td>{appointment.doctorProfile.user.name}</td>
                <td>{appointment.doctorProfile.specialisation}</td>
                <td>
                  <Tag variant={STATUS_TAG_VARIANT[appointment.status] ?? "neutral"}>
                    {STATUS_LABELS[appointment.status] ?? appointment.status}
                  </Tag>
                </td>
                <td className="muted" style={{ fontSize: "13px" }}>
                  {appointment.preVisitSummary && appointment.postVisitSummary
                    ? "Pre- and post-visit"
                    : appointment.preVisitSummary
                      ? "Pre-visit"
                      : appointment.postVisitSummary
                        ? "Post-visit"
                        : "—"}
                </td>
                <td>
                  <Link to={`/patient/appointments/${appointment.id}`} className="btn btn-ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {leaveCancelled.length > 0 && (
        <div
          style={{
            borderLeft: "3px solid var(--color-accent)",
            background: "var(--color-accent-100)",
            padding: "var(--space-3) var(--space-4)",
            fontSize: "13px",
            marginTop: "var(--space-6)",
          }}
        >
          {leaveCancelled.length} appointment{leaveCancelled.length > 1 ? "s were" : " was"} cancelled because
          the doctor was marked on leave for that date. You were emailed and can rebook a new slot at any
          time.
        </div>
      )}
    </div>
  );
}
