import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Umbrella, Calculator, Loader2, Info } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const estadoColor = { pendiente: "bg-amber-100 text-amber-700", aprobada: "bg-emerald-100 text-emerald-700", rechazada: "bg-red-100 text-red-600", aplicada: "bg-purple-100 text-purple-700" };
const emptySolicitud = { empleado_id: "", empresa_id: "", fecha_solicitud: new Date().toISOString().split("T")[0], fecha_inicio: "", fecha_fin: "", dias_solicitados: 0, motivo: "", estado: "pendiente" };

export default function Vacaciones() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptySolicitud);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: solicitudesRaw = [], isLoading } = useQuery({ queryKey: ["vacSolicitudes", empresaId], queryFn: () => base44.entities.VacacionSolicitud.list("-fecha_solicitud") });
  const solicitudes = filterByEmpresa(solicitudesRaw);
  const { data: saldosRaw = [] } = useQuery({ queryKey: ["vacSaldos", empresaId], queryFn: () => base44.entities.VacacionSaldo.list("-fecha_generacion") });
  const saldos = filterByEmpresa(saldosRaw);
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.VacacionSolicitud.update(editing, data) : base44.entities.VacacionSolicitud.create(data),
    onSuccess: () => { qc.invalidateQueries(["vacSolicitudes"]); setOpen(false); },
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.VacacionSolicitud.update(id, { estado }),
    onSuccess: () => qc.invalidateQueries(["vacSolicitudes"]),
  });

  const [calculando, setCalculando] = useState(false);
  const [detalleCalculo, setDetalleCalculo] = useState(null);
  const [openSaldo, setOpenSaldo] = useState(false);
  const [saldoForm, setSaldoForm] = useState({ empleado_id: "", empresa_id: "" });

  const calcularSaldoAuto = async () => {
    if (!saldoForm.empleado_id) return;
    setCalculando(true);
    setDetalleCalculo(null);
    const res = await base44.functions.invoke('calcularVacaciones', {
      empleado_id: saldoForm.empleado_id,
      empresa_id: saldoForm.empresa_id || empresaId,
    });
    if (res.data?.ok) {
      const r = res.data.resultado;
      setSaldoForm(f => ({ ...f, ...r }));
      setDetalleCalculo(r._detalle);
    }
    setCalculando(false);
  };

  const saveSaldo = useMutation({
    mutationFn: (data) => base44.entities.VacacionSaldo.create(data),
    onSuccess: () => { qc.invalidateQueries(["vacSaldos"]); setOpenSaldo(false); setDetalleCalculo(null); },
  });

  const openNew = () => { setForm({ ...emptySolicitud, empresa_id: empresaId || "" }); setEditing(null); setOpen(true); };
  const openEdit = (s) => { setForm(s); setEditing(s.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vacaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Solicitudes y saldos de vacaciones</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
        </Button>
      </div>

      <Tabs defaultValue="solicitudes">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes ({solicitudes.length})</TabsTrigger>
          <TabsTrigger value="saldos">Saldos ({saldos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitudes" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : solicitudes.length === 0 ? (
              <div className="p-12 text-center"><Umbrella className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin solicitudes</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Inicio</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fin</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {solicitudes.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[s.empleado_id] || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.fecha_inicio}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.fecha_fin}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{s.dias_solicitados}</td>
                        <td className="px-4 py-3"><Badge className={estadoColor[s.estado]}>{s.estado}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {s.estado === "pendiente" && (
                              <>
                                <button onClick={() => cambiarEstado.mutate({ id: s.id, estado: "aprobada" })} className="text-xs text-emerald-600 hover:underline">Aprobar</button>
                                <span className="text-gray-300">|</span>
                                <button onClick={() => cambiarEstado.mutate({ id: s.id, estado: "rechazada" })} className="text-xs text-red-500 hover:underline">Rechazar</button>
                                <span className="text-gray-300">|</span>
                              </>
                            )}
                            <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:underline">Editar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {saldos.length === 0 ? (
              <div className="p-12 text-center"><Umbrella className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin saldos registrados</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días Ganados</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días Usados</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {saldos.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{empleadoMap[s.empleado_id] || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{s.dias_ganados}</td>
                        <td className="px-4 py-3 text-gray-600">{s.dias_usados}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{s.saldo_actual}</td>
                        <td className="px-4 py-3"><Badge className={s.estado === "vigente" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>{s.estado}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Solicitud" : "Nueva Solicitud de Vacaciones"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
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
            <div className="space-y-1">
              <Label>Días Solicitados *</Label>
              <Input type="number" value={form.dias_solicitados} onChange={e => set("dias_solicitados", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobada">Aprobada</SelectItem>
                  <SelectItem value="rechazada">Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Motivo</Label>
              <Input value={form.motivo || ""} onChange={e => set("motivo", e.target.value)} />
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