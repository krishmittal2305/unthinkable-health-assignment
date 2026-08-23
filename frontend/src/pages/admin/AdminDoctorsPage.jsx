import { Fragment, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState } from "../../components/ui";

const DEFAULT_WORKING_HOURS = '{\n  "mon": ["09:00", "17:00"],\n  "tue": ["09:00", "17:00"],\n  "wed": ["09:00", "17:00"],\n  "thu": ["09:00", "17:00"],\n  "fri": ["09:00", "17:00"]\n}';

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  specialisation: "",
  slotDurationMins: 30,
  workingHours: DEFAULT_WORKING_HOURS,
};

function summariseWorkingHours(workingHours) {
  const days = Object.keys(workingHours ?? {});
  if (days.length === 0) return "—";
  const [start, end] = workingHours[days[0]];
  return `${days.length} day(s), ${start}–${end}`;
}

function LeavePanel({ doctor, token, onChanged }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(null);

  async function handleAdd(event) {
    event.preventDefault();
    setError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      const result = await apiFetch(`/api/admin/doctors/${doctor.id}/leave-days`, {
        method: "POST",
        token,
        body: { date, reason: reason || undefined },
      });
      if (result.cancelledAppointmentCount > 0) {
        setConflict(result.cancelledAppointmentCount);
      }
      setDate("");
      setReason("");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(leaveDayId) {
    try {
      await apiFetch(`/api/admin/doctors/${doctor.id}/leave-days/${leaveDayId}`, { method: "DELETE", token });
      await onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <span className="kicker">Leave — {doctor.user.name}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "var(--space-2) 0 var(--space-4)" }}>
        {doctor.leaveDays?.length === 0 && <EmptyState label="No leave days marked." />}
        {doctor.leaveDays?.map((leaveDay) => (
          <span
            key={leaveDay.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid var(--color-divider)",
              padding: "4px 10px",
              fontSize: "13px",
            }}
          >
            <span className="tabular">{new Date(leaveDay.date).toLocaleDateString()}</span>
            {leaveDay.reason && <span className="muted">{leaveDay.reason}</span>}
            <button
              onClick={() => handleRemove(leaveDay.id)}
              style={{ background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", fontWeight: 700 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={handleAdd} className="form-row" style={{ alignItems: "flex-end" }}>
        <Field label="Date">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Reason (optional)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Mark on leave"}
        </Button>
      </form>
      {error && <ErrorState message={error} />}
      {conflict != null && (
        <div style={{ border: "2px solid var(--color-accent)", padding: "var(--space-3)", marginTop: "var(--space-3)" }}>
          <p style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>
            {conflict} booked appointment{conflict > 1 ? "s" : ""} fall{conflict === 1 ? "s" : ""} on this
            date.
          </p>
          <p style={{ fontSize: "13px", marginTop: "4px" }}>
            Those bookings were cancelled, their slots released, the linked calendar events deleted, and the
            affected patients emailed — all in one transaction. Any in-flight holds for the day were also
            invalidated.
          </p>
        </div>
      )}
    </div>
  );
}

function EditPanel({ doctor, token, onChanged, onCancel }) {
  const [form, setForm] = useState({
    specialisation: doctor.specialisation,
    slotDurationMins: doctor.slotDurationMins,
    workingHours: JSON.stringify(doctor.workingHours, null, 2),
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    setError(null);

    let workingHours;
    try {
      workingHours = JSON.parse(form.workingHours);
    } catch {
      setError('Working hours must be valid JSON, e.g. "mon": ["09:00", "17:00"]');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/doctors/${doctor.id}`, {
        method: "PATCH",
        token,
        body: {
          specialisation: form.specialisation,
          slotDurationMins: Number(form.slotDurationMins),
          workingHours,
        },
      });
      await onChanged();
      onCancel();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={{ margin: "8px 0" }}>
      <span className="card-kicker">Edit {doctor.user.name}</span>
      <form onSubmit={handleSave} className="form" style={{ marginTop: "8px" }}>
        <Field label="Specialisation">
          <input
            className="input"
            value={form.specialisation}
            onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
            required
          />
        </Field>
        <Field label="Slot duration (minutes)">
          <input
            className="input"
            type="number"
            min={5}
            value={form.slotDurationMins}
            onChange={(e) => setForm({ ...form, slotDurationMins: e.target.value })}
            required
          />
        </Field>
        <Field label="Working hours (JSON)">
          <textarea
            className="input"
            rows={7}
            value={form.workingHours}
            onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
          />
        </Field>
        {error && <ErrorState message={error} />}
        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="secondary" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminDoctorsPage() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [editingDoctorId, setEditingDoctorId] = useState(null);

  async function loadDoctors() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/doctors", { token });
      setDoctors(data.doctors);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError(null);

    let workingHours;
    try {
      workingHours = JSON.parse(form.workingHours);
    } catch {
      setFormError('Working hours must be valid JSON, e.g. "mon": ["09:00", "17:00"]');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/admin/doctors", {
        method: "POST",
        token,
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          specialisation: form.specialisation,
          slotDurationMins: Number(form.slotDurationMins),
          workingHours,
        },
      });
      setForm(EMPTY_FORM);
      await loadDoctors();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(doctorId) {
    if (!confirm("Delete this doctor? This only works if they have no active appointments.")) return;
    try {
      await apiFetch(`/api/admin/doctors/${doctorId}`, { method: "DELETE", token });
      await loadDoctors();
    } catch (err) {
      alert(err.message);
    }
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div>
      <span className="kicker">Admin</span>
      <h1>Doctors</h1>
      <p className="muted">Create doctor accounts, manage working hours, and mark leave days.</p>
      <hr className="hr" />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <table className="table" style={{ marginBottom: "var(--space-8)" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Specialisation</th>
              <th>Slot</th>
              <th>Working hours</th>
              <th>Leave</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <Fragment key={doctor.id}>
                <tr>
                  <td>{doctor.user.name}</td>
                  <td>{doctor.user.email}</td>
                  <td>{doctor.specialisation}</td>
                  <td className="tabular">{doctor.slotDurationMins} min</td>
                  <td className="muted">{summariseWorkingHours(doctor.workingHours)}</td>
                  <td className="tabular">{doctor.leaveDays?.length ?? 0}</td>
                  <td style={{ display: "flex", gap: "12px" }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditingDoctorId(editingDoctorId === doctor.id ? null : doctor.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setSelectedDoctorId(doctor.id)}
                    >
                      Manage leave
                    </button>
                    <button className="btn btn-ghost" onClick={() => handleDelete(doctor.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
                {editingDoctorId === doctor.id && (
                  <tr>
                    <td colSpan={7}>
                      <EditPanel
                        doctor={doctor}
                        token={token}
                        onChanged={loadDoctors}
                        onCancel={() => setEditingDoctorId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState label="No doctors yet." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="split">
        <div className="split-left">
          <span className="kicker">Add a doctor</span>
          <form onSubmit={handleCreate} className="form">
            <div className="form-row">
              <Field label="Name">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Temporary password">
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
              />
            </Field>
            <div className="form-row">
              <Field label="Specialisation">
                <input
                  className="input"
                  value={form.specialisation}
                  onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
                  required
                />
              </Field>
              <Field label="Slot duration (minutes)">
                <input
                  className="input"
                  type="number"
                  min={5}
                  value={form.slotDurationMins}
                  onChange={(e) => setForm({ ...form, slotDurationMins: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Working hours (JSON)">
              <textarea
                className="input"
                rows={7}
                value={form.workingHours}
                onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
              />
            </Field>
            {formError && <ErrorState message={formError} />}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create doctor"}
            </Button>
          </form>
        </div>

        <div className="split-right">
          {selectedDoctor ? (
            <LeavePanel doctor={selectedDoctor} token={token} onChanged={loadDoctors} />
          ) : (
            <EmptyState label="Select 'Manage leave' on a doctor to mark or remove leave days." />
          )}
        </div>
      </div>
    </div>
  );
}
