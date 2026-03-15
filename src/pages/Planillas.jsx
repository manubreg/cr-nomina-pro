import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Receipt, Eye, Calculator, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmpresaContext } from "@/components/EmpresaContext";
import PlanillaDetalleModal from "@/components/planillas/PlanillaDetalleModal";
import { useToast } from "@/components/ui/use-toast";

const estadoColor = {
  borrador: "bg-gray-100 text-gray-600",
  calculado: "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado: "bg-emerald-100 text-emerald-700",
  pagado: "bg-purple-100 text-purple-700",
  anulado: "bg-red-100 text-red-600",
};

const emptyPlanilla = { empresa_id: "", periodo_id: "", tipo_planilla: "ordinaria", estado: "borrador", observacion: "" };

export default function Planillas() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyPlanilla);
  const [editing, setEditing] = useState(null);
  const [detalleModal, setDetalleModal] = useState(null);
  const [calculando, setCalculando] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCalcular = async (planilla) => {
    setCalculando(planilla.id);
    const res = await base44.functions.invoke('calcularPlanilla', { planilla_id: planilla.id });
    setCalculando(null);
    if (res.data?.ok) {
      qc.invalidateQueries(["planillas"]);
      toast({ title: "Planilla calculada", description: `${res.data.empleados_procesados} empleados procesados. Neto: ₡${Number(res.data.total_neto).toLocaleString()}` });
    } else {
      toast({ title: "Error al calcular", description: res.data?.error || "Error desconocido", variant: "destructive" });
    }
  };

  const { data: planillasRaw = [], isLoading } = useQuery({
    queryKey: ["planillas", empresaId],
    queryFn: () => base44.entities.Planilla.list("-created_date"),
  });
  const planillas = filterByEmpresa(planillasRaw);
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => base44.entities.Empresa.list() });
  const { data: periodos = [] } = useQuery({ queryKey: ["periodos"], queryFn: () => base44.entities.PeriodoPlanilla.list("-fecha_inicio") });

  const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e.nombre_comercial || e.nombre_legal]));
  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, `${p.tipo_periodo} · ${p.fecha_inicio} → ${p.fecha_fin}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Planilla.update(editing, data) : base44.entities.Planilla.create(data),
    onSuccess: () => { qc.invalidateQueries(["planillas"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyPlanilla); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planillas</h1>
          <p className="text-gray-500 text-sm mt-1">{planillas.length} planillas encontradas</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Planilla
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando planillas...</div>
        ) : planillas.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No hay planillas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código / Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Período</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Total Neto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {planillas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.codigo_planilla || "—"}</div>
                      <div className="text-xs text-gray-400">{empresaMap[p.empresa_id] || "—"}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell capitalize text-gray-600">{p.tipo_planilla}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{periodoMap[p.periodo_id] || "—"}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-gray-800">
                      {p.total_neto ? `₡ ${Number(p.total_neto).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={estadoColor[p.estado]}>{p.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                     <div className="flex items-center justify-end gap-1">
                       {/* Calcular */}
                       {!['pagado','anulado'].includes(p.estado) && (
                         <button
                           onClick={() => handleCalcular(p)}
                           disabled={calculando === p.id}
                           title="Calcular planilla automáticamente"
                           className="text-gray-400 hover:text-emerald-600 p-1.5 rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
                         >
                           {calculando === p.id
                             ? <Loader2 className="w-4 h-4 animate-spin" />
                             : <Calculator className="w-4 h-4" />}
                         </button>
                       )}
                       {/* Ver detalle */}
                       <button
                         onClick={() => setDetalleModal(p)}
                         title="Ver detalle"
                         className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       {/* Editar */}
                       <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-50 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
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

      {/* Modal detalle */}
      {detalleModal && (
        <PlanillaDetalleModal planilla={detalleModal} onClose={() => setDetalleModal(null)} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Planilla" : "Nueva Planilla"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1">
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={v => set("empresa_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Período</Label>
              <Select value={form.periodo_id} onValueChange={v => set("periodo_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{periodos.map(p => <SelectItem key={p.id} value={p.id}>{p.tipo_periodo} · {p.fecha_inicio}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo Planilla</Label>
              <Select value={form.tipo_planilla} onValueChange={v => set("tipo_planilla", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinaria">Ordinaria</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinaria</SelectItem>
                  <SelectItem value="aguinaldo">Aguinaldo</SelectItem>
                  <SelectItem value="liquidacion">Liquidación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(estadoColor).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Código</Label>
              <Input value={form.codigo_planilla || ""} onChange={e => set("codigo_planilla", e.target.value)} placeholder="PLN-001" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observación</Label>
              <Input value={form.observacion || ""} onChange={e => set("observacion", e.target.value)} />
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