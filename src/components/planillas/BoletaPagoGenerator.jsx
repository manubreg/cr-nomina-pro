import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const fmt = (v) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2 });
const fmtC = (v, moneda = "CRC") => `${moneda} ${fmt(v)}`;

// ─── Tramos ISR CR 2025 ───────────────────────────────────────────────────────
const TRAMOS_ISR = [
  { inf: 0,         sup: 918000,     pct: 0   },
  { inf: 918000,    sup: 1347000,    pct: 10  },
  { inf: 1347000,   sup: 2364000,    pct: 15  },
  { inf: 2364000,   sup: 4727000,    pct: 20  },
  { inf: 4727000,   sup: 999999999,  pct: 25  },
];

// ─── Helpers PDF ─────────────────────────────────────────────────────────────
function drawHeader(doc, empresa, empleado, periodo, detalle) {
  const { jsPDF } = window.jspdf || {};
  const pW = 210; // A4 width mm

  // Azul oscuro encabezado empresa / trabajador
  doc.setFillColor(0, 32, 96);
  doc.rect(10, 10, 90, 6, "F");
  doc.rect(110, 10, 90, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EMPRESA", 55, 14.5, { align: "center" });
  doc.text("TRABAJADOR", 155, 14.5, { align: "center" });

  // Cuerpos
  doc.setFillColor(240, 240, 240);
  doc.rect(10, 16, 90, 26, "F");
  doc.rect(110, 16, 90, 26, "F");

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const eLines = [
    ["Nombre:", empresa?.nombre_legal || "—"],
    ["Domicilio:", empresa?.direccion || "—"],
    ["Representante:", empresa?.representante || "—"],
    ["Cédula:", empresa?.cedula_juridica || "—"],
  ];
  const tLines = [
    ["Nombre:", `${empleado?.nombre || ""} ${empleado?.apellidos || ""}`],
    ["Cédula:", empleado?.identificacion || "—"],
    ["Número empleado:", empleado?.codigo_empleado || "—"],
    ["Posición:", empleado?.puesto || "—"],
    ["Fecha de antigüedad:", empleado?.fecha_ingreso || "—"],
    ["Días de vacaciones:", detalle?.dias_vacaciones || "0.00"],
  ];

  eLines.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 12, 20 + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(v).substring(0, 38), 36, 20 + i * 5);
  });
  tLines.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 112, 20 + i * 4);
    doc.setFont("helvetica", "normal");
    doc.text(String(v).substring(0, 36), 144, 20 + i * 4);
  });

  // Período de pago
  doc.setFillColor(0, 32, 96);
  doc.rect(10, 42, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Periodo de pago:", 14, 46.5);
  const fechas = periodo ? `${periodo.fecha_inicio}  /  ${periodo.fecha_fin}` : "—";
  doc.text(fechas, 100, 46.5, { align: "center" });
}

function drawSeccion(doc, titulo, y, bgR, bgG, bgB) {
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(10, y, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, y + 4.3);
  return y + 6;
}

function drawFila(doc, label, cantidad, precio, total, y, shade) {
  if (shade) {
    doc.setFillColor(248, 248, 248);
    doc.rect(10, y, 190, 5, "F");
  }
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(label, 14, y + 3.7);
  if (cantidad) doc.text(String(cantidad), 105, y + 3.7, { align: "right" });
  if (precio) doc.text(precio, 140, y + 3.7, { align: "right" });
  doc.setFont("helvetica", cantidad ? "normal" : "normal");
  doc.text(total || "-", 198, y + 3.7, { align: "right" });
  return y + 5;
}

function drawColHeaders(doc, y) {
  doc.setFillColor(0, 32, 96);
  doc.rect(10, y, 190, 5.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DEVENGOS", 14, y + 4);
  doc.text("CANTIDAD DIAS", 105, y + 4, { align: "right" });
  doc.text("PRECIO DIA", 140, y + 4, { align: "right" });
  doc.text("TOTALES", 198, y + 4, { align: "right" });
  return y + 5.5;
}

function drawTotal(doc, label, total, y, bgR, bgG, bgB, textColor) {
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(10, y, 190, 6, "F");
  doc.setTextColor(...(textColor || [255, 255, 255]));
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(label, 14, y + 4.3);
  doc.text(total, 198, y + 4.3, { align: "right" });
  return y + 6;
}

function drawDeduccionesHeader(doc, y) {
  doc.setFillColor(80, 80, 80);
  doc.rect(10, y, 190, 5.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DEDUCCIONES", 14, y + 4);
  doc.text("TOTALES", 198, y + 4, { align: "right" });
  return y + 5.5;
}

// ─── Generador principal PDF ──────────────────────────────────────────────────
export async function generarBoletaPDF(empresa, empleado, periodo, detalle, movimientos, tramosISR) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const moneda = empleado?.moneda || "CRC";
  const C = (v) => fmtC(v, moneda);

  const ingresos   = movimientos.filter(m => m.tipo_movimiento === "ingreso");
  const deducciones = movimientos.filter(m => m.tipo_movimiento === "deduccion");

  const salBase    = detalle.salario_base_periodo || 0;
  const diasPeriodo = periodo?.tipo_periodo === "quincenal" ? 15 : periodo?.tipo_periodo === "semanal" ? 7 : 30;
  const precioDia  = diasPeriodo > 0 ? salBase / diasPeriodo : 0;

  drawHeader(doc, empresa, empleado, periodo, detalle);

  let y = 49;
  y = drawColHeaders(doc, y);

  // ── Percepciones salariales ──
  y = drawSeccion(doc, "Percepciones salariales:", y, 0, 32, 96);
  y = drawFila(doc, "Salario base (días laborales)", diasPeriodo, `₡ ${fmt(precioDia)}`, fmtC(salBase), y, false);

  // Extras del cálculo
  const extraIngresos = ingresos.filter(m => m.descripcion !== "Salario base");
  const vacLinea   = extraIngresos.find(m => m.descripcion?.toLowerCase().includes("vacac"));
  const horasD     = extraIngresos.find(m => m.descripcion?.toLowerCase().includes("extra") && !m.descripcion?.toLowerCase().includes("noc") && !m.descripcion?.toLowerCase().includes("mix"));
  const horasN     = extraIngresos.find(m => m.descripcion?.toLowerCase().includes("nocturna") || m.descripcion?.toLowerCase().includes("noc"));
  const horasM     = extraIngresos.find(m => m.descripcion?.toLowerCase().includes("mixta") || m.descripcion?.toLowerCase().includes("mix"));
  const bonoLinea  = extraIngresos.find(m => m.descripcion?.toLowerCase().includes("bono"));

  y = drawFila(doc, "Vacaciones", "", "", vacLinea ? fmtC(vacLinea.monto) : "-", y, true);
  y = drawFila(doc, "Horas extraordinarias diurnas", horasD ? horasD.cantidad : "", "", horasD ? fmtC(horasD.monto) : "-", y, false);
  y = drawFila(doc, "Horas extraordinarias nocturnas", horasN ? horasN.cantidad : "", "", horasN ? fmtC(horasN.monto) : "-", y, true);
  y = drawFila(doc, "Horas extraordinarias mixtas", horasM ? horasM.cantidad : "", "", horasM ? fmtC(horasM.monto) : "-", y, false);
  y = drawFila(doc, "Bonos", "", "", bonoLinea ? fmtC(bonoLinea.monto) : "-", y, true);

  // Percepciones no salariales
  y = drawSeccion(doc, "Percepciones no salariales:", y, 100, 100, 100);
  y = drawFila(doc, "Dietas", "", "", "-", y, false);
  y = drawFila(doc, "Viáticos", "", "", "-", y, true);
  y = drawFila(doc, "Otros", "", "", "-", y, false);

  y = drawTotal(doc, "TOTAL DEVENGADO", fmtC(detalle.ingresos_totales), y, 0, 32, 96);

  y += 3;

  // ── DEDUCCIONES ──
  y = drawDeduccionesHeader(doc, y);

  const ccssTotal = deducciones.filter(m => m.descripcion?.startsWith("CCSS")).reduce((s, m) => s + m.monto, 0);
  const semMov    = deducciones.find(m => m.descripcion?.includes("SEM"));
  const ivmMov    = deducciones.find(m => m.descripcion?.includes("IVM"));
  const bpMov     = deducciones.find(m => m.descripcion?.includes("Banco Popular"));
  const isrMov    = deducciones.find(m => m.descripcion?.includes("Renta"));

  // CCSS
  y = drawSeccion(doc, "CCSS", y, 60, 60, 60);
  if (ccssTotal > 0) {
    const rowCCSS = (label, pct, monto, shade) => {
      if (shade) doc.setFillColor(248, 248, 248), doc.rect(10, y, 190, 5, "F");
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(label, 24, y + 3.7);
      doc.text(`${pct}%`, 130, y + 3.7, { align: "right" });
      doc.text(fmtC(monto), 198, y + 3.7, { align: "right" });
      return y + 5;
    };
    y = rowCCSS("SEM", "5.50", semMov?.monto || 0, false);
    y = rowCCSS("IVM", "4.33", ivmMov?.monto || 0, true);
    y = rowCCSS("Banco Popular", "1.00", bpMov?.monto || 0, false);
  } else {
    y = drawFila(doc, "  (sin cuota CCSS calculada)", "", "", "-", y, false);
  }

  y += 2;

  // Impuesto sobre la Renta
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Impuesto sobre la Renta", 14, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Limite Inferior", 80, y + 4, { align: "right" });
  doc.text("Limite Superior", 120, y + 4, { align: "right" });
  doc.text("Porcentaje retención", 160, y + 4, { align: "right" });
  doc.text(isrMov ? fmtC(isrMov.monto) : "-", 198, y + 4, { align: "right" });
  y += 5;

  TRAMOS_ISR.forEach((t, i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(10, y, 190, 4.5, "F"); }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Tramo ${i + 1}`, 24, y + 3.2);
    doc.text(`₡ ${fmt(t.inf)}`, 80, y + 3.2, { align: "right" });
    doc.text(`₡ ${t.sup >= 999999999 ? "999,999,999.00" : fmt(t.sup)}`, 120, y + 3.2, { align: "right" });
    doc.text(`${t.pct}.0%`, 160, y + 3.2, { align: "right" });
    y += 4.5;
  });

  y += 2;

  // Otros Rebajos
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Otros Rebajos", 14, y + 3.5);
  y += 5;
  y = drawFila(doc, "  Pensiones Alimenticias", "", "", "-", y, false);
  y = drawFila(doc, "  Embargos", "", "", "-", y, true);

  y += 2;
  y = drawTotal(doc, "TOTAL A DEDUCIR", fmtC(detalle.deducciones_totales), y, 80, 80, 80);
  y += 1;
  y = drawTotal(doc, "LÍQUIDO A PERCIBIR", fmtC(detalle.neto_pagar), y, 34, 139, 34);

  // Firma
  y += 12;
  doc.setDrawColor(150, 150, 150);
  doc.line(30, y, 90, y);
  doc.line(120, y, 180, y);
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("Firma Patrono", 60, y + 4, { align: "center" });
  doc.text("Firma Empleado", 150, y + 4, { align: "center" });

  const nombre = `${empleado?.nombre || "Empleado"}_${empleado?.apellidos || ""}`.replace(/\s+/g, "_");
  doc.save(`Boleta_${nombre}_${periodo?.fecha_inicio || "periodo"}.pdf`);
}

// ─── Generador Excel (CSV) ────────────────────────────────────────────────────
function generarExcelBoleta(empresa, empleado, periodo, detalle, movimientos) {
  const rows = [];

  rows.push(["BOLETA DE PAGO"]);
  rows.push([]);
  rows.push(["EMPRESA", "", "TRABAJADOR", ""]);
  rows.push(["Nombre:", empresa?.nombre_legal, "Nombre:", `${empleado?.nombre} ${empleado?.apellidos}`]);
  rows.push(["Domicilio:", empresa?.direccion, "Cédula:", empleado?.identificacion]);
  rows.push(["Cédula:", empresa?.cedula_juridica, "Número empleado:", empleado?.codigo_empleado]);
  rows.push(["", "", "Posición:", empleado?.puesto]);
  rows.push([]);
  rows.push(["Período de pago:", `${periodo?.fecha_inicio || ""} - ${periodo?.fecha_fin || ""}`]);
  rows.push([]);
  rows.push(["DEVENGOS", "CANTIDAD", "PRECIO", "TOTAL"]);

  movimientos.filter(m => m.tipo_movimiento === "ingreso").forEach(m => {
    rows.push([m.descripcion, m.cantidad || "", m.tarifa || "", m.monto]);
  });

  rows.push([]);
  rows.push(["TOTAL DEVENGADO", "", "", detalle.ingresos_totales]);
  rows.push([]);
  rows.push(["DEDUCCIONES", "", "", "TOTAL"]);

  movimientos.filter(m => m.tipo_movimiento === "deduccion").forEach(m => {
    rows.push([m.descripcion, m.porcentaje ? `${m.porcentaje}%` : "", "", m.monto]);
  });

  rows.push([]);
  rows.push(["TOTAL A DEDUCIR", "", "", detalle.deducciones_totales]);
  rows.push(["LÍQUIDO A PERCIBIR", "", "", detalle.neto_pagar]);

  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nombre = `${empleado?.nombre || "Empleado"}_${empleado?.apellidos || ""}`.replace(/\s+/g, "_");
  a.href = url;
  a.download = `Boleta_${nombre}_${periodo?.fecha_inicio || "periodo"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function BoletaPagoGenerator({ empresa, empleado, periodo, detalle, movimientos }) {
  const [loadingPDF, setLoadingPDF] = useState(false);

  const handlePDF = async () => {
    setLoadingPDF(true);
    await generarBoletaPDF(empresa, empleado, periodo, detalle, movimientos, TRAMOS_ISR);
    setLoadingPDF(false);
  };

  const handleExcel = () => {
    generarExcelBoleta(empresa, empleado, periodo, detalle, movimientos);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={handlePDF}
        disabled={loadingPDF}
        className="h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
        title="Descargar boleta PDF"
      >
        {loadingPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExcel}
        className="h-7 text-xs gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
        title="Descargar boleta Excel/CSV"
      >
        <FileSpreadsheet className="w-3 h-3" />
        Excel
      </Button>
    </div>
  );
}