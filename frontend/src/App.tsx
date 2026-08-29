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
import { RequiereAdminGlobal } from './components/RequiereAdminGlobal';
import { AdminHome } from './pages/admin/AdminHome';
import { DashboardPage } from './pages/admin/DashboardPage';
import { PerfilPage } from './pages/admin/PerfilPage';
import { UsuariosPage } from './pages/admin/usuarios/UsuariosPage';
import { OrganizacionesPage } from './pages/admin/organizaciones/OrganizacionesPage';
import { ConsejoBarrioPage } from './pages/admin/ConsejoBarrioPage';
import { CorreosPage } from './pages/admin/CorreosPage';
import { SesionesPage } from './pages/admin/SesionesPage';
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
          <Route path="/admin/perfil" element={<PerfilPage />} />
          <Route
            path="/admin/templo"
            element={
              <RequiereModulo clave="viaje_templo">
                <ViajeTemploPage />
              </RequiereModulo>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <RequiereAdminGlobal>
                <DashboardPage />
              </RequiereAdminGlobal>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <RequiereModulo clave="usuarios">
                <UsuariosPage />
              </RequiereModulo>
            }
          />
          <Route
            path="/admin/organizaciones"
            element={
              <RequiereModulo clave="usuarios">
                <OrganizacionesPage />
              </RequiereModulo>
            }
          />
          <Route
            path="/admin/consejo-barrio"
            element={
              <RequiereModulo clave="usuarios">
                <ConsejoBarrioPage />
              </RequiereModulo>
            }
          />
          <Route
            path="/admin/correos"
            element={
              <RequiereAdminGlobal>
                <CorreosPage />
              </RequiereAdminGlobal>
            }
          />
          <Route
            path="/admin/sesiones"
            element={
              <RequiereAdminGlobal>
                <SesionesPage />
              </RequiereAdminGlobal>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
