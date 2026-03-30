import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, FileText } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReporteISR() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: movimientosRaw = [] } = useQuery({ queryKey: ["movimientos", empresaId], queryFn: () => base44.entities.MovimientoPlanilla.list() });
  const movimientos = filterByEmpresa(movimientosRaw);

  const { data: planillasRaw = [] } = useQuery({ queryKey: ["planillas", empresaId], queryFn: () => base44.entities.Planilla.list() });
  const planillas = filterByEmpresa(planillasRaw).filter(p => p.fecha_calculo?.startsWith?.(selectedYear));

  // ISR del año
  const isrMovimientos = movimientos.filter(m => 
    m.descripcion?.includes("Impuesto") && 
    m.created_date?.startsWith?.(selectedYear)
  );

  const totalISR = isrMovimientos.reduce((s, m) => s + m.monto, 0);
  const totalIngresos = planillas.reduce((s, p) => s + (p.total_ingresos || 0), 0);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const isrPorMes = {};
  for (let i = 1; i <= 12; i++) {
    isrPorMes[i] = isrMovimientos.filter(m => new Date(m.created_date).getMonth() === i - 1).reduce((s, m) => s + m.monto, 0);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de Retenciones ISR</h1>
          <p className="text-gray-500 text-sm mt-1">Para fines fiscales y declarativos</p>
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
          { label: "ISR Retenido", value: `₡${(totalISR / 1000000).toFixed(2)}M`, color: "bg-red-50 text-red-700" },
          { label: "Tasa Efectiva", value: `${((totalISR / totalIngresos) * 100).toFixed(2)}%`, color: "bg-blue-50 text-blue-700" }
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Certificado */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-800">Declaración de Impuestos Sobre la Renta Retenidos</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900">
              <strong>Período Fiscal:</strong> Año {selectedYear}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Mes</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">ISR Retenido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthNames.map((month, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{month}</td>
                    <td className="px-4 py-2 text-right font-mono">₡{(isrPorMes[i + 1] / 1000000).toFixed(2)}M</td>
                  </tr>
                ))}
                <tr className="bg-red-50 font-semibold">
                  <td className="px-4 py-2 text-red-700">Total Anual</td>
                  <td className="px-4 py-2 text-right font-mono text-red-700">₡{(totalISR / 1000000).toFixed(2)}M</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900 space-y-2">
            <p><strong>Base Gravable:</strong> Determinada según la legislación tributaria vigente en Costa Rica.</p>
            <p><strong>Nota Importante:</strong> Este reporte refleja las retenciones efectuadas sobre los ingresos del período. Para la declaración de impuestos ante la Administración Tributaria, consulte con su asesor fiscal.</p>
          </div>
        </div>
      </div>
    </div>
  );
}