import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, ErrorState, Field } from "../components/ui";
import AuthLayout from "../components/AuthLayout";

const ROLE_HOME = {
  ADMIN: "/admin/doctors",
  DOCTOR: "/doctor",
  PATIENT: "/patient",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await login(email, password);
      navigate(ROLE_HOME[user.role] ?? "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <span className="kicker">Sign in</span>
      <h2>Log in to your account</h2>
      <p className="muted" style={{ marginBottom: "var(--space-4)" }}>
        Patients, doctors, and admins all sign in here.
      </p>
      <hr className="hr" />
      <form onSubmit={handleSubmit} className="form">
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={submitting} block>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="muted" style={{ marginTop: "var(--space-4)" }}>
        New patient? <Link to="/register">Create an account</Link>
      </p>
      <p className="muted" style={{ fontSize: "12px", marginTop: "var(--space-2)" }}>
        Doctor and admin accounts are created by an admin, not self-registered.
      </p>
    </AuthLayout>
  );
}
