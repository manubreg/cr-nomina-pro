import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

export default function ReporteConceptosPago() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: movimientosRaw = [] } = useQuery({ queryKey: ["movimientos", empresaId], queryFn: () => base44.entities.MovimientoPlanilla.list() });
  const movimientos = filterByEmpresa(movimientosRaw).filter(m => m.planilla_id?.startsWith?.(selectedYear) || m.created_date?.startsWith?.(selectedYear));

  // Agrupar por concepto y tipo
  const ingresos = {};
  const deducciones = {};
  movimientos.forEach(m => {
    const desc = m.descripcion || "Otros";
    if (m.tipo_movimiento === "ingreso") {
      ingresos[desc] = (ingresos[desc] || 0) + m.monto;
    } else {
      deducciones[desc] = (deducciones[desc] || 0) + m.monto;
    }
  });

  const ingresosData = Object.entries(ingresos).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const deduccionesData = Object.entries(deducciones).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const totalIngresos = Object.values(ingresos).reduce((s, v) => s + v, 0);
  const totalDeducciones = Object.values(deducciones).reduce((s, v) => s + v, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Conceptos de Pago</h1>
          <p className="text-gray-500 text-sm mt-1">Desglose de ingresos y deducciones</p>
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
          { label: "Total Ingresos", value: `₡${(totalIngresos / 1000000).toFixed(2)}M`, color: "bg-emerald-50 text-emerald-700" },
          { label: "Total Deducciones", value: `₡${(totalDeducciones / 1000000).toFixed(2)}M`, color: "bg-red-50 text-red-700" },
          { label: "Neto", value: `₡${((totalIngresos - totalDeducciones) / 1000000).toFixed(2)}M`, color: "bg-blue-50 text-blue-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Distribución de Ingresos</h2>
          {ingresosData.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={ingresosData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${percent > 5 ? name : ""}`}>
                  {ingresosData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Distribución de Deducciones</h2>
          {deduccionesData.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={deduccionesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${percent > 5 ? name : ""}`}>
                  {deduccionesData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-emerald-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-emerald-700">Ingresos</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Concepto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Monto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingresosData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800 text-xs">{row.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-700">₡{(row.value / 1000000).toFixed(2)}M</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-600">{((row.value / totalIngresos) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-emerald-50 font-semibold">
                <td className="px-4 py-2 text-emerald-700">Total</td>
                <td className="px-4 py-2 text-right font-mono text-emerald-700">₡{(totalIngresos / 1000000).toFixed(2)}M</td>
                <td className="px-4 py-2 text-right font-mono text-emerald-700">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Deducciones */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-red-700">Deducciones</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Concepto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Monto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deduccionesData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800 text-xs">{row.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-700">₡{(row.value / 1000000).toFixed(2)}M</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-600">{((row.value / totalDeducciones) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-red-50 font-semibold">
                <td className="px-4 py-2 text-red-700">Total</td>
                <td className="px-4 py-2 text-right font-mono text-red-700">₡{(totalDeducciones / 1000000).toFixed(2)}M</td>
                <td className="px-4 py-2 text-right font-mono text-red-700">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}