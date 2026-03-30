import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, Calendar } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReporteHorasExtras() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: novedadesRaw = [] } = useQuery({ queryKey: ["novedades", empresaId], queryFn: () => base44.entities.Novedad.list() });
  const novedades = filterByEmpresa(novedadesRaw).filter(n => n.tipo_novedad === "horas_extra" && n.estado === "aprobada");

  const horasExtrasData = empleados.map(emp => {
    const horasEmp = novedades.filter(n => n.empleado_id === emp.id && n.fecha.startsWith(selectedYear));
    const diurnas = horasEmp.filter(h => h.tipo_hora_extra === "diurna").reduce((s, h) => s + (h.cantidad || 0), 0);
    const nocturnas = horasEmp.filter(h => h.tipo_hora_extra === "nocturna").reduce((s, h) => s + (h.cantidad || 0), 0);
    const feriados = horasEmp.filter(h => h.tipo_hora_extra === "feriado").reduce((s, h) => s + (h.cantidad || 0), 0);
    const total = diurnas + nocturnas + feriados;
    return { empleado: `${emp.nombre} ${emp.apellidos}`, diurnas, nocturnas, feriados, total };
  }).filter(r => r.total > 0);

  const totalDiurnas = horasExtrasData.reduce((s, r) => s + r.diurnas, 0);
  const totalNocturnas = horasExtrasData.reduce((s, r) => s + r.nocturnas, 0);
  const totalFeriados = horasExtrasData.reduce((s, r) => s + r.feriados, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Horas Extras</h1>
          <p className="text-gray-500 text-sm mt-1">Acumulado por empleado y tipo</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar</Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[{ label: "Total Horas", value: Math.round((totalDiurnas + totalNocturnas + totalFeriados) * 10) / 10, color: "bg-blue-50 text-blue-700" },
          { label: "Diurnas (25%)", value: Math.round(totalDiurnas * 10) / 10, color: "bg-amber-50 text-amber-700" },
          { label: "Nocturnas (35%)", value: Math.round(totalNocturnas * 10) / 10, color: "bg-purple-50 text-purple-700" },
          { label: "Feriados", value: Math.round(totalFeriados * 10) / 10, color: "bg-red-50 text-red-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}h</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Empleado</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Diurnas</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Nocturnas</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Feriados</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {horasExtrasData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{row.empleado}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{(Math.round(row.diurnas * 10) / 10).toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">{(Math.round(row.nocturnas * 10) / 10).toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{(Math.round(row.feriados * 10) / 10).toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{(Math.round(row.total * 10) / 10).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}