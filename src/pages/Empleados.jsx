import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Eye, Edit, Trash2, UserCheck, UserX, RefreshCw, Download } from "lucide-react";
import EmpleadoModal from "@/components/empleados/EmpleadoModal";

const estadoColors = {
  activo: "bg-green-100 text-green-700",
  suspendido: "bg-yellow-100 text-yellow-700",
  inactivo: "bg-gray-100 text-gray-600",
  liquidado: "bg-red-100 text-red-600",
};

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterDept, setFilterDept] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [emps, depts] = await Promise.all([
      base44.entities.Empleado.list("-created_date", 500),
      base44.entities.Departamento.list(),
    ]);
    setEmpleados(emps);
    setDepartamentos(depts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = empleados.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${e.nombre} ${e.apellidos} ${e.codigo_empleado} ${e.identificacion}`.toLowerCase().includes(q);
    const matchEstado = filterEstado === "todos" || e.estado === filterEstado;
    const matchDept = filterDept === "todos" || e.departamento_id === filterDept;
    return matchSearch && matchEstado && matchDept;
  });

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este empleado?")) return;
    await base44.entities.Empleado.delete(id);
    load();
  };

  const openCreate = () => { setEditando(null); setShowModal(true); };
  const openEdit = (emp) => { setEditando(emp); setShowModal(true); };

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500">{empleados.filter(e => e.estado === "activo").length} activos · {empleados.length} total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Empleado
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, cédula..."
            className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="suspendido">Suspendido</option>
          <option value="inactivo">Inactivo</option>
          <option value="liquidado">Liquidado</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todos">Todos los departamentos</option>
          {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Puesto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Departamento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Salario Base</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingreso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando empleados...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                  No se encontraron empleados con ese filtro.
                </td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {emp.nombre?.[0]}{emp.apellidos?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{emp.nombre} {emp.apellidos}</div>
                        <div className="text-xs text-gray-400">{emp.identificacion}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.codigo_empleado || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.puesto || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{departamentos.find(d => d.id === emp.departamento_id)?.nombre || "—"}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {emp.salario_base ? `₡${Number(emp.salario_base).toLocaleString("es-CR")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{emp.fecha_ingreso}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[emp.estado] || "bg-gray-100 text-gray-600"}`}>
                      {emp.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/EmpleadoPerfil/${emp.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Mostrando {filtered.length} de {empleados.length} empleados
          </div>
        )}
      </div>

      {showModal && (
        <EmpleadoModal
          empleado={editando}
          departamentos={departamentos}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}