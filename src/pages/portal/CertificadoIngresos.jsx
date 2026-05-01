import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CertificadoIngresos() {
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

  const { data: planillasRaw = [] } = useQuery({
    queryKey: ["planillas", emp?.id],
    queryFn: () => base44.entities.Planilla.list(),
    enabled: !!emp?.id,
  });

  const { data: detallesRaw = [] } = useQuery({
    queryKey: ["detalles", emp?.id],
    queryFn: () => base44.entities.PlanillaDetalle.list(),
    enabled: !!emp?.id,
  });

  const detalles = detallesRaw.filter(d => d.empleado_id === emp?.id);
  const totalIngresos = detalles.reduce((s, d) => s + (d.ingresos_totales || 0), 0);
  const totalDeducciones = detalles.reduce((s, d) => s + (d.deducciones_totales || 0), 0);

  if (!emp) return <div className="p-6 text-center text-gray-500">Cargando datos...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificado de Ingresos</h1>
          <p className="text-gray-500 text-sm mt-1">Para solicitudes de crédito e hipotecas</p>
        </div>
        <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Descargar PDF</Button>
      </div>

      {/* Certificado */}
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-2xl mx-auto">
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-900">CERTIFICADO DE INGRESOS LABORALES</h2>
          <p className="text-sm text-gray-600 mt-2">Válido para trámites de crédito y financiamiento</p>
        </div>

        <div className="space-y-6">
          {/* Datos del empleado */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">DATOS DEL SOLICITANTE</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Nombre Completo:</p>
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
                <p className="text-gray-600">Antigüedad:</p>
                <p className="font-semibold">
                  {emp?.fecha_ingreso ? `${new Date().getFullYear() - new Date(emp.fecha_ingreso).getFullYear()} años` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Datos de ingresos */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">DATOS DE INGRESOS</h3>
            <div className="space-y-3 text-sm border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between">
                <span className="text-gray-600">Salario Base Mensual:</span>
                <span className="font-mono font-semibold">₡{(emp?.salario_base / 1000).toLocaleString()}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ingresos Brutos Acumulados:</span>
                <span className="font-mono font-semibold">₡{(totalIngresos / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deducciones Acumuladas:</span>
                <span className="font-mono font-semibold">₡{(totalDeducciones / 1000000).toFixed(2)}M</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                <span>Ingreso Neto Mensual Promedio:</span>
                <span className="font-mono text-emerald-700">
                  ₡{detalles.length > 0 ? ((totalIngresos - totalDeducciones) / detalles.length / 1000).toLocaleString() : "0"}K
                </span>
              </div>
            </div>
          </div>

          {/* Declaración */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">CERTIFICACIÓN</p>
            <p>
              Se certifica que <strong>{emp?.nombre} {emp?.apellidos}</strong>, con cédula de identidad <strong>{emp?.identificacion}</strong>, 
              labora en esta empresa como <strong>{emp?.puesto || "empleado"}</strong>, percibiendo ingresos mensuales promedio de 
              <strong> ₡{detalles.length > 0 ? ((totalIngresos - totalDeducciones) / detalles.length / 1000).toLocaleString() : "0"}K</strong>.
            </p>
          </div>

          {/* Pie de página */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t border-gray-200">
            <p>Documento emitido automáticamente el {new Date().toLocaleDateString("es-CR")}</p>
            <p>Este certificado tiene validez para trámites de crédito e hipotecas</p>
          </div>
        </div>
      </div>
    </div>
  );
}