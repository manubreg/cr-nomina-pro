// ─── PDF de Liquidación Final (detalle de cálculos) ───────────────────────────
import { base44 } from "@/api/base44Client";

const fmt = (v) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2 });
const fmtI = (v) => Number(v || 0).toLocaleString("es-CR", { maximumFractionDigits: 2 });

const MOTIVOS_LABEL = {
  renuncia: "Renuncia",
  despido_sin_causa: "Despido sin justa causa",
  despido_con_causa: "Despido con justa causa",
  mutuo_acuerdo: "Mutuo acuerdo",
  fin_contrato: "Fin de contrato",
  fallecimiento: "Fallecimiento",
  otro: "Otro",
};

const AZUL = [0, 32, 96];
const GRIS = [80, 80, 80];
const VERDE = [34, 139, 34];

/**
 * Genera el PDF de Liquidación Final con el detalle de cálculos.
 * @param empresa, empleado, periodo, detalle (PlanillaDetalle),
 *        movimientos (MovimientoPlanilla de la planilla de liquidación),
 *        liquidacion (registro Liquidacion)
 */
export async function generarLiquidacionPDF(empresa, empleado, periodo, detalle, movimientos, liquidacion) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const moneda = empleado?.moneda || "CRC";
  const C = (v) => `${moneda} ${fmt(v)}`;

  const movsIngresos = movimientos.filter(m => m.tipo_movimiento === "ingreso");
  const movsDeducciones = movimientos.filter(m => m.tipo_movimiento === "deduccion");
  const findMov = (kw) => movsIngresos.find(m => m.descripcion?.toLowerCase().includes(kw));

  const movPreaviso   = findMov("preaviso");
  const movCesantia   = findMov("cesant");
  const movVacaciones = findMov("vacac");
  const movAguinaldo  = findMov("aguinaldo");
  const movSalario    = movsIngresos.find(m => m.descripcion?.toLowerCase().includes("salario") && m !== movPreaviso);

  const salarioPromedio = Number(liquidacion?.salario_promedio) || Number(detalle?.salario_base_periodo) || 0;
  const salarioDiario = salarioPromedio / 30;
  const diasDe = (monto) => salarioDiario > 0 && monto ? fmtI(monto / salarioDiario) : "";

  // Antigüedad
  const fechaIngreso = empleado?.fecha_ingreso;
  const fechaSalida = liquidacion?.fecha_salida || periodo?.fecha_fin || "";
  let antiguedadTxt = "—";
  if (fechaIngreso && fechaSalida) {
    const dIng = new Date(fechaIngreso + "T00:00:00");
    const dSal = new Date(fechaSalida + "T00:00:00");
    const dias = Math.max(0, Math.round((dSal - dIng) / (1000 * 60 * 60 * 24)));
    const anios = Math.floor(dias / 365);
    const resto = dias % 365;
    antiguedadTxt = `${anios} año(s) y ${resto} día(s) — total ${dias} días`;
  }

  // ── Encabezado ──
  try { doc.addImage("https://media.base44.com/images/public/69b3108b56c003fc16c880bd/39c06300e_LOGONUEVOcdr.jpg", "JPEG", 165, 10, 35, 20); } catch (e) { /* sin logo */ }

  doc.setFillColor(...AZUL);
  doc.rect(10, 8, 190, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("COMPROBANTE DE LIQUIDACIÓN FINAL", 105, 13.8, { align: "center" });

  // Empresa / Trabajador
  doc.setFillColor(...AZUL);
  doc.rect(10, 19, 90, 6, "F");
  doc.rect(110, 19, 90, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("EMPRESA", 55, 23.5, { align: "center" });
  doc.text("TRABAJADOR", 155, 23.5, { align: "center" });

  doc.setFillColor(240, 240, 240);
  doc.rect(10, 25, 90, 22, "F");
  doc.rect(110, 25, 90, 22, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(7);

  const eLines = [
    ["Nombre:", empresa?.nombre_legal || "—"],
    ["Cédula jurídica:", empresa?.cedula_juridica || "—"],
    ["Domicilio:", empresa?.direccion || "—"],
  ];
  const tLines = [
    ["Nombre:", `${empleado?.nombre || ""} ${empleado?.apellidos || ""}`],
    ["Cédula:", empleado?.identificacion || "—"],
    ["Puesto:", empleado?.puesto || "—"],
    ["Fecha de ingreso:", fechaIngreso || "—"],
  ];
  eLines.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 12, 29 + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(v).substring(0, 36), 42, 29 + i * 5);
  });
  tLines.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 112, 29 + i * 4.5);
    doc.setFont("helvetica", "normal");
    doc.text(String(v).substring(0, 34), 144, 29 + i * 4.5);
  });

  // Datos de salida
  doc.setFillColor(...AZUL);
  doc.rect(10, 49, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DATOS DE LA TERMINACIÓN", 14, 53.3);

  const motivoTxt = MOTIVOS_LABEL[liquidacion?.motivo_salida] || liquidacion?.motivo_salida || "—";
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de salida:", 14, 59);
  doc.text("Motivo:", 80, 59);
  doc.setFont("helvetica", "normal");
  doc.text(fechaSalida || "—", 42, 59);
  doc.text(motivoTxt, 92, 59, { maxWidth: 105 });
  doc.setFont("helvetica", "bold");
  doc.text("Antigüedad:", 14, 64.5);
  doc.setFont("helvetica", "normal");
  doc.text(antiguedadTxt, 34, 64.5, { maxWidth: 164 });

  // Detalle del cálculo: guardado en la liquidación o recalculado al vuelo
  let detalleCalc = null;
  try { detalleCalc = JSON.parse(liquidacion?.detalle_calculo || "null"); } catch { detalleCalc = null; }
  if (!detalleCalc?.salarios_mensuales?.length && empleado?.id && liquidacion?.fecha_salida) {
    try {
      const res = await base44.functions.invoke("calcularLiquidacion", {
        empleado_id: empleado.id,
        fecha_salida: liquidacion.fecha_salida,
        motivo_salida: liquidacion.motivo_salida || "renuncia",
        empresa_id: liquidacion.empresa_id,
      });
      if (res.data?.ok && res.data.resultado?._detalle) detalleCalc = res.data.resultado._detalle;
    } catch { /* sin detalle disponible */ }
  }

  // Parámetros de cálculo — cada dato en su propia fila para evitar superposición
  let y = 70;
  doc.setFillColor(...GRIS);
  doc.rect(10, y, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PARÁMETROS DE CÁLCULO (Código de Trabajo)", 14, y + 4.3);
  y += 6;

  const filaParam = (label, value, bold = false) => {
    doc.setFillColor(248, 248, 248);
    doc.rect(10, y, 190, 5.5, "F");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 14, y + 4);
    doc.text(value, 198, y + 4, { align: "right" });
    y += 5.5;
  };

  filaParam("Salario promedio mensual:", C(salarioPromedio));
  filaParam("Salario diario (promedio / 30):", C(salarioDiario));

  if (detalleCalc?.fuente_salario) {
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text(`Fuente del salario: ${detalleCalc.fuente_salario}`, 14, y + 3);
    y += 4.5;
  }

  // Salarios por mes usados en el promedio (desglose mes a mes)
  const meses = detalleCalc?.salarios_mensuales || [];
  if (meses.length > 0) {
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y, 190, 5, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("SALARIOS POR MES (últimos 6 meses — solo los meses completos entran al promedio)", 14, y + 3.7);
    y += 5;
    const nombresMes = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const etiquetaMes = (s) => {
      const [yy, mm] = s.mes.split("-");
      return `${nombresMes[Number(mm) - 1]} ${yy}${s.completo ? "" : " (parcial — no entra al promedio)"}`;
    };
    for (let i = 0; i < meses.length; i += 2) {
      doc.setFillColor(252, 252, 252);
      doc.rect(10, y, 190, 5, "F");
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(etiquetaMes(meses[i]), 14, y + 3.7);
      doc.text(C(meses[i].salario), 100, y + 3.7, { align: "right" });
      if (meses[i + 1]) {
        doc.text(etiquetaMes(meses[i + 1]), 108, y + 3.7);
        doc.text(C(meses[i + 1].salario), 198, y + 3.7, { align: "right" });
      }
      y += 5;
    }
    const nCompletos = detalleCalc?.meses_completos_promedio ?? meses.filter(m => m.completo).length;
    filaParam(`Promedio de ${nCompletos} mes(es) completo(s)`, C(salarioPromedio), true);
  }
  y += 2;

  // ── Rubros de liquidación ──
  doc.setFillColor(...AZUL);
  doc.rect(10, y, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("CONCEPTOS DE LA LIQUIDACIÓN", 14, y + 4.3);
  doc.text("CANTIDAD", 140, y + 4.3, { align: "right" });
  doc.text("MONTO", 198, y + 4.3, { align: "right" });
  y += 6;

  const rubros = [
    {
      mov: movPreaviso, label: "Preaviso (Art. 28-29 CT)",
      cant: movPreaviso ? (diasDe(movPreaviso.monto) ? `${diasDe(movPreaviso.monto)} días` : "") : "",
      nota: movPreaviso ? "Días de preaviso × salario diario" : null,
    },
    {
      mov: movCesantia, label: "Cesantía (Art. 29 CT)",
      cant: movCesantia ? (diasDe(movCesantia.monto) ? `${diasDe(movCesantia.monto)} días` : "") : "",
      nota: movCesantia ? "Días según escala de antigüedad × salario diario" : null,
    },
    {
      mov: movVacaciones, label: "Vacaciones pendientes (Art. 152 CT)",
      cant: liquidacion?.dias_vacaciones_pendientes != null ? `${fmtI(liquidacion.dias_vacaciones_pendientes)} días` : "",
      nota: movVacaciones ? "Días de vacaciones no disfrutadas × salario diario" : null,
    },
    {
      mov: movAguinaldo, label: "Aguinaldo proporcional",
      cant: movAguinaldo && salarioPromedio > 0 ? `${fmtI((movAguinaldo.monto / salarioPromedio) * 12)} meses` : "",
      nota: movAguinaldo ? "Salarios devengados en el período (1 dic - 30 nov) ÷ 12" : null,
    },
    {
      mov: movSalario, label: "Salario pendiente",
      cant: movSalario ? (diasDe(movSalario.monto) ? `${diasDe(movSalario.monto)} días` : "") : "",
      nota: movSalario ? "Días trabajados no pagados × salario diario" : null,
    },
  ];

  let shade = false;
  for (const r of rubros) {
    if (!r.mov) continue;
    if (shade) { doc.setFillColor(248, 248, 248); doc.rect(10, y, 190, r.nota ? 9 : 6, "F"); }
    shade = !shade;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(r.label, 14, y + 4.2);
    doc.text(r.cant, 140, y + 4.2, { align: "right" });
    doc.text(C(r.mov.monto), 198, y + 4.2, { align: "right" });
    y += 6;
    if (r.nota) {
      doc.setFontSize(6.5);
      doc.setTextColor(110, 110, 110);
      doc.setFont("helvetica", "italic");
      doc.text(r.nota, 18, y + 2.2);
      y += 3;
    }
  }

  // Otros ingresos no clasificados
  const otros = movsIngresos.filter(m => ![movPreaviso, movCesantia, movVacaciones, movAguinaldo, movSalario].includes(m));
  for (const o of otros) {
    if (shade) { doc.setFillColor(248, 248, 248); doc.rect(10, y, 190, 6, "F"); }
    shade = !shade;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(o.descripcion, 14, y + 4.2);
    doc.text(C(o.monto), 198, y + 4.2, { align: "right" });
    y += 6;
  }

  // Salto de página si no hay espacio para totales y deducciones
  if (y > 260) { doc.addPage(); y = 20; }

  // Total indemnizaciones
  doc.setFillColor(...AZUL);
  doc.rect(10, y, 190, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL DEVENGADO EN LIQUIDACIÓN", 14, y + 4.3);
  doc.text(C(detalle?.ingresos_totales ?? movsIngresos.reduce((s, m) => s + m.monto, 0)), 198, y + 4.3, { align: "right" });
  y += 9;

  // ── Deducciones ──
  if (movsDeducciones.length > 0) {
    doc.setFillColor(...GRIS);
    doc.rect(10, y, 190, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("DEDUCCIONES FINALES", 14, y + 4.3);
    doc.text("MONTO", 198, y + 4.3, { align: "right" });
    y += 6;
    for (const d of movsDeducciones) {
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(d.descripcion, 14, y + 4.2);
      doc.text(C(d.monto), 198, y + 4.2, { align: "right" });
      y += 6;
    }
    doc.setFillColor(...GRIS);
    doc.rect(10, y, 190, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL A DEDUCIR", 14, y + 4.3);
    doc.text(C(detalle?.deducciones_totales ?? movsDeducciones.reduce((s, m) => s + m.monto, 0)), 198, y + 4.3, { align: "right" });
    y += 9;
  }

  // ── Neto ──
  doc.setFillColor(...VERDE);
  doc.rect(10, y, 190, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NETO A LIQUIDAR", 14, y + 5.5);
  doc.text(C(detalle?.neto_pagar ?? liquidacion?.neto_liquidar ?? 0), 198, y + 5.5, { align: "right" });
  y += 14;

  // Salto de página si no hay espacio para la nota y las firmas
  if (y > 268) { doc.addPage(); y = 20; }

  // Nota legal
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.text(
    "Cálculo conforme al Código de Trabajo de Costa Rica: preaviso y cesantía (Arts. 28-29), vacaciones (Arts. 152 y ss.) y aguinaldo proporcional (Ley de Aguinaldo).",
    14, y, { maxWidth: 180 }
  );
  y += 14;

  // Firmas
  doc.setDrawColor(150, 150, 150);
  doc.line(30, y, 90, y);
  doc.line(120, y, 180, y);
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Firma Patrono", 60, y + 4, { align: "center" });
  doc.text("Firma Trabajador", 150, y + 4, { align: "center" });

  const nombre = `${empleado?.nombre || "Empleado"}_${empleado?.apellidos || ""}`.replace(/\s+/g, "_");
  doc.save(`Liquidacion_${nombre}_${fechaSalida || periodo?.fecha_fin || "salida"}.pdf`);
}