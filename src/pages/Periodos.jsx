import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Edit, Trash2, Calendar } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const estadoColors = {
  abierto: "bg-blue-100 text-blue-700",
  calculado: "bg-yellow-100 text-yellow-700",
  en_revision: "bg-orange-100 text-orange-700",
  aprobado: "bg-indigo-100 text-indigo-700",
  pagado: "bg-green-100 text-green-700",
  anulado: "bg-red-100 text-red-600",
};

export default function Periodos() {
  const { empresaId, filterByEmpresa, empresas } = useEmpresaContext();
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo_periodo: "mensual", fecha_inicio: "", fecha_fin: "", fecha_pago: "", estado: "abierto", empresa_id: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.PeriodoPlanilla.list("-created_date", 100);
    setPeriodos(filterByEmpresa(data));
    setLoading(false);
  };

  useEffect(() => { load(); }, [empresaId]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PeriodoPlanilla.create(form);
    setSaving(false);
    setShowForm(false);
    setForm({ tipo_periodo: "mensual", fecha_inicio: "", fecha_fin: "", fecha_pago: "", estado: "abierto", empresa_id: empresaId || "" });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este periodo?")) return;
    await base44.entities.PeriodoPlanilla.delete(id);
    load();
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Periodos de Planilla</h1>
          <p className="text-sm text-gray-500">{periodos.filter(p => p.estado === "abierto").length} periodos abiertos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nuevo Periodo
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear Nuevo Periodo</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Empresa</label>
              <Select value={form.empresa_id} onValueChange={v => setForm(p => ({ ...p, empresa_id: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Tipo</label>
              <select value={form.tipo_periodo} onChange={e => setForm(p => ({ ...p, tipo_periodo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="aguinaldo">Aguinaldo</option>
                <option value="liquidacion">Liquidación</option>
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
              <label className="text-xs font-medium text-gray-600">Fecha de Pago</label>
              <input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar Periodo"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fin</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha Pago</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando...
              </td></tr>
            ) : periodos.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No hay periodos registrados.</td></tr>
            ) : periodos.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="capitalize text-gray-700">{p.tipo_periodo}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.fecha_inicio}</td>
                <td className="px-4 py-3 text-gray-600">{p.fecha_fin}</td>
                <td className="px-4 py-3 text-gray-600">{p.fecha_pago || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600"}`}>
                    {p.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}