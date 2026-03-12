import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, Receipt, AlertTriangle, CheckCircle, TrendingUp, Clock, Building2, CalendarDays } from "lucide-react";

const StatCard = ({ title, value, sub, icon: Icon, color, to }) => (
  <Link to={to || "#"} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex items-start gap-4">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </Link>
);

export default function Dashboard() {
  const [stats, setStats] = useState({ empleados: 0, planillas: 0, novedades: 0, empresas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Empleado.list(),
      base44.entities.Planilla.list(),
      base44.entities.Novedad.filter({ estado: "pendiente" }),
      base44.entities.Empresa.list(),
    ]).then(([empleados, planillas, novedades, empresas]) => {
      setStats({
        empleados: empleados.filter(e => e.estado === "activo").length,
        planillas: planillas.length,
        novedades: novedades.length,
        empresas: empresas.length,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del sistema de nómina</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Empleados Activos" value={stats.empleados} icon={Users} color="bg-blue-600" to="/Empleados" sub="Colaboradores activos" />
          <StatCard title="Planillas" value={stats.planillas} icon={Receipt} color="bg-emerald-600" to="/Planillas" sub="Total registradas" />
          <StatCard title="Novedades Pendientes" value={stats.novedades} icon={Clock} color="bg-amber-500" to="/Novedades" sub="Requieren revisión" />
          <StatCard title="Empresas" value={stats.empresas} icon={Building2} color="bg-purple-600" to="/Empresas" sub="Registradas en el sistema" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acciones rápidas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Nueva Planilla", to: "/Planillas", icon: Receipt, color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
              { label: "Nuevo Empleado", to: "/Empleados", icon: Users, color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
              { label: "Registrar Novedad", to: "/Novedades", icon: AlertTriangle, color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
              { label: "Ver Periodos", to: "/Periodos", icon: CalendarDays, color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
            ].map(({ label, to, icon: Icon, color }) => (
              <Link key={to} to={to} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${color}`}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Estado del sistema */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Estado del Sistema</h2>
          <div className="space-y-3">
            {[
              { label: "Módulo de Empleados", ok: true },
              { label: "Módulo de Planillas", ok: true },
              { label: "Módulo de Vacaciones", ok: true },
              { label: "Parámetros Legales", ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-emerald-600" : "text-red-500"}`}>
                  {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {ok ? "Operativo" : "Alerta"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}