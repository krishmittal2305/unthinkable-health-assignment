import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

export default function DoctorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="nav">
        <span className="nav-brand">Healthcare Manager</span>
        <nav className="nav-links">
          <NavLink to="/doctor" end>
            Schedule
          </NavLink>
          <NavLink to="/doctor/calendar">Calendar</NavLink>
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
