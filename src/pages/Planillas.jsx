import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Eye, CheckCircle, DollarSign, XCircle, Calculator, FileText, ChevronDown } from "lucide-react";
import PlanillaModal from "@/components/planillas/PlanillaModal";
import PlanillaDetalleModal from "@/components/planillas/PlanillaDetalleModal";

const estadoColors = {
  borrador: "bg-gray-100 text-gray-600",
  calculado: "bg-yellow-100 text-yellow-700",
  en_revision: "bg-orange-100 text-orange-700",
  aprobado: "bg-blue-100 text-blue-700",
  pagado: "bg-green-100 text-green-700",
  anulado: "bg-red-100 text-red-600",
};

const estadoFlow = ["borrador", "calculado", "en_revision", "aprobado", "pagado"];

const formatCRC = (v) => `₡${Number(v || 0).toLocaleString("es-CR")}`;

export default function Planillas() {
  const [planillas, setPlanillas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetalle, setShowDetalle] = useState(null);
  const [filterEstado, setFilterEstado] = useState("todos");

  const load = async () => {
    setLoading(true);
    const [pl, per, emp, con] = await Promise.all([
      base44.entities.Planilla.list("-created_date", 100),
      base44.entities.PeriodoPlanilla.list(),
      base44.entities.Empleado.filter({ estado: "activo" }),
      base44.entities.ConceptoPago.filter({ estado: "activo" }),
    ]);
    setPlanillas(pl);
    setPeriodos(per);
    setEmpleados(emp);
    setConceptos(con);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filterEstado === "todos" ? planillas : planillas.filter(p => p.estado === filterEstado);

  const avanzarEstado = async (planilla) => {
    const idx = estadoFlow.indexOf(planilla.estado);
    if (idx < 0 || idx >= estadoFlow.length - 1) return;
    const nextEstado = estadoFlow[idx + 1];
    const updates = { estado: nextEstado };
    if (nextEstado === "aprobado") updates.fecha_aprobacion = new Date().toISOString().split("T")[0];
    if (nextEstado === "pagado") updates.fecha_pago = new Date().toISOString().split("T")[0];
    await base44.entities.Planilla.update(planilla.id, updates);
    load();
  };

  const anular = async (id) => {
    if (!confirm("¿Anular esta planilla? Esta acción no se puede deshacer fácilmente.")) return;
    await base44.entities.Planilla.update(id, { estado: "anulado" });
    load();
  };

  const nextLabel = (estado) => {
    const map = { borrador: "Calcular", calculado: "Enviar a Revisión", en_revision: "Aprobar", aprobado: "Marcar Pagado" };
    return map[estado];
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planillas</h1>
          <p className="text-sm text-gray-500">{planillas.length} planillas registradas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nueva Planilla
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Planillas", val: planillas.length, color: "text-gray-800" },
          { label: "Pendientes", val: planillas.filter(p => ["borrador","calculado","en_revision"].includes(p.estado)).length, color: "text-yellow-600" },
          { label: "Aprobadas", val: planillas.filter(p => p.estado === "aprobado").length, color: "text-blue-600" },
          { label: "Pagadas", val: planillas.filter(p => p.estado === "pagado").length, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 items-center">
        <span className="text-sm text-gray-500">Filtrar por estado:</span>
        {["todos", "borrador", "calculado", "en_revision", "aprobado", "pagado", "anulado"].map(e => (
          <button
            key={e}
            onClick={() => setFilterEstado(e)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterEstado === e ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {e === "todos" ? "Todos" : e}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Periodo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleados</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bruto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deducciones</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Neto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No hay planillas con ese filtro.</td></tr>
              ) : filtered.map(p => {
                const periodo = periodos.find(per => per.id === p.periodo_id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.codigo_planilla || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.tipo_planilla}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {periodo ? `${periodo.fecha_inicio} → ${periodo.fecha_fin}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.cantidad_empleados || 0}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCRC(p.total_ingresos)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCRC(p.total_deducciones)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCRC(p.total_neto)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600"}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setShowDetalle(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                        {nextLabel(p.estado) && (
                          <button onClick={() => avanzarEstado(p)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium">
                            {p.estado === "borrador" ? <Calculator className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            {nextLabel(p.estado)}
                          </button>
                        )}
                        {p.estado !== "anulado" && p.estado !== "pagado" && (
                          <button onClick={() => anular(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PlanillaModal
          periodos={periodos}
          empleados={empleados}
          conceptos={conceptos}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {showDetalle && (
        <PlanillaDetalleModal planilla={showDetalle} onClose={() => setShowDetalle(null)} />
      )}
    </div>
  );
}