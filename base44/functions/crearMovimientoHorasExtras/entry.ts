import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { novedad_id, empleado_id, cantidad_horas, fecha, empresa_id } = await req.json();

    if (!novedad_id || !empleado_id || !cantidad_horas || !fecha || !empresa_id) {
      return Response.json({ error: 'Parámetros faltantes' }, { status: 400 });
    }

    // Obtener todos los conceptos y buscar horas extras (puede ser por tipo o nombre)
    const conceptos = await base44.entities.ConceptoPago.filter({
      empresa_id,
    });

    // Buscar por código "HE" o nombre que contenga "extra"
    let conceptoHE = conceptos.find(c => c.codigo === "HE");
    if (!conceptoHE) {
      conceptoHE = conceptos.find(c => c.nombre && c.nombre.toLowerCase().includes("extra"));
    }

    if (!conceptoHE) {
      console.log("Conceptos disponibles:", conceptos.map(c => ({ codigo: c.codigo, nombre: c.nombre })));
      return Response.json({ error: 'Concepto de horas extras no encontrado' }, { status: 400 });
    }

    // Encontrar el periodo que contiene la fecha
    const allPeriodos = await base44.entities.PeriodoPlanilla.filter({
      empresa_id,
    });

    const fechaMovimiento = new Date(fecha);
    const periodo = allPeriodos.find(p => {
      const inicio = new Date(p.fecha_inicio);
      const fin = new Date(p.fecha_fin);
      return fechaMovimiento >= inicio && fechaMovimiento <= fin;
    });

    if (!periodo) {
      console.log("Periodos disponibles:", allPeriodos.map(p => ({ id: p.id, inicio: p.fecha_inicio, fin: p.fecha_fin })));
      return Response.json({ error: 'No hay periodo abierto para esta fecha' }, { status: 400 });
    }

    // Encontrar la planilla del periodo (en estado calculado o posterior)
    const allPlanillas = await base44.entities.Planilla.filter({
      empresa_id,
    });

    const planilla = allPlanillas.find(p => p.periodo_id === periodo.id);

    if (!planilla) {
      return Response.json({ error: 'No hay planilla para este periodo' }, { status: 400 });
    }

    // Encontrar o crear el detalle de planilla para el empleado
    const allDetalles = await base44.entities.PlanillaDetalle.filter({
      empresa_id,
    });

    let detalleId;
    const detalleExistente = allDetalles.find(d => d.planilla_id === planilla.id && d.empleado_id === empleado_id);
    
    if (detalleExistente) {
      detalleId = detalleExistente.id;
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
    const empleadoData = await base44.entities.Empleado.filter({ id: empleado_id });
    if (!empleadoData || empleadoData.length === 0) {
      return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const emp = empleadoData[0];
    const salario_base = emp.salario_base || 0;
    const horas_jornada = emp.horas_jornada || 8;
    const dias_laborales = (emp.dias_laborales && emp.dias_laborales.length) || 5;
    
    // Calcular tarifa por hora
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
      mensaje: "Movimiento creado en planilla",
    });
  } catch (error) {
    console.error('Error en crearMovimientoHorasExtras:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});