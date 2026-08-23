import { useCallback, useEffect, useState } from "react";
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

export default function AdminAppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch("/api/admin/appointments", { token });
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

  const visible = statusFilter === "ALL" ? appointments : appointments.filter((a) => a.status === statusFilter);

  const booked = appointments.filter((a) => a.status === "BOOKED").length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledByLeave = appointments.filter((a) => a.status === "CANCELLED_BY_LEAVE").length;

  const filters = ["ALL", ...Object.keys(STATUS_LABELS)];

  return (
    <div>
      <span className="kicker">Admin</span>
      <h1>All appointments</h1>
      <hr className="hr" />

      <div className="stat-row">
        <div className="stat-cell">
          <span className="stat-label">Total</span>
          <span className="stat-value tabular">{appointments.length}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Booked</span>
          <span className="stat-value tabular">{booked}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Completed</span>
          <span className="stat-value tabular">{completed}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Cancelled — leave</span>
          <span className="stat-value tabular">{cancelledByLeave}</span>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: "var(--space-4)" }}>
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={statusFilter === value ? "pill-on" : "pill-off"}
          >
            {value === "ALL" ? "All" : STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Specialisation</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {!loading && visible.length === 0 && (
            <tr>
              <td colSpan={5}>
                <EmptyState label="No appointments found." />
              </td>
            </tr>
          )}
          {visible.map((appointment) => (
            <tr key={appointment.id}>
              <td className="tabular">{formatSlotTime(appointment.slotStart)}</td>
              <td>{appointment.patient.name}</td>
              <td>{appointment.doctorProfile.user.name}</td>
              <td>{appointment.doctorProfile.specialisation}</td>
              <td>
                <Tag variant={STATUS_TAG_VARIANT[appointment.status] ?? "neutral"}>
                  {STATUS_LABELS[appointment.status] ?? appointment.status}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
