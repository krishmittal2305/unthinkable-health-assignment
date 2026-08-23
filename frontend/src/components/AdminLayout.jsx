import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="nav">
        <span className="nav-brand">Healthcare Manager</span>
        <nav className="nav-links">
          <NavLink to="/admin/doctors">Doctors</NavLink>
          <NavLink to="/admin/appointments">All appointments</NavLink>
        </nav>
        <div className="nav-right">
          <span className="nav-email">{user?.email}</span>
          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
