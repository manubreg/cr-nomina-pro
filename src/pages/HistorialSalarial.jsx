import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Plus, ArrowUp, Calendar, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const motivoLabel = {
  decreto_mtss: "Decreto MTSS",
  merito: "Mérito",
  reclasificacion: "Reclasificación",
  promocion: "Promoción",
  ajuste_mercado: "Ajuste de Mercado",
  otro: "Otro",
};

const motivoColor = {
  decreto_mtss: "bg-blue-100 text-blue-700",
  merito: "bg-emerald-100 text-emerald-700",
  reclasificacion: "bg-purple-100 text-purple-700",
  promocion: "bg-amber-100 text-amber-700",
  ajuste_mercado: "bg-cyan-100 text-cyan-700",
  otro: "bg-gray-100 text-gray-600",
};

const empty = {
  empleado_id: "",
  salario_anterior: "",
  salario_nuevo: "",
  fecha_efectiva: new Date().toISOString().split("T")[0],
  motivo: "merito",
  descripcion: "",
};

export default function HistorialSalarial() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ["historial_salario", empresaId],
    queryFn: () => base44.entities.HistorialSalario.list("-fecha_efectiva"),
  });

  const { data: empleadosRaw = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });
  const empleados = filterByEmpresa(empleadosRaw).filter(e => e.estado === "activo");
  const empleadoMap = Object.fromEntries(empleadosRaw.map(e => [e.id, e]));

  const historialFiltrado = filterByEmpresa(historial).filter(h => {
    if (!filtroEmpleado) return true;
    const emp = empleadoMap[h.empleado_id];
    return emp && `${emp.nombre} ${emp.apellidos}`.toLowerCase().includes(filtroEmpleado.toLowerCase());
  });

  const registrarMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      // 1. Guardar historial
      await base44.entities.HistorialSalario.create({
        ...data,
        empresa_id: empresaId || empleadoMap[data.empleado_id]?.empresa_id,
        salario_anterior: Number(data.salario_anterior),
        salario_nuevo: Number(data.salario_nuevo),
        porcentaje_aumento: data.salario_anterior > 0
          ? Math.round(((data.salario_nuevo - data.salario_anterior) / data.salario_anterior) * 10000) / 100
          : 0,
        usuario_registro: user.email,
      });
      // 2. Actualizar salario en el empleado
      await base44.entities.Empleado.update(data.empleado_id, {
        salario_base: Number(data.salario_nuevo),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["historial_salario"]);
      qc.invalidateQueries(["empleados"]);
      setModal(false);
      setForm(empty);
      toast({ title: "Aumento registrado", description: "El salario del empleado ha sido actualizado." });
    },
  });

  const handleEmpleadoChange = (id) => {
    const emp = empleadoMap[id];
    setForm(f => ({ ...f, empleado_id: id, salario_anterior: emp?.salario_base || "" }));
  };

  const pct = form.salario_anterior && form.salario_nuevo
    ? (((Number(form.salario_nuevo) - Number(form.salario_anterior)) / Number(form.salario_anterior)) * 100).toFixed(2)
    : null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial Salarial</h1>
          <p className="text-gray-500 text-sm mt-1">{historialFiltrado.length} movimientos registrados</p>
        </div>
        <Button onClick={() => setModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Registrar Aumento
        </Button>
      </div>

      {/* Filtro */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar empleado..."
          value={filtroEmpleado}
          onChange={e => setFiltroEmpleado(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando historial...</div>
        ) : historialFiltrado.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay registros salariales</p>
            <p className="text-gray-400 text-sm mt-1">Registra el primer aumento salarial</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Motivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Nuevo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">% Aumento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Fecha Efectiva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historialFiltrado.map(h => {
                  const emp = empleadoMap[h.empleado_id];
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</div>
                        <div className="text-xs text-gray-400">{emp?.puesto || ""}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge className={motivoColor[h.motivo]}>{motivoLabel[h.motivo]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        ₡{Number(h.salario_anterior).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                        ₡{Number(h.salario_nuevo).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <ArrowUp className="w-3 h-3" />
                          {h.porcentaje_aumento}%
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{h.fecha_efectiva}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modal} onOpenChange={open => { if (!open) { setModal(false); setForm(empty); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> Registrar Aumento Salarial
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={handleEmpleadoChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>
                  {empleados.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Salario Anterior</Label>
                <input
                  type="number"
                  value={form.salario_anterior}
                  onChange={e => setForm(f => ({ ...f, salario_anterior: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Salario Nuevo *</Label>
                <input
                  type="number"
                  value={form.salario_nuevo}
                  onChange={e => setForm(f => ({ ...f, salario_nuevo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            {pct !== null && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
                <ArrowUp className="w-4 h-4" />
                Aumento del <strong>{pct}%</strong> · Diferencia: ₡{(Number(form.salario_nuevo) - Number(form.salario_anterior)).toLocaleString()}
              </div>
            )}

            <div className="space-y-1">
              <Label>Motivo *</Label>
              <Select value={form.motivo} onValueChange={v => setForm(f => ({ ...f, motivo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(motivoLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fecha Efectiva *</Label>
              <input
                type="date"
                value={form.fecha_efectiva}
                onChange={e => setForm(f => ({ ...f, fecha_efectiva: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <Label>Descripción / Observaciones</Label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Aumento por decreto MTSS enero 2026..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => { setModal(false); setForm(empty); }}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.empleado_id || !form.salario_nuevo || registrarMutation.isPending}
              onClick={() => registrarMutation.mutate(form)}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {registrarMutation.isPending ? "Guardando..." : "Registrar Aumento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}