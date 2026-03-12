import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { calculado: "bg-blue-100 text-blue-700", pagado: "bg-emerald-100 text-emerald-700", anulado: "bg-red-100 text-red-600" };
const emptyAg = { empleado_id: "", empresa_id: "", anio: new Date().getFullYear(), total_salarios_computables: 0, monto_aguinaldo: 0, fecha_calculo: new Date().toISOString().split("T")[0], estado: "calculado" };

export default function AguinaldoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyAg);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: aguinaldos = [], isLoading } = useQuery({ queryKey: ["aguinaldos"], queryFn: () => base44.entities.Aguinaldo.list("-anio") });
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Aguinaldo.update(editing, data) : base44.entities.Aguinaldo.create(data),
    onSuccess: () => { qc.invalidateQueries(["aguinaldos"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyAg); setEditing(null); setOpen(true); };
  const openEdit = (a) => { setForm(a); setEditing(a.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aguinaldo</h1>
          <p className="text-gray-500 text-sm mt-1">Cálculo y registro de aguinaldos</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Aguinaldo
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : aguinaldos.length === 0 ? (
          <div className="p-12 text-center"><Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin registros de aguinaldo</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Año</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Salarios Comp.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">F. Cálculo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aguinaldos.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[a.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{a.anio}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell font-mono text-xs">₡ {Number(a.total_salarios_computables).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 font-mono">₡ {Number(a.monto_aguinaldo).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{a.fecha_calculo}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[a.estado]}>{a.estado}</Badge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Aguinaldo" : "Nuevo Aguinaldo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Año *</Label>
              <Input type="number" value={form.anio} onChange={e => set("anio", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de Cálculo</Label>
              <Input type="date" value={form.fecha_calculo} onChange={e => set("fecha_calculo", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Total Salarios Comp. (₡)</Label>
              <Input type="number" value={form.total_salarios_computables} onChange={e => set("total_salarios_computables", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Monto Aguinaldo (₡)</Label>
              <Input type="number" value={form.monto_aguinaldo} onChange={e => set("monto_aguinaldo", Number(e.target.value))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="calculado">Calculado</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="anulado">Anulado</SelectItem>
                </SelectContent>
              </Select>
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