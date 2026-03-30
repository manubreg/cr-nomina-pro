import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, AlertTriangle } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ReporteVacaciones() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: vacacionesRaw = [] } = useQuery({ queryKey: ["vacaciones", empresaId], queryFn: () => base44.entities.VacacionSaldo.list() });
  const vacaciones = filterByEmpresa(vacacionesRaw);

  const vacData = empleados.map(emp => {
    const vac = vacaciones.find(v => v.empleado_id === emp.id) || {};
    return {
      empleado: `${emp.nombre} ${emp.apellidos}`,
      ganados: vac.dias_ganados || 0,
      usados: vac.dias_usados || 0,
      disponibles: vac.dias_disponibles || 0,
      vencimiento: vac.fecha_vencimiento,
      estado: vac.estado || "vigente"
    };
  }).sort((a, b) => a.disponibles - b.disponibles);

  const totalGanados = vacData.reduce((s, v) => s + v.ganados, 0);
  const totalUsados = vacData.reduce((s, v) => s + v.usados, 0);
  const totalDisponibles = vacData.reduce((s, v) => s + v.disponibles, 0);
  const vacVencidas = vacData.filter(v => v.estado === "vencido").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Vacaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Control de saldo disponible vs usado</p>
        </div>
        <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar</Button>
      </div>

      {/* Alerta vacaciones vencidas */}
      {vacVencidas > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{vacVencidas} empleado(s) con vacaciones vencidas</p>
            <p className="text-sm text-red-700 mt-0.5">Estas vacaciones ya no pueden ser disfrutadas.</p>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[{ label: "Días Ganados", value: totalGanados, color: "bg-emerald-50 text-emerald-700" },
          { label: "Días Usados", value: totalUsados, color: "bg-blue-50 text-blue-700" },
          { label: "Días Disponibles", value: totalDisponibles, color: "bg-amber-50 text-amber-700" },
          { label: "Empleados", value: vacData.length, color: "bg-purple-50 text-purple-700" }
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
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Ganados</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Usados</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Disponibles</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Vencimiento</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vacData.map((row, i) => (
              <tr key={i} className={row.disponibles === 0 ? "bg-red-50" : row.disponibles < 3 ? "bg-yellow-50" : "hover:bg-gray-50"}>
                <td className="px-4 py-3 text-gray-800">{row.empleado}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">{row.ganados}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">{row.usados}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{row.disponibles}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{row.vencimiento || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={
                    row.estado === "vencido" ? "bg-red-100 text-red-700" :
                    row.estado === "agotado" ? "bg-gray-100 text-gray-700" :
                    "bg-emerald-100 text-emerald-700"
                  }>
                    {row.estado}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}