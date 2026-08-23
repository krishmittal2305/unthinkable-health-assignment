import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const STATUS_LABELS = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED_BY_PATIENT: "Cancelled by patient",
  CANCELLED_BY_DOCTOR: "Cancelled by doctor",
  CANCELLED_BY_LEAVE: "Cancelled (leave)",
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

export default function AdminAppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/admin/appointments", { token })
      .then((data) => setAppointments(data.appointments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

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

      {loading && <p>Loading...</p>}
      {error && <p className="form-error">{error}</p>}

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
              <td colSpan={5} className="muted">
                No appointments found.
              </td>
            </tr>
          )}
          {visible.map((appointment) => (
            <tr key={appointment.id}>
              <td>{appointment.patient.name}</td>
              <td>{appointment.doctorProfile.user.name}</td>
              <td>{appointment.doctorProfile.specialisation}</td>
              <td>{formatSlotTime(appointment.slotStart)}</td>
              <td>{STATUS_LABELS[appointment.status] ?? appointment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
