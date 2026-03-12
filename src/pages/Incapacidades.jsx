import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { activa: "bg-amber-100 text-amber-700", finalizada: "bg-gray-100 text-gray-600", anulada: "bg-red-100 text-red-600" };
const tiposInc = ["enfermedad_comun","accidente_trabajo","maternidad","paternidad","riesgo_trabajo","otro"];
const emptyInc = { empleado_id: "", empresa_id: "", tipo_incapacidad: "", entidad_emisora: "CCSS", fecha_inicio: "", fecha_fin: "", dias: 0, porcentaje_reconocimiento: 60, afecta_planilla: true, observaciones: "", estado: "activa" };

export default function Incapacidades() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInc);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: incapacidades = [], isLoading } = useQuery({ queryKey: ["incapacidades"], queryFn: () => base44.entities.Incapacidad.list("-fecha_inicio") });
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Incapacidad.update(editing, data) : base44.entities.Incapacidad.create(data),
    onSuccess: () => { qc.invalidateQueries(["incapacidades"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyInc); setEditing(null); setOpen(true); };
  const openEdit = (i) => { setForm(i); setEditing(i.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incapacidades</h1>
          <p className="text-gray-500 text-sm mt-1">{incapacidades.length} registros</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Incapacidad
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : incapacidades.length === 0 ? (
          <div className="p-12 text-center"><Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin incapacidades registradas</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Reconocimiento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incapacidades.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[i.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">{i.tipo_incapacidad?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{i.fecha_inicio}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{i.fecha_fin}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{i.dias}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{i.porcentaje_reconocimiento}%</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[i.estado]}>{i.estado}</Badge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(i)} className="text-xs text-blue-600 hover:underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Incapacidad" : "Nueva Incapacidad"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo_incapacidad} onValueChange={v => set("tipo_incapacidad", v)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{tiposInc.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Entidad Emisora</Label>
              <Input value={form.entidad_emisora} onChange={e => set("entidad_emisora", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Inicio *</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Fin *</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => set("fecha_fin", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Días *</Label>
              <Input type="number" value={form.dias} onChange={e => set("dias", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>% Reconocimiento</Label>
              <Input type="number" value={form.porcentaje_reconocimiento} onChange={e => set("porcentaje_reconocimiento", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Afecta Planilla</Label>
              <Select value={form.afecta_planilla ? "si" : "no"} onValueChange={v => set("afecta_planilla", v === "si")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Input value={form.observaciones} onChange={e => set("observaciones", e.target.value)} />
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