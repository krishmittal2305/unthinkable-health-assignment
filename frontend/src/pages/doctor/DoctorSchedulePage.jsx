import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  return (
    <div>
      <h1>My schedule</h1>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

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
              <td colSpan={5}>
                <EmptyState label="No appointments yet." />
              </td>
            </tr>
          )}
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>{appointment.patient.name}</td>
              <td>{formatSlotTime(appointment.slotStart)}</td>
              <td>
                <Pill tone={STATUS_TONE[appointment.status] ?? "blue"}>
                  {STATUS_LABELS[appointment.status] ?? appointment.status}
                </Pill>
              </td>
              <td>
                {appointment.preVisitSummary && (
                  <Pill tone={URGENCY_TONE[appointment.preVisitSummary.urgencyLevel] ?? "blue"}>
                    {appointment.preVisitSummary.urgencyLevel}
                  </Pill>
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
