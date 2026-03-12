import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { borrador: "bg-gray-100 text-gray-600", aprobada: "bg-emerald-100 text-emerald-700", pagada: "bg-purple-100 text-purple-700", anulada: "bg-red-100 text-red-600" };
const motivos = ["renuncia","despido_sin_causa","despido_con_causa","mutuo_acuerdo","fin_contrato","fallecimiento","otro"];
const emptyLiq = { empleado_id: "", empresa_id: "", fecha_salida: "", motivo_salida: "renuncia", salario_promedio: 0, preaviso: 0, cesantia: 0, vacaciones_pendientes: 0, aguinaldo_proporcional: 0, salario_pendiente: 0, deducciones_finales: 0, total_liquidacion: 0, neto_liquidar: 0, estado: "borrador", observaciones: "" };

export default function Liquidaciones() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyLiq);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const recalcularNeto = (f) => {
    const total = (Number(f.preaviso)||0) + (Number(f.cesantia)||0) + (Number(f.vacaciones_pendientes)||0) + (Number(f.aguinaldo_proporcional)||0) + (Number(f.salario_pendiente)||0);
    const neto = total - (Number(f.deducciones_finales)||0);
    return { ...f, total_liquidacion: total, neto_liquidar: neto };
  };
  const setCalc = (k, v) => setForm(f => recalcularNeto({ ...f, [k]: v }));

  const { data: liquidaciones = [], isLoading } = useQuery({ queryKey: ["liquidaciones"], queryFn: () => base44.entities.Liquidacion.list("-fecha_salida") });
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Liquidacion.update(editing, data) : base44.entities.Liquidacion.create(data),
    onSuccess: () => { qc.invalidateQueries(["liquidaciones"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyLiq); setEditing(null); setOpen(true); };
  const openEdit = (l) => { setForm(l); setEditing(l.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
          <p className="text-gray-500 text-sm mt-1">{liquidaciones.length} liquidaciones registradas</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Liquidación
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : liquidaciones.length === 0 ? (
          <div className="p-12 text-center"><Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin liquidaciones</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">F. Salida</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Motivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Neto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {liquidaciones.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[l.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{l.fecha_salida}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell capitalize text-xs">{l.motivo_salida?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 font-mono">₡ {Number(l.neto_liquidar).toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[l.estado]}>{l.estado}</Badge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(l)} className="text-xs text-blue-600 hover:underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Liquidación" : "Nueva Liquidación"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de Salida *</Label>
              <Input type="date" value={form.fecha_salida} onChange={e => set("fecha_salida", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo de Salida *</Label>
              <Select value={form.motivo_salida} onValueChange={v => set("motivo_salida", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{motivos.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Salario Promedio (₡)</Label>
              <Input type="number" value={form.salario_promedio} onChange={e => set("salario_promedio", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Preaviso (₡)</Label>
              <Input type="number" value={form.preaviso} onChange={e => setCalc("preaviso", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Cesantía (₡)</Label>
              <Input type="number" value={form.cesantia} onChange={e => setCalc("cesantia", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Vacaciones Pendientes (₡)</Label>
              <Input type="number" value={form.vacaciones_pendientes} onChange={e => setCalc("vacaciones_pendientes", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Aguinaldo Proporcional (₡)</Label>
              <Input type="number" value={form.aguinaldo_proporcional} onChange={e => setCalc("aguinaldo_proporcional", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Salario Pendiente (₡)</Label>
              <Input type="number" value={form.salario_pendiente} onChange={e => setCalc("salario_pendiente", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Deducciones Finales (₡)</Label>
              <Input type="number" value={form.deducciones_finales} onChange={e => setCalc("deducciones_finales", Number(e.target.value))} />
            </div>
            <div className="col-span-2 bg-blue-50 rounded-lg p-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">Total Liquidación</p>
                <p className="font-bold text-gray-800 text-lg">₡ {Number(form.total_liquidacion).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Neto a Liquidar</p>
                <p className="font-bold text-blue-700 text-lg">₡ {Number(form.neto_liquidar).toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="aprobada">Aprobada</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
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