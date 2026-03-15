import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, FileText } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { activo: "bg-emerald-100 text-emerald-700", vencido: "bg-amber-100 text-amber-700", anulado: "bg-red-100 text-red-600" };
const emptyContrato = { empleado_id: "", empresa_id: "", tipo_contrato: "indefinido", fecha_inicio: "", fecha_fin: "", salario_pactado: 0, tipo_salario: "mensual", frecuencia_pago: "mensual", tipo_jornada: "diurna", horas_semana: 40, modalidad: "presencial", moneda: "CRC", estado: "activo", observaciones: "" };

export default function Contratos() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyContrato);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: contratosRaw = [], isLoading } = useQuery({ queryKey: ["contratos", empresaId], queryFn: () => base44.entities.Contrato.list("-created_date") });
  const contratos = filterByEmpresa(contratosRaw);
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Contrato.update(editing, data) : base44.entities.Contrato.create(data),
    onSuccess: () => { qc.invalidateQueries(["contratos"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyContrato); setEditing(null); setOpen(true); };
  const openEdit = (c) => { setForm(c); setEditing(c.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">{contratos.length} contratos registrados</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Contrato
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : contratos.length === 0 ? (
          <div className="p-12 text-center"><FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin contratos</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fin</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Salario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contratos.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[c.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.tipo_contrato?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.fecha_inicio}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.fecha_fin || "Indefinido"}</td>
                    <td className="px-4 py-3 text-right text-gray-800 font-mono hidden lg:table-cell">
                      {c.moneda} {Number(c.salario_pactado).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"><Badge className={estadoColor[c.estado]}>{c.estado}</Badge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Contrato" : "Nuevo Contrato"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Contrato</Label>
              <Select value={form.tipo_contrato} onValueChange={v => set("tipo_contrato", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinido">Indefinido</SelectItem>
                  <SelectItem value="plazo_fijo">Plazo Fijo</SelectItem>
                  <SelectItem value="temporal">Temporal</SelectItem>
                  <SelectItem value="servicios_especiales">Servicios Especiales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="anulado">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha Inicio *</Label>
              <Input type="date" value={form.fecha_inicio} onChange={e => set("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={e => set("fecha_fin", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Salario Pactado *</Label>
              <Input type="number" value={form.salario_pactado} onChange={e => set("salario_pactado", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={v => set("moneda", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Salario</Label>
              <Select value={form.tipo_salario} onValueChange={v => set("tipo_salario", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="por_hora">Por Hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Jornada</Label>
              <Select value={form.tipo_jornada} onValueChange={v => set("tipo_jornada", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurna">Diurna</SelectItem>
                  <SelectItem value="mixta">Mixta</SelectItem>
                  <SelectItem value="nocturna">Nocturna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modalidad</Label>
              <Select value={form.modalidad} onValueChange={v => set("modalidad", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                  <SelectItem value="remoto">Remoto</SelectItem>
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