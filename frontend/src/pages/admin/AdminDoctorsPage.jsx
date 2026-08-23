import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_WORKING_HOURS = '{\n  "mon": ["09:00", "17:00"],\n  "tue": ["09:00", "17:00"],\n  "wed": ["09:00", "17:00"],\n  "thu": ["09:00", "17:00"],\n  "fri": ["09:00", "17:00"]\n}';

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  specialisation: "",
  slotDurationMins: 30,
  workingHours: DEFAULT_WORKING_HOURS,
};

export default function AdminDoctorsPage() {
  const { token, user, logout } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError(null);

    let workingHours;
    try {
      workingHours = JSON.parse(form.workingHours);
    } catch {
      setFormError("Working hours must be valid JSON, e.g. \"mon\": [\"09:00\", \"17:00\"]");
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

  return (
    <div className="page">
      <header className="page-header">
        <h1>Doctor management</h1>
        <div>
          <span className="muted">{user?.email}</span>
          <button onClick={logout} className="button-secondary">
            Log out
          </button>
        </div>
      </header>

      <section className="card">
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
          {formError && <p className="form-error">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create doctor"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Doctors</h2>
        {loading && <p>Loading...</p>}
        {error && <p className="form-error">{error}</p>}
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
                <tr key={doctor.id}>
                  <td>{doctor.user.name}</td>
                  <td>{doctor.user.email}</td>
                  <td>{doctor.specialisation}</td>
                  <td>{doctor.slotDurationMins}</td>
                  <td>{doctor.leaveDays?.length ?? 0}</td>
                  <td>
                    <button onClick={() => handleDelete(doctor.id)} className="button-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No doctors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
