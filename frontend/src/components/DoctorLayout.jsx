import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DoctorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <nav style={{ display: "flex", gap: "16px" }}>
          <NavLink to="/doctor" end>
            Schedule
          </NavLink>
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
