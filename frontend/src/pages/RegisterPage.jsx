import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, ErrorState, Field } from "../components/ui";
import AuthLayout from "../components/AuthLayout";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      navigate("/patient");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <span className="kicker">Patient sign up</span>
      <h2>Create your account</h2>
      <p className="muted" style={{ marginBottom: "var(--space-4)" }}>
        Book appointments and track visits, symptom forms, and prescriptions.
      </p>
      <hr className="hr" />
      <form onSubmit={handleSubmit} className="form">
        <Field label="Name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
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
        <Field label="Password">
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
        </Field>
        <Field label="Phone (optional)">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={submitting} block>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="muted" style={{ marginTop: "var(--space-4)" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <p className="muted" style={{ fontSize: "12px", marginTop: "var(--space-2)" }}>
        Doctor and admin accounts are created by an admin, not self-registered.
      </p>
    </AuthLayout>
  );
}
