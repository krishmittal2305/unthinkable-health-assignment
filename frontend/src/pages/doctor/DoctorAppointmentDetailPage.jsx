import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

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
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState(null);

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

  async function handleRegenerateSummary() {
    setRegenerateError(null);
    setRegenerating(true);
    try {
      const data = await apiFetch(`/api/doctor/appointments/${appointmentId}/regenerate-pre-visit-summary`, {
        method: "POST",
        token,
      });
      setAppointment((current) => ({ ...current, preVisitSummary: data.preVisitSummary }));
    } catch (err) {
      setRegenerateError(err.message);
    } finally {
      setRegenerating(false);
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
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!appointment) return null;

  return (
    <div>
      <h1>Appointment with {appointment.patient.name}</h1>
      <p className="muted">
        {formatSlotTime(appointment.slotStart)} · {appointment.status}
      </p>
      <p className="muted">
        {appointment.patient.email}
        {appointment.patient.phone ? ` · ${appointment.patient.phone}` : ""}
      </p>

      {appointment.symptomForm && (
        <section className="card">
          <h2>Symptoms reported by patient</h2>
          <p>{appointment.symptomForm.symptoms}</p>
          {appointment.symptomForm.durationDays != null && (
            <p className="muted">Duration: {appointment.symptomForm.durationDays} day(s)</p>
          )}
          {appointment.symptomForm.severity && <p className="muted">Severity: {appointment.symptomForm.severity}</p>}
        </section>
      )}

      {appointment.preVisitSummary && (
        <section className="card">
          <h2>
            AI pre-visit summary
            {appointment.preVisitSummary.isFallback && (
              <span className="muted"> (AI unavailable — showing basic info)</span>
            )}
          </h2>
          <p>
            <strong>Urgency:</strong> {appointment.preVisitSummary.urgencyLevel}
          </p>
          <p>
            <strong>Chief complaint:</strong> {appointment.preVisitSummary.chiefComplaint}
          </p>
          {appointment.preVisitSummary.suggestedQuestions?.length > 0 && (
            <>
              <p>
                <strong>Suggested questions:</strong>
              </p>
              <ul>
                {appointment.preVisitSummary.suggestedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          )}
          {appointment.preVisitSummary.isFallback && (
            <>
              <button className="button-secondary" onClick={handleRegenerateSummary} disabled={regenerating}>
                {regenerating ? "Regenerating..." : "Regenerate AI summary"}
              </button>
              {regenerateError && <p className="form-error">{regenerateError}</p>}
            </>
          )}
        </section>
      )}

      {appointment.status === "BOOKED" && (
        <section className="card">
          <h2>Post-visit notes</h2>
          <form onSubmit={handleSubmitNotes} className="form">
            <label>
              Clinical notes
              <textarea rows={4} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} required />
            </label>

            <div>
              <strong>Prescriptions</strong>
              {prescriptions.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                  <input
                    placeholder="Drug name"
                    value={p.drugName}
                    onChange={(e) => updatePrescription(i, "drugName", e.target.value)}
                  />
                  <input
                    placeholder="Dosage (e.g. 500mg)"
                    value={p.dosage}
                    onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                  />
                  <input
                    placeholder="Frequency (e.g. twice a day)"
                    value={p.frequency}
                    onChange={(e) => updatePrescription(i, "frequency", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Days"
                    style={{ width: "70px" }}
                    value={p.durationDays}
                    onChange={(e) => updatePrescription(i, "durationDays", e.target.value)}
                  />
                  <button type="button" className="button-danger" onClick={() => removePrescriptionRow(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="button-secondary" onClick={addPrescriptionRow} style={{ marginTop: "8px" }}>
                Add another prescription
              </button>
            </div>

            {submitError && <p className="form-error">{submitError}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Complete visit"}
            </button>
          </form>
        </section>
      )}

      {appointment.postVisitNote && (
        <section className="card">
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
        </section>
      )}

      {appointment.postVisitSummary && (
        <section className="card">
          <h2>
            Patient-friendly summary
            {appointment.postVisitSummary.isFallback && <span className="muted"> (AI unavailable)</span>}
          </h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{appointment.postVisitSummary.summaryText}</p>
        </section>
      )}
    </div>
  );
}
