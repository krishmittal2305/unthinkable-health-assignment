import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { Button, EmptyState, ErrorState, Field, LoadingState, Tag } from "../../components/ui";

export default function DoctorSearchPage() {
  const [specialisation, setSpecialisation] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDoctors(query) {
    setLoading(true);
    setError(null);
    try {
      const search = query ? `?specialisation=${encodeURIComponent(query)}` : "";
      const data = await apiFetch(`/api/doctors${search}`);
      setDoctors(data.doctors);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors("");
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    loadDoctors(specialisation);
  }

  return (
    <div>
      <span className="kicker">Directory</span>
      <h1>Find a doctor</h1>
      <p className="muted">Search by specialisation, then pick a slot on the next screen.</p>
      <hr className="hr" />

      <form onSubmit={handleSearch} className="form-row" style={{ alignItems: "flex-end", marginBottom: "var(--space-4)" }}>
        <Field label="Specialisation">
          <input
            className="input"
            value={specialisation}
            onChange={(e) => setSpecialisation(e.target.value)}
            placeholder="e.g. Cardiology"
          />
        </Field>
        <Button type="submit">Search</Button>
      </form>
      <hr className="hr" />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && doctors.length === 0 && <EmptyState label="No doctors found." />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 0,
        }}
      >
        {doctors.map((doctor) => (
          <div
            key={doctor.id}
            style={{
              borderLeft: "1px solid var(--color-divider)",
              borderBottom: "1px solid var(--color-divider)",
              padding: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "19px" }}>
                  {doctor.name}
                </div>
                <p className="muted">{doctor.specialisation}</p>
              </div>
              <Tag variant="accent">Available</Tag>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--color-divider)",
                marginTop: "var(--space-3)",
                paddingTop: "var(--space-3)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-2)",
              }}
            >
              <div>
                <span className="stat-label">Slot length</span>
                <span className="tabular" style={{ fontWeight: 700, fontSize: "14px" }}>
                  {doctor.slotDurationMins} min
                </span>
              </div>
            </div>
            <Link to={`/patient/book/${doctor.id}`} style={{ display: "block", marginTop: "var(--space-3)" }}>
              <Button variant="primary" block>
                Book a slot
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
