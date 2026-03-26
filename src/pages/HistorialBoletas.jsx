import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { generarBoletaPDF } from "@/components/planillas/BoletaPagoGenerator";
import { FileText, Search, Download, Loader2, ChevronDown, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const estadoColor = {
  borrador: "bg-gray-100 text-gray-600",
  calculado: "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado: "bg-emerald-100 text-emerald-700",
  pagado: "bg-purple-100 text-purple-700",
  anulado: "bg-red-100 text-red-600",
};

const fmt = (v) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2 });

export default function HistorialBoletas() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [busqueda, setBusqueda] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroAnio, setFiltroAnio] = useState("todos");
  const [expandidos, setExpandidos] = useState({});
  const [descargando, setDescargando] = useState(null);
  const [user, setUser] = useState(null);
  const [empleadoDelUsuario, setEmpleadoDelUsuario] = useState(null);

  // Obtener usuario logueado
  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role === "empleado") {
        // Si es empleado, encontrar su registro por email
        base44.entities.Empleado.filter({ correo: u.email }).then(emps => {
          if (emps.length > 0) setEmpleadoDelUsuario(emps[0].id);
        });
      }
    });
  }, []);

  const { data: planillasRaw = [], isLoading: loadingPlanillas } = useQuery({
    queryKey: ["planillas", empresaId],
    queryFn: () => base44.entities.Planilla.list("-created_date"),
  });
  const planillas = filterByEmpresa(planillasRaw).filter(p => ["calculado", "en_revision", "aprobado", "pagado"].includes(p.estado));

  const { data: periodos = [] } = useQuery({
    queryKey: ["periodos"],
    queryFn: () => base44.entities.PeriodoPlanilla.list("-fecha_inicio"),
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => base44.entities.Empresa.list(),
  });
  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });
  const { data: detalles = [] } = useQuery({
    queryKey: ["planillaDetalles"],
    queryFn: () => base44.entities.PlanillaDetalle.list("-created_date", 500),
  });

  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));
  const empresaMap = Object.fromEntries(empresas.map(e => [e.id, e]));
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, e]));

  // Años disponibles
  const aniosDisponibles = useMemo(() => {
    const set = new Set();
    planillas.forEach(p => {
      const per = periodoMap[p.periodo_id];
      if (per?.fecha_inicio) set.add(per.fecha_inicio.substring(0, 4));
    });
    return [...set].sort().reverse();
  }, [planillas, periodoMap]);

  // Planillas filtradas — si es empleado, mostrar solo sus boletas
  const planillasFiltradas = useMemo(() => {
    let filtered = planillas;
    
    // Si es empleado, filtrar solo sus detalles
    if (user?.role === "empleado" && empleadoDelUsuario) {
      filtered = planillas.filter(p => {
        const detallesPlanilla = detalles.filter(d => d.planilla_id === p.id && d.empleado_id === empleadoDelUsuario);
        return detallesPlanilla.length > 0;
      });
    }
    
    return filtered.filter(p => {
      const per = periodoMap[p.periodo_id];
      if (filtroAnio !== "todos" && per?.fecha_inicio?.substring(0, 4) !== filtroAnio) return false;
      if (filtroPeriodo !== "todos" && per?.tipo_periodo !== filtroPeriodo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const nombrePlanilla = (p.codigo_planilla || "").toLowerCase();
        const nombreEmpresa = (empresaMap[p.empresa_id]?.nombre_comercial || empresaMap[p.empresa_id]?.nombre_legal || "").toLowerCase();
        if (!nombrePlanilla.includes(q) && !nombreEmpresa.includes(q)) return false;
      }
      return true;
    });
  }, [planillas, periodoMap, filtroAnio, filtroPeriodo, busqueda, detalles, empleadoMap, empresaMap, user, empleadoDelUsuario]);

  const toggleExpandido = (id) => setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDescargarBoleta = async (planilla, detalle) => {
    const key = `${planilla.id}_${detalle.empleado_id}`;
    setDescargando(key);
    const empresa = empresaMap[planilla.empresa_id];
    const periodo = periodoMap[planilla.periodo_id];
    const empleado = empleadoMap[detalle.empleado_id];
    const movimientos = await base44.entities.MovimientoPlanilla.filter({
      planilla_id: planilla.id,
      empleado_id: detalle.empleado_id,
    });
    await generarBoletaPDF(empresa, empleado, periodo, detalle, movimientos, []);
    setDescargando(null);
  };

  const handleDescargarTodas = async (planilla) => {
    setDescargando(`all_${planilla.id}`);
    const empresa = empresaMap[planilla.empresa_id];
    const periodo = periodoMap[planilla.periodo_id];
    const detallesPlanilla = detalles.filter(d => d.planilla_id === planilla.id);
    for (const det of detallesPlanilla) {
      const empleado = empleadoMap[det.empleado_id];
      const movimientos = await base44.entities.MovimientoPlanilla.filter({
        planilla_id: planilla.id,
        empleado_id: det.empleado_id,
      });
      await generarBoletaPDF(empresa, empleado, periodo, det, movimientos, []);
    }
    setDescargando(null);
  };

  const isLoading = loadingPlanillas;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Boletas</h1>
        <p className="text-gray-500 text-sm mt-1">Consulte y descargue boletas de pago por empleado y período</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por planilla, empresa o empleado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroAnio} onValueChange={setFiltroAnio}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los años</SelectItem>
            {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
            <SelectItem value="quincenal">Quincenal</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="bisemanal">Bisemanal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando historial...
        </div>
      ) : planillasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No hay planillas con boletas disponibles</p>
          <p className="text-gray-400 text-sm mt-1">Solo se muestran planillas calculadas, aprobadas o pagadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {planillasFiltradas.map(planilla => {
            const periodo = periodoMap[planilla.periodo_id];
            const empresa = empresaMap[planilla.empresa_id];
            const detallesPlanilla = user?.role === "empleado" && empleadoDelUsuario
              ? detalles.filter(d => d.planilla_id === planilla.id && d.empleado_id === empleadoDelUsuario)
              : detalles.filter(d => d.planilla_id === planilla.id);
            const isOpen = expandidos[planilla.id];
            const descargandoTodas = descargando === `all_${planilla.id}`;

            return (
              <div key={planilla.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Cabecera de planilla */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpandido(planilla.id)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                    <div>
                      <div className="font-semibold text-gray-900">{planilla.codigo_planilla || "—"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {empresa?.nombre_comercial || empresa?.nombre_legal || "—"}
                        {periodo ? ` · ${periodo.tipo_periodo} · ${periodo.fecha_inicio} → ${periodo.fecha_fin}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                      <div className="text-sm font-semibold text-gray-800">₡ {fmt(planilla.total_neto)}</div>
                      <div className="text-xs text-gray-400">{detallesPlanilla.length} empleados</div>
                    </div>
                    <Badge className={estadoColor[planilla.estado]}>{planilla.estado}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                      disabled={descargandoTodas || detallesPlanilla.length === 0}
                      onClick={e => { e.stopPropagation(); handleDescargarTodas(planilla); }}
                      title="Descargar todas las boletas"
                    >
                      {descargandoTodas ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      <span className="hidden sm:inline">Todas</span>
                    </Button>
                  </div>
                </div>

                {/* Lista de empleados */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {detallesPlanilla.length === 0 ? (
                      <div className="px-6 py-4 text-sm text-gray-400">Sin detalles de empleados para esta planilla.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Salario Base</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Deducciones</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Neto a pagar</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Boleta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {detallesPlanilla.map(det => {
                            const emp = empleadoMap[det.empleado_id];
                            const key = `${planilla.id}_${det.empleado_id}`;
                            const isDesc = descargando === key;
                            // Filtrar por búsqueda a nivel de empleado (solo para admin)
                            if (!user || user.role !== "empleado") {
                              if (busqueda) {
                                const q = busqueda.toLowerCase();
                                const nombre = `${emp?.nombre || ""} ${emp?.apellidos || ""}`.toLowerCase();
                                const codPlan = (planilla.codigo_planilla || "").toLowerCase();
                                const empresa_ = (empresaMap[planilla.empresa_id]?.nombre_comercial || "").toLowerCase();
                                if (!nombre.includes(q) && !codPlan.includes(q) && !empresa_.includes(q)) return null;
                              }
                            }
                            return (
                              <tr key={det.id} className="hover:bg-gray-50">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                      <User className="w-3.5 h-3.5 text-blue-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-800">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</div>
                                      <div className="text-xs text-gray-400">{emp?.puesto || ""}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-gray-600 hidden md:table-cell">
                                  ₡ {fmt(det.salario_base_periodo)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-red-600 hidden md:table-cell">
                                  ₡ {fmt(det.deducciones_totales)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                                  ₡ {fmt(det.neto_pagar)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                                    disabled={isDesc}
                                    onClick={() => handleDescargarBoleta(planilla, det)}
                                    title="Descargar boleta PDF"
                                  >
                                    {isDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                    PDF
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}