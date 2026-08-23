import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

const navClass = ({ isActive }) => (isActive ? "nav-active" : undefined);

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <nav>
          <NavLink to="/admin/doctors" className={navClass}>
            Doctors
          </NavLink>
          <NavLink to="/admin/appointments" className={navClass}>
            All appointments
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
