import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatSlotTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookAppointmentPage() {
  const { doctorId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState(null);

  const [hold, setHold] = useState(null);
  const [holdError, setHoldError] = useState(null);

  const [symptomForm, setSymptomForm] = useState({ symptoms: "", durationDays: "", severity: "" });
  const [confirmError, setConfirmError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch(`/api/doctors/${doctorId}`)
      .then((data) => setDoctor(data.doctor))
      .catch((err) => setSlotError(err.message));
  }, [doctorId]);

  useEffect(() => {
    setLoadingSlots(true);
    setSlotError(null);
    setHold(null);
    apiFetch(`/api/doctors/${doctorId}/availability?date=${date}`)
      .then(setAvailability)
      .catch((err) => setSlotError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  async function handleSelectSlot(slot) {
    setHoldError(null);
    try {
      const data = await apiFetch("/api/appointments/hold", {
        method: "POST",
        token,
        body: { doctorId, slotStart: slot.slotStart },
      });
      setHold(data.hold);
    } catch (err) {
      setHoldError(err.message);

      apiFetch(`/api/doctors/${doctorId}/availability?date=${date}`).then(setAvailability);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setConfirmError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/appointments/confirm", {
        method: "POST",
        token,
        body: {
          holdId: hold.id,
          symptoms: symptomForm.symptoms,
          durationDays: symptomForm.durationDays ? Number(symptomForm.durationDays) : undefined,
          severity: symptomForm.severity || undefined,
        },
      });
      navigate("/patient/appointments");
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelHold() {
    setHold(null);
    setConfirmError(null);
  }

  return (
    <div>
      <h1>Book with {doctor ? doctor.name : "..."}</h1>
      {doctor && <p className="muted">{doctor.specialisation}</p>}

      {!hold && (
        <section className="card">
          <h2>Choose a date and time</h2>
          <label>
            Date
            <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </label>

          {loadingSlots && <p>Loading slots...</p>}
          {slotError && <p className="form-error">{slotError}</p>}
          {holdError && <p className="form-error">{holdError}</p>}

          {!loadingSlots && availability?.onLeave && (
            <p className="muted">The doctor is on leave this day. Please pick another date.</p>
          )}
          {!loadingSlots && !availability?.onLeave && availability?.slots.length === 0 && (
            <p className="muted">No slots available this day.</p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
            {availability?.slots.map((slot) => (
              <button key={slot.slotStart} onClick={() => handleSelectSlot(slot)} className="button-secondary">
                {formatSlotTime(slot.slotStart)}
              </button>
            ))}
          </div>
        </section>
      )}

      {hold && (
        <section className="card">
          <h2>Describe your symptoms</h2>
          <p className="muted">
            Slot held: {formatSlotTime(hold.slotStart)} — please complete this within 5 minutes.
          </p>
          <form onSubmit={handleConfirm} className="form">
            <label>
              Symptoms
              <textarea
                rows={4}
                value={symptomForm.symptoms}
                onChange={(e) => setSymptomForm({ ...symptomForm, symptoms: e.target.value })}
                required
              />
            </label>
            <label>
              How many days have you had these symptoms? (optional)
              <input
                type="number"
                min={0}
                value={symptomForm.durationDays}
                onChange={(e) => setSymptomForm({ ...symptomForm, durationDays: e.target.value })}
              />
            </label>
            <label>
              Severity (optional)
              <input
                value={symptomForm.severity}
                onChange={(e) => setSymptomForm({ ...symptomForm, severity: e.target.value })}
                placeholder="mild / moderate / severe"
              />
            </label>
            {confirmError && <p className="form-error">{confirmError}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={submitting}>
                {submitting ? "Confirming..." : "Confirm booking"}
              </button>
              <button type="button" className="button-secondary" onClick={cancelHold} disabled={submitting}>
                Choose a different slot
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
