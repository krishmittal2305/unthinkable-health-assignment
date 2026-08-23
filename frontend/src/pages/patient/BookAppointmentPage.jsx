import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";

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

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
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
  const [holdExpired, setHoldExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [symptomForm, setSymptomForm] = useState({ symptoms: "", durationDays: "", severity: "" });
  const [confirmError, setConfirmError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showGeneratingHint, setShowGeneratingHint] = useState(false);
  const generatingHintTimer = useRef(null);

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

  useEffect(() => {
    if (!hold) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hold]);

  useEffect(() => {
    if (!hold) return;
    const remaining = new Date(hold.expiresAt).getTime() - now;
    if (remaining <= 0) {
      setHold(null);
      setHoldExpired(true);
    }
  }, [hold, now]);

  async function handleSelectSlot(slot) {
    setHoldError(null);
    setHoldExpired(false);
    try {
      const data = await apiFetch("/api/appointments/hold", {
        method: "POST",
        token,
        body: { doctorId, slotStart: slot.slotStart },
      });
      setHold(data.hold);
      setNow(Date.now());
    } catch (err) {
      setHoldError(err.message);
      apiFetch(`/api/doctors/${doctorId}/availability?date=${date}`).then(setAvailability);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setConfirmError(null);
    setSubmitting(true);
    generatingHintTimer.current = setTimeout(() => setShowGeneratingHint(true), 1000);
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
      clearTimeout(generatingHintTimer.current);
      setShowGeneratingHint(false);
      setSubmitting(false);
    }
  }

  function cancelHold() {
    setHold(null);
    setConfirmError(null);
  }

  const remainingMs = hold ? new Date(hold.expiresAt).getTime() - now : 0;

  return (
    <div>
      <h1>Book with {doctor ? doctor.name : "..."}</h1>
      {doctor && <p className="muted">{doctor.specialisation}</p>}

      {!hold && (
        <Card>
          <h2>Choose a date and time</h2>
          <label>
            Date
            <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </label>

          {loadingSlots && <LoadingState label="Loading slots..." />}
          {slotError && <ErrorState message={slotError} />}
          {holdError && <ErrorState message={holdError} />}
          {holdExpired && <ErrorState message="Your hold expired. Please select a slot again." />}

          {!loadingSlots && availability?.onLeave && (
            <EmptyState label="The doctor is on leave this day. Please pick another date." />
          )}
          {!loadingSlots && !availability?.onLeave && availability?.slots.length === 0 && (
            <EmptyState label="No slots available this day." />
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
            {availability?.slots.map((slot) => (
              <Button key={slot.slotStart} onClick={() => handleSelectSlot(slot)}>
                {formatSlotTime(slot.slotStart)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {hold && (
        <Card>
          <h2>Describe your symptoms</h2>
          <p className="muted">
            Slot held: {formatSlotTime(hold.slotStart)} — expires in {formatRemaining(remainingMs)}
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
            {confirmError && <ErrorState message={confirmError} />}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Confirming..." : "Confirm booking"}
              </Button>
              <Button variant="outline" type="button" onClick={cancelHold} disabled={submitting}>
                Choose a different slot
              </Button>
              {showGeneratingHint && (
                <span className="muted">Generating AI summary — this can take a few seconds</span>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
