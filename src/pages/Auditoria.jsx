import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const accionColor = { crear: "bg-emerald-100 text-emerald-700", editar: "bg-blue-100 text-blue-700", eliminar: "bg-red-100 text-red-600", aprobar: "bg-purple-100 text-purple-700", pagar: "bg-teal-100 text-teal-700", anular: "bg-red-100 text-red-600", recalcular: "bg-amber-100 text-amber-700", ver: "bg-gray-100 text-gray-500" };

export default function Auditoria() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["auditoria"],
    queryFn: () => base44.entities.Auditoria.list("-fecha_hora", 100),
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-gray-500 text-sm mt-1">Registro de actividad del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando registros...</div> : logs.length === 0 ? (
          <div className="p-12 text-center"><ShieldCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin registros de auditoría</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Módulo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Entidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{l.fecha_hora || l.created_date}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{l.usuario_email || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{l.modulo}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell text-xs">{l.entidad}</td>
                    <td className="px-4 py-3"><Badge className={accionColor[l.accion]}>{l.accion}</Badge></td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{l.observacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}