import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, ErrorState, Field, LoadingState, Tag } from "../../components/ui";
import { STATUS_LABELS, STATUS_TAG_VARIANT } from "../../lib/statusTags";

const EMPTY_PRESCRIPTION = { drugName: "", dosage: "", frequency: "", durationDays: "" };

function formatSlotTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGeneratedAt(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DoctorAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState([{ ...EMPTY_PRESCRIPTION }]);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showGeneratingHint, setShowGeneratingHint] = useState(false);

  const [regeneratingPreVisit, setRegeneratingPreVisit] = useState(false);
  const [preVisitRegenerateError, setPreVisitRegenerateError] = useState(null);
  const [regeneratingPostVisit, setRegeneratingPostVisit] = useState(false);
  const [postVisitRegenerateError, setPostVisitRegenerateError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/doctor/appointments/${appointmentId}`, { token });
      setAppointment(data.appointment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [appointmentId]);

  async function handleRegeneratePreVisit() {
    setPreVisitRegenerateError(null);
    setRegeneratingPreVisit(true);
    try {
      const data = await apiFetch(`/api/doctor/appointments/${appointmentId}/regenerate-pre-visit-summary`, {
        method: "POST",
        token,
      });
      setAppointment((current) => ({ ...current, preVisitSummary: data.preVisitSummary }));
    } catch (err) {
      setPreVisitRegenerateError(err.message);
    } finally {
      setRegeneratingPreVisit(false);
    }
  }

  async function handleRegeneratePostVisit() {
    setPostVisitRegenerateError(null);
    setRegeneratingPostVisit(true);
    try {
      const data = await apiFetch(`/api/doctor/appointments/${appointmentId}/regenerate-post-visit-summary`, {
        method: "POST",
        token,
      });
      setAppointment((current) => ({ ...current, postVisitSummary: data.postVisitSummary }));
    } catch (err) {
      setPostVisitRegenerateError(err.message);
    } finally {
      setRegeneratingPostVisit(false);
    }
  }

  function updatePrescription(index, field, value) {
    setPrescriptions((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addPrescriptionRow() {
    setPrescriptions((rows) => [...rows, { ...EMPTY_PRESCRIPTION }]);
  }

  function removePrescriptionRow(index) {
    setPrescriptions((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmitNotes(event) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    const hintTimer = setTimeout(() => setShowGeneratingHint(true), 1000);
    try {
      const validPrescriptions = prescriptions
        .filter((p) => p.drugName.trim())
        .map((p) => ({ ...p, durationDays: Number(p.durationDays) || 1 }));

      await apiFetch(`/api/doctor/appointments/${appointmentId}/post-visit`, {
        method: "POST",
        token,
        body: { clinicalNotes, prescriptions: validPrescriptions },
      });
      await load();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      clearTimeout(hintTimer);
      setShowGeneratingHint(false);
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!appointment) return null;

  const preVisit = appointment.preVisitSummary;

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/doctor")}>
        ← Schedule
      </Button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "38px", marginBottom: "var(--space-1)" }}>{appointment.patient.name}</h1>
          <p className="muted">
            {formatSlotTime(appointment.slotStart)} · {appointment.patient.email}
            {appointment.patient.phone ? ` · ${appointment.patient.phone}` : ""}
          </p>
        </div>
        <Tag variant={STATUS_TAG_VARIANT[appointment.status] ?? "neutral"}>
          {STATUS_LABELS[appointment.status] ?? appointment.status}
        </Tag>
      </div>
      <hr className="hr" />

      <div className="split">
        <div className="split-left">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kicker">AI pre-visit summary</span>
            {preVisit && <Tag variant="outline">{formatGeneratedAt(preVisit.createdAt)}</Tag>}
          </div>

          {preVisit ? (
            <>
              <div
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                  padding: "var(--space-3) var(--space-4)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  marginBottom: "var(--space-4)",
                }}
              >
                <div>
                  <span style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Urgency
                  </span>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "30px" }}>
                    {preVisit.urgencyLevel}
                  </span>
                </div>
                <span style={{ fontSize: "13px", maxWidth: "40%", textAlign: "right" }}>
                  {preVisit.chiefComplaint}
                </span>
              </div>

              <span style={{ display: "block", fontSize: "13px", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                Chief complaint
              </span>
              <p style={{ fontSize: "17px", margin: "var(--space-1) 0 var(--space-3)" }}>{preVisit.chiefComplaint}</p>
              <hr className="hr" />

              {preVisit.suggestedQuestions?.length > 0 && (
                <>
                  <h3>Suggested questions</h3>
                  <ol style={{ fontSize: "15px", paddingLeft: "20px" }}>
                    {preVisit.suggestedQuestions.map((q, i) => (
                      <li key={i} style={{ marginBottom: "8px" }}>
                        {q}
                      </li>
                    ))}
                  </ol>
                  <hr className="hr" />
                </>
              )}

              {appointment.symptomForm && (
                <>
                  <h3>Reported by patient</h3>
                  <p style={{ fontSize: "15px" }}>&ldquo;{appointment.symptomForm.symptoms}&rdquo;</p>
                  <p className="muted" style={{ fontSize: "13px" }}>
                    {appointment.symptomForm.durationDays != null && `${appointment.symptomForm.durationDays} day(s)`}
                    {appointment.symptomForm.severity ? ` · ${appointment.symptomForm.severity}` : ""}
                  </p>
                </>
              )}

              {preVisit.isFallback && (
                <div
                  style={{
                    border: "1px solid var(--color-divider)",
                    background: "var(--color-surface)",
                    padding: "var(--space-3)",
                    marginTop: "var(--space-4)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>AI was unavailable — this is default content, not a real assessment.</span>
                  <Button variant="secondary" onClick={handleRegeneratePreVisit} disabled={regeneratingPreVisit}>
                    {regeneratingPreVisit ? "Regenerating..." : "Regenerate summary"}
                  </Button>
                </div>
              )}
              {preVisitRegenerateError && <ErrorState message={preVisitRegenerateError} />}
            </>
          ) : (
            <p className="muted">No symptom form was submitted for this booking.</p>
          )}
        </div>

        <div className="split-right">
          <span className="kicker">Post-visit notes</span>

          {appointment.status === "BOOKED" && (
            <form onSubmit={handleSubmitNotes} className="form">
              <Field label="Clinical notes">
                <textarea
                  className="input"
                  rows={4}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  required
                />
              </Field>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-2)" }}>
                <strong>Prescriptions</strong>
                <Button variant="ghost" type="button" onClick={addPrescriptionRow}>
                  + Add row
                </Button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1.3fr 62px 28px",
                  gap: "8px",
                  borderBottom: "2px solid var(--color-divider)",
                  paddingBottom: "var(--space-1)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                }}
              >
                <span>Drug</span>
                <span>Dose</span>
                <span>Frequency</span>
                <span>Days</span>
                <span></span>
              </div>
              {prescriptions.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1.3fr 62px 28px",
                    gap: "8px",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-divider)",
                    padding: "var(--space-2) 0",
                  }}
                >
                  <input
                    className="input"
                    placeholder="Drug name"
                    value={p.drugName}
                    onChange={(e) => updatePrescription(i, "drugName", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="500mg"
                    value={p.dosage}
                    onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Twice a day"
                    value={p.frequency}
                    onChange={(e) => updatePrescription(i, "frequency", e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={p.durationDays}
                    onChange={(e) => updatePrescription(i, "durationDays", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removePrescriptionRow(i)}
                    className="btn btn-ghost"
                    style={{ padding: 0, minHeight: "auto" }}
                  >
                    ×
                  </button>
                </div>
              ))}

              <p className="muted" style={{ fontSize: "12px" }}>
                Frequency is parsed automatically into medication reminder times.
              </p>

              {submitError && <ErrorState message={submitError} />}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Complete visit"}
                </Button>
                {showGeneratingHint && (
                  <span className="muted" style={{ fontSize: "12px" }}>
                    Generating AI summary — this can take a few seconds
                  </span>
                )}
              </div>
            </form>
          )}

          {appointment.postVisitNote && (
            <>
              <Card style={{ marginTop: "var(--space-3)" }}>
                <span className="card-kicker">Clinical notes</span>
                <p className="card-body">{appointment.postVisitNote.clinicalNotes}</p>
              </Card>
              {appointment.postVisitNote.prescriptions?.length > 0 && (
                <table className="table" style={{ marginTop: "var(--space-3)" }}>
                  <thead>
                    <tr>
                      <th>Drug</th>
                      <th>Dose</th>
                      <th>Frequency</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointment.postVisitNote.prescriptions.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 800 }}>{p.drugName}</td>
                        <td>{p.dosage}</td>
                        <td>{p.frequency}</td>
                        <td className="tabular">{p.durationDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {appointment.postVisitSummary && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <span className="kicker">Patient-friendly summary</span>
              {appointment.postVisitSummary.isFallback && (
                <div
                  style={{
                    border: "1px solid var(--color-divider)",
                    background: "var(--color-surface)",
                    padding: "var(--space-3)",
                    marginBottom: "var(--space-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>AI was unavailable — this is default content.</span>
                  <Button variant="secondary" onClick={handleRegeneratePostVisit} disabled={regeneratingPostVisit}>
                    {regeneratingPostVisit ? "Regenerating..." : "Regenerate summary"}
                  </Button>
                </div>
              )}
              {postVisitRegenerateError && <ErrorState message={postVisitRegenerateError} />}
              <p style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{appointment.postVisitSummary.summaryText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
