import { Routes, Route } from 'react-router-dom';
import { InscripcionPage } from './pages/InscripcionPage';
import { PoliticaDatosPage } from './pages/PoliticaDatosPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { RequiereModulo } from './components/RequiereModulo';
import { AdminHome } from './pages/admin/AdminHome';
import { ViajeTemploPage } from './pages/admin/templo/ViajeTemploPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<InscripcionPage />} />
      <Route path="/politica-datos" element={<PoliticaDatosPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route
            path="/admin/templo"
            element={
              <RequiereModulo clave="viaje_templo">
                <ViajeTemploPage />
              </RequiereModulo>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
