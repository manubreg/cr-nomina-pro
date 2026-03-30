import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, FileText } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReporteCCSS() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: movimientosRaw = [] } = useQuery({ queryKey: ["movimientos", empresaId], queryFn: () => base44.entities.MovimientoPlanilla.list() });
  const movimientos = filterByEmpresa(movimientosRaw);

  // Filtrar CCSS del mes/año
  const ccssMovimientos = movimientos.filter(m => 
    m.descripcion?.includes("CCSS") && 
    m.created_date?.startsWith?.(selectedYear) &&
    new Date(m.created_date).getMonth() === selectedMonth
  );

  const totalSEM = ccssMovimientos.filter(m => m.descripcion?.includes("SEM")).reduce((s, m) => s + m.monto, 0);
  const totalIVM = ccssMovimientos.filter(m => m.descripcion?.includes("IVM")).reduce((s, m) => s + m.monto, 0);
  const totalBP = ccssMovimientos.filter(m => m.descripcion?.includes("Banco Popular")).reduce((s, m) => s + m.monto, 0);
  const totalCCSS = totalSEM + totalIVM + totalBP;

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprobante CCSS</h1>
          <p className="text-gray-500 text-sm mt-1">Resumen de aportes por mes</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthNames.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
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
        {[
          { label: "SEM (Enfermedad)", value: `₡${(totalSEM / 1000000).toFixed(2)}M`, color: "bg-blue-50 text-blue-700" },
          { label: "IVM (Vejez/Invalidez)", value: `₡${(totalIVM / 1000000).toFixed(2)}M`, color: "bg-emerald-50 text-emerald-700" },
          { label: "Banco Popular", value: `₡${(totalBP / 1000000).toFixed(2)}M`, color: "bg-amber-50 text-amber-700" },
          { label: "Total CCSS", value: `₡${(totalCCSS / 1000000).toFixed(2)}M`, color: "bg-purple-50 text-purple-700" }
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
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Comprobante de Aporte a CCSS</h2>
        </div>

        <div className="space-y-6">
          <div className="border-t-4 border-blue-600 pt-4">
            <h3 className="font-semibold text-gray-800 mb-4">Período: {monthNames[selectedMonth]} {selectedYear}</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-700">Aporte SEM (Seguro de Enfermedad)</span>
                <span className="font-mono font-semibold">₡{(totalSEM / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-700">Aporte IVM (Vejez, Invalidez y Muerte)</span>
                <span className="font-mono font-semibold">₡{(totalIVM / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-700">Aporte Fondo Solidario (Banco Popular)</span>
                <span className="font-mono font-semibold">₡{(totalBP / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between bg-blue-50 p-3 rounded-lg">
                <span className="font-semibold text-blue-900">Total a Pagar a CCSS</span>
                <span className="font-mono font-bold text-lg text-blue-700">₡{(totalCCSS / 1000000).toFixed(2)}M</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-6">
            <p><strong>Nota:</strong> Este comprobante refleja los aportes realizados en el período indicado. Los porcentajes se calculan sobre la base imponible según el inciso E de la Ley Constitutiva de la CCSS.</p>
          </div>
        </div>
      </div>
    </div>
  );
}