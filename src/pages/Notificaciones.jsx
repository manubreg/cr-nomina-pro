import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const tipoColor = {
  contrato_vencer: "bg-amber-100 text-amber-700",
  planilla_pendiente: "bg-blue-100 text-blue-700",
  parametro_vencido: "bg-red-100 text-red-600",
  error_calculo: "bg-red-100 text-red-600",
  vacaciones_vencer: "bg-purple-100 text-purple-700",
  general: "bg-gray-100 text-gray-600",
};

export default function Notificaciones() {
  const qc = useQueryClient();

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => base44.entities.Notificacion.list("-fecha_hora", 50),
  });

  const marcarLeida = useMutation({
    mutationFn: (id) => base44.entities.Notificacion.update(id, { leida: true }),
    onSuccess: () => qc.invalidateQueries(["notificaciones"]),
  });

  const marcarTodasLeidas = async () => {
    const noLeidas = notifs.filter(n => !n.leida);
    await Promise.all(noLeidas.map(n => base44.entities.Notificacion.update(n.id, { leida: true })));
    qc.invalidateQueries(["notificaciones"]);
  };

  const noLeidas = notifs.filter(n => !n.leida).length;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 text-sm mt-1">{noLeidas} no leídas</p>
        </div>
        {noLeidas > 0 && (
          <Button variant="outline" onClick={marcarTodasLeidas} className="text-sm">
            <CheckCheck className="w-4 h-4 mr-2" /> Marcar todas como leídas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando notificaciones...</div>
      ) : notifs.length === 0 ? (
        <div className="p-12 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No hay notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div key={n.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 transition-colors ${n.leida ? "border-gray-100 opacity-70" : "border-blue-200 bg-blue-50/30"}`}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.leida ? "bg-gray-300" : "bg-blue-500"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-sm">{n.titulo}</span>
                  <Badge className={tipoColor[n.tipo] || "bg-gray-100 text-gray-600"}>{n.tipo?.replace(/_/g," ")}</Badge>
                </div>
                <p className="text-sm text-gray-600">{n.mensaje}</p>
                <p className="text-xs text-gray-400 mt-1">{n.fecha_hora || n.created_date}</p>
              </div>
              {!n.leida && (
                <button onClick={() => marcarLeida.mutate(n.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                  Marcar leída
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}