import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarConfigGeneral,
  configurarLogo,
  configurarSmtp,
  configurarTelegramBot,
  obtenerConfigSmtp,
  obtenerConfigTelegramBot,
} from '../../lib/admin';
import { useConfig } from '../../lib/useConfig';
import { Card } from '../../components/ui/Card';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';

const extraerError = (err: unknown, fallback: string) => {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' ') : (msg ?? fallback);
};

export const ConfigPage = () => {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: telegramCfg } = useQuery({ queryKey: ['config-telegram'], queryFn: obtenerConfigTelegramBot });
  const { data: smtpCfg } = useQuery({ queryKey: ['config-smtp'], queryFn: obtenerConfigSmtp });

  // ---------- General (nombre de unidad + registro) ----------
  const [nombreUnidad, setNombreUnidad] = useState('');
  const [permitirRegistro, setPermitirRegistro] = useState(false);
  const [generalOk, setGeneralOk] = useState('');
  const inicializadoGeneral = useRef(false);
  useEffect(() => {
    if (!config || inicializadoGeneral.current) return;
    inicializadoGeneral.current = true;
    setNombreUnidad(config.nombreUnidad);
    setPermitirRegistro(config.permitirRegistro);
  }, [config]);

  const guardarGeneral = useMutation({
    mutationFn: () => actualizarConfigGeneral({ nombreUnidad, permitirRegistro }),
    onSuccess: () => {
      setGeneralOk('Guardado.');
      queryClient.invalidateQueries({ queryKey: ['config', 'public'] });
    },
  });

  // ---------- Logo ----------
  const [logoError, setLogoError] = useState('');
  const guardarLogo = useMutation({
    mutationFn: (dataUrl: string | null) => configurarLogo(dataUrl),
    onSuccess: () => {
      setLogoError('');
      queryClient.invalidateQueries({ queryKey: ['config', 'public'] });
    },
    onError: (err: unknown) => setLogoError(extraerError(err, 'No se pudo guardar el logo.')),
  });

  const subirLogo = (file: File) => {
    if (file.size > 2_000_000) {
      setLogoError('La imagen es muy pesada (máx. ~2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => guardarLogo.mutate(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ---------- Telegram ----------
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [telegramOk, setTelegramOk] = useState('');
  const [telegramError, setTelegramError] = useState('');
  useEffect(() => {
    if (telegramCfg?.botUsername) setBotUsername(telegramCfg.botUsername);
  }, [telegramCfg]);

  const guardarTelegram = useMutation({
    mutationFn: () => configurarTelegramBot(botToken, botUsername),
    onSuccess: () => {
      setTelegramOk('Bot configurado — el sistema lo activa solo, sin reiniciar nada.');
      setTelegramError('');
      setBotToken('');
      queryClient.invalidateQueries({ queryKey: ['config-telegram'] });
    },
    onError: (err: unknown) => {
      setTelegramOk('');
      setTelegramError(extraerError(err, 'No se pudo guardar el bot.'));
    },
  });

  // ---------- SMTP ----------
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpOk, setSmtpOk] = useState('');
  const [smtpError, setSmtpError] = useState('');
  useEffect(() => {
    if (!smtpCfg) return;
    if (smtpCfg.host) setSmtpHost(smtpCfg.host);
    if (smtpCfg.port) setSmtpPort(String(smtpCfg.port));
    setSmtpSecure(smtpCfg.secure);
    if (smtpCfg.user) setSmtpUser(smtpCfg.user);
  }, [smtpCfg]);

  const guardarSmtp = useMutation({
    mutationFn: () =>
      configurarSmtp({
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        user: smtpUser,
        password: smtpPassword || undefined,
      }),
    onSuccess: () => {
      setSmtpOk('Guardado.');
      setSmtpError('');
      setSmtpPassword('');
      queryClient.invalidateQueries({ queryKey: ['config-smtp'] });
    },
    onError: (err: unknown) => {
      setSmtpOk('');
      setSmtpError(extraerError(err, 'No se pudo guardar el servidor de correo.'));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Configuración" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Configuración del sistema</h1>
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-[var(--text)]">General</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGeneralOk('');
            guardarGeneral.mutate();
          }}
          className="space-y-4"
        >
          {generalOk && <p className="text-sm text-[var(--sage-600)]">{generalOk}</p>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nombre de la unidad</label>
            <input
              value={nombreUnidad}
              onChange={(e) => setNombreUnidad(e.target.value)}
              placeholder="Ej. Barrio Los Laureles"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={permitirRegistro}
              onChange={(e) => setPermitirRegistro(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
            />
            Permitir que cualquiera se registre desde el formulario público
          </label>
          <button
            type="submit"
            disabled={guardarGeneral.isPending}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {guardarGeneral.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Logo</h3>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Se usa en el login, el registro y el formulario público de inscripción.
        </p>
        {logoError && <p className="mb-2 text-sm text-[var(--danger)]">{logoError}</p>}
        <div className="flex items-center gap-4">
          {config?.logoDataUrl && (
            <img src={config.logoDataUrl} alt="Logo actual" className="h-16 w-16 rounded-lg object-contain" />
          )}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) subirLogo(file);
              }}
              className="text-sm text-[var(--text)]"
            />
            {config?.logoDataUrl && (
              <button
                type="button"
                onClick={() => guardarLogo.mutate(null)}
                className="self-start text-xs font-medium text-[var(--danger)] hover:underline"
              >
                Quitar logo (volver al de fábrica)
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Bot de Telegram</h3>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Para las notificaciones (ver "Notificar" en Organizaciones → Permisos). Crea el bot con{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--brown-700)] underline"
          >
            @BotFather
          </a>{' '}
          en Telegram y pega aquí el token que te da — se guarda cifrado, no se vuelve a mostrar.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarTelegram.mutate();
          }}
          className="space-y-4"
        >
          {telegramError && <p className="text-sm text-[var(--danger)]">{telegramError}</p>}
          {telegramOk && <p className="text-sm text-[var(--sage-600)]">{telegramOk}</p>}
          <p className="text-xs text-[var(--text-muted)]">
            {telegramCfg?.hasToken ? 'Ya hay un token guardado — pega uno nuevo solo si quieres reemplazarlo.' : 'Todavía no hay token guardado.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                Usuario del bot <span className="text-[var(--text-muted)]">(sin @, ej. LaurelesBot)</span>
              </label>
              <input
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Token</label>
              <input
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={telegramCfg?.hasToken ? '••••••••••••••••' : '123456:ABC-DEF...'}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={guardarTelegram.isPending || !botToken || !botUsername}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {guardarTelegram.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Servidor de correo (SMTP)</h3>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Si no configuras nada aquí, el sistema sigue usando las variables NODEMAILER_* del .env.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarSmtp.mutate();
          }}
          className="space-y-4"
        >
          {smtpError && <p className="text-sm text-[var(--danger)]">{smtpError}</p>}
          {smtpOk && <p className="text-sm text-[var(--sage-600)]">{smtpOk}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Host</label>
              <input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Puerto</label>
              <input
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
            />
            Conexión segura (TLS) — normalmente sí para el puerto 465, no para el 587
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Usuario / correo</label>
              <input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Contraseña</label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={smtpCfg?.hasPassword ? '••••••••••••••••' : ''}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={guardarSmtp.isPending || !smtpHost || !smtpUser}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {guardarSmtp.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </Card>
    </div>
  );
};
