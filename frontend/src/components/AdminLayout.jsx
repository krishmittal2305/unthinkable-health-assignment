import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <nav style={{ display: "flex", gap: "16px" }}>
          <NavLink to="/admin/doctors">Doctors</NavLink>
          <NavLink to="/admin/appointments">All appointments</NavLink>
        </nav>
        <div>
          <span className="muted">{user?.email}</span>
          <button onClick={logout} className="button-secondary">
            Log out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
