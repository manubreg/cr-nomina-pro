import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart3, TrendingUp, Users, Receipt, Download } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function Reportes() {
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const { data: planillas = [] } = useQuery({ queryKey: ["planillas"], queryFn: () => base44.entities.Planilla.list() });
  const { data: novedades = [] } = useQuery({ queryKey: ["novedades"], queryFn: () => base44.entities.Novedad.list() });

  // Distribución por estado de empleados
  const estadosEmp = empleados.reduce((acc, e) => {
    acc[e.estado] = (acc[e.estado] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(estadosEmp).map(([name, value]) => ({ name, value }));

  // Distribución por tipo de jornada
  const jornadas = empleados.reduce((acc, e) => {
    const j = e.tipo_jornada || "diurna";
    acc[j] = (acc[j] || 0) + 1;
    return acc;
  }, {});
  const jornadaData = Object.entries(jornadas).map(([name, value]) => ({ name, value }));

  // Novedades por tipo
  const novTipos = novedades.reduce((acc, n) => {
    const t = n.tipo_novedad || "otro";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const novData = Object.entries(novTipos).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.replace(/_/g," "), value }));

  const statCards = [
    { label: "Total Empleados", value: empleados.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Empleados Activos", value: empleados.filter(e => e.estado === "activo").length, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Planillas", value: planillas.length, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Novedades Pendientes", value: novedades.filter(n => n.estado === "pendiente").length, icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">Análisis y estadísticas del sistema</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Empleados por estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Empleados por Estado</h2>
          {pieData.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Novedades por tipo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Novedades por Tipo</h2>
          {novData.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={novData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Jornadas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Distribución por Jornada</h2>
          {jornadaData.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={jornadaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {jornadaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Planillas por estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Planillas por Estado</h2>
          {planillas.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin datos</div>
          ) : (() => {
            const pl = planillas.reduce((acc, p) => { acc[p.estado] = (acc[p.estado]||0)+1; return acc; }, {});
            const plData = Object.entries(pl).map(([name, value]) => ({ name, value }));
            return (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>
    </div>
  );
}