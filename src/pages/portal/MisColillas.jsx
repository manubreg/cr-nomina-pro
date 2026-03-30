import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ChevronDown, ChevronUp, Download } from "lucide-react";
import { jsPDF } from "jspdf";

const formatCRC = (v) => `₡${Number(v || 0).toLocaleString("es-CR")}`;
const formatUSD = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCurrency = (v, moneda) => moneda === "USD" ? formatUSD(v) : formatCRC(v);

function descargarPDF({ detalle, movimientos, periodo, monedaEmpleado, empleadoNombre }) {
  const doc = new jsPDF();
  const ingresos = movimientos.filter(m => m.tipo_movimiento === "ingreso");
  const deducciones = movimientos.filter(m => m.tipo_movimiento === "deduccion");

  const periodLabel = periodo ? `${periodo.fecha_inicio} al ${periodo.fecha_fin}` : "Periodo";

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Colilla de Pago", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(periodLabel, 14, 22);

  doc.setTextColor(30, 30, 30);

  // Empleado
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Empleado:", 14, 38);
  doc.setFont("helvetica", "normal");
  doc.text(empleadoNombre || "—", 50, 38);
  doc.setFont("helvetica", "bold");
  doc.text("Moneda:", 14, 46);
  doc.setFont("helvetica", "normal");
  doc.text(monedaEmpleado, 50, 46);

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 52, 196, 52);

  let y = 60;

  // Ingresos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text("INGRESOS", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  ingresos.forEach(m => {
    doc.text(m.descripcion || m.concepto_id || "—", 14, y);
    doc.text(formatCurrency(m.monto, monedaEmpleado), 196, y, { align: "right" });
    y += 7;
  });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(5, 150, 105);
  doc.text("Total Ingresos", 14, y);
  doc.text(formatCurrency(detalle.ingresos_totales, monedaEmpleado), 196, y, { align: "right" });
  y += 10;

  // Deducciones
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(220, 38, 38);
  doc.text("DEDUCCIONES", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  deducciones.forEach(m => {
    doc.text(m.descripcion || m.concepto_id || "—", 14, y);
    doc.text(formatCurrency(m.monto, monedaEmpleado), 196, y, { align: "right" });
    y += 7;
  });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 38, 38);
  doc.text("Total Deducciones", 14, y);
  doc.text(formatCurrency(detalle.deducciones_totales, monedaEmpleado), 196, y, { align: "right" });
  y += 12;

  // Neto
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y, 182, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 64, 175);
  doc.text("NETO A PAGAR", 20, y + 9);
  doc.text(formatCurrency(detalle.neto_pagar, monedaEmpleado), 190, y + 9, { align: "right" });

  doc.save(`colilla_${periodLabel.replace(/ /g, "_")}.pdf`);
}

function ColillaCard({ detalle, movimientos, periodo, monedaEmpleado, empleadoNombre }) {
  const [expanded, setExpanded] = useState(false);
  const ingresos = movimientos.filter(m => m.tipo_movimiento === "ingreso");
  const deducciones = movimientos.filter(m => m.tipo_movimiento === "deduccion");
  const periodLabel = periodo ? `${periodo.fecha_inicio} al ${periodo.fecha_fin}` : "Periodo";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-800 text-sm">{periodLabel}</p>
            <p className="text-xs text-gray-400">Planilla ordinaria</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400">Neto a pagar</p>
            <p className="font-bold text-blue-700">{formatCurrency(detalle.neto_pagar, monedaEmpleado)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{monedaEmpleado}</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ingresos</p>
              {ingresos.map(m => (
                <div key={m.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-700">{m.descripcion || m.concepto_id}</span>
                  <span className="font-medium text-emerald-700">{formatCurrency(m.monto, monedaEmpleado)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2">
                <span>Total Ingresos</span>
                <span className="text-emerald-700">{formatCurrency(detalle.ingresos_totales, monedaEmpleado)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deducciones</p>
              {deducciones.map(m => (
                <div key={m.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-700">{m.descripcion || m.concepto_id}</span>
                  <span className="font-medium text-red-600">{formatCurrency(m.monto, monedaEmpleado)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2">
                <span>Total Deducciones</span>
                <span className="text-red-600">{formatCurrency(detalle.deducciones_totales, monedaEmpleado)}</span>
              </div>
            </div>
            <div className="md:col-span-2 bg-blue-50 rounded-lg p-3 flex justify-between items-center">
              <span className="font-semibold text-gray-700">NETO A PAGAR</span>
              <span className="text-xl font-bold text-blue-700">{formatCurrency(detalle.neto_pagar, monedaEmpleado)}</span>
            </div>
          </div>

          {/* Botón descargar PDF */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                descargarPDF({ detalle, movimientos, periodo, monedaEmpleado, empleadoNombre });
              }}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MisColillas() {
  const [detalles, setDetalles] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [planillas, setPlanillas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empleadoId, setEmpleadoId] = useState(null);
  const [monedaEmpleado, setMonedaEmpleado] = useState("CRC");
  const [empleadoNombre, setEmpleadoNombre] = useState("");

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (!me?.empleado_id) { setLoading(false); return; }
      setEmpleadoId(me.empleado_id);
      const [dets, movs, plans, pers, emps] = await Promise.all([
        base44.entities.PlanillaDetalle.filter({ empleado_id: me.empleado_id }),
        base44.entities.MovimientoPlanilla.filter({ empleado_id: me.empleado_id }),
        base44.entities.Planilla.list("-created_date", 50),
        base44.entities.PeriodoPlanilla.list(),
        base44.entities.Empleado.filter({ id: me.empleado_id }),
      ]);
      const empleado = emps[0];
      setMonedaEmpleado(empleado?.moneda || "CRC");
      setEmpleadoNombre(empleado ? `${empleado.nombre} ${empleado.apellidos}` : "");
      setDetalles(dets);
      setMovimientos(movs);
      setPlanillas(plans);
      setPeriodos(pers);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando colillas...</div>;
  if (!empleadoId) return <div className="p-8 text-center text-gray-400">No se encontró vínculo con empleado.</div>;

  const planillaMap = Object.fromEntries(planillas.map(p => [p.id, p]));
  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Colillas de Pago</h1>
        <p className="text-gray-500 text-sm mt-1">{detalles.length} recibos disponibles</p>
      </div>

      {detalles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No hay colillas de pago disponibles aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {detalles.map(det => {
            const planilla = planillaMap[det.planilla_id];
            const periodo = planilla ? periodoMap[planilla.periodo_id] : null;
            const movsDet = movimientos.filter(m => m.planilla_id === det.planilla_id);
            return (
              <ColillaCard
                key={det.id}
                detalle={det}
                movimientos={movsDet}
                periodo={periodo}
                monedaEmpleado={monedaEmpleado}
                empleadoNombre={empleadoNombre}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}