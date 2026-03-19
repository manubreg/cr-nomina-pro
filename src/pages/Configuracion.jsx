import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Configuracion() {
  const qc = useQueryClient();
  const { empresaId } = useEmpresaContext();
  const [tab, setTab] = useState(0);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", codigo: "", descripcion: "", pais: "" });
  const [depSeleccionado, setDepSeleccionado] = useState("");

  // Fetch data
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

  // Mutations
  const save = useMutation({
    mutationFn: (data) => {
      const entity = [departamentos, centrosCosto, puestos][tab];
      const entityName = ["Departamento", "CentroCosto", "Puesto"][tab];
      
      if (editId) {
        return base44.entities[entityName].update(editId, data);
      } else {
        return base44.entities[entityName].create({ ...data, empresa_id: empresaId });
      }
    },
    onSuccess: () => {
      const keys = ["departamentos", "centrosCosto", "puestos"];
      qc.invalidateQueries({ queryKey: [keys[tab], empresaId] });
      setForm({ nombre: "", codigo: "", descripcion: "" });
      setEditId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id) => {
      const entityName = ["Departamento", "CentroCosto", "Puesto"][tab];
      return base44.entities[entityName].delete(id);
    },
    onSuccess: () => {
      const keys = ["departamentos", "centrosCosto", "puestos"];
      qc.invalidateQueries({ queryKey: [keys[tab], empresaId] });
    },
  });

  // Auto-generar código CC: codigoPais(dep) + codigoDep
  const autoCodCC = (depId) => {
    const dep = departamentos.find(d => d.id === depId);
    if (!dep) return "";
    const paisCod = dep.pais ? dep.pais.substring(0, 2).toUpperCase() : "XX";
    const depCod = dep.codigo ? dep.codigo.toUpperCase() : dep.nombre.substring(0, 3).toUpperCase();
    return `${paisCod}-${depCod}`;
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setForm({ nombre: item.nombre, codigo: item.codigo || "", descripcion: item.descripcion || "", pais: item.pais || "" });
    setDepSeleccionado("");
  };

  const handleNew = () => {
    setEditId(null);
    setForm({ nombre: "", codigo: "", descripcion: "", pais: "" });
    setDepSeleccionado("");
  };

  const data = [departamentos, centrosCosto, puestos][tab];
  const labels = ["Departamento", "Centro de Costos", "Puesto"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Configuración</h1>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {["Departamentos", "Centros de Costos", "Puestos"].map((label, i) => (
          <button
            key={i}
            onClick={() => { setTab(i); handleNew(); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-1 bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editId ? `Editar ${labels[tab]}` : `Nuevo ${labels[tab]}`}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre"
              />
            </div>

            {/* Campo País — solo para Departamentos */}
            {tab === 0 && (
              <div>
                <label className="text-xs font-medium text-gray-600">País</label>
                <input
                  type="text"
                  value={form.pais}
                  onChange={e => setForm({ ...form, pais: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Costa Rica, CR"
                />
              </div>
            )}

            {/* Selector de Departamento + código auto — solo para Centros de Costos */}
            {tab === 1 && (
              <div>
                <label className="text-xs font-medium text-gray-600">Departamento (para código)</label>
                <select
                  value={depSeleccionado}
                  onChange={e => {
                    const depId = e.target.value;
                    setDepSeleccionado(depId);
                    if (depId) setForm(f => ({ ...f, codigo: autoCodCC(depId) }));
                  }}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar departamento...</option>
                  {departamentos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} {d.pais ? `(${d.pais})` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600">Código</label>
              <input
                type="text"
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tab === 1 ? "Auto-generado al seleccionar depto." : "Código"}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={3}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descripción"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.nombre}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
              >
                {save.isPending ? "Guardando..." : "Guardar"}
              </button>
              {editId && (
                <button
                  onClick={handleNew}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Nuevo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">{labels[tab]}s</h3>
          </div>
          <div className="overflow-y-auto max-h-96">
            {data.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay registros</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.nombre}</div>
                        {item.codigo && <div className="text-xs text-gray-500">{item.codigo}</div>}
                      </td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove.mutate(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}