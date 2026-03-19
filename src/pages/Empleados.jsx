import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Upload, Eye, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmpleadoForm from "@/components/empleados/EmpleadoForm";
import ImportarEmpleadosModal from "@/components/empleados/ImportarEmpleadosModal";
import { useEmpresaContext } from "@/components/EmpresaContext";

const estadoColor = { activo: "bg-emerald-100 text-emerald-700", suspendido: "bg-amber-100 text-amber-700", inactivo: "bg-gray-100 text-gray-600", liquidado: "bg-red-100 text-red-600" };

export default function Empleados() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("activo");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [importarOpen, setImportarOpen] = useState(false);

  const { data: empleadosRaw = [], isLoading } = useQuery({
    queryKey: ["empleados", empresaId],
    queryFn: () => base44.entities.Empleado.list("-created_date"),
  });
  const empleados = filterByEmpresa(empleadosRaw);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", empresaId],
    queryFn: () => empresaId ? base44.entities.Departamento.filter({ empresa_id: empresaId }) : Promise.resolve([]),
  });

  const { data: centrosCosto = [] } = useQuery({
    queryKey: ["centrosCosto", empresaId],
    queryFn: () => empresaId ? base44.entities.CentroCosto.filter({ empresa_id: empresaId }) : Promise.resolve([]),
  });

  const { data: puestos = [] } = useQuery({
    queryKey: ["puestos", empresaId],
    queryFn: () => empresaId ? base44.entities.Puesto?.filter?.({ empresa_id: empresaId }) : Promise.resolve([]),
  });

  const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e.nombre_comercial || e.nombre_legal]));

  const filtered = empleados.filter(e => {
    const matchEstado = estadoFiltro === "todos" || e.estado === estadoFiltro;
    const matchSearch = !search || `${e.nombre} ${e.apellidos} ${e.identificacion} ${e.puesto}`.toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchSearch;
  });

  const openNew = () => { setEditId(null); setFormOpen(true); };
  const openEdit = (id) => { setEditId(id); setFormOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} empleados encontrados</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Empleado
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar por nombre, ID, puesto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="suspendido">Suspendidos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
            <SelectItem value="liquidado">Liquidados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando empleados...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No se encontraron empleados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Identificación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Puesto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fecha Salida</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-blue-700 text-xs font-bold">{emp.nombre?.[0]}{emp.apellidos?.[0]}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.nombre} {emp.apellidos}</div>
                          {emp.correo && <div className="text-xs text-gray-400">{emp.correo}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono text-xs">{emp.identificacion}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{emp.puesto || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-xs">{empresaMap[emp.empresa_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-xs">{emp.fecha_salida || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={estadoColor[emp.estado] || "bg-gray-100 text-gray-600"}>{emp.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/EmpleadoPerfil?id=${emp.id}`} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={() => openEdit(emp.id)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmpleadoForm open={formOpen} onClose={() => setFormOpen(false)} editId={editId} empresas={empresas} departamentos={departamentos} centrosCosto={centrosCosto} puestos={puestos} empleados={empleados.filter(e => e.estado === 'activo')} />
    </div>
  );
}