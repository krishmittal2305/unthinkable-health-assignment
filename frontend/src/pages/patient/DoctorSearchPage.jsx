import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";

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
        <button type="submit">Search</button>
      </form>

      {loading && <p>Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        {!loading && doctors.length === 0 && <p className="muted">No doctors found.</p>}
        {doctors.map((doctor) => (
          <div key={doctor.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{doctor.name}</strong>
              <p className="muted">{doctor.specialisation}</p>
            </div>
            <Link to={`/patient/book/${doctor.id}`}>
              <button>Book appointment</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
