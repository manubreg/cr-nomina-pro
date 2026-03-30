import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { novedad_id, empleado_id, cantidad_horas, fecha, empresa_id } = await req.json();

    // Obtener el concepto de pago para horas extras
    const conceptos = await base44.entities.ConceptoPago.filter({
      empresa_id,
      codigo: "HE", // Código para Horas Extras
    });

    if (!conceptos || conceptos.length === 0) {
      return Response.json({ error: 'Concepto de horas extras no configurado' }, { status: 400 });
    }

    const conceptoHE = conceptos[0];

    // Encontrar el periodo que contiene la fecha
    const periodos = await base44.entities.PeriodoPlanilla.filter({
      empresa_id,
    });

    const fechaMovimiento = new Date(fecha);
    const periodo = periodos.find(p => {
      const inicio = new Date(p.fecha_inicio);
      const fin = new Date(p.fecha_fin);
      return fechaMovimiento >= inicio && fechaMovimiento <= fin;
    });

    if (!periodo) {
      return Response.json({ error: 'No hay periodo abierto para esta fecha' }, { status: 400 });
    }

    // Encontrar la planilla del periodo
    const planillas = await base44.entities.Planilla.filter({
      periodo_id: periodo.id,
      empresa_id,
    });

    if (!planillas || planillas.length === 0) {
      return Response.json({ error: 'No hay planilla para este periodo' }, { status: 400 });
    }

    const planilla = planillas[0];

    // Encontrar o crear el detalle de planilla para el empleado
    const detalles = await base44.entities.PlanillaDetalle.filter({
      planilla_id: planilla.id,
      empleado_id,
      empresa_id,
    });

    let detalleId;
    if (detalles && detalles.length > 0) {
      detalleId = detalles[0].id;
    } else {
      const nuevoDetalle = await base44.entities.PlanillaDetalle.create({
        planilla_id: planilla.id,
        empleado_id,
        empresa_id,
        salario_base_periodo: 0,
        ingresos_totales: 0,
        deducciones_totales: 0,
        neto_pagar: 0,
      });
      detalleId = nuevoDetalle.id;
    }

    // Obtener datos del empleado para calcular tarifa
    const empleado = await base44.entities.Empleado.filter({ id: empleado_id });
    if (!empleado || empleado.length === 0) {
      return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const salario_base = empleado[0].salario_base || 0;
    const horas_jornada = empleado[0].horas_jornada || 8;
    const dias_laborales = empleado[0].dias_laborales?.length || 5;
    
    // Calcular tarifa por hora (salario_base / (horas_jornada * dias_laborales) = tarifa diaria, después dividir por horas_jornada)
    const tarifa_hora = salario_base / (horas_jornada * dias_laborales);
    const monto_horas_extras = tarifa_hora * cantidad_horas * 1.5; // 50% extra

    // Crear movimiento de planilla
    const movimiento = await base44.entities.MovimientoPlanilla.create({
      planilla_detalle_id: detalleId,
      planilla_id: planilla.id,
      empleado_id,
      concepto_id: conceptoHE.id,
      tipo_movimiento: "ingreso",
      descripcion: `Horas extras: ${cantidad_horas}h`,
      cantidad: cantidad_horas,
      tarifa: tarifa_hora,
      porcentaje: 50,
      monto: monto_horas_extras,
      base_calculo: salario_base,
      origen: "novedad",
      referencia_origen_id: novedad_id,
    });

    return Response.json({
      success: true,
      movimiento_id: movimiento.id,
      monto: monto_horas_extras,
    });
  } catch (error) {
    console.error('Error en crearMovimientoHorasExtras:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});