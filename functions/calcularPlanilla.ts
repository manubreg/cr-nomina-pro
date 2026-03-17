import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Calcula automáticamente una planilla usando bulkCreate para evitar timeouts.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const { planilla_id, empleados_ids } = await req.json();
  if (!planilla_id) return Response.json({ error: 'planilla_id requerido' }, { status: 400 });

  // ── 1. Cargar planilla y período ─────────────────────────────────────────
  const planilla = await base44.asServiceRole.entities.Planilla.filter({ id: planilla_id }, '-created_date', 1).then(r => r[0]);
  if (!planilla) return Response.json({ error: 'Planilla no encontrada' }, { status: 404 });
  if (planilla.estado === 'pagado' || planilla.estado === 'anulado') {
    return Response.json({ error: 'No se puede recalcular una planilla pagada o anulada' }, { status: 400 });
  }

  const empresa_id = planilla.empresa_id;
  if (!empresa_id) return Response.json({ error: 'La planilla no tiene empresa_id definido' }, { status: 400 });
  console.log('[calcularPlanilla] empresa_id =', empresa_id, '| planilla_id =', planilla_id);

  // ── 2. Cargar datos en paralelo ──────────────────────────────────────────
  const [periodos, todosParams, empleadosEmpresa, todasNovedades] = await Promise.all([
    base44.asServiceRole.entities.PeriodoPlanilla.filter({ empresa_id }, '-fecha_inicio', 100),
    base44.asServiceRole.entities.ParametroLegal.filter({ empresa_id, estado: 'vigente' }, '-created_date', 100),
    base44.asServiceRole.entities.Empleado.filter({ empresa_id, estado: 'activo' }, '-fecha_ingreso', 500),
    base44.asServiceRole.entities.Novedad.filter({ empresa_id, periodo_id: planilla.periodo_id, estado: 'aprobada' }, '-created_date', 500),
  ]);

  const periodo = periodos.find(p => p.id === planilla.periodo_id) || null;
  console.log('[calcularPlanilla] empleados count =', empleadosEmpresa.length, '| periodo =', periodo?.tipo_periodo);

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

  // ── 2b. Tipo de cambio (BCCR directo, sin invocar otra función) ──────────
  let tipoCambioVenta = 650; // fallback razonable
  try {
    const fechaRef = periodo?.fecha_fin || new Date().toISOString().split("T")[0];
    const [anio, mes, dia] = fechaRef.split('-');
    const bccrUrl = `https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos?Indicador=318&FechaInicio=${dia}/${mes}/${anio}&FechaFinal=${dia}/${mes}/${anio}&Nombre=tipo_cambio&SubNiveles=N&CorreoElectronico=${Deno.env.get('BCCR_EMAIL')||''}&Token=${Deno.env.get('BCCR_TOKEN')||''}`;
    const resp = await fetch(bccrUrl, { signal: AbortSignal.timeout(5000) });
    const xml = await resp.text();
    const match = xml.match(/<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/);
    if (match) tipoCambioVenta = parseFloat(match[1]);
  } catch { /* usa fallback */ }

  // ── 3. Filtrar empleados ─────────────────────────────────────────────────
  const fechaInicioPeriodo = periodo?.fecha_inicio || '';
  let empleados = empleadosEmpresa;
  if (fechaInicioPeriodo) {
    empleados = empleados.filter(e => !e.fecha_ingreso || e.fecha_ingreso <= fechaInicioPeriodo);
  }
  if (empleados_ids && empleados_ids.length > 0) {
    empleados = empleados.filter(e => empleados_ids.includes(e.id));
  }

  // ── 4. Helpers ────────────────────────────────────────────────────────────
  const calcISR = (baseImponible) => {
    let impuesto = 0;
    let base = baseImponible;
    const tramos = [...tramosISR].sort((a, b) => a.limite_inferior - b.limite_inferior);
    for (const tramo of tramos) {
      if (base <= tramo.limite_inferior) break;
      const gravado = Math.min(base, tramo.limite_superior) - tramo.limite_inferior;
      impuesto += gravado * (tramo.porcentaje / 100);
      if (base <= tramo.limite_superior) break;
    }
    return Math.round(impuesto);
  };

  const factorPeriodo = (tipo) => {
    switch (tipo) {
      case 'diario':    return 1 / 30;
      case 'semanal':   return 7 / 30;
      case 'bisemanal': return 14 / 30;
      case 'quincenal': return 15 / 30;
      default:          return 1;
    }
  };
  const tipoPlanillaFactor = factorPeriodo(periodo?.tipo_periodo || 'mensual');

  // ── 5. Eliminar registros previos ────────────────────────────────────────
  const [detsPrev, movsPrev] = await Promise.all([
    base44.asServiceRole.entities.PlanillaDetalle.filter({ planilla_id }, '-created_date', 1000),
    base44.asServiceRole.entities.MovimientoPlanilla.filter({ planilla_id }, '-created_date', 5000),
  ]);
  await Promise.all([
    ...detsPrev.map(d => base44.asServiceRole.entities.PlanillaDetalle.delete(d.id)),
    ...movsPrev.map(m => base44.asServiceRole.entities.MovimientoPlanilla.delete(m.id)),
  ]);

  // ── 6. Calcular datos de cada empleado (sin I/O) ─────────────────────────
  const detallesData = [];
  const movimientosTemp = []; // { empleado_id, movs[] }

  for (const emp of empleados) {
    const salarioMensualBase = emp.salario_base || 0;
    const salarioMensual = emp.moneda === "USD" ? Math.round(salarioMensualBase * tipoCambioVenta) : salarioMensualBase;
    const salarioPeriodo = Math.round(salarioMensual * tipoPlanillaFactor);

    const movs = [];
    movs.push({
      tipo_movimiento: 'ingreso',
      descripcion: 'Salario base',
      monto: salarioPeriodo,
      cantidad: 1, tarifa: salarioPeriodo, porcentaje: 0,
      base_calculo: salarioPeriodo, orden_calculo: 1, origen: 'automatico',
    });

    let totalIngresos = salarioPeriodo;
    let totalRebajos = 0;

    const novsEmp = todasNovedades.filter(n => n.empleado_id === emp.id);
    for (const nov of novsEmp) {
      let montoNov = 0, descripcion = '', tipo_mov = 'ingreso', orden = 10;
      switch (nov.tipo_novedad) {
        case 'horas_extra': {
          const valorHora = salarioMensual / 240;
          const factor = emp.tipo_jornada === 'nocturna' ? 1.75 : (emp.tipo_jornada === 'mixta' ? 1.625 : 1.5);
          montoNov = Math.round(valorHora * factor * (nov.cantidad || 0));
          descripcion = `Horas extra (${nov.cantidad}h)`; break;
        }
        case 'bono':     montoNov = nov.monto || 0; descripcion = 'Bono'; break;
        case 'comision': montoNov = nov.monto || 0; descripcion = 'Comisión'; break;
        case 'ausencia':
        case 'permiso_sin_goce': {
          const valorDia = salarioMensual / 30;
          montoNov = Math.round(valorDia * (nov.cantidad || 0));
          descripcion = `Rebajo ${nov.tipo_novedad === 'ausencia' ? 'ausencia' : 'permiso sin goce'} (${nov.cantidad}d)`;
          tipo_mov = 'deduccion'; orden = 5; break;
        }
        case 'feriado_trabajado': {
          const valorDia = salarioMensual / 30;
          montoNov = Math.round(valorDia * 2 * (nov.cantidad || 1));
          descripcion = 'Feriado trabajado'; break;
        }
        case 'ajuste_manual':
          montoNov = Math.abs(nov.monto || 0);
          descripcion = 'Ajuste manual';
          if ((nov.monto || 0) < 0) { tipo_mov = 'deduccion'; orden = 5; }
          break;
        default: continue;
      }
      if (montoNov === 0) continue;
      movs.push({ tipo_movimiento: tipo_mov, descripcion, monto: montoNov, cantidad: nov.cantidad || 1,
        tarifa: 0, porcentaje: 0, base_calculo: salarioPeriodo, orden_calculo: orden,
        origen: 'novedad', referencia_origen_id: nov.id });
      if (tipo_mov === 'ingreso') totalIngresos += montoNov;
      else totalRebajos += montoNov;
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
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - SEM (${ccssEmpleado.sem}%)`,              monto: sem, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.sem,          base_calculo: baseCCSS, orden_calculo: 20, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - IVM (${ccssEmpleado.ivm}%)`,              monto: ivm, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.ivm,          base_calculo: baseCCSS, orden_calculo: 21, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `Banco Popular (${ccssEmpleado.banco_popular}%)`, monto: bp,  cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.banco_popular, base_calculo: baseCCSS, orden_calculo: 22, origen: 'automatico' });
    }

    const baseISR = Math.max(0, baseCCSS - totalCCSSEmp);
    const montoISR = calcISR(baseISR);
    if (montoISR > 0) {
      movs.push({ tipo_movimiento: 'deduccion', descripcion: 'Impuesto sobre la Renta', monto: montoISR,
        cantidad: 1, tarifa: 0, porcentaje: 0, base_calculo: baseISR, orden_calculo: 30, origen: 'automatico' });
    }

    const deducciones = movs.filter(m => m.tipo_movimiento === 'deduccion').reduce((s, m) => s + m.monto, 0);
    const ingresos    = movs.filter(m => m.tipo_movimiento === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const neto = ingresos - deducciones;

    detallesData.push({
      planilla_id, empleado_id: emp.id, empresa_id,
      salario_base_periodo: salarioPeriodo,
      ingresos_totales: ingresos,
      deducciones_totales: deducciones,
      neto_pagar: neto,
      base_ccss: baseCCSS,
      base_impuesto: baseISR,
      base_aguinaldo: totalIngresos,
      base_vacaciones: totalIngresos,
    });
    movimientosTemp.push({ empleado_id: emp.id, movs });
  }

  // ── 7. Guardar PlanillaDetalle en bulk ───────────────────────────────────
  console.log('[calcularPlanilla] Guardando', detallesData.length, 'detalles con bulkCreate...');
  const detallesCreados = await base44.asServiceRole.entities.PlanillaDetalle.bulkCreate(detallesData);
  console.log('[calcularPlanilla] Detalles creados:', detallesCreados?.length);

  // ── 8. Guardar MovimientoPlanilla en bulk ────────────────────────────────
  const empleadoADetalle = {};
  for (const det of detallesCreados) {
    empleadoADetalle[det.empleado_id] = det.id;
  }

  const todosMovimientos = [];
  for (const { empleado_id, movs } of movimientosTemp) {
    const planilla_detalle_id = empleadoADetalle[empleado_id];
    for (const m of movs) {
      todosMovimientos.push({
        ...m,
        planilla_id,
        planilla_detalle_id,
        empleado_id,
        concepto_id: m.concepto_id || 'auto',
      });
    }
  }
  if (todosMovimientos.length > 0) {
    await base44.asServiceRole.entities.MovimientoPlanilla.bulkCreate(todosMovimientos);
  }

  // ── 9. Actualizar totales de la planilla ──────────────────────────────────
  const totalIngresosGlobal    = detallesData.reduce((s, d) => s + d.ingresos_totales, 0);
  const totalDeduccionesGlobal = detallesData.reduce((s, d) => s + d.deducciones_totales, 0);
  const totalNeto = totalIngresosGlobal - totalDeduccionesGlobal;

  await base44.asServiceRole.entities.Planilla.update(planilla_id, {
    total_ingresos:     totalIngresosGlobal,
    total_deducciones:  totalDeduccionesGlobal,
    total_neto:         totalNeto,
    cantidad_empleados: detallesData.length,
    estado:             'calculado',
    fecha_calculo:      new Date().toISOString().split('T')[0],
    usuario_genero:     user.email,
  });

  return Response.json({
    ok: true,
    empleados_procesados: detallesData.length,
    total_ingresos:    totalIngresosGlobal,
    total_deducciones: totalDeduccionesGlobal,
    total_neto:        totalNeto,
  });
});