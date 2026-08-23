import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProtectedRoute } from "./components/ProtectedRoute";
import PatientLayout from "./components/PatientLayout";
import DoctorLayout from "./components/DoctorLayout";
import AdminLayout from "./components/AdminLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDoctorsPage from "./pages/admin/AdminDoctorsPage";
import AdminAppointmentsPage from "./pages/admin/AdminAppointmentsPage";
import DoctorSearchPage from "./pages/patient/DoctorSearchPage";
import BookAppointmentPage from "./pages/patient/BookAppointmentPage";
import MyAppointmentsPage from "./pages/patient/MyAppointmentsPage";
import DoctorSchedulePage from "./pages/doctor/DoctorSchedulePage";
import DoctorAppointmentDetailPage from "./pages/doctor/DoctorAppointmentDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="doctors" replace />} />
        <Route path="doctors" element={<AdminDoctorsPage />} />
        <Route path="appointments" element={<AdminAppointmentsPage />} />
      </Route>
      <Route
        path="/patient"
        element={
          <ProtectedRoute role="PATIENT">
            <PatientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DoctorSearchPage />} />
        <Route path="book/:doctorId" element={<BookAppointmentPage />} />
        <Route path="appointments" element={<MyAppointmentsPage />} />
      </Route>
      <Route
        path="/doctor"
        element={
          <ProtectedRoute role="DOCTOR">
            <DoctorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DoctorSchedulePage />} />
        <Route path="appointments/:appointmentId" element={<DoctorAppointmentDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
