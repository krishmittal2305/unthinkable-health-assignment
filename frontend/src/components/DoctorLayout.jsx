import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

const navClass = ({ isActive }) => (isActive ? "nav-active" : undefined);

export default function DoctorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <nav>
          <NavLink to="/doctor" end className={navClass}>
            Schedule
          </NavLink>
        </nav>
        <div>
          <span className="muted">{user?.email}</span>
          <Button variant="outline" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
