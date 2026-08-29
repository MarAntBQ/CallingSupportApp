import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearAbonoTemplo,
  eliminarAbonoTemplo,
  listarCobradoresTemplo,
  crearCobradorTemplo,
} from '../../../lib/templo';
import { formatFecha } from '../../../lib/format';
import type { TemploParticipante, TipoAbono } from '../../../types';

const TIPOS: { value: TipoAbono; label: string }[] = [
  { value: 'donativo_iglesia', label: 'Donativo al sistema de la Iglesia' },
  { value: 'pagado_persona', label: 'Pagado a una persona' },
];

const hoy = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    fecha: z.string().min(1, 'Requerido'),
    valor: z.number().min(0.01, 'Debe ser mayor a 0'),
    tipo: z.enum(['donativo_iglesia', 'pagado_persona']),
    cobradorId: z.number().optional(),
  })
  .refine((data) => data.tipo !== 'pagado_persona' || !!data.cobradorId, {
    message: 'Selecciona a quién se le pagó',
    path: ['cobradorId'],
  });

type FormValues = z.infer<typeof schema>;

const CobradorPicker = ({
  value,
  onChange,
  error,
}: {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  error?: string;
}) => {
  const queryClient = useQueryClient();
  const { data: cobradores } = useQuery({ queryKey: ['templo-cobradores'], queryFn: listarCobradoresTemplo });
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const crear = useMutation({
    mutationFn: (nombre: string) => crearCobradorTemplo(nombre),
    onSuccess: (nuevo) => {
      queryClient.invalidateQueries({ queryKey: ['templo-cobradores'] });
      onChange(nuevo.id);
      setCreando(false);
      setNombreNuevo('');
    },
  });

  const activos = (cobradores ?? []).filter((c) => c.activo);

  if (creando) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre del hermano/hermana"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
        />
        <button
          type="button"
          disabled={!nombreNuevo.trim() || crear.isPending}
          onClick={() => crear.mutate(nombreNuevo.trim())}
          className="rounded-lg bg-[var(--brown-700)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Crear
        </button>
        <button
          type="button"
          onClick={() => setCreando(false)}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
        >
          <option value="">Selecciona…</option>
          {activos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)]"
        >
          + Nuevo
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export const AbonosSection = ({
  participante,
  costoTotal,
}: {
  participante: TemploParticipante;
  costoTotal: number;
}) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: hoy(), valor: undefined, tipo: 'donativo_iglesia', cobradorId: undefined },
  });

  const tipoActual = watch('tipo');
  const cobradorIdActual = watch('cobradorId');

  const crear = useMutation({
    mutationFn: (data: FormValues) => crearAbonoTemplo(participante.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      reset({ fecha: hoy(), valor: undefined, tipo: 'donativo_iglesia', cobradorId: undefined });
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarAbonoTemplo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] }),
  });

  const abonos = participante.abonos ?? [];
  const totalAbonado = abonos.reduce((sum, a) => sum + parseFloat(a.valor), 0);
  const saldo = costoTotal - totalAbonado;

  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">Abonos</h3>
        <div className="flex gap-4 text-xs">
          <span className="text-[var(--text-muted)]">
            Costo: <span className="font-semibold text-[var(--text)]">${costoTotal.toFixed(2)}</span>
          </span>
          <span className="text-[var(--text-muted)]">
            Abonado: <span className="font-semibold text-[var(--success)]">${totalAbonado.toFixed(2)}</span>
          </span>
          <span className="text-[var(--text-muted)]">
            Saldo:{' '}
            <span className={`font-semibold ${saldo > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
              ${saldo.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      {abonos.length > 0 && (
        <div className="mb-4 space-y-2">
          {abonos.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-[var(--text)]">${parseFloat(a.valor).toFixed(2)}</span>{' '}
                <span className="text-[var(--text-muted)]">
                  · {formatFecha(a.fecha)} ·{' '}
                  {a.tipo === 'donativo_iglesia' ? 'Donativo a la Iglesia' : `Pagado a ${a.cobrador?.nombre ?? '—'}`}
                </span>
              </div>
              <button
                type="button"
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(a.id)}
                className="text-xs font-medium text-[var(--danger)] hover:underline disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-start">
        <div>
          <input
            type="date"
            {...register('fecha')}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25 sm:w-36"
          />
          {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha.message}</p>}
        </div>
        <div>
          <input
            type="number"
            step="0.01"
            placeholder="Valor"
            {...register('valor', { valueAsNumber: true })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25 sm:w-28"
          />
          {errors.valor && <p className="mt-1 text-xs text-red-500">{errors.valor.message}</p>}
        </div>
        <div>
          <select
            {...register('tipo')}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tipoActual === 'pagado_persona' && (
        <div className="mt-2">
          <CobradorPicker
            value={cobradorIdActual}
            onChange={(id) => setValue('cobradorId', id)}
            error={errors.cobradorId?.message}
          />
        </div>
      )}

      <button
        type="button"
        disabled={crear.isPending}
        onClick={handleSubmit((data) => crear.mutate(data))}
        className="mt-3 rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
      >
        {crear.isPending ? 'Guardando…' : '+ Agregar abono'}
      </button>
    </div>
  );
};
