import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Umbrella, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { pendiente: "bg-yellow-100 text-yellow-700", aprobada: "bg-emerald-100 text-emerald-700", rechazada: "bg-red-100 text-red-600", aplicada: "bg-blue-100 text-blue-700" };

export default function MisVacaciones() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [saldo, setSaldo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [empleadoId, setEmpleadoId] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fecha_inicio: "", fecha_fin: "", dias_solicitados: 0, motivo: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (!me?.empleado_id) { setLoading(false); return; }
      setEmpleadoId(me.empleado_id);
      setEmpresaId(me.empresa_id);
      const [sols, saldos] = await Promise.all([
        base44.entities.VacacionSolicitud.filter({ empleado_id: me.empleado_id }),
        base44.entities.VacacionSaldo.filter({ empleado_id: me.empleado_id }),
      ]);
      setSolicitudes(sols);
      setSaldo(saldos[0] || null);
      setLoading(false);
    });
  }, []);

  const calcDias = (ini, fin) => {
    if (!ini || !fin) return 0;
    const d = (new Date(fin) - new Date(ini)) / 86400000 + 1;
    return d > 0 ? d : 0;
  };

  const handleFechas = (k, v) => {
    const updated = { ...form, [k]: v };
    updated.dias_solicitados = calcDias(updated.fecha_inicio, updated.fecha_fin);
    setForm(updated);
  };

  const handleSolicitar = async () => {
    setSaving(true);
    await base44.entities.VacacionSolicitud.create({ ...form, empleado_id: empleadoId, empresa_id: empresaId, fecha_solicitud: new Date().toISOString().split("T")[0], estado: "pendiente" });
    const sols = await base44.entities.VacacionSolicitud.filter({ empleado_id: empleadoId });
    setSolicitudes(sols);
    setOpen(false);
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (!empleadoId) return <div className="p-8 text-center text-gray-400">No se encontró vínculo con empleado.</div>;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Vacaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Saldo y solicitudes</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Solicitar Vacaciones
        </Button>
      </div>

      {/* Saldo */}
      {saldo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Días Ganados", val: saldo.dias_ganados, color: "text-blue-700" },
            { label: "Días Usados", val: saldo.dias_usados, color: "text-gray-700" },
            { label: "Días Disponibles", val: saldo.dias_disponibles, color: "text-emerald-700" },
            { label: "Saldo Actual", val: saldo.saldo_actual, color: "text-purple-700" },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${item.color}`}>{item.val}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Solicitudes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Historial de Solicitudes</h2>
        </div>
        {solicitudes.length === 0 ? (
          <div className="p-10 text-center"><Umbrella className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-gray-400 text-sm">No tienes solicitudes</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {solicitudes.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.fecha_inicio} al {s.fecha_fin}</p>
                  <p className="text-xs text-gray-400">{s.dias_solicitados} días · {s.motivo || "Sin motivo"}</p>
                </div>
                <Badge className={estadoColor[s.estado]}>{s.estado}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Solicitar Vacaciones</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-1">
              <Label>Fecha Inicio</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => handleFechas("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => handleFechas("fecha_fin", e.target.value)} />
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{form.dias_solicitados}</p>
              <p className="text-xs text-gray-500">días solicitados</p>
            </div>
            <div className="space-y-1">
              <Label>Motivo (opcional)</Label>
              <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleSolicitar} disabled={saving || !form.fecha_inicio || !form.fecha_fin}>
              {saving ? "Enviando..." : "Enviar Solicitud"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}