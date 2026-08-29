import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { ORDENANZAS, GENEROS, campoCupoOrdenanza } from '../../../types';
import { ListasImprimibles } from './ListasImprimibles';
import type { TemploParticipante, TemploViaje } from '../../../types';

const StatCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card className="flex items-center gap-3">
    <div>
      <p className="text-lg font-semibold tabular-nums text-[var(--text)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">
        {label}
        {sub && <span className="text-[var(--text-muted)]"> · {sub}</span>}
      </p>
    </div>
  </Card>
);

export const ReportesViaje = ({
  viaje,
  participantes,
}: {
  viaje: TemploViaje;
  participantes: TemploParticipante[];
}) => {
  const [soloAprobados, setSoloAprobados] = useState(true);
  const lista = soloAprobados ? participantes.filter((p) => p.aprobado) : participantes;

  const transporte = lista.filter((p) => p.vaEnTransporte).length;
  const hospedaje = lista.filter((p) => p.necesitaHospedaje).length;
  const desayuno = lista.filter((p) => p.quiereDesayuno).length;
  const almuerzo = lista.filter((p) => p.quiereAlmuerzo).length;
  const totalRecaudar = lista.reduce((sum, p) => sum + parseFloat(p.costoTotal), 0);

  const todosLosAbonos = lista.flatMap((p) => p.abonos ?? []);
  const totalAbonado = todosLosAbonos.reduce((sum, a) => sum + parseFloat(a.valor), 0);
  const saldoPendiente = totalRecaudar - totalAbonado;

  const totalDonativoIglesia = todosLosAbonos
    .filter((a) => a.tipo === 'donativo_iglesia')
    .reduce((sum, a) => sum + parseFloat(a.valor), 0);

  const porCobrador = new Map<string, number>();
  for (const a of todosLosAbonos) {
    if (a.tipo !== 'pagado_persona' || !a.cobrador) continue;
    porCobrador.set(a.cobrador.nombre, (porCobrador.get(a.cobrador.nombre) ?? 0) + parseFloat(a.valor));
  }
  const resumenCobradores = Array.from(porCobrador.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSoloAprobados(true)}
          className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
            soloAprobados ? 'bg-[var(--brown-700)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
          }`}
        >
          Solo aprobados
        </button>
        <button
          type="button"
          onClick={() => setSoloAprobados(false)}
          className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
            !soloAprobados ? 'bg-[var(--brown-700)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
          }`}
        >
          Todos (incluye pendientes)
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {viaje.incluyeTransporte && (
          <StatCard label="Transporte" value={`${transporte} / ${viaje.cuposTransporte}`} />
        )}
        {viaje.incluyeHospedaje && (
          <StatCard label="Hospedaje" value={`${hospedaje} / ${viaje.cuposHospedaje}`} />
        )}
        {viaje.incluyeDesayuno && <StatCard label="Quieren desayuno" value={`${desayuno}`} />}
        {viaje.incluyeAlmuerzo && <StatCard label="Quieren almuerzo" value={`${almuerzo}`} />}
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Ordenanzas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="py-2 pr-4">Ordenanza</th>
                <th className="py-2 pr-4">Hombres</th>
                <th className="py-2 pr-4">Mujeres</th>
                <th className="py-2 pr-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {ORDENANZAS.map((ord) => {
                const porGenero = GENEROS.map((genero) => {
                  const cupoCampo = campoCupoOrdenanza(ord, genero) as keyof TemploViaje;
                  const cupoTotal = viaje[cupoCampo] as number;
                  const count = lista.filter(
                    (p) => p.genero === genero && p.ordenanzas.split(', ').filter(Boolean).includes(ord),
                  ).length;
                  return { genero, count, cupoTotal };
                });
                const totalOrd = porGenero.reduce((sum, g) => sum + g.count, 0);
                const cupoTotalOrd = porGenero.reduce((sum, g) => sum + g.cupoTotal, 0);
                return (
                  <tr key={ord} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 text-sm font-medium text-[var(--text)]">{ord}</td>
                    {porGenero.map((g) => (
                      <td key={g.genero} className="py-2.5 pr-4 text-sm tabular-nums text-[var(--text)]">
                        {g.count} / {g.cupoTotal}
                      </td>
                    ))}
                    <td className="py-2.5 pr-4 text-sm font-semibold tabular-nums text-[var(--text)]">
                      {totalOrd} / {cupoTotalOrd}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[var(--text-muted)]">Total a recaudar</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--text)]">${totalRecaudar.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)]">Abonado</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--success)]">${totalAbonado.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)]">Saldo pendiente</p>
          <p
            className={`text-xl font-semibold tabular-nums ${saldoPendiente > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}
          >
            ${saldoPendiente.toFixed(2)}
          </p>
        </Card>
      </div>
      <p className="-mt-4 text-xs text-[var(--text-muted)]">
        {soloAprobados ? 'Solo participantes aprobados' : 'Todos los participantes'} — referencial, no reemplaza la
        contabilidad oficial del barrio.
      </p>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Efectivo por cobrador</h3>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Cuánto le han pagado en efectivo a cada hermano — para que sepa cuánto debe entregar.
        </p>
        {resumenCobradores.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Todavía no hay pagos registrados a una persona.</p>
        ) : (
          <div className="space-y-2">
            {resumenCobradores.map(([nombre, total]) => (
              <div key={nombre} className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text)]">{nombre}</span>
                <span className="font-semibold tabular-nums text-[var(--text)]">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Donativo directo al sistema de la Iglesia: <span className="font-semibold">${totalDonativoIglesia.toFixed(2)}</span>
        </p>
      </Card>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Listas para imprimir</h3>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Solo participantes aprobados — para entregar al chofer, al equipo de alimentación o enviar al templo.
        </p>
        <ListasImprimibles viaje={viaje} participantes={participantes} />
      </div>
    </div>
  );
};
