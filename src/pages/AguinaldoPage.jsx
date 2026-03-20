import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Gift, Calculator, Loader2, Info, Users, Trash2 } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
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
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyAg);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: aguinaldosRaw = [], isLoading } = useQuery({ queryKey: ["aguinaldos", empresaId], queryFn: () => base44.entities.Aguinaldo.list("-anio") });
  const aguinaldos = filterByEmpresa(aguinaldosRaw);
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Aguinaldo.update(editing, data) : base44.entities.Aguinaldo.create(data),
    onSuccess: () => { qc.invalidateQueries(["aguinaldos"]); setOpen(false); },
  });

  const eliminar = useMutation({
    mutationFn: (id) => base44.entities.Aguinaldo.delete(id),
    onSuccess: () => qc.invalidateQueries(["aguinaldos"]),
  });

  const [calculando, setCalculando] = useState(false);
  const [detalleCalculo, setDetalleCalculo] = useState(null);
  const [masivo, setMasivo] = useState(false);
  const [anioMasivo, setAnioMasivo] = useState(new Date().getFullYear());
  const [calculandoMasivo, setCalculandoMasivo] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState(null);

  const calcularAuto = async () => {
    if (!form.empleado_id || !form.anio) return;
    setCalculando(true);
    setDetalleCalculo(null);
    const res = await base44.functions.invoke('calcularAguinaldo', {
      empleado_id: form.empleado_id,
      anio: form.anio,
      empresa_id: form.empresa_id || empresaId,
    });
    if (res.data?.ok) {
      const r = res.data.resultado;
      setForm(f => ({ ...f, ...r }));
      setDetalleCalculo(r._detalle);
    }
    setCalculando(false);
  };

  const calcularMasivo = async () => {
    const activos = empleados.filter(e => e.empresa_id === empresaId && e.estado === "activo");
    if (activos.length === 0) return;
    setCalculandoMasivo(true);
    setResultadoMasivo(null);
    let ok = 0, err = 0;
    for (const emp of activos) {
      const res = await base44.functions.invoke('calcularAguinaldo', {
        empleado_id: emp.id,
        anio: anioMasivo,
        empresa_id: empresaId,
      });
      if (res.data?.ok) {
        const r = res.data.resultado;
        const existing = aguinaldos.find(a => a.empleado_id === emp.id && a.anio === anioMasivo);
        if (existing) {
          await base44.entities.Aguinaldo.update(existing.id, r);
        } else {
          await base44.entities.Aguinaldo.create({ ...r, empresa_id: empresaId });
        }
        ok++;
      } else {
        err++;
      }
    }
    setCalculandoMasivo(false);
    setResultadoMasivo({ ok, err, total: activos.length });
    qc.invalidateQueries(["aguinaldos"]);
  };

  const openNew = () => { setForm({ ...emptyAg, empresa_id: empresaId || "" }); setEditing(null); setDetalleCalculo(null); setOpen(true); };
  const openEdit = (a) => { setForm(a); setEditing(a.id); setDetalleCalculo(null); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aguinaldo</h1>
          <p className="text-gray-500 text-sm mt-1">Cálculo y registro de aguinaldos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setMasivo(true); setResultadoMasivo(null); }} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <Users className="w-4 h-4 mr-2" /> Cálculo Masivo
          </Button>
          <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Aguinaldo
          </Button>
        </div>
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
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                       <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline">Editar</button>
                       <button onClick={() => { if (confirm("¿Eliminar este aguinaldo?")) eliminar.mutate(a.id); }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal cálculo masivo */}
      <Dialog open={masivo} onOpenChange={setMasivo}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /> Cálculo Masivo de Aguinaldo</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Calcula el aguinaldo de todos los empleados activos de la empresa para el año indicado.</p>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Año</Label>
              <Input type="number" value={anioMasivo} onChange={e => setAnioMasivo(Number(e.target.value))} />
            </div>
            {resultadoMasivo && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 space-y-1">
                <p className="font-semibold">Proceso completado</p>
                <p>✔ {resultadoMasivo.ok} calculados correctamente</p>
                {resultadoMasivo.err > 0 && <p className="text-red-600">✖ {resultadoMasivo.err} con error</p>}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setMasivo(false)} disabled={calculandoMasivo}>Cerrar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={calcularMasivo} disabled={calculandoMasivo || !empresaId}>
              {calculandoMasivo ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="w-4 h-4 mr-2" /> Calcular</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="col-span-2">
              <Button type="button" variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={calcularAuto} disabled={calculando || !form.empleado_id}>
                {calculando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="w-4 h-4 mr-2" /> Calcular Automáticamente (Ley 1584 CR)</>}
              </Button>
            </div>
            {detalleCalculo && (
              <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                <p className="font-semibold flex items-center gap-1"><Info className="w-3 h-3" /> Detalle del cálculo</p>
                <p>Período: <strong>{detalleCalculo.periodo_inicio}</strong> al <strong>{detalleCalculo.periodo_fin}</strong></p>
                <p>Meses en período: <strong>{detalleCalculo.meses_en_periodo}</strong></p>
                <p>Fuente: <strong>{detalleCalculo.fuente === 'planillas' ? 'Planillas procesadas' : 'Salario base del empleado'}</strong></p>
              </div>
            )}
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