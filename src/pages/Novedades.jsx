import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Filter, AlertTriangle } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { pendiente: "bg-amber-100 text-amber-700", aprobada: "bg-emerald-100 text-emerald-700", rechazada: "bg-red-100 text-red-600", aplicada: "bg-purple-100 text-purple-700" };
const tiposNovedad = ["horas_extra","ausencia","tardia","vacacion","incapacidad","permiso_con_goce","permiso_sin_goce","feriado_trabajado","bono","comision","rebajo_especial","ajuste_manual"];
const emptyNovedad = { empleado_id: "", empresa_id: "", tipo_novedad: "", fecha: "", cantidad: 1, unidad: "horas", monto: 0, comentario: "", estado: "pendiente" };

export default function Novedades() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyNovedad);
  const [editing, setEditing] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: novedades = [], isLoading } = useQuery({ queryKey: ["novedades"], queryFn: () => base44.entities.Novedad.list("-fecha") });
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Novedad.update(editing, data) : base44.entities.Novedad.create(data),
    onSuccess: () => { qc.invalidateQueries(["novedades"]); setOpen(false); },
  });

  const changeEstado = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.Novedad.update(id, { estado }),
    onSuccess: () => qc.invalidateQueries(["novedades"]),
  });

  const filtered = estadoFiltro === "todos" ? novedades : novedades.filter(n => n.estado === estadoFiltro);

  const openNew = () => { setForm(emptyNovedad); setEditing(null); setOpen(true); };
  const openEdit = (n) => { setForm(n); setEditing(n.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novedades</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} novedades</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Novedad
        </Button>
      </div>

      <div className="flex gap-2">
        {["todos","pendiente","aprobada","rechazada","aplicada"].map(s => (
          <button key={s} onClick={() => setEstadoFiltro(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize
              ${estadoFiltro === s ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando novedades...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No hay novedades</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Cantidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[n.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{n.tipo_novedad?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{n.fecha}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{n.cantidad} {n.unidad}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[n.estado]}>{n.estado}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {n.estado === "pendiente" && (
                          <>
                            <button onClick={() => changeEstado.mutate({ id: n.id, estado: "aprobada" })} className="text-xs text-emerald-600 hover:underline">Aprobar</button>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => changeEstado.mutate({ id: n.id, estado: "rechazada" })} className="text-xs text-red-500 hover:underline">Rechazar</button>
                          </>
                        )}
                        <button onClick={() => openEdit(n)} className="text-xs text-blue-600 hover:underline ml-1">Editar</button>
                      </div>
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
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Novedad" : "Nueva Novedad"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Novedad *</Label>
              <Select value={form.tipo_novedad} onValueChange={v => set("tipo_novedad", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>{tiposNovedad.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input type="number" value={form.cantidad} onChange={e => set("cantidad", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <Select value={form.unidad} onValueChange={v => set("unidad", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horas">Horas</SelectItem>
                  <SelectItem value="dias">Días</SelectItem>
                  <SelectItem value="monto">Monto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monto (₡)</Label>
              <Input type="number" value={form.monto} onChange={e => set("monto", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobada">Aprobada</SelectItem>
                  <SelectItem value="rechazada">Rechazada</SelectItem>
                  <SelectItem value="aplicada">Aplicada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Comentario</Label>
              <Input value={form.comentario} onChange={e => set("comentario", e.target.value)} />
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