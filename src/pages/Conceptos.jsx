import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const emptyConcept = { codigo: "", nombre: "", tipo: "ingreso", categoria: "ordinario", calculo_tipo: "manual", monto_fijo: 0, porcentaje: 0, formula_texto: "", aplica_ccss: true, aplica_impuesto: true, afecta_aguinaldo: true, afecta_vacaciones: true, prioridad_calculo: 10, estado: "activo" };

export default function Conceptos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyConcept);
  const [editing, setEditing] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: conceptos = [], isLoading } = useQuery({ queryKey: ["conceptos"], queryFn: () => base44.entities.ConceptoPago.list("prioridad_calculo") });

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.ConceptoPago.update(editing, data) : base44.entities.ConceptoPago.create(data),
    onSuccess: () => { qc.invalidateQueries(["conceptos"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyConcept); setEditing(null); setOpen(true); };
  const openEdit = (c) => { setForm(c); setEditing(c.id); setOpen(true); };

  const filtered = tipoFiltro === "todos" ? conceptos : conceptos.filter(c => c.tipo === tipoFiltro);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conceptos de Pago</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresos y deducciones de la nómina</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Concepto
        </Button>
      </div>

      <div className="flex gap-2">
        {["todos","ingreso","deduccion"].map(t => (
          <button key={t} onClick={() => setTipoFiltro(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize
              ${tipoFiltro === t ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando conceptos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No hay conceptos de pago registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Cálculo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                    <td className="px-4 py-3">
                      <Badge className={c.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}>{c.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell capitalize">{c.categoria}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                      {c.calculo_tipo === "porcentaje" ? `${c.porcentaje}%` : c.calculo_tipo === "fijo" ? `₡${c.monto_fijo}` : c.calculo_tipo}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={c.estado === "activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>{c.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Concepto" : "Nuevo Concepto"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={e => set("codigo", e.target.value)} placeholder="SAL-001" />
            </div>
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => set("nombre", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="deduccion">Deducción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ordinario","extraordinario","legal","interno","beneficio","rebajo","ajuste"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de Cálculo</Label>
              <Select value={form.calculo_tipo} onValueChange={v => set("calculo_tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">Monto Fijo</SelectItem>
                  <SelectItem value="porcentaje">Porcentaje</SelectItem>
                  <SelectItem value="formula">Fórmula</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.calculo_tipo === "fijo" && (
              <div className="space-y-1">
                <Label>Monto Fijo (₡)</Label>
                <Input type="number" value={form.monto_fijo} onChange={e => set("monto_fijo", Number(e.target.value))} />
              </div>
            )}
            {form.calculo_tipo === "porcentaje" && (
              <div className="space-y-1">
                <Label>Porcentaje (%)</Label>
                <Input type="number" value={form.porcentaje} onChange={e => set("porcentaje", Number(e.target.value))} />
              </div>
            )}
            {form.calculo_tipo === "formula" && (
              <div className="col-span-2 space-y-1">
                <Label>Fórmula</Label>
                <Input value={form.formula_texto} onChange={e => set("formula_texto", e.target.value)} placeholder="salario_base * 0.05" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Prioridad Cálculo</Label>
              <Input type="number" value={form.prioridad_calculo} onChange={e => set("prioridad_calculo", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase">Aplicabilidad</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[["aplica_ccss","Aplica CCSS"],["aplica_impuesto","Aplica Impuesto"],["afecta_aguinaldo","Afecta Aguinaldo"],["afecta_vacaciones","Afecta Vacaciones"]].map(([k,l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-gray-700">{l}</span>
                  </label>
                ))}
              </div>
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