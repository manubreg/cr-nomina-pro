import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Zap } from "lucide-react";

const tipoHoraExtraLabels = {
  diurna: { label: "Diurna", color: "bg-amber-100 text-amber-800" },
  nocturna: { label: "Nocturna", color: "bg-purple-100 text-purple-800" },
  feriado: { label: "Feriado", color: "bg-red-100 text-red-800" },
};

export default function MisHorasExtras() {
  const [empleado, setEmpleado] = useState(null);
  const [horasExtras, setHorasExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (me?.empleado_id) {
        // Cargar datos del empleado
        const empRes = await base44.entities.Empleado.filter({ id: me.empleado_id });
        const emp = empRes[0] || null;
        setEmpleado(emp);

        if (emp?.empresa_id) {
          const empsRes = await base44.entities.Empresa.filter({ id: emp.empresa_id });
          setEmpresa(empsRes[0] || null);
        }

        // Cargar horas extras aprobadas del empleado
        const novedadesRes = await base44.entities.Novedad.filter({
          empleado_id: me.empleado_id,
          tipo_novedad: "horas_extra",
          estado: "aprobada",
        }, "-fecha", 100);
        setHorasExtras(novedadesRes || []);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (!empleado) return <div className="p-8 text-center text-gray-400">No se encontró información de empleado.</div>;

  const totalHoras = horasExtras.reduce((sum, h) => sum + (h.cantidad || 0), 0);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <Zap className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Horas Extras</h1>
          <p className="text-gray-500 text-sm">Historial de horas extra registradas</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total de Horas</div>
          <div className="text-3xl font-bold text-amber-700 mt-2">{totalHoras.toFixed(1)}h</div>
          <div className="text-xs text-gray-500 mt-1">{horasExtras.length} registros</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diurnas</div>
          <div className="text-3xl font-bold text-amber-600 mt-2">
            {horasExtras
              .filter(h => h.tipo_hora_extra === "diurna")
              .reduce((sum, h) => sum + (h.cantidad || 0), 0)
              .toFixed(1)}h
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nocturnas</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">
            {horasExtras
              .filter(h => h.tipo_hora_extra === "nocturna")
              .reduce((sum, h) => sum + (h.cantidad || 0), 0)
              .toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Historial de Horas Extras</h2>
        </div>

        {horasExtras.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tienes horas extras registradas aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Horas</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Tipo</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {horasExtras.map((hora) => {
                  const tipoInfo = tipoHoraExtraLabels[hora.tipo_hora_extra] || tipoHoraExtraLabels.diurna;
                  return (
                    <tr key={hora.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-800 font-medium">{hora.fecha}</td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">{hora.cantidad}h</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tipoInfo.color}`}>
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Aprobada
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{hora.comentario || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}