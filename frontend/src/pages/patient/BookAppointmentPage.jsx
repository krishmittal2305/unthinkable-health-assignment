import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, EmptyState, ErrorState, Field, LoadingState } from "../../components/ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseIso, days) {
  const d = new Date(`${baseIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextSixDays() {
  const start = todayIso();
  return Array.from({ length: 6 }, (_, i) => addDaysIso(start, i));
}

function formatSlotTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
    day: d.toLocaleDateString(undefined, { day: "numeric", timeZone: "UTC" }),
  };
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const SEVERITY_OPTIONS = ["mild", "moderate", "severe"];

export default function BookAppointmentPage() {
  const { doctorId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const days = nextSixDays();

  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(days[0]);
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
      <Button variant="ghost" onClick={() => navigate("/patient")}>
        ← All doctors
      </Button>
      <h1>Book with {doctor ? doctor.name : "..."}</h1>
      {doctor && <p className="muted">{doctor.specialisation}</p>}
      <hr className="hr" />

      <div className="split">
        <div className="split-left">
          <span className="kicker">1 — Choose a slot</span>

          <div style={{ display: "inline-flex", border: "1px solid var(--color-divider)", marginBottom: "var(--space-4)" }}>
            {days.map((iso, i) => {
              const label = formatDayLabel(iso);
              const selected = iso === date;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setDate(iso)}
                  className={selected ? "pill-on" : "pill-off"}
                  style={{
                    border: "none",
                    borderLeft: i > 0 ? "1px solid var(--color-divider)" : "none",
                    background: selected ? undefined : "transparent",
                    padding: "var(--space-2) var(--space-3)",
                    cursor: "pointer",
                    textAlign: "center",
                    minWidth: "56px",
                  }}
                >
                  <span style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label.weekday}
                  </span>
                  <span className="tabular" style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "16px" }}>
                    {label.day}
                  </span>
                </button>
              );
            })}
          </div>

          {loadingSlots && <LoadingState label="Loading slots..." />}
          {slotError && <ErrorState message={slotError} />}
          {holdError && <ErrorState message={holdError} />}
          {holdExpired && <ErrorState message="Your hold expired. Please select a slot again." />}

          {!loadingSlots && availability?.onLeave && <EmptyState label="The doctor is on leave this day. Please pick another date." />}
          {!loadingSlots && !availability?.onLeave && availability?.slots.length === 0 && (
            <EmptyState label="No slots available this day." />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: "8px" }}>
            {availability?.slots.map((slot) => {
              const isHeld = hold?.slotStart === slot.slotStart;
              return (
                <Button
                  key={slot.slotStart}
                  variant={isHeld ? "primary" : "secondary"}
                  onClick={() => handleSelectSlot(slot)}
                >
                  <span className="tabular">{formatSlotTime(slot.slotStart)}</span>
                </Button>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: "12px", marginTop: "var(--space-3)" }}>
            Outline = free · solid = your hold · greyed out = taken or held by another patient.
          </p>
        </div>

        <div className="split-right">
          {!hold && (
            <div className="card">
              <span className="card-kicker">How holds work</span>
              <p className="card-body">
                Selecting a slot holds it for you for 5 minutes while you fill in the symptom form. If the
                hold expires before you confirm, the slot is released back for other patients.
              </p>
            </div>
          )}

          {hold && (
            <>
              <div
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-3) var(--space-4)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  Held: <span className="tabular">{formatSlotTime(hold.slotStart)}</span>
                </span>
                <span className="tabular" style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "22px" }}>
                  {formatRemaining(remainingMs)}
                </span>
              </div>

              <form onSubmit={handleConfirm} className="form">
                <Field label="Symptoms">
                  <textarea
                    className="input"
                    rows={4}
                    value={symptomForm.symptoms}
                    onChange={(e) => setSymptomForm({ ...symptomForm, symptoms: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Days so far (optional)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={symptomForm.durationDays}
                    onChange={(e) => setSymptomForm({ ...symptomForm, durationDays: e.target.value })}
                  />
                </Field>
                <Field label="Severity (optional)">
                  <div className="segmented">
                    {SEVERITY_OPTIONS.map((option, i) => (
                      <button
                        key={option}
                        type="button"
                        className={symptomForm.severity === option ? "pill-on" : "pill-off"}
                        style={{ borderLeft: i > 0 ? "1px solid var(--color-divider)" : "none" }}
                        onClick={() =>
                          setSymptomForm({
                            ...symptomForm,
                            severity: symptomForm.severity === option ? "" : option,
                          })
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </Field>
                {confirmError && <ErrorState message={confirmError} />}
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Confirming..." : "Confirm booking"}
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelHold} disabled={submitting}>
                    Choose another slot
                  </Button>
                </div>
                {showGeneratingHint && (
                  <span className="muted" style={{ fontSize: "12px" }}>
                    Generating AI summary — this can take a few seconds
                  </span>
                )}
                <p className="muted" style={{ fontSize: "12px" }}>
                  Confirming books the slot, generates an AI pre-visit summary for the doctor, and emails a
                  confirmation to you both.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
