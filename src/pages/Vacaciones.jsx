import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Umbrella, Calculator, Loader2, Info, CalendarDays, AlertTriangle } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CalendarioAusencias from "@/components/vacaciones/CalendarioAusencias";

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
  const empleadoEstadoMap = Object.fromEntries(empleados.map(e => [e.id, e.estado]));

  // Filtrar saldos: excluir empleados liquidados o inactivos (sus vacaciones ya se liquidaron)
  const saldosFiltrados = saldos.filter(s => {
    const estado = empleadoEstadoMap[s.empleado_id];
    return estado !== 'liquidado' && estado !== 'inactivo';
  });

  // Cálculo de días acumulados según Código de Trabajo CR: 1 día por cada mes trabajado (12 días por año)
  const calcularDiasAcumulados = (fechaIngreso) => {
    if (!fechaIngreso) return { diasGanados: 0, mesesTrabajados: 0, anios: 0 };
    const ingreso = new Date(fechaIngreso + "T00:00:00");
    const hoy = new Date();
    let anios = hoy.getFullYear() - ingreso.getFullYear();
    let meses = hoy.getMonth() - ingreso.getMonth();
    if (meses < 0) { anios--; meses += 12; }
    const mesesTotales = anios * 12 + meses;
    const diasGanados = parseFloat((mesesTotales * 1.25).toFixed(2)); // 15 días por año = 1.25 por mes
    return { diasGanados, mesesTrabajados: mesesTotales, anios };
  };

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
  const [modoCalculo, setModoCalculo] = useState("individual"); // "individual" | "total"
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultadosTotal, setResultadosTotal] = useState([]);

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

  const calcularTodos = async () => {
    const empsActivos = empleados.filter(e => e.estado === "activo" && e.fecha_ingreso && (!empresaId || e.empresa_id === empresaId));
    if (empsActivos.length === 0) return;
    setCalculando(true);
    setResultadosTotal([]);
    setProgreso({ actual: 0, total: empsActivos.length });
    const resultados = [];
    for (let i = 0; i < empsActivos.length; i++) {
      const emp = empsActivos[i];
      setProgreso({ actual: i + 1, total: empsActivos.length });
      const res = await base44.functions.invoke('calcularVacaciones', {
        empleado_id: emp.id,
        empresa_id: emp.empresa_id || empresaId,
      });
      if (res.data?.ok) {
        resultados.push({ emp, resultado: res.data.resultado });
        await base44.entities.VacacionSaldo.create(res.data.resultado);
      }
    }
    setResultadosTotal(resultados);
    setCalculando(false);
    qc.invalidateQueries(["vacSaldos"]);
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
        <div className="flex gap-2">
          <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { setSaldoForm({ empleado_id: "", empresa_id: empresaId || "" }); setDetalleCalculo(null); setOpenSaldo(true); }}>
            <Calculator className="w-4 h-4 mr-2" /> Calcular Saldo
          </Button>
          <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
            <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
          </Button>
        </div>
      </div>

      <Tabs defaultValue="solicitudes">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes ({solicitudes.length})</TabsTrigger>
          <TabsTrigger value="acumulados">Acumulados</TabsTrigger>
          <TabsTrigger value="calendario"><CalendarDays className="w-3.5 h-3.5 mr-1" />Calendario</TabsTrigger>
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


        {/* Pestaña Acumulados: muestra días ganados automáticamente por fecha de ingreso */}
        <TabsContent value="acumulados" className="mt-4">
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            Cálculo automático basado en el Código de Trabajo de Costa Rica: <strong>15 días por año laborado</strong> (1.25 días/mes). Solo empleados activos con fecha de ingreso registrada.
          </div>
          {/* Alerta empleados con 8+ días disponibles */}
          {(() => {
            const conAlerta = empleados
              .filter(e => e.estado === "activo" && e.fecha_ingreso && (!empresaId || e.empresa_id === empresaId))
              .filter(emp => {
                const { diasGanados } = calcularDiasAcumulados(emp.fecha_ingreso);
                const diasUsados = solicitudes.filter(s => s.empleado_id === emp.id && ["aprobada", "aplicada"].includes(s.estado)).reduce((sum, s) => sum + (s.dias_solicitados || 0), 0);
                return Math.max(0, diasGanados - diasUsados) >= 8;
              });
            if (conAlerta.length === 0) return null;
            return (
              <div className="mb-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {conAlerta.length} empleado{conAlerta.length !== 1 ? "s" : ""} con 8 o más días de vacaciones disponibles
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {conAlerta.map(e => `${e.nombre} ${e.apellidos}`).join(" · ")}
                  </p>
                </div>
              </div>
            );
          })()}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {empleados.filter(e => e.estado === "activo" && e.fecha_ingreso && (!empresaId || e.empresa_id === empresaId)).length === 0 ? (
              <div className="p-12 text-center"><Umbrella className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin empleados activos con fecha de ingreso</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fecha Ingreso</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Antigüedad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días Acumulados</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Días Usados</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {empleados
                      .filter(e => e.estado === "activo" && e.fecha_ingreso && (!empresaId || e.empresa_id === empresaId))
                      .map(emp => {
                        const { diasGanados, mesesTrabajados, anios } = calcularDiasAcumulados(emp.fecha_ingreso);
                        // Sumar días usados de solicitudes aprobadas/aplicadas
                        const diasUsados = solicitudes
                          .filter(s => s.empleado_id === emp.id && ["aprobada", "aplicada"].includes(s.estado))
                          .reduce((sum, s) => sum + (s.dias_solicitados || 0), 0);
                        const saldoDisponible = Math.max(0, diasGanados - diasUsados);
                        return (
                          <tr key={emp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{emp.nombre} {emp.apellidos}</div>
                              <div className="text-xs text-gray-400">{emp.puesto || ""}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{emp.fecha_ingreso}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-gray-700">
                                {anios > 0 ? `${anios} año${anios !== 1 ? "s" : ""}` : ""} {mesesTrabajados % 12 > 0 ? `${mesesTrabajados % 12} mes${(mesesTrabajados % 12) !== 1 ? "es" : ""}` : ""}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-emerald-700">{diasGanados}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-red-500">{diasUsados}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-lg ${saldoDisponible >= 8 ? "text-amber-600" : saldoDisponible > 0 ? "text-blue-700" : "text-red-600"}`}>
                                    {saldoDisponible.toFixed(2)}
                                  </span>
                                  {saldoDisponible >= 8 && (
                                    <span title="8 o más días disponibles" className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-medium">
                                      <AlertTriangle className="w-3 h-3" /> Pendientes
                                    </span>
                                  )}
                                </div>
                              </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Pestaña Calendario de Ausencias */}
        <TabsContent value="calendario" className="mt-4">
          <CalendarioAusencias solicitudes={solicitudes} empleadoMap={empleadoMap} />
        </TabsContent>
      </Tabs>

      {/* Modal Calcular Saldo Vacaciones */}
      <Dialog open={openSaldo} onOpenChange={(v) => { if (!calculando) { setOpenSaldo(v); setResultadosTotal([]); setDetalleCalculo(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-600" /> Calcular Saldo de Vacaciones</DialogTitle></DialogHeader>

          {/* Tabs modo */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mt-2">
            <button onClick={() => { setModoCalculo("individual"); setResultadosTotal([]); }}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${modoCalculo === "individual" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
              Individual
            </button>
            <button onClick={() => { setModoCalculo("total"); setDetalleCalculo(null); }}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${modoCalculo === "total" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
              Todos los empleados
            </button>
          </div>

          {modoCalculo === "individual" ? (
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Empleado *</Label>
                <Select value={saldoForm.empleado_id} onValueChange={v => setSaldoForm(f => ({ ...f, empleado_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                  <SelectContent>{empleados.filter(e => e.estado === "activo").map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={calcularSaldoAuto} disabled={calculando || !saldoForm.empleado_id}>
                {calculando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="w-4 h-4 mr-2" /> Calcular (Código Trabajo CR)</>}
              </Button>
              {detalleCalculo && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1"><Info className="w-3 h-3" /> Resultado del cálculo</p>
                  <p>Fecha ingreso: <strong>{detalleCalculo.fecha_ingreso}</strong></p>
                  <p>Días trabajados: <strong>{detalleCalculo.dias_trabajados}</strong> ({detalleCalculo.anios_completos} años)</p>
                  <p>Días ganados: <strong>{saldoForm.dias_ganados}</strong> | Días usados: <strong>{saldoForm.dias_usados}</strong></p>
                  <p>Saldo actual: <strong>{saldoForm.saldo_actual} días</strong></p>
                  <p>Valor en colones: <strong>₡ {Number(detalleCalculo.valor_saldo_total).toLocaleString()}</strong></p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                Calculará y guardará el saldo de vacaciones para <strong>{empleados.filter(e => e.estado === "activo" && e.fecha_ingreso && (!empresaId || e.empresa_id === empresaId)).length} empleados activos</strong>.
              </div>
              {calculando && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Procesando empleado {progreso.actual} de {progreso.total}...</span>
                    <span>{Math.round((progreso.actual / progreso.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(progreso.actual / progreso.total) * 100}%` }} />
                  </div>
                </div>
              )}
              {resultadosTotal.length > 0 && !calculando && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
                  <p className="font-semibold mb-1">✅ {resultadosTotal.length} saldos calculados y guardados</p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {resultadosTotal.map(({ emp, resultado }) => (
                      <p key={emp.id}>{emp.nombre} {emp.apellidos}: <strong>{resultado.saldo_actual} días</strong></p>
                    ))}
                  </div>
                </div>
              )}
              <Button type="button" className="w-full bg-blue-700 hover:bg-blue-800"
                onClick={calcularTodos} disabled={calculando}>
                {calculando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando {progreso.actual}/{progreso.total}...</> : <><Calculator className="w-4 h-4 mr-2" /> Calcular todos</>}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setOpenSaldo(false); setResultadosTotal([]); setDetalleCalculo(null); }} disabled={calculando}>Cancelar</Button>
            {modoCalculo === "individual" && detalleCalculo && (
              <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => saveSaldo.mutate(saldoForm)} disabled={saveSaldo.isPending}>
                {saveSaldo.isPending ? "Guardando..." : "Guardar Saldo"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Solicitud" : "Nueva Solicitud de Vacaciones"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.filter(e => e.estado === "activo").map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
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