// Sector privado: Ley 2412. Siempre se divide el salario devengado entre 12.
export async function leerPaginas(entity, query) {
  const items = [];
  let cursor;
  do {
    const page = await entity.filter(query, { limit: 100, cursor });
    items.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return items;
}

async function porIds(entity, field, ids, query = {}) {
  const items = [];
  const idsUnicos = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < idsUnicos.length; i += 100) {
    items.push(...await leerPaginas(entity, { ...query, [field]: { $in: idsUnicos.slice(i, i + 100) } }));
  }
  return items;
}

export function fechaCostaRica() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function calcularBaseAguinaldo(client, emp, anio) {
  const inicio = `${anio - 1}-12-01`;
  const fin = `${anio}-11-30`;
  const hoy = fechaCostaRica();
  const corte = [fin, hoy, emp.fecha_salida || fin].sort()[0];
  const ingreso = (emp.fecha_ingreso || '').slice(0, 10);
  const desde = ingreso > inicio ? ingreso : inicio;
  const avisos = [];
  const revisiones = [];
  const entities = client.entities;
  const [periodos, incapacidades] = await Promise.all([
    leerPaginas(entities.PeriodoPlanilla, { empresa_id: emp.empresa_id, fecha_inicio: { $lte: corte }, fecha_fin: { $gte: desde }, tipo_periodo: { $nin: ['aguinaldo', 'liquidacion'] } }),
    leerPaginas(entities.Incapacidad, { empleado_id: emp.id, estado: { $ne: 'anulada' }, fecha_inicio: { $lte: corte }, fecha_fin: { $gte: desde } }),
  ]);
  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));
  const planillas = await porIds(entities.Planilla, 'periodo_id', periodos.map(p => p.id), {
    empresa_id: emp.empresa_id, estado: { $in: ['aprobado', 'pagado'] }, tipo_planilla: { $in: ['ordinaria', 'extraordinaria'] },
  });
  const planillaMap = Object.fromEntries(planillas.map(p => [p.id, p]));
  const detalles = await porIds(entities.PlanillaDetalle, 'planilla_id', planillas.map(p => p.id), { empleado_id: emp.id });
  const movimientos = await porIds(entities.MovimientoPlanilla, 'planilla_detalle_id', detalles.map(d => d.id), { empleado_id: emp.id, tipo_movimiento: 'ingreso' });
  const conceptos = await porIds(entities.ConceptoPago, 'id', movimientos.map(m => m.concepto_id));
  const noComputables = new Set(conceptos.filter(c => c.afecta_aguinaldo === false).map(c => c.id));
  const excluidos = {};
  for (const mov of movimientos) {
    if (noComputables.has(mov.concepto_id)) excluidos[mov.planilla_detalle_id] = (excluidos[mov.planilla_detalle_id] || 0) + Number(mov.monto || 0);
  }
  const incluidos = [];
  const vistos = new Set();
  const periodosOrdinarios = new Set();
  for (const det of detalles) {
    const planilla = planillaMap[det.planilla_id];
    const periodo = periodoMap[planilla.periodo_id];
    if (periodo.fecha_fin > corte) {
      avisos.push(`Planilla ${planilla.codigo_planilla || planilla.id} no incluida: termina después del corte ${corte}.`);
      if (periodo.fecha_inicio <= fin && periodo.fecha_fin > fin) revisiones.push('Hay períodos que cruzan el 30 de noviembre: deben separarse los salarios devengados a cada lado del corte.');
      continue;
    }
    if (periodo.fecha_inicio < inicio) {
      revisiones.push('Hay períodos que cruzan el 1 de diciembre: se requiere separar el salario del período legal.');
      continue;
    }
    const key = `${planilla.id}:${emp.id}`;
    if (vistos.has(key)) { revisiones.push('Hay detalles duplicados del empleado en una misma planilla.'); continue; }
    vistos.add(key);
    if (planilla.tipo_planilla === 'ordinaria') {
      if (periodosOrdinarios.has(periodo.id)) revisiones.push('Hay más de una planilla ordinaria aprobada para el mismo período.');
      periodosOrdinarios.add(periodo.id);
    }
    let base = Number(det.base_aguinaldo);
    if (det.base_aguinaldo == null || !Number.isFinite(base) || base < 0) {
      revisiones.push('Hay planillas sin una base de aguinaldo válida. Corrija la base salarial antes de registrar el cálculo.');
      base = 0;
    }
    if (excluidos[det.id] && base > Number(det.ingresos_totales || 0) - excluidos[det.id] + 0.01) {
      revisiones.push('Hay conceptos no salariales incluidos en la base de aguinaldo; corrija la base de esas planillas.');
    }
    incluidos.push({ ...det, _base_computable: base });
  }
  if (incapacidades.length) revisiones.push('Revise las bases de las planillas con incapacidad: los subsidios por enfermedad o riesgo no computan; la licencia de maternidad sí computa completa, incluyendo ambas partes. No se estiman estos importes con el salario actual.');
  const total = incluidos.reduce((sum, det) => sum + det._base_computable, 0);
  if (!incluidos.length) avisos.push('Sin planillas aprobadas o pagadas computables. No se sustituye el historial por el salario base actual.');
  if (hoy < fin) avisos.push(`Acumulado provisional al ${corte}; no incluye salarios posteriores. Recalcule después del cierre del 30 de noviembre.`);
  avisos.push('Se utilizan bases salariales brutas de planillas aprobadas o pagadas, no el neto ni las deducciones de CCSS o renta. Verifique que el historial esté completo y que incluya horas extra, comisiones, bonificaciones salariales y salario en especie.');
  const meses = new Set(incluidos.map(d => periodoMap[planillaMap[d.planilla_id].periodo_id].fecha_fin.slice(0, 7))).size;
  const fechaMinima = new Date(`${ingreso || '9999-01-01'}T00:00:00Z`);
  const diaIngreso = fechaMinima.getUTCDate();
  fechaMinima.setUTCMonth(fechaMinima.getUTCMonth() + 1, 1);
  const ultimoDia = new Date(Date.UTC(fechaMinima.getUTCFullYear(), fechaMinima.getUTCMonth() + 1, 0)).getUTCDate();
  fechaMinima.setUTCDate(Math.min(diaIngreso, ultimoDia));
  const diaSiguienteCorte = new Date(`${corte}T00:00:00Z`);
  diaSiguienteCorte.setUTCDate(diaSiguienteCorte.getUTCDate() + 1);
  const tieneDerecho = ingreso && fechaMinima <= diaSiguienteCorte && desde <= corte;
  if (!tieneDerecho) revisiones.push('No se cumple todavía el mínimo de un mes continuo de relación laboral al corte.');
  return {
    total: Math.round((total + Number.EPSILON) * 100) / 100,
    monto: Math.round((total / 12 + Number.EPSILON) * 100) / 100,
    incluidos, meses, inicio, fin, desde, corte,
    provisional: hoy < fin,
    tieneDerecho: Boolean(tieneDerecho),
    registrable: incluidos.length > 0 && revisiones.length === 0,
    advertencia: [...new Set([...revisiones, ...avisos])].join(' '),
  };
}