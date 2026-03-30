import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function ResumenAnualIngresos() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return u;
    },
  });

  const { data: empleado } = useQuery({
    queryKey: ["empleado", user?.id],
    queryFn: async () => {
      if (!user?.empleado_id) return null;
      return await base44.entities.Empleado.filter({ id: user.empleado_id });
    },
    enabled: !!user?.empleado_id,
  });

  const emp = empleado?.[0];

  const { data: detallesRaw = [] } = useQuery({
    queryKey: ["detalles", emp?.id, selectedYear],
    queryFn: () => base44.entities.PlanillaDetalle.list(),
    enabled: !!emp?.id,
  });

  const { data: movimientosRaw = [] } = useQuery({
    queryKey: ["movimientos", emp?.id, selectedYear],
    queryFn: () => base44.entities.MovimientoPlanilla.list(),
    enabled: !!emp?.id,
  });

  const detalles = detallesRaw.filter(d => d.empleado_id === emp?.id && d.created_date?.startsWith?.(selectedYear));
  const movimientos = movimientosRaw.filter(m => m.empleado_id === emp?.id && m.created_date?.startsWith?.(selectedYear));

  const totalIngresos = detalles.reduce((s, d) => s + (d.ingresos_totales || 0), 0);
  const totalDeducciones = detalles.reduce((s, d) => s + (d.deducciones_totales || 0), 0);
  const totalNeto = detalles.reduce((s, d) => s + (d.neto_pagar || 0), 0);

  // Desglose por tipo de ingreso
  const ingresos = {};
  movimientos.filter(m => m.tipo_movimiento === "ingreso").forEach(m => {
    ingresos[m.descripcion] = (ingresos[m.descripcion] || 0) + m.monto;
  });

  const deducciones = {};
  movimientos.filter(m => m.tipo_movimiento === "deduccion").forEach(m => {
    deducciones[m.descripcion] = (deducciones[m.descripcion] || 0) + m.monto;
  });

  if (!emp) return <div className="p-6 text-center text-gray-500">Cargando datos...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resumen Anual de Ingresos</h1>
          <p className="text-gray-500 text-sm mt-1">Para declaración de impuestos</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar PDF</Button>
        </div>
      </div>

      {/* Documento */}
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-3xl mx-auto">
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-900">RESUMEN ANUAL DE INGRESOS LABORALES</h2>
          <p className="text-sm text-gray-600 mt-2">Año Fiscal {selectedYear}</p>
        </div>

        <div className="space-y-6">
          {/* Datos del empleado */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">INFORMACIÓN DEL CONTRIBUYENTE</h3>
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-gray-600">Nombre:</p>
                <p className="font-semibold">{emp?.nombre} {emp?.apellidos}</p>
              </div>
              <div>
                <p className="text-gray-600">Identificación:</p>
                <p className="font-semibold">{emp?.identificacion}</p>
              </div>
              <div>
                <p className="text-gray-600">Puesto:</p>
                <p className="font-semibold">{emp?.puesto || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600">Email:</p>
                <p className="font-semibold">{emp?.correo || "—"}</p>
              </div>
            </div>
          </div>

          {/* Resumen de ingresos */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">RESUMEN DE INGRESOS Y DEDUCCIONES</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-700">Total Ingresos Brutos:</span>
                <span className="font-mono font-bold">₡{(totalIngresos / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-700">Total Deducciones (CCSS, ISR, etc.):</span>
                <span className="font-mono font-bold text-red-700">-₡{(totalDeducciones / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between bg-emerald-50 p-3 rounded-lg font-bold">
                <span className="text-emerald-900">Total Ingresos Netos:</span>
                <span className="font-mono text-emerald-700">₡{(totalNeto / 1000000).toFixed(2)}M</span>
              </div>
            </div>
          </div>

          {/* Desglose por concepto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ingresos */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">Desglose de Ingresos</h4>
              <div className="space-y-2 text-sm bg-emerald-50 p-3 rounded-lg">
                {Object.entries(ingresos).map(([concepto, monto]) => (
                  <div key={concepto} className="flex justify-between">
                    <span className="text-gray-700">{concepto}</span>
                    <span className="font-mono">₡{(monto / 1000000).toFixed(2)}M</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deducciones */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">Desglose de Deducciones</h4>
              <div className="space-y-2 text-sm bg-red-50 p-3 rounded-lg">
                {Object.entries(deducciones).map(([concepto, monto]) => (
                  <div key={concepto} className="flex justify-between">
                    <span className="text-gray-700">{concepto}</span>
                    <span className="font-mono">-₡{(monto / 1000000).toFixed(2)}M</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Certificación */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">NOTA IMPORTANTE</p>
            <p>
              Este resumen es para propósitos informativos y debe ser utilizadojunto con los comprobantes de retención de impuestos (si aplica) 
              para la declaración ante la Administración Tributaria. Consulte con su asesor fiscal para asuntos tributarios específicos.
            </p>
          </div>

          {/* Pie de página */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t border-gray-200">
            <p>Emitido automáticamente el {new Date().toLocaleDateString("es-CR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}