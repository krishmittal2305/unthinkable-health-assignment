import { Fragment, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";

const DEFAULT_WORKING_HOURS = '{\n  "mon": ["09:00", "17:00"],\n  "tue": ["09:00", "17:00"],\n  "wed": ["09:00", "17:00"],\n  "thu": ["09:00", "17:00"],\n  "fri": ["09:00", "17:00"]\n}';

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  specialisation: "",
  slotDurationMins: 30,
  workingHours: DEFAULT_WORKING_HOURS,
};

function LeaveDayManager({ doctor, token, onChanged }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch(`/api/admin/doctors/${doctor.id}/leave-days`, {
        method: "POST",
        token,
        body: { date, reason: reason || undefined },
      });
      if (result.cancelledAppointmentCount > 0) {
        alert(
          `${result.cancelledAppointmentCount} booked appointment(s) on this date were cancelled and the affected patients notified.`,
        );
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
    <Card style={{ margin: "8px 0" }}>
      <strong>Leave days for {doctor.user.name}</strong>
      <ul style={{ margin: "8px 0" }}>
        {doctor.leaveDays?.length === 0 && <li className="muted">No leave days marked.</li>}
        {doctor.leaveDays?.map((leaveDay) => (
          <li key={leaveDay.id} style={{ marginBottom: "4px" }}>
            {new Date(leaveDay.date).toLocaleDateString()} {leaveDay.reason ? `— ${leaveDay.reason}` : ""}{" "}
            <Button variant="danger" onClick={() => handleRemove(leaveDay.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Reason (optional)
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Mark on leave"}
        </Button>
      </form>
      {error && <ErrorState message={error} />}
    </Card>
  );
}

function EditDoctorForm({ doctor, token, onChanged, onCancel }) {
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
      <strong>Edit {doctor.user.name}</strong>
      <form onSubmit={handleSave} className="form" style={{ marginTop: "8px" }}>
        <label>
          Specialisation
          <input
            value={form.specialisation}
            onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
            required
          />
        </label>
        <label>
          Slot duration (minutes)
          <input
            type="number"
            min={5}
            value={form.slotDurationMins}
            onChange={(e) => setForm({ ...form, slotDurationMins: e.target.value })}
            required
          />
        </label>
        <label>
          Working hours (JSON)
          <textarea
            rows={7}
            value={form.workingHours}
            onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
          />
        </label>
        {error && <ErrorState message={error} />}
        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="outline" type="button" onClick={onCancel} disabled={submitting}>
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
  const [expandedDoctorId, setExpandedDoctorId] = useState(null);
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
    if (!confirm("Delete this doctor? This only works if they have no active appointments.")) {
      return;
    }
    try {
      await apiFetch(`/api/admin/doctors/${doctorId}`, { method: "DELETE", token });
      await loadDoctors();
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleExpanded(doctorId) {
    setEditingDoctorId(null);
    setExpandedDoctorId((current) => (current === doctorId ? null : doctorId));
  }

  function toggleEditing(doctorId) {
    setExpandedDoctorId(null);
    setEditingDoctorId((current) => (current === doctorId ? null : doctorId));
  }

  return (
    <div>
      <h1>Doctor management</h1>

      <Card>
        <h2>Add doctor</h2>
        <form onSubmit={handleCreate} className="form">
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required
            />
          </label>
          <label>
            Specialisation
            <input
              value={form.specialisation}
              onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
              required
            />
          </label>
          <label>
            Slot duration (minutes)
            <input
              type="number"
              min={5}
              value={form.slotDurationMins}
              onChange={(e) => setForm({ ...form, slotDurationMins: e.target.value })}
              required
            />
          </label>
          <label>
            Working hours (JSON)
            <textarea
              rows={7}
              value={form.workingHours}
              onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
            />
          </label>
          {formError && <ErrorState message={formError} />}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create doctor"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2>Doctors</h2>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialisation</th>
                <th>Slot (mins)</th>
                <th>Leave days</th>
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
                    <td>{doctor.slotDurationMins}</td>
                    <td>{doctor.leaveDays?.length ?? 0}</td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <Button variant="outline" onClick={() => toggleEditing(doctor.id)}>
                        {editingDoctorId === doctor.id ? "Hide edit" : "Edit"}
                      </Button>
                      <Button variant="outline" onClick={() => toggleExpanded(doctor.id)}>
                        {expandedDoctorId === doctor.id ? "Hide leave" : "Manage leave"}
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(doctor.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                  {editingDoctorId === doctor.id && (
                    <tr>
                      <td colSpan={6}>
                        <EditDoctorForm
                          doctor={doctor}
                          token={token}
                          onChanged={loadDoctors}
                          onCancel={() => setEditingDoctorId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {expandedDoctorId === doctor.id && (
                    <tr>
                      <td colSpan={6}>
                        <LeaveDayManager doctor={doctor} token={token} onChanged={loadDoctors} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState label="No doctors yet." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
