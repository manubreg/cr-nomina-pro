import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, TrendingUp } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function ReportePresupuesto() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: empleadosRaw = [] } = useQuery({ queryKey: ["empleados", empresaId], queryFn: () => base44.entities.Empleado.list() });
  const empleados = filterByEmpresa(empleadosRaw);
  
  const { data: periodosRaw = [] } = useQuery({ queryKey: ["periodos", empresaId], queryFn: () => base44.entities.PeriodoPlanilla.list() });
  const periodos = filterByEmpresa(periodosRaw).filter(p => p.fecha_inicio.startsWith(selectedYear));
  
  const { data: planillasRaw = [] } = useQuery({ queryKey: ["planillas", empresaId], queryFn: () => base44.entities.Planilla.list() });
  const planillas = filterByEmpresa(planillasRaw).filter(p => p.fecha_calculo?.startsWith(selectedYear));

  // Proyección anual basada en promedio de salarios actuales
  const salarioMensualPromedio = empleados.reduce((s, e) => s + (e.salario_base || 0), 0) / Math.max(empleados.length, 1);
  const costosProyectados = {
    salarios: Math.round(salarioMensualPromedio * empleados.length * 12),
    ccss: Math.round(salarioMensualPromedio * empleados.length * 12 * 0.1085),
    vacaciones: Math.round(salarioMensualPromedio * empleados.length * 12 * 0.0481),
    aguinaldo: Math.round(salarioMensualPromedio * empleados.length),
  };
  costosProyectados.total = Object.values(costosProyectados).reduce((s, v) => s + v, 0) - costosProyectados.total;

  // Gasto real de planillas ejecutadas
  const gastosReales = {
    salarios: planillas.reduce((s, p) => s + (p.total_ingresos || 0), 0),
    ccss: 0,
    vacaciones: 0,
    aguinaldo: 0,
  };

  const chartData = [
    { concepto: "Salarios", presupuesto: costosProyectados.salarios, real: gastosReales.salarios },
    { concepto: "CCSS", presupuesto: costosProyectados.ccss, real: gastosReales.ccss },
    { concepto: "Vacaciones", presupuesto: costosProyectados.vacaciones, real: gastosReales.vacaciones },
    { concepto: "Aguinaldo", presupuesto: costosProyectados.aguinaldo, real: gastosReales.aguinaldo },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto vs Gasto</h1>
          <p className="text-gray-500 text-sm mt-1">Comparativa de proyección anual vs ejecución real</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Presupuesto Anual", value: `₡${(costosProyectados.total / 1000000).toFixed(1)}M`, color: "bg-blue-50 text-blue-700" },
          { label: "Gasto Ejecutado", value: `₡${(gastosReales.salarios / 1000000).toFixed(1)}M`, color: "bg-emerald-50 text-emerald-700" },
          { label: "Variación", value: `${Math.round(((gastosReales.salarios / costosProyectados.salarios) * 100 - 100) * 10) / 10}%`, color: "bg-purple-50 text-purple-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Comparativa por Concepto
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="concepto" />
            <YAxis />
            <Tooltip formatter={(v) => `₡${(v / 1000000).toFixed(2)}M`} />
            <Legend />
            <Bar dataKey="presupuesto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="real" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Concepto</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Presupuesto</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Real</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Variación</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chartData.map((row, i) => {
              const variacion = row.real - row.presupuesto;
              const pct = row.presupuesto > 0 ? (variacion / row.presupuesto) * 100 : 0;
              return (
                <tr key={i} className={variacion > 0 ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3 text-gray-800 font-medium">{row.concepto}</td>
                  <td className="px-4 py-3 text-right font-mono">₡{(row.presupuesto / 1000000).toFixed(2)}M</td>
                  <td className="px-4 py-3 text-right font-mono">{row.real > 0 ? `₡${(row.real / 1000000).toFixed(2)}M` : "—"}</td>
                  <td className={`px-4 py-3 text-right font-mono ${variacion > 0 ? "text-red-700 font-semibold" : "text-emerald-700"}`}>
                    {variacion > 0 ? "+" : ""}₡{(variacion / 1000000).toFixed(2)}M
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${variacion > 0 ? "text-red-700 font-semibold" : "text-emerald-700"}`}>
                    {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}