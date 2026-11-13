export async function resumenMensualAguinaldo(base44, detalles) {
  async function cargar(entity, ids) {
    const registros = [];
    const unicos = [...new Set(ids.filter(Boolean))];
    for (let i = 0; i < unicos.length; i += 100) {
      let cursor;
      do {
        const pagina = await entity.filter({ id: { $in: unicos.slice(i, i + 100) } }, { limit: 100, cursor });
        registros.push(...pagina.items);
        cursor = pagina.has_more ? pagina.next_cursor : null;
      } while (cursor);
    }
    return Object.fromEntries(registros.map(r => [r.id, r]));
  }
  const planillas = await cargar(base44.entities.Planilla, detalles.map(d => d.planilla_id));
  const periodos = await cargar(base44.entities.PeriodoPlanilla, Object.values(planillas).map(p => p.periodo_id));
  const meses = {};
  for (const det of detalles) {
    const planilla = planillas[det.planilla_id];
    const periodo = periodos[planilla?.periodo_id];
    const mes = (periodo?.fecha_fin || planilla?.fecha_pago || periodo?.fecha_pago || '').slice(0, 7) || 'sin_fecha';
    const grupo = meses[mes] ||= { mes, ingresos_totales: 0, monto_pagado: 0, pagos: [] };
    const pagada = planilla?.estado === 'pagado';
    const monto = pagada ? Number(det.neto_pagar || 0) : null;
    grupo.ingresos_totales += Number(det.ingresos_totales || 0);
    grupo.monto_pagado += monto || 0;
    grupo.pagos.push({
      id: det.id,
      referencia: planilla?.codigo_planilla || 'Sin código de planilla',
      frecuencia: periodo?.tipo_periodo || 'Sin frecuencia',
      fecha_pago: pagada ? planilla.fecha_pago || null : null,
      fecha_programada: periodo?.fecha_pago || null,
      monto_pagado: monto,
      ingresos_totales: Number(det.ingresos_totales) || 0,
      estado: planilla?.estado || 'Sin planilla disponible',
    });
  }
  return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => ({
    ...m, pagos: m.pagos.sort((a, b) => (a.fecha_pago || a.fecha_programada || '').localeCompare(b.fecha_pago || b.fecha_programada || '')),
  }));
}