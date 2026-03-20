import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, User, ChevronDown } from "lucide-react";

const fmt = (n) => `₡${Number(n || 0).toLocaleString("es-CR")}`;
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `₡${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₡${(v / 1_000).toFixed(0)}K`;
  return `₡${v}`;
};

export default function ReporteHistorialSalarial() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState("");

  const { data: empleadosRaw = [] } = useQuery({
    queryKey: ["empleados", empresaId],
    queryFn: () => base44.entities.Empleado.list("-nombre", 300),
  });
  const empleados = filterByEmpresa(empleadosRaw).filter(e => e.estado === "activo" || e.estado === "inactivo");

  const { data: planillasRaw = [] } = useQuery({
    queryKey: ["planillas-reporte", empresaId],
    queryFn: () => base44.entities.Planilla.filter({ estado: "pagado" }, "-fecha_calculo", 200)
      .catch(() => base44.entities.Planilla.list("-fecha_calculo", 200)),
  });
  const planillas = filterByEmpresa(planillasRaw);

  const { data: periodos = [] } = useQuery({
    queryKey: ["periodos"],
    queryFn: () => base44.entities.PeriodoPlanilla.list("-fecha_inicio", 200),
  });

  const { data: detalles = [], isLoading: loadingDetalles } = useQuery({
    queryKey: ["detalles-historial", selectedEmpleadoId],
    queryFn: () => selectedEmpleadoId
      ? base44.entities.PlanillaDetalle.filter({ empleado_id: selectedEmpleadoId }, "-created_date", 100)
      : Promise.resolve([]),
    enabled: !!selectedEmpleadoId,
  });

  const periodoMap = useMemo(() => Object.fromEntries(periodos.map(p => [p.id, p])), [periodos]);
  const planillaMap = useMemo(() => Object.fromEntries(planillas.map(p => [p.id, p])), [planillas]);

  const historial = useMemo(() => {
    return detalles
      .map(det => {
        const planilla = planillaMap[det.planilla_id];
        if (!planilla) return null;
        const periodo = periodoMap[planilla.periodo_id];
        return {
          ...det,
          planilla,
          periodo,
          label: periodo
            ? `${periodo.fecha_inicio?.slice(0, 7)} (${periodo.tipo_periodo})`
            : planilla.codigo_planilla || planilla.fecha_calculo?.slice(0, 7) || "—",
          fecha_orden: periodo?.fecha_inicio || planilla.fecha_calculo || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.fecha_orden.localeCompare(b.fecha_orden));
  }, [detalles, planillaMap, periodoMap]);

  const empleadoSel = empleados.find(e => e.id === selectedEmpleadoId);

  const handleExportCSV = () => {
    const headers = ["Período", "Tipo", "Fecha Inicio", "Fecha Fin", "Salario Base", "Total Ingresos", "Total Deducciones", "Neto a Pagar"];
    const rows = historial.map(h => [
      h.planilla?.codigo_planilla || "—",
      h.periodo?.tipo_periodo || "—",
      h.periodo?.fecha_inicio || "—",
      h.periodo?.fecha_fin || "—",
      h.salario_base_periodo,
      h.ingresos_totales,
      h.deducciones_totales,
      h.neto_pagar,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_salarial_${empleadoSel?.nombre}_${empleadoSel?.apellidos}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Resumen estadístico
  const stats = useMemo(() => {
    if (!historial.length) return null;
    const netos = historial.map(h => h.neto_pagar || 0);
    return {
      promedio: netos.reduce((a, b) => a + b, 0) / netos.length,
      maximo: Math.max(...netos),
      minimo: Math.min(...netos),
      total: netos.reduce((a, b) => a + b, 0),
      periodos: historial.length,
    };
  }, [historial]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial Salarial</h1>
          <p className="text-gray-500 text-sm mt-1">Evolución de ingresos, deducciones y neto por empleado</p>
        </div>
        {historial.length > 0 && (
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        )}
      </div>

      {/* Selector de empleado */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <User className="w-4 h-4" /> Empleado:
          </div>
          <Select value={selectedEmpleadoId} onValueChange={setSelectedEmpleadoId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Seleccionar empleado..." />
            </SelectTrigger>
            <SelectContent>
              {empleados.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombre} {e.apellidos}
                  {e.estado === "inactivo" && <span className="text-gray-400 ml-1">(inactivo)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {empleadoSel && (
            <div className="flex items-center gap-2 text-sm text-gray-500 ml-2">
              <Badge className="bg-blue-100 text-blue-700">{empleadoSel.puesto || "Sin puesto"}</Badge>
              <span>·</span>
              <span>{empleadoSel.frecuencia_pago || "mensual"}</span>
            </div>
          )}
        </div>
      </div>

      {!selectedEmpleadoId && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">Seleccione un empleado para ver su historial salarial</p>
        </div>
      )}

      {selectedEmpleadoId && loadingDetalles && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Cargando historial...
        </div>
      )}

      {selectedEmpleadoId && !loadingDetalles && historial.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No se encontraron planillas procesadas para este empleado.
        </div>
      )}

      {historial.length > 0 && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Períodos", value: stats.periodos, isNumber: true, color: "text-gray-800" },
              { label: "Promedio Neto", value: fmt(stats.promedio), color: "text-blue-700" },
              { label: "Máximo Neto", value: fmt(stats.maximo), color: "text-emerald-700" },
              { label: "Mínimo Neto", value: fmt(stats.minimo), color: "text-amber-700" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.isNumber ? s.value : s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Evolución Salarial</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={historial} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={45} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name) => [fmt(val), name]}
                  labelStyle={{ fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="ingresos_totales" name="Ingresos" stroke="#3b82f6" fill="url(#gradIngreso)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="deducciones_totales" name="Deducciones" stroke="#f59e0b" fill="url(#gradDed)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="neto_pagar" name="Neto a Pagar" stroke="#10b981" fill="url(#gradNeto)" strokeWidth={2.5} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla detallada */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Detalle por Período</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Período / Planilla</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tipo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Base</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Deducciones</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase font-bold">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...historial].reverse().map((h, i) => (
                    <tr key={h.id || i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{h.planilla?.codigo_planilla || "—"}</div>
                        <div className="text-xs text-gray-400">
                          {h.periodo?.fecha_inicio} → {h.periodo?.fecha_fin}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge className="bg-gray-100 text-gray-600 capitalize text-xs">{h.periodo?.tipo_periodo || "—"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">{fmt(h.salario_base_periodo)}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-700 font-medium">{fmt(h.ingresos_totales)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">{fmt(h.deducciones_totales)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{fmt(h.neto_pagar)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total acumulado</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-700 text-xs">
                      {fmt(historial.reduce((s, h) => s + (h.salario_base_periodo || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">
                      {fmt(historial.reduce((s, h) => s + (h.ingresos_totales || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-600">
                      {fmt(historial.reduce((s, h) => s + (h.deducciones_totales || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {fmt(historial.reduce((s, h) => s + (h.neto_pagar || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}