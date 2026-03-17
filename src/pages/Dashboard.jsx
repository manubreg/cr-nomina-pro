import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useEmpresaContext } from "@/components/EmpresaContext";
import {
  Users, UserX, Clock, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, Calendar, Activity, Gift, Briefcase, Bell, ArrowRight,
  CheckCircle, XCircle, RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

const formatCRC = (v) => `₡${Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;

function StatCard({ title, value, subtitle, icon: Icon, color, trend, linkTo }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    red: "bg-red-50 text-red-600 border-red-100",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}% vs mes anterior
        </div>
      )}
      {linkTo && (
        <Link to={linkTo} className="flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium">
          Ver detalle <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { empresaId, filterByEmpresa, empresaActual, isAdmin } = useEmpresaContext();
  const [empleados, setEmpleados] = useState([]);
  const [planillas, setPlanillas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [incapacidades, setIncapacidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departamentos, setDepartamentos] = useState([]);
  const [graficoAgrupacion, setGraficoAgrupacion] = useState("mensual");

  const [allEmpleados, setAllEmpleados] = useState([]);
  const [allPlanillas, setAllPlanillas] = useState([]);
  const [allPeriodos, setAllPeriodos] = useState([]);
  const [allNovedades, setAllNovedades] = useState([]);
  const [allContratos, setAllContratos] = useState([]);
  const [allVacaciones, setAllVacaciones] = useState([]);
  const [allIncapacidades, setAllIncapacidades] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Empleado.list("-created_date", 200),
      base44.entities.Planilla.list("-created_date", 20),
      base44.entities.PeriodoPlanilla.list("-created_date", 20),
      base44.entities.Novedad.list("-created_date", 10),
      base44.entities.Contrato.list("-created_date", 100),
      base44.entities.VacacionSaldo.list("-created_date", 100),
      base44.entities.Incapacidad.list("-created_date", 50),
    ]).then(([emp, plan, per, nov, cont, vac, inc]) => {
      setAllEmpleados(emp);
      setAllPlanillas(plan);
      setAllPeriodos(per);
      setAllNovedades(nov);
      setAllContratos(cont);
      setAllVacaciones(vac);
      setAllIncapacidades(inc);
      setLoading(false);
    });
    base44.entities.Departamento.list("-created_date", 100).then(setDepartamentos);
  }, []);

  useEffect(() => {
    setEmpleados(filterByEmpresa(allEmpleados));
    setPlanillas(filterByEmpresa(allPlanillas));
    setPeriodos(filterByEmpresa(allPeriodos));
    setNovedades(filterByEmpresa(allNovedades));
    setContratos(filterByEmpresa(allContratos));
    setVacaciones(filterByEmpresa(allVacaciones));
    setIncapacidades(filterByEmpresa(allIncapacidades));
  }, [empresaId, allEmpleados, allPlanillas, allPeriodos, allNovedades, allContratos, allVacaciones, allIncapacidades]);

  const activos = empleados.filter(e => e.estado === "activo").length;
  const inactivos = empleados.filter(e => e.estado !== "activo").length;
  const planillasPendientes = planillas.filter(p => p.estado === "calculado" || p.estado === "en_revision").length;
  const ultimaPlanilla = planillas.find(p => p.estado === "pagado" || p.estado === "aprobado");
  const incapActivas = incapacidades.filter(i => i.estado === "activa").length;

  const now = new Date();
  const en30dias = new Date(now.getTime() + 30 * 86400000);
  const contratosPorVencer = contratos.filter(c => {
    if (!c.fecha_fin) return false;
    const f = new Date(c.fecha_fin);
    return f >= now && f <= en30dias && c.estado === "activo";
  }).length;

  const sinCuentaBancaria = empleados.filter(e => e.estado === "activo" && !e.cuenta_iban && !e.cuenta_bancaria).length;

  // Gráfico evolución planilla — agrupado por filtro (semanal, quincenal, mensual)
  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));
  const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const getGrupoKey = (planilla) => {
    const periodo = periodoMap[planilla.periodo_id];
    const fecha = periodo?.fecha_inicio || planilla.fecha_calculo;
    if (!fecha) return null;
    const d = new Date(fecha + "T00:00:00");
    if (graficoAgrupacion === "mensual") {
      return `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    } else if (graficoAgrupacion === "quincenal") {
      const quincena = d.getDate() <= 15 ? "Q1" : "Q2";
      return `${MONTH_NAMES[d.getMonth()]} ${quincena}`;
    } else { // semanal
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `S${week} ${String(d.getFullYear()).slice(2)}`;
    }
  };

  const monthlyData = (() => {
    const grupos = {};
    const orden = [];
    const sorted = [...planillas]
      .filter(p => p.estado !== "anulado")
      .sort((a, b) => {
        const fa = periodoMap[a.periodo_id]?.fecha_inicio || a.fecha_calculo || "";
        const fb = periodoMap[b.periodo_id]?.fecha_inicio || b.fecha_calculo || "";
        return fa.localeCompare(fb);
      });

    for (const p of sorted) {
      const key = getGrupoKey(p);
      if (!key) continue;
      if (!grupos[key]) { grupos[key] = { mes: key, neto: 0, bruto: 0 }; orden.push(key); }
      grupos[key].neto += p.total_neto || 0;
      grupos[key].bruto += p.total_ingresos || 0;
    }

    const limit = graficoAgrupacion === "semanal" ? 8 : 6;
    return orden.slice(-limit).map(k => grupos[k]);
  })();

  // Distribución empleados por departamento — calculado desde los datos filtrados
  const deptNameMap = Object.fromEntries(departamentos.map(d => [d.id, d.nombre]));
  const deptMap = {};
  empleados.filter(e => e.estado === "activo").forEach(e => {
    const deptName = (e.departamento_id && deptNameMap[e.departamento_id]) || "Sin depto";
    deptMap[deptName] = (deptMap[deptName] || 0) + 1;
  });
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando dashboard...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {empresaActual ? empresaActual.nombre_comercial || empresaActual.nombre_legal : isAdmin ? "Todas las empresas" : "Resumen ejecutivo de nómina"}
          </p>
        </div>
        <div className="text-sm text-gray-500 bg-white border border-gray-200 px-4 py-2 rounded-lg">
          {new Date().toLocaleDateString("es-CR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Alerts */}
      {(contratosPorVencer > 0 || sinCuentaBancaria > 0 || planillasPendientes > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-4 text-sm text-amber-700">
            {contratosPorVencer > 0 && <span>⚠ <strong>{contratosPorVencer}</strong> contrato(s) por vencer en 30 días</span>}
            {sinCuentaBancaria > 0 && <span>⚠ <strong>{sinCuentaBancaria}</strong> empleado(s) sin cuenta bancaria</span>}
            {planillasPendientes > 0 && <span>⚠ <strong>{planillasPendientes}</strong> planilla(s) pendiente(s) de aprobación</span>}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="Empleados Activos" value={activos} icon={Users} color="blue" linkTo="/Empleados" />
        <StatCard title="Empleados Inactivos" value={inactivos} icon={UserX} color="gray" linkTo="/Empleados" />
        <StatCard title="Planillas Pendientes" value={planillasPendientes} icon={Clock} color="yellow" linkTo="/Planillas" />
        <StatCard title="Contratos por Vencer" value={contratosPorVencer} icon={AlertTriangle} color="red" linkTo="/Contratos" />
        <StatCard
          title="Último Bruto"
          value={formatCRC(ultimaPlanilla?.total_ingresos || 0)}
          subtitle="Último periodo pagado"
          icon={TrendingUp}
          color="green"
          linkTo="/Planillas"
        />
        <StatCard
          title="Total Deducciones"
          value={formatCRC(ultimaPlanilla?.total_deducciones || 0)}
          subtitle="Último periodo pagado"
          icon={TrendingDown}
          color="red"
          linkTo="/Planillas"
        />
        <StatCard
          title="Neto Pagado"
          value={formatCRC(ultimaPlanilla?.total_neto || 0)}
          subtitle="Último periodo pagado"
          icon={DollarSign}
          color="blue"
          linkTo="/Planillas"
        />
        <StatCard title="Incapacidades Activas" value={incapActivas} icon={Activity} color="purple" linkTo="/Incapacidades" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Evolución */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Evolución de Planilla</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {["semanal","quincenal","mensual"].map(op => (
                <button key={op} onClick={() => setGraficoAgrupacion(op)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${graficoAgrupacion === op ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {op}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₡${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCRC(v)} />
              <Bar dataKey="bruto" name="Bruto" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
              <Bar dataKey="neto" name="Neto" fill="#1e40af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución por dept */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución por Departamento</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={deptData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {deptData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-medium text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent rows */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Últimas Planillas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Últimas Planillas</h3>
            <Link to="/Planillas" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {planillas.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.codigo_planilla || "Planilla"}</div>
                  <div className="text-xs text-gray-400">{p.tipo_planilla} • {p.cantidad_empleados || 0} empl.</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800">{formatCRC(p.total_neto)}</div>
                  <StatusBadge status={p.estado} />
                </div>
              </div>
            ))}
            {planillas.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No hay planillas registradas</div>
            )}
          </div>
        </div>

        {/* Últimas Novedades */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Últimas Novedades</h3>
            <Link to="/Novedades" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {novedades.slice(0, 6).map(n => (
              <div key={n.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-800">{n.tipo_novedad?.replace(/_/g, " ")}</div>
                  <div className="text-xs text-gray-400">{n.fecha} • {n.cantidad} {n.unidad}</div>
                </div>
                <StatusBadge status={n.estado} />
              </div>
            ))}
            {novedades.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No hay novedades registradas</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    activo: "bg-green-100 text-green-700",
    pagado: "bg-green-100 text-green-700",
    aprobado: "bg-blue-100 text-blue-700",
    calculado: "bg-yellow-100 text-yellow-700",
    en_revision: "bg-orange-100 text-orange-700",
    borrador: "bg-gray-100 text-gray-600",
    anulado: "bg-red-100 text-red-600",
    pendiente: "bg-yellow-100 text-yellow-700",
    aplicada: "bg-green-100 text-green-700",
    rechazada: "bg-red-100 text-red-600",
    abierto: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}