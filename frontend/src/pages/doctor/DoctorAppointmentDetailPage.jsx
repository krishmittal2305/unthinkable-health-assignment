import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AiStatusBanner, Button, Card, ErrorState, LoadingState, Pill } from "../../components/ui";

const EMPTY_PRESCRIPTION = { drugName: "", dosage: "", frequency: "", durationDays: "" };

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

export default function DoctorAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const { token } = useAuth();

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

  return (
    <div>
      <h1>Appointment with {appointment.patient.name}</h1>
      <p className="muted">
        {formatSlotTime(appointment.slotStart)} · <Pill tone={STATUS_TONE[appointment.status] ?? "blue"}>{appointment.status}</Pill>
      </p>
      <p className="muted" style={{ marginTop: "6px" }}>
        {appointment.patient.email}
        {appointment.patient.phone ? ` · ${appointment.patient.phone}` : ""}
      </p>

      {appointment.symptomForm && (
        <Card>
          <h2>Symptoms reported by patient</h2>
          <p>{appointment.symptomForm.symptoms}</p>
          {appointment.symptomForm.durationDays != null && (
            <p className="muted">Duration: {appointment.symptomForm.durationDays} day(s)</p>
          )}
          {appointment.symptomForm.severity && <p className="muted">Severity: {appointment.symptomForm.severity}</p>}
        </Card>
      )}

      {appointment.preVisitSummary && (
        <Card>
          <h2>AI pre-visit summary</h2>
          {appointment.preVisitSummary.isFallback && (
            <AiStatusBanner
              action={
                <Button variant="outline" onClick={handleRegeneratePreVisit} disabled={regeneratingPreVisit}>
                  {regeneratingPreVisit ? "Regenerating..." : "Regenerate"}
                </Button>
              }
            />
          )}
          {preVisitRegenerateError && <ErrorState message={preVisitRegenerateError} />}
          <p style={{ margin: "8px 0" }}>
            <Pill tone={URGENCY_TONE[appointment.preVisitSummary.urgencyLevel] ?? "blue"}>
              {appointment.preVisitSummary.urgencyLevel}
            </Pill>
          </p>
          <p>
            <strong>Chief complaint:</strong> {appointment.preVisitSummary.chiefComplaint}
          </p>
          {appointment.preVisitSummary.suggestedQuestions?.length > 0 && (
            <>
              <p style={{ marginTop: "8px" }}>
                <strong>Suggested questions:</strong>
              </p>
              <ul>
                {appointment.preVisitSummary.suggestedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {appointment.status === "BOOKED" && (
        <Card>
          <h2>Post-visit notes</h2>
          <form onSubmit={handleSubmitNotes} className="form">
            <label>
              Clinical notes
              <textarea rows={4} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} required />
            </label>

            <div>
              <strong>Prescriptions</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {prescriptions.map((p, i) => (
                  <Card key={i} style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        placeholder="Drug name"
                        value={p.drugName}
                        onChange={(e) => updatePrescription(i, "drugName", e.target.value)}
                        style={{ flex: "1 1 140px" }}
                      />
                      <input
                        placeholder="Dosage (e.g. 500mg)"
                        value={p.dosage}
                        onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                        style={{ flex: "1 1 140px" }}
                      />
                      <input
                        placeholder="Frequency (e.g. twice a day)"
                        value={p.frequency}
                        onChange={(e) => updatePrescription(i, "frequency", e.target.value)}
                        style={{ flex: "1 1 160px" }}
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Days"
                        style={{ width: "70px" }}
                        value={p.durationDays}
                        onChange={(e) => updatePrescription(i, "durationDays", e.target.value)}
                      />
                      <Button variant="danger" type="button" onClick={() => removePrescriptionRow(i)}>
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Button variant="outline" type="button" onClick={addPrescriptionRow} style={{ marginTop: "10px" }}>
                Add another prescription
              </Button>
            </div>

            {submitError && <ErrorState message={submitError} />}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Complete visit"}
              </Button>
              {showGeneratingHint && (
                <span className="muted">Generating AI summary — this can take a few seconds</span>
              )}
            </div>
          </form>
        </Card>
      )}

      {appointment.postVisitNote && (
        <Card>
          <h2>Clinical notes (submitted)</h2>
          <p>{appointment.postVisitNote.clinicalNotes}</p>
          {appointment.postVisitNote.prescriptions?.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {appointment.postVisitNote.prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.drugName}</td>
                    <td>{p.dosage}</td>
                    <td>{p.frequency}</td>
                    <td>{p.durationDays} day(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {appointment.postVisitSummary && (
        <Card>
          <h2>Patient-friendly summary</h2>
          {appointment.postVisitSummary.isFallback && (
            <AiStatusBanner
              action={
                <Button variant="outline" onClick={handleRegeneratePostVisit} disabled={regeneratingPostVisit}>
                  {regeneratingPostVisit ? "Regenerating..." : "Regenerate"}
                </Button>
              }
            />
          )}
          {postVisitRegenerateError && <ErrorState message={postVisitRegenerateError} />}
          <p style={{ whiteSpace: "pre-wrap" }}>{appointment.postVisitSummary.summaryText}</p>
        </Card>
      )}
    </div>
  );
}
