import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Receipt, Eye, Calculator, Loader2, Zap, Download, FileText, Edit2, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useEmpresaContext } from "@/components/EmpresaContext";
import PlanillaDetalleModal from "@/components/planillas/PlanillaDetalleModal";
import { generarBoletaPDF } from "@/components/planillas/BoletaPagoGenerator";
import { useToast } from "@/components/ui/use-toast";

const estadoColor = {
  borrador: "bg-gray-100 text-gray-600",
  calculado: "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado: "bg-emerald-100 text-emerald-700",
  pagado: "bg-purple-100 text-purple-700",
  anulado: "bg-red-100 text-red-600",
};

export default function Planillas() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const { toast } = useToast();
  const [detalleModal, setDetalleModal] = useState(null);
  const [editandoModal, setEditandoModal] = useState(null);
  const [calculando, setCalculando] = useState(null);
  const [descargando, setDescargando] = useState(null);
  const [autoModal, setAutoModal] = useState(false);
  const [autoForm, setAutoForm] = useState({ empresa_id: "", periodo_id: "", tipo_planilla: "ordinaria", empleados_ids: [] });
  const [creandoAuto, setCreandoAuto] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const [busquedaEmpleados, setBusquedaEmpleados] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, title, description, confirmLabel, btnType, onConfirm }

  const { data: planillasRaw = [], isLoading } = useQuery({
    queryKey: ["planillas", empresaId],
    queryFn: () => base44.entities.Planilla.list("-created_date"),
  });
  const planillas = filterByEmpresa(planillasRaw);

  const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => base44.entities.Empresa.list() });
  const { data: periodos = [] } = useQuery({ queryKey: ["periodos"], queryFn: () => base44.entities.PeriodoPlanilla.list("-fecha_inicio") });
  const { data: empleadosAll = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });

  const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e]));
  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));

  const handleCrearAutomatica = async () => {
    if (!autoForm.empresa_id || !autoForm.periodo_id) {
      toast({ title: "Campos requeridos", description: "Seleccione empresa y período", variant: "destructive" });
      return;
    }
    setCreandoAuto(true);
    const periodoSel = periodos.find(p => p.id === autoForm.periodo_id);
    const generarNombre = (periodo) => {
      if (!periodo) return `PLN-${Date.now().toString().slice(-6)}`;
      const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      const fecha = new Date((periodo.fecha_inicio || "") + "T00:00:00");
      const mes = MESES[fecha.getMonth()];
      const anio = fecha.getFullYear();
      switch (periodo.tipo_periodo) {
        case "mensual":    return `Planilla ${mes} ${anio}`;
        case "quincenal":  return `Planilla ${fecha.getDate() <= 15 ? "1ra" : "2da"} Quincena ${mes} ${anio}`;
        case "bisemanal":  return `Planilla Bisemanal ${periodo.fecha_inicio} - ${periodo.fecha_fin}`;
        case "semanal":    return `Planilla Semana ${periodo.fecha_inicio}`;
        case "diario":     return `Planilla Diaria ${periodo.fecha_inicio}`;
        case "aguinaldo":  return `Aguinaldo ${anio}`;
        case "liquidacion":return `Liquidación ${mes} ${anio}`;
        default:           return `Planilla ${periodo.fecha_inicio}`;
      }
    };
    const nueva = await base44.entities.Planilla.create({
      empresa_id: autoForm.empresa_id,
      periodo_id: autoForm.periodo_id,
      tipo_planilla: autoForm.tipo_planilla,
      estado: "borrador",
      codigo_planilla: generarNombre(periodoSel),
    });
    const res = await base44.functions.invoke('calcularPlanilla', { 
      planilla_id: nueva.id,
      empresa_id: autoForm.empresa_id,
      periodo_id: autoForm.periodo_id,
      empleados_ids: autoForm.empleados_ids.length > 0 ? autoForm.empleados_ids : undefined
    });
    setCreandoAuto(false);
    setAutoModal(false);
    setAutoForm({ empresa_id: "", periodo_id: "", tipo_planilla: "ordinaria", empleados_ids: [] });
    setBusquedaEmpleados("");
    qc.invalidateQueries(["planillas"]);
    if (res.data?.ok) {
      toast({
        title: "✅ Planilla creada y calculada",
        description: `${res.data.empleados_procesados} empleados · Neto: ₡${Number(res.data.total_neto).toLocaleString()}`,
      });
    } else {
      toast({ title: "Error al calcular", description: res.data?.error || "Error desconocido", variant: "destructive" });
    }
  };

  const handleCalcular = async (planilla) => {
    setCalculando(planilla.id);
    const res = await base44.functions.invoke('calcularPlanilla', { planilla_id: planilla.id, empresa_id: planilla.empresa_id, periodo_id: planilla.periodo_id });
    setCalculando(null);
    if (res.data?.ok) {
      qc.invalidateQueries(["planillas"]);
      toast({ title: "Planilla calculada", description: `${res.data.empleados_procesados} empleados · Neto: ₡${Number(res.data.total_neto).toLocaleString()}` });
    } else {
      toast({ title: "Error al calcular", description: res.data?.error || "Error desconocido", variant: "destructive" });
    }
  };

  // Descargar boletas PDF de todos los empleados de la planilla
  const handleDescargarTodas = async (planilla) => {
    setDescargando(planilla.id);
    const empresa = empresaMap[planilla.empresa_id];
    const periodo = periodoMap[planilla.periodo_id];

    const detalles = await base44.entities.PlanillaDetalle.list();
    const movimientos = await base44.entities.MovimientoPlanilla.list();

    const detallesPlanilla = detalles.filter(d => d.planilla_id === planilla.id);

    for (const detalle of detallesPlanilla) {
      const empleado = empleadosAll.find(e => e.id === detalle.empleado_id);
      const movs = movimientos.filter(m => m.planilla_id === planilla.id && m.empleado_id === detalle.empleado_id);
      await generarBoletaPDF(empresa, empleado, periodo, detalle, movs, []);
    }

    setDescargando(null);
    toast({ title: "Descarga completa", description: `${detallesPlanilla.length} boletas generadas` });
  };

  const handleEliminar = async (planilla) => {
    if (!confirm(`¿Eliminar planilla ${planilla.codigo_planilla}? Esta acción no se puede deshacer.`)) return;
    setEliminando(planilla.id);
    
    try {
      // Eliminar detalles y movimientos
      const detalles = await base44.entities.PlanillaDetalle.filter({ planilla_id: planilla.id });
      const movimientos = await base44.entities.MovimientoPlanilla.filter({ planilla_id: planilla.id });
      
      await Promise.all([
        ...detalles.map(d => base44.entities.PlanillaDetalle.delete(d.id)),
        ...movimientos.map(m => base44.entities.MovimientoPlanilla.delete(m.id)),
      ]);
      
      // Eliminar planilla
      await base44.entities.Planilla.delete(planilla.id);
      qc.invalidateQueries(["planillas"]);
      toast({ title: "Planilla eliminada", description: `${planilla.codigo_planilla} ha sido eliminada` });
    } catch (err) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planillas</h1>
          <p className="text-gray-500 text-sm mt-1">{planillas.length} planillas registradas</p>
        </div>
        <Button onClick={() => setAutoModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Zap className="w-4 h-4 mr-2" /> Planilla Automática
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando planillas...</div>
        ) : planillas.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay planillas registradas</p>
            <p className="text-gray-400 text-sm mt-1">Crea una planilla automática para comenzar</p>
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
                      <div className="text-xs text-gray-400">{empresaMap[p.empresa_id]?.nombre_comercial || empresaMap[p.empresa_id]?.nombre_legal || "—"}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell capitalize text-gray-600">{p.tipo_planilla}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {periodoMap[p.periodo_id] ? `${periodoMap[p.periodo_id].tipo_periodo} · ${periodoMap[p.periodo_id].fecha_inicio} → ${periodoMap[p.periodo_id].fecha_fin}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-gray-800">
                      {p.total_neto ? `₡ ${Number(p.total_neto).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={estadoColor[p.estado]}>{p.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                     <div className="flex items-center justify-end gap-1">
                       {/* Recalcular — bloqueado si aprobado/pagado/anulado */}
                       {!['aprobado', 'pagado', 'anulado'].includes(p.estado) && (
                         <button
                           onClick={() => handleCalcular(p)}
                           disabled={calculando === p.id}
                           title="Recalcular planilla"
                           className="text-gray-400 hover:text-emerald-600 p-1.5 rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
                         >
                           {calculando === p.id
                             ? <Loader2 className="w-4 h-4 animate-spin" />
                             : <Calculator className="w-4 h-4" />}
                         </button>
                       )}
                       {/* Aprobar — solo si está calculado o en_revision */}
                       {['calculado', 'en_revision'].includes(p.estado) && (
                         <button
                           onClick={async () => {
                             if (!confirm(`¿Aprobar la planilla "${p.codigo_planilla}"? Una vez aprobada no podrá modificarse.`)) return;
                             await base44.entities.Planilla.update(p.id, {
                               estado: 'aprobado',
                               usuario_aprobo: (await base44.auth.me()).email,
                               fecha_aprobacion: new Date().toISOString().split("T")[0],
                             });
                             if (p.periodo_id) {
                               await base44.entities.PeriodoPlanilla.update(p.periodo_id, { estado: 'aprobado' });
                               qc.invalidateQueries(["periodos"]);
                             }
                             qc.invalidateQueries(["planillas"]);
                             toast({ title: "Planilla aprobada", description: "El período también fue marcado como aprobado." });
                           }}
                           title="Aprobar planilla"
                           className="text-gray-400 hover:text-emerald-600 p-1.5 rounded hover:bg-emerald-50 transition-colors"
                         >
                           <CheckCircle className="w-4 h-4" />
                         </button>
                       )}
                       {/* Visualizar */}
                       <button
                         onClick={() => setDetalleModal(p)}
                         title="Visualizar detalle"
                         className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       {/* Descargar boletas */}
                       <button
                         onClick={() => handleDescargarTodas(p)}
                         disabled={descargando === p.id}
                         title="Descargar boletas PDF de todos los empleados"
                         className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                       >
                         {descargando === p.id
                           ? <Loader2 className="w-4 h-4 animate-spin" />
                           : <FileText className="w-4 h-4" />}
                       </button>
                       {/* Editar — bloqueado si aprobado/pagado/anulado */}
                       {!['aprobado', 'pagado', 'anulado'].includes(p.estado) && (
                         <button
                           onClick={() => setEditandoModal(p)}
                           title="Editar planilla"
                           className="text-gray-400 hover:text-orange-600 p-1.5 rounded hover:bg-orange-50 transition-colors"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                       )}
                       {/* Eliminar — bloqueado si aprobado/pagado */}
                       {!['aprobado', 'pagado'].includes(p.estado) && (
                         <button
                           onClick={() => handleEliminar(p)}
                           disabled={eliminando === p.id}
                           title="Eliminar planilla"
                           className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                         >
                           {eliminando === p.id
                             ? <Loader2 className="w-4 h-4 animate-spin" />
                             : <Trash2 className="w-4 h-4" />}
                         </button>
                       )}
                     </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Planilla Automática */}
      <Dialog open={autoModal} onOpenChange={(open) => { if (!creandoAuto) setAutoModal(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" /> Crear Planilla Automática
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">
            Crea la planilla y ejecuta el cálculo completo (CCSS, ISR, novedades) en un solo paso.
          </p>
          <div className="grid gap-4 mt-1">
            <div className="space-y-1">
              <Label>Empresa *</Label>
              <Select value={autoForm.empresa_id} onValueChange={v => setAutoForm(f => ({ ...f, empresa_id: v, periodo_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Período *</Label>
              <Select value={autoForm.periodo_id} onValueChange={v => setAutoForm(f => ({ ...f, periodo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar período" /></SelectTrigger>
                <SelectContent>
                  {periodos
                    .filter(p => !autoForm.empresa_id || p.empresa_id === autoForm.empresa_id)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.tipo_periodo} · {p.fecha_inicio} → {p.fecha_fin}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
               <Label>Tipo de Planilla</Label>
               <Select value={autoForm.tipo_planilla} onValueChange={v => setAutoForm(f => ({ ...f, tipo_planilla: v }))}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="ordinaria">Ordinaria</SelectItem>
                   <SelectItem value="extraordinaria">Extraordinaria</SelectItem>
                   <SelectItem value="aguinaldo">Aguinaldo</SelectItem>
                   <SelectItem value="liquidacion">Liquidación</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             {autoForm.tipo_planilla === "extraordinaria" && (
               <div className="space-y-2">
                 <Label>Empleados (opcional: si no selecciona se procesa toda la nómina)</Label>
                 <input
                   type="text"
                   placeholder="Buscar empleado..."
                   value={busquedaEmpleados}
                   onChange={(e) => setBusquedaEmpleados(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                 />
                 <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                   {empleadosAll
                     .filter(e => e.empresa_id === autoForm.empresa_id && e.estado === "activo" && 
                       `${e.nombre} ${e.apellidos}`.toLowerCase().includes(busquedaEmpleados.toLowerCase()))
                     .length === 0 ? (
                     <p className="text-xs text-gray-500">No hay empleados que coincidan</p>
                   ) : (
                     empleadosAll
                       .filter(e => e.empresa_id === autoForm.empresa_id && e.estado === "activo" &&
                         `${e.nombre} ${e.apellidos}`.toLowerCase().includes(busquedaEmpleados.toLowerCase()))
                       .map(emp => (
                         <label key={emp.id} className="flex items-center gap-2 py-2 cursor-pointer hover:bg-white px-2 rounded text-sm">
                           <input
                             type="checkbox"
                             checked={autoForm.empleados_ids.includes(emp.id)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setAutoForm(f => ({ ...f, empleados_ids: [...f.empleados_ids, emp.id] }));
                               } else {
                                 setAutoForm(f => ({ ...f, empleados_ids: f.empleados_ids.filter(id => id !== emp.id) }));
                               }
                             }}
                             className="w-4 h-4"
                           />
                           <span>{emp.nombre} {emp.apellidos}</span>
                         </label>
                       ))
                   )}
                 </div>
               </div>
             )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setAutoModal(false)} disabled={creandoAuto}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCrearAutomatica} disabled={creandoAuto}>
              {creandoAuto ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> : <><Zap className="w-4 h-4 mr-2" /> Crear y Calcular</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle */}
      {detalleModal && (
        <PlanillaDetalleModal planilla={detalleModal} onClose={() => setDetalleModal(null)} />
      )}

      {/* Modal editar */}
      {editandoModal && (
        <Dialog open={!!editandoModal} onOpenChange={(open) => { if (open) return; setEditandoModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-600" /> Editar Planilla
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-1">
                <Label>Código Planilla</Label>
                <input
                  type="text"
                  value={editandoModal.codigo_planilla || ""}
                  onChange={(e) => setEditandoModal({ ...editandoModal, codigo_planilla: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={editandoModal.estado} onValueChange={(v) => setEditandoModal({ ...editandoModal, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="calculado">Calculado</SelectItem>
                    <SelectItem value="en_revision">En Revisión</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <textarea
                  value={editandoModal.observacion || ""}
                  onChange={(e) => setEditandoModal({ ...editandoModal, observacion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  rows="3"
                />
              </div>
            </div>
            {editandoModal.estado === "aprobado" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                ✅ Al aprobar, se descargarán automáticamente las boletas PDF de todos los empleados con las deducciones de CCSS e ISR calculadas.
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setEditandoModal(null)}>Cancelar</Button>
              <Button 
                className="bg-orange-600 hover:bg-orange-700"
                onClick={async () => {
                  const aprobando = editandoModal.estado === "aprobado";
                  await base44.entities.Planilla.update(editandoModal.id, {
                    codigo_planilla: editandoModal.codigo_planilla,
                    estado: editandoModal.estado,
                    observacion: editandoModal.observacion,
                    ...(aprobando ? { usuario_aprobo: (await base44.auth.me()).email, fecha_aprobacion: new Date().toISOString().split("T")[0] } : {}),
                  });
                  if (aprobando && editandoModal.periodo_id) {
                    await base44.entities.PeriodoPlanilla.update(editandoModal.periodo_id, { estado: 'aprobado' });
                    qc.invalidateQueries(["periodos"]);
                  }
                  qc.invalidateQueries(["planillas"]);
                  setEditandoModal(null);
                  toast({ title: "Planilla actualizada", description: aprobando ? "El período también fue marcado como aprobado." : undefined });

                  // Al aprobar: descargar boletas automáticamente
                  if (aprobando) {
                    toast({ title: "Generando boletas PDF...", description: "Se descargarán las boletas de todos los empleados." });
                    await handleDescargarTodas({ ...editandoModal });
                  }
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {editandoModal.estado === "aprobado" ? "Aprobar y Descargar Boletas" : "Guardar Cambios"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}