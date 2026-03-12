import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, CheckCircle, XCircle, Clock, Umbrella } from "lucide-react";

const estadoColors = {
  pendiente: "bg-yellow-100 text-yellow-700",
  aprobada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-600",
  aplicada: "bg-blue-100 text-blue-700",
};

export default function Vacaciones() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("solicitudes");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ empleado_id: "", fecha_inicio: "", fecha_fin: "", dias_solicitados: 1, motivo: "", empresa_id: "empresa_demo" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [sol, sal, emp] = await Promise.all([
      base44.entities.VacacionSolicitud.list("-created_date", 100),
      base44.entities.VacacionSaldo.list("-created_date", 200),
      base44.entities.Empleado.filter({ estado: "activo" }),
    ]);
    setSolicitudes(sol);
    setSaldos(sal);
    setEmpleados(emp);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.VacacionSolicitud.create({
      ...form,
      fecha_solicitud: new Date().toISOString().split("T")[0],
      estado: "pendiente",
    });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const aprobar = async (id) => {
    await base44.entities.VacacionSolicitud.update(id, { estado: "aprobada", fecha_aprobacion: new Date().toISOString().split("T")[0] });
    load();
  };

  const rechazar = async (id) => {
    await base44.entities.VacacionSolicitud.update(id, { estado: "rechazada" });
    load();
  };

  const empName = (id) => {
    const e = empleados.find(x => x.id === id);
    return e ? `${e.nombre} ${e.apellidos}` : id;
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vacaciones</h1>
          <p className="text-sm text-gray-500">{solicitudes.filter(s => s.estado === "pendiente").length} solicitudes pendientes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nueva Solicitud
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Solicitudes Pendientes", val: solicitudes.filter(s => s.estado === "pendiente").length, color: "text-yellow-600" },
          { label: "Aprobadas", val: solicitudes.filter(s => s.estado === "aprobada").length, color: "text-green-600" },
          { label: "Días Promedio Saldo", val: saldos.length > 0 ? Math.round(saldos.reduce((a, s) => a + (s.saldo_actual || 0), 0) / saldos.length) : 0, color: "text-blue-600" },
          { label: "Empleados con Saldo", val: saldos.filter(s => s.saldo_actual > 0).length, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nueva Solicitud de Vacaciones</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Empleado *</label>
              <select value={form.empleado_id} onChange={e => setForm(p => ({ ...p, empleado_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha Inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha Fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Días Solicitados</label>
              <input type="number" min={1} value={form.dias_solicitados} onChange={e => setForm(p => ({ ...p, dias_solicitados: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-gray-600">Motivo</label>
              <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Motivo de la solicitud..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.empleado_id}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? "Guardando..." : "Registrar Solicitud"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {["solicitudes", "saldos"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "solicitudes" ? "Solicitudes" : "Saldos por Empleado"}
          </button>
        ))}
      </div>

      {activeTab === "solicitudes" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Solicitud</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fin</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
              ) : solicitudes.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No hay solicitudes.</td></tr>
              ) : solicitudes.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{empName(s.empleado_id)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.fecha_solicitud}</td>
                  <td className="px-4 py-3 text-gray-600">{s.fecha_inicio}</td>
                  <td className="px-4 py-3 text-gray-600">{s.fecha_fin}</td>
                  <td className="px-4 py-3 text-center font-medium text-blue-700">{s.dias_solicitados}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[s.estado] || "bg-gray-100 text-gray-600"}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.estado === "pendiente" && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => aprobar(s.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 hover:bg-green-100 rounded-lg">
                          <CheckCircle className="w-3 h-3" /> Aprobar
                        </button>
                        <button onClick={() => rechazar(s.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">
                          <XCircle className="w-3 h-3" /> Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "saldos" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ganados</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usados</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo Disponible</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
              ) : saldos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No hay saldos registrados.</td></tr>
              ) : saldos.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{empName(s.empleado_id)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{s.dias_ganados || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{s.dias_usados || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-lg ${s.saldo_actual > 10 ? "text-orange-500" : "text-blue-700"}`}>
                      {s.saldo_actual || 0}
                    </span>
                    {s.saldo_actual > 10 && <span className="ml-1 text-xs text-orange-500">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.fecha_vencimiento || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.estado === "vigente" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {s.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}