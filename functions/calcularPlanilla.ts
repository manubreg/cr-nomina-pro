import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Calcula automáticamente una planilla:
 * - Salario base por período
 * - CCSS empleado (SEM + IVM + Banco Popular)
 * - CCSS patrono
 * - Impuesto sobre la Renta (tramos)
 * - Novedades (horas extra, bonos, ausencias, etc.)
 * - Neto a pagar
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const { planilla_id, empleados_ids } = await req.json();
  if (!planilla_id) return Response.json({ error: 'planilla_id requerido' }, { status: 400 });

  // ── 1. Cargar planilla y período ─────────────────────────────────────────
  const [todasPlanillas, periodos] = await Promise.all([
    base44.entities.Planilla.list(),
    base44.entities.PeriodoPlanilla.list(),
  ]);
  const planilla = todasPlanillas.find(p => p.id === planilla_id);
  if (!planilla) return Response.json({ error: 'Planilla no encontrada' }, { status: 404 });
  if (planilla.estado === 'pagado' || planilla.estado === 'anulado') {
    return Response.json({ error: 'No se puede recalcular una planilla pagada o anulada' }, { status: 400 });
  }

  const periodo = periodos.find(p => p.id === planilla.periodo_id);
  const empresa_id = planilla.empresa_id;
  if (!empresa_id) return Response.json({ error: 'La planilla no tiene empresa_id definido' }, { status: 400 });

  // ── 2. Cargar parámetros legales vigentes ────────────────────────────────
  const todosParams = await base44.entities.ParametroLegal.list();
  const parametros = todosParams.filter(p => p.empresa_id === empresa_id && p.estado === 'vigente');

  const getParam = (tipo) => {
    const p = parametros.find(p => p.tipo === tipo);
    if (!p) return null;
    try { return JSON.parse(p.datos_json); } catch { return null; }
  };

  // Tasas CCSS (fallback a valores legales CR 2025)
  const ccssEmpleado = getParam('cuota_ccss_empleado') || { sem: 5.50, ivm: 4.33, banco_popular: 1.00 };
  const ccssPatrono = getParam('cuota_ccss_patrono') || { sem: 9.25, ivm: 5.42, fce: 0.50, imas: 0.50 };

  // Tramos ISR (fallback a tabla CR 2025 mensual en CRC)
  const tramosISR = getParam('tramo_impuesto') || [
    { limite_inferior: 0,          limite_superior: 918000,      porcentaje: 0   },
    { limite_inferior: 918000,     limite_superior: 1347000,     porcentaje: 10  },
    { limite_inferior: 1347000,    limite_superior: 2364000,     porcentaje: 15  },
    { limite_inferior: 2364000,    limite_superior: 4727000,     porcentaje: 20  },
    { limite_inferior: 4727000,    limite_superior: 999999999,   porcentaje: 25  },
  ];

  // ── 2b. Tipo de cambio del día del período ───────────────────────────────
  // Si es sábado/domingo se usa el viernes anterior (lógica en obtenerTipoCambio)
  let tipoCambioVenta = 1;
  try {
    const fechaRef = periodo?.fecha_fin || new Date().toISOString().split("T")[0];
    const tcRes = await base44.functions.invoke("obtenerTipoCambio", { fecha: fechaRef });
    tipoCambioVenta = tcRes?.venta || tcRes?.compra || 1;
  } catch { /* si falla, usa 1 (CRC nativo) */ }

  // ── 3. Empleados activos de la empresa ────────────────────────────────────
  const fechaInicioPeriodo = periodo?.fecha_inicio || '';

  // Usar filter nativo para asegurar que solo se traen empleados de esta empresa
  const [empleadosEmpresa, todasNovedades, conceptosPago] = await Promise.all([
    base44.asServiceRole.entities.Empleado.filter({ empresa_id, estado: 'activo' }, '-fecha_ingreso', 500),
    base44.asServiceRole.entities.Novedad.filter({ empresa_id, periodo_id: planilla.periodo_id, estado: 'aprobada' }, '-created_date', 500),
    base44.asServiceRole.entities.ConceptoPago.filter({ empresa_id, estado: 'activo' }, '-created_date', 200),
  ]);

  let empleados = empleadosEmpresa;
  // Excluir empleados que ingresaron después del inicio del período
  if (fechaInicioPeriodo) {
    empleados = empleados.filter(e => !e.fecha_ingreso || e.fecha_ingreso <= fechaInicioPeriodo);
  }
  // Filtrar por empleados específicos si se indicaron
  if (empleados_ids && empleados_ids.length > 0) {
    empleados = empleados.filter(e => empleados_ids.includes(e.id));
  }
  const novedades = todasNovedades;

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

  // Factor de conversión salario mensual → período
  const factorPeriodo = (tipo) => {
    switch (tipo) {
      case 'diario':     return 1 / 30;
      case 'semanal':    return 7 / 30;
      case 'bisemanal':  return 14 / 30;
      case 'quincenal':  return 15 / 30;
      case 'mensual':
      default:           return 1;
    }
  };

  const tipoPlanillaFactor = factorPeriodo(periodo?.tipo_periodo || 'mensual');

  // ── 5. Calcular por empleado ───────────────────────────────────────────────
  // Eliminar detalles y movimientos previos
  const [detsPrev, movsPrev] = await Promise.all([
    base44.asServiceRole.entities.PlanillaDetalle.filter({ planilla_id }, '-created_date', 1000),
    base44.asServiceRole.entities.MovimientoPlanilla.filter({ planilla_id }, '-created_date', 5000),
  ]);
  await Promise.all([
    ...detsPrev.map(d => base44.entities.PlanillaDetalle.delete(d.id)),
    ...movsPrev.map(m => base44.entities.MovimientoPlanilla.delete(m.id)),
  ]);

  let totalIngresosGlobal = 0;
  let totalDeduccionesGlobal = 0;
  let cantidadEmpleados = 0;

  for (const emp of empleados) {
    // Convertir salario a CRC si está en USD
    const salarioMensualBase = emp.salario_base || 0;
    const salarioMensual = emp.moneda === "USD" ? Math.round(salarioMensualBase * tipoCambioVenta) : salarioMensualBase;
    const salarioPeriodo = Math.round(salarioMensual * tipoPlanillaFactor);

    const movs = [];

    // ─ Ingreso: Salario base ─────────────────────────────────────────────────
    movs.push({
      tipo_movimiento: 'ingreso',
      descripcion: 'Salario base',
      monto: salarioPeriodo,
      cantidad: 1,
      tarifa: salarioPeriodo,
      porcentaje: 0,
      base_calculo: salarioPeriodo,
      orden_calculo: 1,
      origen: 'automatico',
    });

    let totalIngresos = salarioPeriodo;
    let totalExtra = 0;

    // ─ Novedades del período ─────────────────────────────────────────────────
    const novsEmp = novedades.filter(n => n.empleado_id === emp.id);
    for (const nov of novsEmp) {
      let montoNov = 0;
      let descripcion = '';
      let tipo_mov = 'ingreso';
      let orden = 10;

      switch (nov.tipo_novedad) {
        case 'horas_extra': {
          const valorHora = salarioMensual / 240;
          const factor = emp.tipo_jornada === 'nocturna' ? 1.75 : (emp.tipo_jornada === 'mixta' ? 1.625 : 1.5);
          montoNov = Math.round(valorHora * factor * (nov.cantidad || 0));
          descripcion = `Horas extra (${nov.cantidad}h)`;
          break;
        }
        case 'bono':
          montoNov = nov.monto || 0;
          descripcion = `Bono`;
          break;
        case 'comision':
          montoNov = nov.monto || 0;
          descripcion = `Comisión`;
          break;
        case 'ausencia':
        case 'permiso_sin_goce': {
          const valorDia = salarioMensual / 30;
          montoNov = -Math.round(valorDia * (nov.cantidad || 0));
          descripcion = `Rebajo ${nov.tipo_novedad === 'ausencia' ? 'ausencia' : 'permiso sin goce'} (${nov.cantidad}d)`;
          tipo_mov = 'deduccion';
          orden = 5;
          break;
        }
        case 'feriado_trabajado': {
          const valorDia = salarioMensual / 30;
          montoNov = Math.round(valorDia * 2 * (nov.cantidad || 1));
          descripcion = `Feriado trabajado`;
          break;
        }
        case 'ajuste_manual':
          montoNov = nov.monto || 0;
          descripcion = `Ajuste manual`;
          if (montoNov < 0) { tipo_mov = 'deduccion'; montoNov = Math.abs(montoNov); orden = 5; }
          break;
        default:
          continue;
      }

      if (montoNov === 0) continue;
      const montoAbs = Math.abs(montoNov);
      movs.push({
        tipo_movimiento: tipo_mov,
        descripcion,
        monto: montoAbs,
        cantidad: nov.cantidad || 1,
        tarifa: 0,
        porcentaje: 0,
        base_calculo: salarioPeriodo,
        orden_calculo: orden,
        origen: 'novedad',
        referencia_origen_id: nov.id,
      });

      if (tipo_mov === 'ingreso') totalIngresos += montoAbs;
      else totalExtra -= montoAbs; // rebajos
    }

    totalIngresos += totalExtra; // descontar rebajos

    // ─ Base CCSS = total ingresos brutos del período ─────────────────────────
    const baseCCSS = Math.max(0, totalIngresos);
    const esAsegurado = emp.asegurado_ccss !== false; // true por defecto

    let totalCCSSEmp = 0;
    if (esAsegurado) {
      const montoCCSSEmp = {
        sem: Math.round(baseCCSS * (ccssEmpleado.sem / 100)),
        ivm: Math.round(baseCCSS * (ccssEmpleado.ivm / 100)),
        bp:  Math.round(baseCCSS * (ccssEmpleado.banco_popular / 100)),
      };
      totalCCSSEmp = montoCCSSEmp.sem + montoCCSSEmp.ivm + montoCCSSEmp.bp;

      // ─ Deducciones CCSS empleado ───────────────────────────────────────────
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - SEM (${ccssEmpleado.sem}%)`,             monto: montoCCSSEmp.sem, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.sem,          base_calculo: baseCCSS, orden_calculo: 20, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `CCSS - IVM (${ccssEmpleado.ivm}%)`,             monto: montoCCSSEmp.ivm, cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.ivm,          base_calculo: baseCCSS, orden_calculo: 21, origen: 'automatico' });
      movs.push({ tipo_movimiento: 'deduccion', descripcion: `Banco Popular (${ccssEmpleado.banco_popular}%)`, monto: montoCCSSEmp.bp,  cantidad: 1, tarifa: 0, porcentaje: ccssEmpleado.banco_popular, base_calculo: baseCCSS, orden_calculo: 22, origen: 'automatico' });
    }

    // ─ Base ISR = ingresos - CCSS empleado (si aplica) ───────────────────────
    const baseISR = Math.max(0, baseCCSS - totalCCSSEmp);
    const montoISR = calcISR(baseISR);

    if (montoISR > 0) {
      movs.push({ tipo_movimiento: 'deduccion', descripcion: 'Impuesto sobre la Renta', monto: montoISR, cantidad: 1, tarifa: 0, porcentaje: 0, base_calculo: baseISR, orden_calculo: 30, origen: 'automatico' });
    }

    // ─ Bases para aguinaldo y vacaciones ─────────────────────────────────────
    const baseAguinaldo  = totalIngresos;
    const baseVacaciones = totalIngresos;

    // ─ Totales del empleado ───────────────────────────────────────────────────
    const deducciones = movs.filter(m => m.tipo_movimiento === 'deduccion').reduce((s, m) => s + m.monto, 0);
    const ingresos    = movs.filter(m => m.tipo_movimiento === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const neto        = ingresos - deducciones;

    // ─ Guardar PlanillaDetalle ───────────────────────────────────────────────
    const detalle = await base44.entities.PlanillaDetalle.create({
      planilla_id,
      empleado_id: emp.id,
      empresa_id,
      salario_base_periodo: salarioPeriodo,
      ingresos_totales: ingresos,
      deducciones_totales: deducciones,
      neto_pagar: neto,
      base_ccss: baseCCSS,
      base_impuesto: baseISR,
      base_aguinaldo: baseAguinaldo,
      base_vacaciones: baseVacaciones,
    });

    // ─ Guardar MovimientosPlanilla ───────────────────────────────────────────
    await Promise.all(movs.map(m => base44.entities.MovimientoPlanilla.create({
      ...m,
      planilla_id,
      planilla_detalle_id: detalle.id,
      empleado_id: emp.id,
      concepto_id: m.concepto_id || 'auto',
    })));

    totalIngresosGlobal    += ingresos;
    totalDeduccionesGlobal += deducciones;
    cantidadEmpleados++;
  }

  // ── 6. Actualizar totales de la planilla ──────────────────────────────────
  const totalNeto = totalIngresosGlobal - totalDeduccionesGlobal;
  await base44.entities.Planilla.update(planilla_id, {
    total_ingresos:    totalIngresosGlobal,
    total_deducciones: totalDeduccionesGlobal,
    total_neto:        totalNeto,
    cantidad_empleados: cantidadEmpleados,
    estado:            'calculado',
    fecha_calculo:     new Date().toISOString().split('T')[0],
    usuario_genero:    user.email,
  });

  return Response.json({
    ok: true,
    empleados_procesados: cantidadEmpleados,
    total_ingresos:    totalIngresosGlobal,
    total_deducciones: totalDeduccionesGlobal,
    total_neto:        totalNeto,
  });
});