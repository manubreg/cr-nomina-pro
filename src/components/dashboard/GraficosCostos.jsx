import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area, AreaChart, ScatterChart, Scatter } from "recharts";

const COLORS = ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd"];

export function ComposicionCostos({ planillas, periodoMap }) {
  const data = planillas
    .filter(p => p.estado !== "anulado")
    .sort((a, b) => {
      const fa = periodoMap[a.periodo_id]?.fecha_inicio || "";
      const fb = periodoMap[b.periodo_id]?.fecha_inicio || "";
      return fa.localeCompare(fb);
    })
    .slice(-6)
    .map(p => ({
      mes: `${new Date(periodoMap[p.periodo_id]?.fecha_inicio || "").toLocaleDateString("es-CR", { month: "short" })}`,
      salarios: p.total_ingresos || 0,
      ccss: (p.total_ingresos || 0) * 0.095,
      isr: (p.total_deducciones || 0) * 0.3,
      otros: (p.total_deducciones || 0) * 0.7,
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Composición de Costos</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₡${(v / 1000000).toFixed(1)}M`} />
          <YAxis dataKey="mes" type="category" tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v) => `₡${Number(v || 0).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="salarios" name="Salarios" stackId="a" fill="#1e40af" />
          <Bar dataKey="ccss" name="CCSS" stackId="a" fill="#3b82f6" />
          <Bar dataKey="isr" name="ISR" stackId="a" fill="#93c5fd" />
          <Bar dataKey="otros" name="Otros" stackId="a" fill="#dbeafe" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProximosVencimientos({ contratos, vacaciones, periodos, daysThreshold = 30 }) {
  const now = new Date();
  const deadline = new Date(now.getTime() + daysThreshold * 86400000);

  const eventos = [];

  contratos
    .filter(c => c.estado === "activo" && c.fecha_fin)
    .forEach(c => {
      const f = new Date(c.fecha_fin);
      if (f >= now && f <= deadline) {
        const dias = Math.ceil((f - now) / 86400000);
        eventos.push({ fecha: c.fecha_fin, tipo: "Contrato vence", dias, urgencia: dias <= 7 ? "rojo" : dias <= 15 ? "naranja" : "amarillo" });
      }
    });

  vacaciones
    .filter(v => v.estado === "vigente")
    .forEach(v => {
      if (v.fecha_vencimiento) {
        const f = new Date(v.fecha_vencimiento);
        if (f >= now && f <= deadline) {
          const dias = Math.ceil((f - now) / 86400000);
          eventos.push({ fecha: v.fecha_vencimiento, tipo: "Vacaciones vencen", dias, urgencia: dias <= 7 ? "rojo" : dias <= 15 ? "naranja" : "amarillo" });
        }
      }
    });

  eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const colorMap = { rojo: "bg-red-50 border-red-200 text-red-700", naranja: "bg-orange-50 border-orange-200 text-orange-700", amarillo: "bg-yellow-50 border-yellow-200 text-yellow-700" };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Próximos Vencimientos (30 días)</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {eventos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin vencimientos próximos</p>
        ) : (
          eventos.map((e, i) => (
            <div key={i} className={`border rounded-lg p-3 text-xs ${colorMap[e.urgencia]}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.tipo}</span>
                <span className="font-bold">{e.dias} días</span>
              </div>
              <div className="text-xs opacity-75">{new Date(e.fecha).toLocaleDateString("es-CR")}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function HistorialAumentosSalariales({ historialSalario, empleados }) {
  const data = historialSalario
    .filter(h => h.fecha_efectiva)
    .sort((a, b) => new Date(a.fecha_efectiva) - new Date(b.fecha_efectiva))
    .slice(-10)
    .map(h => {
      const emp = empleados.find(e => e.id === h.empleado_id);
      return {
        fecha: new Date(h.fecha_efectiva).toLocaleDateString("es-CR", { month: "short", day: "numeric" }),
        anterior: h.salario_anterior || 0,
        nuevo: h.salario_nuevo || 0,
        aumento: ((h.salario_nuevo - h.salario_anterior) / h.salario_anterior) * 100,
        empleado: emp?.nombre || "—",
      };
    });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Historial de Aumentos</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="izq" tickFormatter={v => `₡${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="der" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v, name) => name === "aumento" ? `${v.toFixed(1)}%` : `₡${Number(v).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar yAxisId="izq" dataKey="anterior" name="Salario Anterior" fill="#93c5fd" />
          <Bar yAxisId="izq" dataKey="nuevo" name="Salario Nuevo" fill="#1e40af" />
          <Line yAxisId="der" type="monotone" dataKey="aumento" name="% Aumento" stroke="#ef4444" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}