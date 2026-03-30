import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, TrendingUp } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ReporteCambiosSalariales() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: historialRaw = [] } = useQuery({ queryKey: ["historial", empresaId], queryFn: () => base44.entities.HistorialSalario.list() });
  const historial = filterByEmpresa(historialRaw).sort((a, b) => new Date(b.fecha_efectiva) - new Date(a.fecha_efectiva));

  const cambiosData = historial.map(h => {
    const emp = empleados.find(e => e.id === h.empleado_id);
    const diferencia = h.salario_nuevo - (h.salario_anterior || 0);
    const porcentaje = h.salario_anterior > 0 ? ((diferencia / h.salario_anterior) * 100) : 0;
    return {
      empleado: emp ? `${emp.nombre} ${emp.apellidos}` : "—",
      puesto: emp?.puesto || "—",
      anterior: h.salario_anterior || 0,
      nuevo: h.salario_nuevo,
      diferencia,
      porcentaje,
      fecha: h.fecha_efectiva,
      motivo: h.motivo || "Ajuste salarial",
      razon: h.razon || "—"
    };
  });

  const totalCambios = cambiosData.length;
  const costosAdicionalesAnuales = cambiosData.reduce((s, c) => s + (c.diferencia * 12), 0);
  const aumentoPromedio = cambiosData.length > 0 ? cambiosData.reduce((s, c) => s + c.porcentaje, 0) / cambiosData.length : 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Cambios Salariales</h1>
          <p className="text-gray-500 text-sm mt-1">Auditoría de aumentos y ajustes de salarios</p>
        </div>
        <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar</Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Cambios", value: totalCambios, color: "bg-blue-50 text-blue-700" },
          { label: "Aumento Promedio", value: `${aumentoPromedio.toFixed(2)}%`, color: "bg-emerald-50 text-emerald-700" },
          { label: "Costo Anual Adicional", value: `₡${(costosAdicionalesAnuales / 1000000).toFixed(2)}M`, color: "bg-purple-50 text-purple-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Empleado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Puesto</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Salario Anterior</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Salario Nuevo</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Diferencia</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">%</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cambiosData.map((row, i) => (
              <tr key={i} className={row.diferencia > 0 ? "bg-emerald-50" : "hover:bg-gray-50"}>
                <td className="px-4 py-3 text-gray-800 font-medium">{row.empleado}</td>
                <td className="px-4 py-3 text-gray-600 text-xs hidden lg:table-cell">{row.puesto}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">₡{(row.anterior / 1000000).toFixed(2)}M</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">₡{(row.nuevo / 1000000).toFixed(2)}M</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                  {row.diferencia > 0 ? "+" : ""}₡{(row.diferencia / 1000000).toFixed(2)}M
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                  {row.porcentaje > 0 ? "+" : ""}{row.porcentaje.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{row.fecha}</td>
                <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">
                  <Badge className="bg-blue-100 text-blue-700 text-xs">{row.motivo}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Estadísticas */}
      {cambiosData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> Mayor Aumento
            </h3>
            {(() => {
              const mayor = cambiosData.reduce((m, c) => c.porcentaje > m.porcentaje ? c : m);
              return (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600"><strong>{mayor.empleado}</strong></p>
                  <p className="text-sm text-gray-600">Aumento: <span className="font-bold text-emerald-700">{mayor.porcentaje.toFixed(2)}%</span></p>
                  <p className="text-sm text-gray-600">Diferencia: <span className="font-bold text-emerald-700">₡{(mayor.diferencia / 1000000).toFixed(2)}M</span></p>
                </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Resumen por Período</h3>
            {(() => {
              const porAno = {};
              cambiosData.forEach(c => {
                const ano = c.fecha.substring(0, 4);
                porAno[ano] = (porAno[ano] || 0) + 1;
              });
              return (
                <div className="space-y-2">
                  {Object.entries(porAno).sort((a, b) => b[0] - a[0]).map(([ano, count]) => (
                    <div key={ano} className="flex justify-between">
                      <span className="text-sm text-gray-600">Año {ano}</span>
                      <span className="font-semibold text-gray-800">{count} cambio(s)</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}