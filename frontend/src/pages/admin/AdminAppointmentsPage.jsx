import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, ErrorState, LoadingState, Pill } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";

const STATUS_LABELS = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED_BY_PATIENT: "Cancelled by patient",
  CANCELLED_BY_DOCTOR: "Cancelled by doctor",
  CANCELLED_BY_LEAVE: "Cancelled (leave)",
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

  return (
    <div>
      <h1>All appointments</h1>

      <label style={{ display: "inline-flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
        Filter by status
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      <table className="table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Specialisation</th>
            <th>Time</th>
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
              <td>{appointment.patient.name}</td>
              <td>{appointment.doctorProfile.user.name}</td>
              <td>{appointment.doctorProfile.specialisation}</td>
              <td>{formatSlotTime(appointment.slotStart)}</td>
              <td>
                <Pill tone={STATUS_TONE[appointment.status] ?? "blue"}>
                  {STATUS_LABELS[appointment.status] ?? appointment.status}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
