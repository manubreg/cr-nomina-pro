import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  // empresa_id y periodo_id se pasan desde el frontend para evitar fetch extra
  const { planilla_id, empresa_id, periodo_id, estado: planilla_estado, empleados_ids } = await req.json();
  if (!planilla_id) return Response.json({ error: 'planilla_id requerido' }, { status: 400 });
  if (!empresa_id)  return Response.json({ error: 'empresa_id requerido' }, { status: 400 });

  if (planilla_estado === 'pagado' || planilla_estado === 'anulado') {
    return Response.json({ error: 'No se puede recalcular una planilla pagada o anulada' }, { status: 400 });
  }
  console.log('[calcularPlanilla] empresa_id =', empresa_id, '| periodo_id =', periodo_id);

  // ── FASE 1: Cargar datos en paralelo ──────────────────────────────────────
  const [todosParams, empleadosEmpresa, todasNovedades, periodoArr] = await Promise.all([
    base44.asServiceRole.entities.ParametroLegal.filter({ empresa_id, estado: 'vigente' }, '-created_date', 50),
    base44.asServiceRole.entities.Empleado.filter({ empresa_id, estado: 'activo' }, '-fecha_ingreso', 300),
    periodo_id
      ? base44.asServiceRole.entities.Novedad.filter({ empresa_id, periodo_id, estado: 'aprobada' }, '-created_date', 300)
      : Promise.resolve([]),
    periodo_id
      ? base44.asServiceRole.entities.PeriodoPlanilla.filter({ empresa_id }, '-fecha_inicio', 50)
      : Promise.resolve([]),
  ]);
  const planilla = { id: planilla_id, empresa_id, periodo_id };
  console.log('[calcularPlanilla] empleados:', empleadosEmpresa.length);

  const periodo = periodoArr.find(p => p.id === periodo_id) || periodoArr[0] || null;

  // ── Tipo de cambio ────────────────────────────────────────────────────────
  let tipoCambioVenta = 650;
  try {
    const fechaRef = periodo?.fecha_fin || new Date().toISOString().split("T")[0];
    const [anio, mes, dia] = fechaRef.split('-');
    const url = `https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos?Indicador=318&FechaInicio=${dia}/${mes}/${anio}&FechaFinal=${dia}/${mes}/${anio}&Nombre=tc&SubNiveles=N&CorreoElectronico=${Deno.env.get('BCCR_EMAIL')||''}&Token=${Deno.env.get('BCCR_TOKEN')||''}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const xml = await resp.text();
    const match = xml.match(/<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/);
    if (match) tipoCambioVenta = parseFloat(match[1]);
  } catch { /* usa fallback */ }
  console.log('[calcularPlanilla] TC =', tipoCambioVenta, '| periodo =', periodo?.tipo_periodo);

  // ── Parámetros ────────────────────────────────────────────────────────────
  const getParam = (tipo) => {
    const p = todosParams.find(p => p.tipo === tipo);
    if (!p) return null;
    try { return JSON.parse(p.datos_json); } catch { return null; }
  };
  const ccssEmpleado = getParam('cuota_ccss_empleado') || { sem: 5.50, ivm: 4.33, banco_popular: 1.00 };
  const tramosISR = getParam('tramo_impuesto') || [
    { limite_inferior: 0,        limite_superior: 918000,    porcentaje: 0  },
    { limite_inferior: 918000,   limite_superior: 1347000,   porcentaje: 10 },
    { limite_inferior: 1347000,  limite_superior: 2364000,   porcentaje: 15 },
    { limite_inferior: 2364000,  limite_superior: 4727000,   porcentaje: 20 },
    { limite_inferior: 4727000,  limite_superior: 999999999, porcentaje: 25 },
  ];

  const calcISR = (base) => {
    let impuesto = 0;
    const tramos = [...tramosISR].sort((a, b) => a.limite_inferior - b.limite_inferior);
    for (const t of tramos) {
      if (base <= t.limite_inferior) break;
      const gravado = Math.min(base, t.limite_superior) - t.limite_inferior;
      impuesto += gravado * (t.porcentaje / 100);
      if (base <= t.limite_superior) break;
    }
    return Math.round(impuesto);
  };

  const factorPeriodo = (tipo) => {
    switch (tipo) {
      case 'diario':    return 1 / 30;
      case 'semanal':   return 7 / 30;
      case 'bisemanal': return 14 / 30;
      case 'quincenal': return 0.5;
      default:          return 1;
    }
  };
  const factor = factorPeriodo(periodo?.tipo_periodo || 'mensual');
  const fechaInicioPeriodo = periodo?.fecha_inicio || '';

  // ── Filtrar empleados ─────────────────────────────────────────────────────
  let empleados = empleadosEmpresa;
  if (fechaInicioPeriodo) {
    empleados = empleados.filter(e => !e.fecha_ingreso || e.fecha_ingreso <= fechaInicioPeriodo);
  }
  if (empleados_ids && empleados_ids.length > 0) {
    empleados = empleados.filter(e => empleados_ids.includes(e.id));
  }
  console.log('[calcularPlanilla] empleados para calcular:', empleados.length);

  // ── FASE 4: Calcular (pura CPU, sin I/O) ─────────────────────────────────
  const detallesData = [];
  const movimientosTemp = [];

  for (const emp of empleados) {
    const salarioMensual = emp.moneda === "USD"
      ? Math.round((emp.salario_base || 0) * tipoCambioVenta)
      : (emp.salario_base || 0);
    const salarioPeriodo = Math.round(salarioMensual * factor);
    const movs = [];

    movs.push({ tipo_movimiento: 'ingreso', descripcion: 'Salario base', monto: salarioPeriodo,
      cantidad: 1, tarifa: salarioPeriodo, porcentaje: 0, base_calculo: salarioPeriodo, orden_calculo: 1, origen: 'automatico' });

    let totalIngresos = salarioPeriodo;
    let totalRebajos = 0;

    for (const nov of todasNovedades.filter(n => n.empleado_id === emp.id)) {
      let monto = 0, desc = '', tipo_mov = 'ingreso', orden = 10;
      switch (nov.tipo_novedad) {
        case 'horas_extra': {
          const f = emp.tipo_jornada === 'nocturna' ? 1.75 : (emp.tipo_jornada === 'mixta' ? 1.625 : 1.5);
          monto = Math.round((salarioMensual / 240) * f * (nov.cantidad || 0));
          desc = `Horas extra (${nov.cantidad}h)`; break;
        }
        case 'bono':     monto = nov.monto || 0; desc = 'Bono'; break;
        case 'comision': monto = nov.monto || 0; desc = 'Comisión'; break;
        case 'ausencia':
        case 'permiso_sin_goce':
          monto = Math.round((salarioMensual / 30) * (nov.cantidad || 0));
          desc = `Rebajo ${nov.tipo_novedad === 'ausencia' ? 'ausencia' : 'permiso sin goce'} (${nov.cantidad}d)`;
          tipo_mov = 'deduccion'; orden = 5; break;
        case 'feriado_trabajado':
          monto = Math.round((salarioMensual / 30) * 2 * (nov.cantidad || 1));
          desc = 'Feriado trabajado'; break;
        case 'ajuste_manual':
          monto = Math.abs(nov.monto || 0); desc = 'Ajuste manual';
          if ((nov.monto || 0) < 0) { tipo_mov = 'deduccion'; orden = 5; } break;
        default: continue;
      }
      if (monto === 0) continue;
      movs.push({ tipo_movimiento: tipo_mov, descripcion: desc, monto, cantidad: nov.cantidad || 1,
        tarifa: 0, porcentaje: 0, base_calculo: salarioPeriodo, orden_calculo: orden,
        origen: 'novedad', referencia_origen_id: nov.id });
      if (tipo_mov === 'ingreso') totalIngresos += monto;
      else totalRebajos += monto;
    }
    totalIngresos -= totalRebajos;

    const baseCCSS = Math.max(0, totalIngresos);
    const esAsegurado = emp.asegurado_ccss !== false;
    let totalCCSSEmp = 0;
    if (esAsegurado) {
      const sem = Math.round(baseCCSS * (ccssEmpleado.sem / 100));
      const ivm = Math.round(baseCCSS * (ccssEmpleado.ivm / 100));
      const bp  = Math.round(baseCCSS * (ccssEmpleado.banco_popular / 100));
      totalCCSSEmp = sem + ivm + bp;
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - SEM (${ccssEmpleado.sem}%)`, monto: sem, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.sem, base_calculo: baseCCSS, orden_calculo: 20, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - IVM (${ccssEmpleado.ivm}%)`, monto: ivm, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.ivm, base_calculo: baseCCSS, orden_calculo: 21, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `Banco Popular (${ccssEmpleado.banco_popular}%)`, monto: bp, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.banco_popular, base_calculo: baseCCSS, orden_calculo: 22, origen: 'automatico' });
    }
    const baseISR = Math.max(0, baseCCSS - totalCCSSEmp);
    const montoISR = calcISR(baseISR);
    if (montoISR > 0) {
      movs.push({ tipo_movimiento: 'deduccion', descripcion: 'Impuesto sobre la Renta', monto: montoISR,
        cantidad: 1, tarifa: 0, porcentaje: 0, base_calculo: baseISR, orden_calculo: 30, origen: 'automatico' });
    }

    const deducciones = movs.filter(m => m.tipo_movimiento === 'deduccion').reduce((s, m) => s + m.monto, 0);
    const ingresos    = movs.filter(m => m.tipo_movimiento === 'ingreso').reduce((s, m) => s + m.monto, 0);

    detallesData.push({ planilla_id, empleado_id: emp.id, empresa_id,
      salario_base_periodo: salarioPeriodo, ingresos_totales: ingresos,
      deducciones_totales: deducciones, neto_pagar: ingresos - deducciones,
      base_ccss: baseCCSS, base_impuesto: baseISR,
      base_aguinaldo: totalIngresos, base_vacaciones: totalIngresos });
    movimientosTemp.push({ empleado_id: emp.id, movs });
  }

  // ── FASE 5: Guardar detalles ──────────────────────────────────────────────
  console.log('[calcularPlanilla] guardando', detallesData.length, 'detalles...');
  const detallesCreados = await base44.asServiceRole.entities.PlanillaDetalle.bulkCreate(detallesData);
  console.log('[calcularPlanilla] detalles guardados:', detallesCreados?.length);

  // ── FASE 6: Guardar movimientos ───────────────────────────────────────────
  const empToDetalle = {};
  for (const det of detallesCreados) empToDetalle[det.empleado_id] = det.id;

  const todosMovimientos = [];
  for (const { empleado_id, movs } of movimientosTemp) {
    const planilla_detalle_id = empToDetalle[empleado_id];
    for (const m of movs) {
      todosMovimientos.push({ ...m, planilla_id, planilla_detalle_id, empleado_id, concepto_id: 'auto' });
    }
  }

  if (todosMovimientos.length > 0) {
    console.log('[calcularPlanilla] guardando', todosMovimientos.length, 'movimientos...');
    await base44.asServiceRole.entities.MovimientoPlanilla.bulkCreate(todosMovimientos);
    console.log('[calcularPlanilla] movimientos guardados');
  }

  // ── FASE 7: Actualizar totales planilla ───────────────────────────────────
  const totalIngresosFinal    = detallesData.reduce((s, d) => s + d.ingresos_totales, 0);
  const totalDeduccionesFinal = detallesData.reduce((s, d) => s + d.deducciones_totales, 0);
  await base44.asServiceRole.entities.Planilla.update(planilla_id, {
    total_ingresos: totalIngresosFinal,
    total_deducciones: totalDeduccionesFinal,
    total_neto: totalIngresosFinal - totalDeduccionesFinal,
    cantidad_empleados: detallesData.length,
    estado: 'calculado',
    fecha_calculo: new Date().toISOString().split('T')[0],
    usuario_genero: user.email,
  });

  console.log('[calcularPlanilla] LISTO. Empleados procesados:', detallesData.length);
  return Response.json({
    ok: true,
    empleados_procesados: detallesData.length,
    total_ingresos: totalIngresosFinal,
    total_deducciones: totalDeduccionesFinal,
    total_neto: totalIngresosFinal - totalDeduccionesFinal,
  });
});