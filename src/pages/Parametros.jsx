import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Settings, Pencil, Trash2 } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { vigente: "bg-emerald-100 text-emerald-700", vencido: "bg-red-100 text-red-600", borrador: "bg-gray-100 text-gray-500" };
const tipos = ["tramo_impuesto","cuota_ccss_empleado","cuota_ccss_patrono","regla_vacaciones","regla_aguinaldo","regla_horas_extra","regla_liquidacion","tope_base","tipo_cambio"];
const emptyParam = { tipo: "", nombre: "", version: "1.0", datos_json: "", fecha_inicio_vigencia: "", fecha_fin_vigencia: "", estado: "vigente", observacion: "" };

// Editor visual de tramos de impuesto
function TramosEditor({ value, onChange }) {
  // value es el string JSON de datos_json
  let tramos = [];
  try { tramos = JSON.parse(value || "[]"); if (!Array.isArray(tramos)) tramos = []; } catch { tramos = []; }

  const updateTramo = (i, field, val) => {
    const updated = tramos.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange(JSON.stringify(updated));
  };

  const addTramo = () => {
    const updated = [...tramos, { hasta: "", tasa: "" }];
    onChange(JSON.stringify(updated));
  };

  const removeTramo = (i) => {
    const updated = tramos.filter((_, idx) => idx !== i);
    onChange(JSON.stringify(updated));
  };

  const isLast = (i) => i === tramos.length - 1;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-1/2">Tope hasta (₡)</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-1/3">% Retención</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tramos.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">Sin tramos. Agregue el primero.</td></tr>
            )}
            {tramos.map((t, i) => (
              <tr key={i} className="bg-white">
                <td className="px-2 py-1.5">
                  {isLast(i)
                    ? <span className="text-xs text-gray-400 italic px-1">En adelante</span>
                    : <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="929000"
                        value={t.hasta ?? ""}
                        onChange={e => updateTramo(i, "hasta", e.target.value === "" ? "" : Number(e.target.value))}
                      />
                  }
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-8 text-sm"
                      placeholder="0"
                      value={t.tasa !== undefined && t.tasa !== "" ? Number(t.tasa) * 100 : ""}
                      onChange={e => updateTramo(i, "tasa", e.target.value === "" ? "" : Number(e.target.value) / 100)}
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeTramo(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addTramo} className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
        <Plus className="w-3 h-3 mr-1" /> Agregar tramo
      </Button>
      {tramos.length > 0 && (
        <p className="text-xs text-gray-400">El último tramo aplica "en adelante" sin tope.</p>
      )}
    </div>
  );
}

export default function Parametros() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyParam);
  const [editing, setEditing] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: paramsRaw = [], isLoading } = useQuery({ queryKey: ["parametros", empresaId], queryFn: () => base44.entities.ParametroLegal.list("-fecha_inicio_vigencia") });
  const params = filterByEmpresa(paramsRaw);

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.ParametroLegal.update(editing, data) : base44.entities.ParametroLegal.create(data),
    onSuccess: () => { qc.invalidateQueries(["parametros"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyParam); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setOpen(true); };
  const filtered = tipoFiltro === "todos" ? params : params.filter(p => p.tipo === tipoFiltro);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parámetros Legales</h1>
          <p className="text-gray-500 text-sm mt-1">CCSS, Impuestos, Vacaciones y más</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Parámetro
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTipoFiltro("todos")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tipoFiltro === "todos" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Todos</button>
        {tipos.map(t => (
          <button key={t} onClick={() => setTipoFiltro(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${tipoFiltro === t ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t.replace(/_/g," ")}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando parámetros...</div> : filtered.length === 0 ? (
          <div className="p-12 text-center"><Settings className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin parámetros registrados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Versión</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Vigencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">{p.tipo?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.version}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{p.fecha_inicio_vigencia} → {p.fecha_fin_vigencia || "Sin venc."}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[p.estado]}>{p.estado}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Parámetro" : "Nuevo Parámetro Legal"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Cuota obrera CCSS 2025" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>{tipos.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Versión</Label>
              <Input value={form.version} onChange={e => set("version", e.target.value)} placeholder="1.0" />
            </div>
            <div className="space-y-1">
              <Label>Inicio Vigencia *</Label>
              <Input type="date" value={form.fecha_inicio_vigencia} onChange={e => set("fecha_inicio_vigencia", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin Vigencia</Label>
              <Input type="date" value={form.fecha_fin_vigencia} onChange={e => set("fecha_fin_vigencia", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Datos JSON (configuración)</Label>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-2 text-xs font-mono resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.datos_json}
                onChange={e => set("datos_json", e.target.value)}
                placeholder='{"porcentaje": 5.5}'
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observación</Label>
              <Input value={form.observacion} onChange={e => set("observacion", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}