import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const estadoColor = { abierto: "bg-blue-100 text-blue-700", calculado: "bg-amber-100 text-amber-700", en_revision: "bg-orange-100 text-orange-700", aprobado: "bg-emerald-100 text-emerald-700", pagado: "bg-purple-100 text-purple-700", anulado: "bg-red-100 text-red-600" };
const emptyPeriodo = { empresa_id: "", tipo_periodo: "mensual", fecha_inicio: "", fecha_fin: "", fecha_pago: "", estado: "abierto", observaciones: "" };

export default function Periodos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyPeriodo);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: periodos = [], isLoading } = useQuery({ queryKey: ["periodos"], queryFn: () => base44.entities.PeriodoPlanilla.list("-fecha_inicio") });
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => base44.entities.Empresa.list() });
  const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e.nombre_comercial || e.nombre_legal]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.PeriodoPlanilla.update(editing, data) : base44.entities.PeriodoPlanilla.create(data),
    onSuccess: () => { qc.invalidateQueries(["periodos"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyPeriodo); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Períodos de Planilla</h1>
          <p className="text-gray-500 text-sm mt-1">Administre los períodos de pago</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Período
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando períodos...</div>
        ) : periodos.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No hay períodos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">F. Pago</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 text-xs">{empresaMap[p.empresa_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{p.tipo_periodo}</td>
                    <td className="px-4 py-3 text-gray-600">{p.fecha_inicio}</td>
                    <td className="px-4 py-3 text-gray-600">{p.fecha_fin}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.fecha_pago || "—"}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[p.estado]}>{p.estado}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline">Editar</button>
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
            <DialogTitle>{editing ? "Editar Período" : "Nuevo Período"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={v => set("empresa_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Período</Label>
              <Select value={form.tipo_periodo} onValueChange={v => set("tipo_periodo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="aguinaldo">Aguinaldo</SelectItem>
                  <SelectItem value="liquidacion">Liquidación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(estadoColor).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha Inicio *</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Fin *</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => set("fecha_fin", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Fecha de Pago</Label>
              <Input type="date" value={form.fecha_pago} onChange={e => set("fecha_pago", e.target.value)} />
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