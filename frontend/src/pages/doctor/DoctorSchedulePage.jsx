import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

const URGENCY_COLORS = { HIGH: "#d64545", MEDIUM: "#c88a1a", LOW: "#2f9e44" };

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

  useEffect(() => {
    apiFetch("/api/doctor/appointments", { token })
      .then((data) => setAppointments(data.appointments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <h1>My schedule</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Time</th>
            <th>Status</th>
            <th>Urgency</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {!loading && appointments.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No appointments yet.
              </td>
            </tr>
          )}
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>{appointment.patient.name}</td>
              <td>{formatSlotTime(appointment.slotStart)}</td>
              <td>{STATUS_LABELS[appointment.status] ?? appointment.status}</td>
              <td>
                {appointment.preVisitSummary && (
                  <span style={{ color: URGENCY_COLORS[appointment.preVisitSummary.urgencyLevel] ?? "inherit" }}>
                    {appointment.preVisitSummary.urgencyLevel}
                  </span>
                )}
              </td>
              <td>
                <Link to={`/doctor/appointments/${appointment.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
