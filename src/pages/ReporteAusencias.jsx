import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReporteAusencias() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: novedadesRaw = [] } = useQuery({ queryKey: ["novedades", empresaId], queryFn: () => base44.entities.Novedad.list() });
  const novedades = filterByEmpresa(novedadesRaw).filter(n => ["ausencia", "tardía", "permiso_sin_goce"].includes(n.tipo_novedad) && n.estado === "aprobada");

  const ausenciasData = empleados.map(emp => {
    const novEmp = novedades.filter(n => n.empleado_id === emp.id && n.fecha.startsWith(selectedYear));
    const ausencias = novEmp.filter(n => n.tipo_novedad === "ausencia").reduce((s, n) => s + (n.cantidad || 0), 0);
    const tardias = novEmp.filter(n => n.tipo_novedad === "tardía").reduce((s, n) => s + (n.cantidad || 0), 0);
    const permisosSinGoce = novEmp.filter(n => n.tipo_novedad === "permiso_sin_goce").reduce((s, n) => s + (n.cantidad || 0), 0);
    const total = ausencias + tardias + permisosSinGoce;
    return { empleado: `${emp.nombre} ${emp.apellidos}`, ausencias, tardias, permisosSinGoce, total };
  }).filter(r => r.total > 0);

  const totalAusencias = ausenciasData.reduce((s, r) => s + r.ausencias, 0);
  const totalTardias = ausenciasData.reduce((s, r) => s + r.tardias, 0);
  const totalPermisos = ausenciasData.reduce((s, r) => s + r.permisosSinGoce, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Ausencias y Permisos</h1>
          <p className="text-gray-500 text-sm mt-1">Inasistencias, tardanzas y permisos sin goce</p>
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
        {[{ label: "Ausencias", value: totalAusencias, color: "bg-red-50 text-red-700" },
          { label: "Tardanzas", value: totalTardias, color: "bg-yellow-50 text-yellow-700" },
          { label: "Permisos Sin Goce", value: totalPermisos, color: "bg-orange-50 text-orange-700" },
          { label: "Empleados Afectados", value: ausenciasData.length, color: "bg-blue-50 text-blue-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
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
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Ausencias</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Tardanzas</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Permisos Sin Goce</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Días</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ausenciasData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{row.empleado}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{row.ausencias}</td>
                <td className="px-4 py-3 text-right font-mono text-yellow-700">{row.tardias}</td>
                <td className="px-4 py-3 text-right font-mono text-orange-700">{row.permisosSinGoce}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}