import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { setSession, getUsuario } from '../../lib/auth';
import { Card } from '../../components/ui/Card';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState } from '../../components/ui/StatusViews';

interface MiPerfil {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  role: string;
  organizaciones: string[];
  modulosPermitidos: string[];
}

const extraerError = (err: unknown, fallback: string) => {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' ') : (msg ?? fallback);
};

export const PerfilPage = () => {
  const queryClient = useQueryClient();
  const { data: perfil, isLoading, isError } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: async () => (await api.get<MiPerfil>('/auth/me')).data,
  });

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [datosError, setDatosError] = useState('');
  const [datosOk, setDatosOk] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordOk, setPasswordOk] = useState('');

  const inicializado = useRef(false);
  useEffect(() => {
    if (!perfil || inicializado.current) return;
    inicializado.current = true;
    setNombres(perfil.nombres);
    setApellidos(perfil.apellidos);
    setTelefono(perfil.telefono ?? '');
  }, [perfil]);

  const actualizarDatos = useMutation({
    mutationFn: async () => (await api.post<MiPerfil>('/auth/profile', { nombres, apellidos, telefono })).data,
    onSuccess: (data) => {
      setDatosError('');
      setDatosOk('Datos actualizados.');
      queryClient.setQueryData(['mi-perfil'], data);
      const usuario = getUsuario();
      const token = localStorage.getItem('token');
      if (usuario && token) {
        setSession(token, { ...usuario, nombres: data.nombres, apellidos: data.apellidos });
      }
    },
    onError: (err: unknown) => {
      setDatosOk('');
      setDatosError(extraerError(err, 'No se pudieron guardar los cambios.'));
    },
  });

  const cambiarPassword = useMutation({
    mutationFn: async () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordError('');
      setPasswordOk('Contraseña actualizada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: unknown) => {
      setPasswordOk('');
      setPasswordError(extraerError(err, 'No se pudo cambiar la contraseña.'));
    },
  });

  const enviarPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordOk('');
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setPasswordError('');
    cambiarPassword.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Mi cuenta" submodulo="Perfil" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Mi perfil</h1>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar tu perfil." />}

      {perfil && (
        <>
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Mis datos</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              {perfil.email} · {perfil.role}
              {perfil.organizaciones.length > 0 ? ` · ${perfil.organizaciones.join(', ')}` : ''}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDatosOk('');
                actualizarDatos.mutate();
              }}
              className="space-y-4"
              noValidate
            >
              {datosError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
                  {datosError}
                </div>
              )}
              {datosOk && (
                <div className="rounded-lg border border-[var(--sage-600)]/30 bg-[var(--sage-600)]/10 px-3.5 py-2.5 text-sm text-[var(--sage-600)]">
                  {datosOk}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nombres</label>
                  <input
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Apellidos</label>
                  <input
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Teléfono</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>
              <button
                type="submit"
                disabled={actualizarDatos.isPending}
                className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
              >
                {actualizarDatos.isPending ? 'Guardando…' : 'Guardar datos'}
              </button>
            </form>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-[var(--text)]">Cambiar contraseña</h3>
            <form onSubmit={enviarPassword} className="space-y-4" noValidate>
              {passwordError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
                  {passwordError}
                </div>
              )}
              {passwordOk && (
                <div className="rounded-lg border border-[var(--sage-600)]/30 bg-[var(--sage-600)]/10 px-3.5 py-2.5 text-sm text-[var(--sage-600)]">
                  {passwordOk}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={cambiarPassword.isPending}
                className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
              >
                {cambiarPassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
};
