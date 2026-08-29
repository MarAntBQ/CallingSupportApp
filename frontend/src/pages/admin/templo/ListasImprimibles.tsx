import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../components/ui/Card';
import { formatFecha } from '../../../lib/format';
import { useConfig } from '../../../lib/useConfig';
import { ORDENANZAS } from '../../../types';
import { actualizarLogisticaTemplo, type LogisticaPayload } from '../../../lib/templo';
import type { TemploParticipante, TemploViaje } from '../../../types';

type TipoLista = 'general' | 'transporte' | 'desayuno' | 'almuerzo' | 'hospedaje' | 'ordenanzas';

const TITULOS: Record<TipoLista, string> = {
  general: 'Vista general',
  transporte: 'Lista de transporte',
  desayuno: 'Lista de desayuno',
  almuerzo: 'Lista de almuerzo',
  hospedaje: 'Lista de hospedaje',
  ordenanzas: 'Listas de ordenanzas',
};

const porNombre = (a: TemploParticipante, b: TemploParticipante) => a.nombreCompleto.localeCompare(b.nombreCompleto);

const Marca = ({ activo }: { activo: boolean }) =>
  activo ? <span className="font-semibold text-[var(--text)]">X</span> : null;

const VistaGeneral = ({ viaje, participantes }: { viaje: TemploViaje; participantes: TemploParticipante[] }) => {
  const items = [...participantes].sort(porNombre);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--text)]">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2 pr-3">Nombre completo</th>
            <th className="py-2 pr-3">Cédula</th>
            {ORDENANZAS.map((ord) => (
              <th key={ord} className="py-2 px-2 text-center" title={ord}>
                {ord.slice(0, 3)}
              </th>
            ))}
            {viaje.incluyeTransporte && <th className="py-2 px-2 text-center">Transp.</th>}
            {viaje.incluyeDesayuno && <th className="py-2 px-2 text-center">Desay.</th>}
            {viaje.incluyeAlmuerzo && <th className="py-2 px-2 text-center">Almz.</th>}
            <th className="py-2 pl-2 text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => {
            const ordenanzasDe = p.ordenanzas.split(', ').filter(Boolean);
            return (
              <tr key={p.id} className="border-b border-[var(--border)]">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-3">{p.nombreCompleto}</td>
                <td className="py-2 pr-3 tabular-nums">{p.cedulaOPasaporte}</td>
                {ORDENANZAS.map((ord) => (
                  <td key={ord} className="py-2 px-2 text-center">
                    <Marca activo={ordenanzasDe.includes(ord)} />
                  </td>
                ))}
                {viaje.incluyeTransporte && (
                  <td className="py-2 px-2 text-center">
                    <Marca activo={p.vaEnTransporte} />
                  </td>
                )}
                {viaje.incluyeDesayuno && (
                  <td className="py-2 px-2 text-center">
                    <Marca activo={p.quiereDesayuno} />
                  </td>
                )}
                {viaje.incluyeAlmuerzo && (
                  <td className="py-2 px-2 text-center">
                    <Marca activo={p.quiereAlmuerzo} />
                  </td>
                )}
                <td className="py-2 pl-2 text-right tabular-nums">${parseFloat(p.costoTotal).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-sm font-medium text-[var(--text)]">
        Total: {items.length} · ${items.reduce((sum, p) => sum + parseFloat(p.costoTotal), 0).toFixed(2)}
      </p>
    </div>
  );
};

interface ColumnaViva {
  label: string;
  campo: 'subioIda' | 'subioRegreso' | 'desayunoEntregado' | 'almuerzoEntregado';
}

// Lista con casillas clickeables que guardan solas al marcarlas (para el
// día del viaje: subir al bus, entregar comida) — no son solo para papel.
const ListaConCheckboxes = ({
  items,
  columnas,
  onToggle,
  pendiente,
}: {
  items: TemploParticipante[];
  columnas: ColumnaViva[];
  onToggle: (id: number, campo: ColumnaViva['campo'], valor: boolean) => void;
  pendiente: boolean;
}) => (
  <div>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--text)]">
            <th className="py-2 pr-3 w-10">#</th>
            <th className="py-2 pr-3">Nombre completo</th>
            <th className="py-2 pr-3">Cédula</th>
            {columnas.map((c) => (
              <th key={c.campo} className="py-2 w-24 text-center">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={p.id} className="border-b border-[var(--border)]">
              <td className="py-2 pr-3">{i + 1}</td>
              <td className="py-2 pr-3">{p.nombreCompleto}</td>
              <td className="py-2 pr-3 tabular-nums">{p.cedulaOPasaporte}</td>
              {columnas.map((c) => (
                <td key={c.campo} className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={p[c.campo]}
                    disabled={pendiente}
                    onChange={(e) => onToggle(p.id, c.campo, e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)] print:appearance-auto"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mt-3 text-sm font-medium text-[var(--text)]">Total: {items.length}</p>
  </div>
);

const ListasOrdenanzas = ({ participantes }: { participantes: TemploParticipante[] }) => (
  <div className="space-y-8">
    {ORDENANZAS.map((ord) => {
      const items = participantes
        .filter((p) => p.ordenanzas.split(', ').filter(Boolean).includes(ord))
        .sort((a, b) => a.genero.localeCompare(b.genero) || porNombre(a, b));
      if (items.length === 0) return null;
      return (
        <div key={ord} className="break-inside-avoid">
          <h3 className="mb-2 text-base font-semibold text-[var(--text)]">
            {ord} <span className="text-sm font-normal text-[var(--text-muted)]">({items.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--text)]">
                  <th className="py-2 pr-3 w-10">#</th>
                  <th className="py-2 pr-3">Nombre completo</th>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2">Género</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{i + 1}</td>
                    <td className="py-2 pr-3">{p.nombreCompleto}</td>
                    <td className="py-2 pr-3 tabular-nums">{p.cedulaOPasaporte}</td>
                    <td className="py-2">{p.genero}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    })}
  </div>
);

const ListaHospedaje = ({ participantes }: { participantes: TemploParticipante[] }) => {
  const necesitanHospedaje = participantes.filter((p) => p.necesitaHospedaje);
  const sinAsignar = necesitanHospedaje.filter((p) => !p.habitacion).sort(porNombre);
  const numeros = Array.from(
    new Set(necesitanHospedaje.filter((p) => p.habitacion).map((p) => p.habitacion!.numero)),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (necesitanHospedaje.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Nadie solicitó hospedaje en este viaje.</p>;
  }

  return (
    <div className="space-y-8">
      {numeros.map((numero) => {
        const ocupantes = necesitanHospedaje
          .filter((p) => p.habitacion?.numero === numero)
          .sort((a, b) => (a.rolHabitacion === 'lider' ? -1 : 1) - (b.rolHabitacion === 'lider' ? -1 : 1) || porNombre(a, b));
        return (
          <div key={numero} className="break-inside-avoid">
            <h3 className="mb-2 text-base font-semibold text-[var(--text)]">
              Habitación {numero} <span className="text-sm font-normal text-[var(--text-muted)]">({ocupantes.length}/6)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[var(--text)]">
                    <th className="py-2 pr-3 w-10">#</th>
                    <th className="py-2 pr-3">Nombre completo</th>
                    <th className="py-2 pr-3">Cédula</th>
                    <th className="py-2">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {ocupantes.map((p, i) => (
                    <tr key={p.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="py-2 pr-3">{p.nombreCompleto}</td>
                      <td className="py-2 pr-3 tabular-nums">{p.cedulaOPasaporte}</td>
                      <td className="py-2">{p.rolHabitacion === 'lider' ? 'Líder a cargo' : 'Huésped'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {sinAsignar.length > 0 && (
        <div className="break-inside-avoid">
          <h3 className="mb-2 text-base font-semibold text-[var(--text)]">
            Sin asignar <span className="text-sm font-normal text-[var(--text-muted)]">({sinAsignar.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--text)]">
                  <th className="py-2 pr-3 w-10">#</th>
                  <th className="py-2 pr-3">Nombre completo</th>
                  <th className="py-2 pr-3">Cédula</th>
                </tr>
              </thead>
              <tbody>
                {sinAsignar.map((p, i) => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{i + 1}</td>
                    <td className="py-2 pr-3">{p.nombreCompleto}</td>
                    <td className="py-2 pr-3 tabular-nums">{p.cedulaOPasaporte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const ListasImprimibles = ({
  viaje,
  participantes,
}: {
  viaje: TemploViaje;
  participantes: TemploParticipante[];
}) => {
  const [tipo, setTipo] = useState<TipoLista>('general');
  const queryClient = useQueryClient();
  const aprobados = participantes.filter((p) => p.aprobado);
  const { data: config } = useConfig();

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: LogisticaPayload }) =>
      actualizarLogisticaTemplo(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] }),
  });

  const toggle = (id: number, campo: ColumnaViva['campo'], valor: boolean) => {
    mutation.mutate({ id, payload: { [campo]: valor } });
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TITULOS) as TipoLista[])
            .filter((t) => t !== 'hospedaje' || viaje.incluyeHospedaje)
            .map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors ${
                tipo === t ? 'bg-[var(--brown-700)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
              }`}
            >
              {TITULOS[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)]"
        >
          Imprimir
        </button>
      </div>

      <div id="print-area">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">{TITULOS[tipo]} — Viaje al Templo</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {formatFecha(viaje.fecha)}
            {config?.nombreUnidad ? ` · ${config.nombreUnidad}` : ''}
          </p>
          {(tipo === 'transporte' || tipo === 'desayuno' || tipo === 'almuerzo') && (
            <p className="mt-1 text-xs text-[var(--text-muted)] print:hidden">
              Marca las casillas el día del viaje — se guardan solas, sin necesidad de reimprimir.
            </p>
          )}
        </div>

        {tipo === 'general' && <VistaGeneral viaje={viaje} participantes={aprobados} />}
        {tipo === 'transporte' && (
          <ListaConCheckboxes
            items={aprobados.filter((p) => p.vaEnTransporte).sort(porNombre)}
            columnas={[
              { label: 'Ida', campo: 'subioIda' },
              { label: 'Regreso', campo: 'subioRegreso' },
            ]}
            onToggle={toggle}
            pendiente={mutation.isPending}
          />
        )}
        {tipo === 'desayuno' && (
          <ListaConCheckboxes
            items={aprobados.filter((p) => p.quiereDesayuno).sort(porNombre)}
            columnas={[{ label: 'Entregado', campo: 'desayunoEntregado' }]}
            onToggle={toggle}
            pendiente={mutation.isPending}
          />
        )}
        {tipo === 'almuerzo' && (
          <ListaConCheckboxes
            items={aprobados.filter((p) => p.quiereAlmuerzo).sort(porNombre)}
            columnas={[{ label: 'Entregado', campo: 'almuerzoEntregado' }]}
            onToggle={toggle}
            pendiente={mutation.isPending}
          />
        )}
        {tipo === 'hospedaje' && viaje.incluyeHospedaje && <ListaHospedaje participantes={aprobados} />}
        {tipo === 'ordenanzas' && <ListasOrdenanzas participantes={aprobados} />}
      </div>
    </Card>
  );
};
