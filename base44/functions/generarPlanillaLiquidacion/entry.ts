import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Genera (o actualiza) la planilla de liquidación a partir de una liquidación aprobada.
 *
 * Flujo: Liquidación aprobada → Período + Planilla tipo "liquidacion" (aprobada)
 * con su PlanillaDetalle y un MovimientoPlanilla por componente
 * (preaviso, cesantía, vacaciones, aguinaldo, salario pendiente, deducciones).
 *
 * Es idempotente: si ya existe una planilla vinculada (no pagada/anulada),
 * se reemplazan sus detalles y movimientos con los montos vigentes.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { liquidacion_id } = await req.json();
    if (!liquidacion_id) return Response.json({ error: 'Falta liquidacion_id' }, { status: 400 });

    const liq = await base44.entities.Liquidacion.get(liquidacion_id);
    if (!liq) return Response.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    if (liq.estado !== 'aprobada') {
      return Response.json({ error: 'La liquidación debe estar en estado "aprobada" para generar la planilla' }, { status: 400 });
    }

    const empleado = await base44.asServiceRole.entities.Empleado.get(liq.empleado_id);
    const nombreEmpleado = empleado ? `${empleado.nombre} ${empleado.apellidos || ''}`.trim() : 'Empleado';
    const hoy = new Date().toISOString().split('T')[0];

    // Idempotencia: buscar planilla vinculada que no esté pagada ni anulada
    const existentes = await base44.asServiceRole.entities.Planilla
      .filter({ liquidacion_id }, '-created_date', 10);
    const planillaExistente = existentes.find(p => !['pagado', 'anulado'].includes(p.estado));

    let planilla = planillaExistente;
    if (planillaExistente) {
      // Reemplazar detalle y movimientos con los montos vigentes de la liquidación
      await base44.asServiceRole.entities.MovimientoPlanilla.deleteMany({ planilla_id: planilla.id });
      await base44.asServiceRole.entities.PlanillaDetalle.deleteMany({ planilla_id: planilla.id });
    } else {
      // Crear período de liquidación (día de la salida)
      const periodo = await base44.asServiceRole.entities.PeriodoPlanilla.create({
        empresa_id: liq.empresa_id,
        tipo_periodo: 'liquidacion',
        fecha_inicio: liq.fecha_salida,
        fecha_fin: liq.fecha_salida,
        fecha_pago: liq.fecha_salida,
        estado: 'aprobado',
        observaciones: `Liquidación de ${nombreEmpleado}`,
        usuario_creacion: user.email,
      });
      planilla = await base44.asServiceRole.entities.Planilla.create({
        empresa_id: liq.empresa_id,
        periodo_id: periodo.id,
        liquidacion_id: liq.id,
        codigo_planilla: `Liquidación ${nombreEmpleado} ${liq.fecha_salida}`,
        tipo_planilla: 'liquidacion',
        fecha_calculo: hoy,
        estado: 'aprobado',
        usuario_genero: user.email,
        usuario_aprobo: user.email,
        fecha_aprobacion: hoy,
        observacion: 'Generada automáticamente desde el módulo de Liquidaciones',
      });
    }

    // Conceptos de liquidación: buscar o crear por empresa
    const conceptosDef = [
      { codigo: 'LIQ_PREAVISO', nombre: 'Preaviso', tipo: 'ingreso' },
      { codigo: 'LIQ_CESANTIA', nombre: 'Cesantía', tipo: 'ingreso' },
      { codigo: 'LIQ_VACACIONES', nombre: 'Vacaciones pendientes', tipo: 'ingreso' },
      { codigo: 'LIQ_AGUINALDO', nombre: 'Aguinaldo proporcional', tipo: 'ingreso' },
      { codigo: 'LIQ_SALARIO', nombre: 'Salario pendiente', tipo: 'ingreso' },
      { codigo: 'LIQ_DEDUCCIONES', nombre: 'Deducciones finales de liquidación', tipo: 'deduccion' },
    ];
    const conceptosExistentes = await base44.asServiceRole.entities.ConceptoPago
      .filter({ empresa_id: liq.empresa_id }, 'codigo', 200);
    const conceptoMap = {};
    for (const def of conceptosDef) {
      let c = conceptosExistentes.find(x => x.codigo === def.codigo);
      if (!c) {
        c = await base44.asServiceRole.entities.ConceptoPago.create({
          empresa_id: liq.empresa_id,
          codigo: def.codigo,
          nombre: def.nombre,
          tipo: def.tipo,
          categoria: 'legal',
          calculo_tipo: 'manual',
          aplica_ccss: false,
          aplica_impuesto: false,
          estado: 'activo',
        });
      }
      conceptoMap[def.codigo] = c.id;
    }

    const totalIngresos = Number(liq.total_liquidacion) || 0;
    const deducciones = Number(liq.deducciones_finales) || 0;
    const neto = Number(liq.neto_liquidar) || (totalIngresos - deducciones);

    const detalle = await base44.asServiceRole.entities.PlanillaDetalle.create({
      planilla_id: planilla.id,
      empleado_id: liq.empleado_id,
      empresa_id: liq.empresa_id,
      salario_base_periodo: Number(liq.salario_promedio) || 0,
      ingresos_totales: totalIngresos,
      deducciones_totales: deducciones,
      neto_pagar: neto,
      observaciones: `Liquidación por ${String(liq.motivo_salida || '').replace(/_/g, ' ')}`,
    });

    const partidas = [
      { codigo: 'LIQ_PREAVISO', monto: Number(liq.preaviso) || 0 },
      { codigo: 'LIQ_CESANTIA', monto: Number(liq.cesantia) || 0 },
      { codigo: 'LIQ_VACACIONES', monto: Number(liq.vacaciones_pendientes) || 0 },
      { codigo: 'LIQ_AGUINALDO', monto: Number(liq.aguinaldo_proporcional) || 0 },
      { codigo: 'LIQ_SALARIO', monto: Number(liq.salario_pendiente) || 0 },
    ];
    let orden = 1;
    for (const partida of partidas) {
      if (partida.monto > 0) {
        await base44.asServiceRole.entities.MovimientoPlanilla.create({
          planilla_id: planilla.id,
          planilla_detalle_id: detalle.id,
          empleado_id: liq.empleado_id,
          concepto_id: conceptoMap[partida.codigo],
          tipo_movimiento: 'ingreso',
          descripcion: conceptosDef.find(d => d.codigo === partida.codigo).nombre,
          monto: partida.monto,
          origen: 'automatico',
          orden_calculo: orden++,
        });
      }
    }
    if (deducciones > 0) {
      await base44.asServiceRole.entities.MovimientoPlanilla.create({
        planilla_id: planilla.id,
        planilla_detalle_id: detalle.id,
        empleado_id: liq.empleado_id,
        concepto_id: conceptoMap['LIQ_DEDUCCIONES'],
        tipo_movimiento: 'deduccion',
        descripcion: 'Deducciones finales de liquidación',
        monto: deducciones,
        origen: 'manual',
        orden_calculo: 90,
      });
    }

    // Totales de la planilla
    await base44.asServiceRole.entities.Planilla.update(planilla.id, {
      total_ingresos: totalIngresos,
      total_deducciones: deducciones,
      total_neto: neto,
      cantidad_empleados: 1,
      estado: 'aprobado',
      fecha_calculo: hoy,
    });

    return Response.json({
      ok: true,
      mensaje: planillaExistente
        ? `Planilla "${planilla.codigo_planilla}" actualizada con los montos vigentes`
        : `Planilla de liquidación creada y aprobada para ${nombreEmpleado}`,
      planilla_id: planilla.id,
      codigo_planilla: planilla.codigo_planilla,
      actualizada: !!planillaExistente,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}