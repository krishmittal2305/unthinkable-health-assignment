import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";

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
      <h1>Find a doctor</h1>
      <form onSubmit={handleSearch} className="form" style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <label style={{ flex: 1 }}>
          Specialisation
          <input
            value={specialisation}
            onChange={(e) => setSpecialisation(e.target.value)}
            placeholder="e.g. Cardiology"
          />
        </label>
        <Button type="submit">Search</Button>
      </form>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        {!loading && doctors.length === 0 && <EmptyState label="No doctors found." />}
        {doctors.map((doctor) => (
          <Card key={doctor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{doctor.name}</strong>
              <p className="muted">{doctor.specialisation}</p>
            </div>
            <Link to={`/patient/book/${doctor.id}`}>
              <Button>Book appointment</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
