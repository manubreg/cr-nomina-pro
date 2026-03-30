import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, AlertCircle } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ReporteIncapacidades() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: incapacidadesRaw = [] } = useQuery({ queryKey: ["incapacidades", empresaId], queryFn: () => base44.entities.Incapacidad.list() });
  const incapacidades = filterByEmpresa(incapacidadesRaw);

  const incapData = incapacidades.map(inc => {
    const emp = empleados.find(e => e.id === inc.empleado_id);
    const hoy = new Date().toISOString().split("T")[0];
    const estado = inc.fecha_fin < hoy ? "finalizada" : "activa";
    return {
      empleado: emp ? `${emp.nombre} ${emp.apellidos}` : "—",
      tipo: inc.tipo_incapacidad,
      entidad: inc.entidad_emisora,
      inicio: inc.fecha_inicio,
      fin: inc.fecha_fin,
      dias: inc.dias,
      porcentaje: inc.porcentaje_reconocimiento,
      estado
    };
  }).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

  const activas = incapData.filter(i => i.estado === "activa");
  const totalDias = incapData.reduce((s, i) => s + i.dias, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Incapacidades</h1>
          <p className="text-gray-500 text-sm mt-1">Seguimiento de incapacidades activas y finalizadas</p>
        </div>
        <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar</Button>
      </div>

      {/* Alerta incapacidades activas */}
      {activas.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">{activas.length} incapacidad(es) activa(s)</p>
            <p className="text-sm text-yellow-700 mt-0.5">Hay empleados con incapacidades vigentes que requieren seguimiento.</p>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[{ label: "Total Incapacidades", value: incapData.length, color: "bg-blue-50 text-blue-700" },
          { label: "Incapacidades Activas", value: activas.length, color: "bg-red-50 text-red-700" },
          { label: "Total Días Generados", value: totalDias, color: "bg-emerald-50 text-emerald-700" }
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Entidad</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Inicio</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fin</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Días</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">%</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {incapData.map((row, i) => (
              <tr key={i} className={row.estado === "activa" ? "bg-yellow-50" : "hover:bg-gray-50"}>
                <td className="px-4 py-3 text-gray-800">{row.empleado}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">{row.tipo.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.entidad}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.inicio}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.fin}</td>
                <td className="px-4 py-3 text-right font-mono">{row.dias}</td>
                <td className="px-4 py-3 text-right font-mono">{row.porcentaje}%</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={row.estado === "activa" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
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