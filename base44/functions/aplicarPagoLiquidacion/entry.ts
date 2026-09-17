import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Sincroniza el pago de una planilla de liquidación (estado "pagado"):
 * - Marca la liquidación vinculada como "pagada"
 * - Cierra al empleado: estado "liquidado" y fecha de salida
 *
 * Se invoca al marcar como pagada una planilla tipo "liquidacion".
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { planilla_id } = await req.json();
    if (!planilla_id) return Response.json({ error: 'Falta planilla_id' }, { status: 400 });

    const planilla = await base44.asServiceRole.entities.Planilla.get(planilla_id);
    if (!planilla) return Response.json({ error: 'Planilla no encontrada' }, { status: 404 });
    if (planilla.tipo_planilla !== 'liquidacion') {
      return Response.json({ error: 'La planilla no es de tipo liquidación' }, { status: 400 });
    }
    if (planilla.estado !== 'pagado') {
      return Response.json({ error: 'Primero marque la planilla como pagada' }, { status: 400 });
    }
    if (!planilla.liquidacion_id) {
      return Response.json({ ok: true, mensaje: 'Planilla sin liquidación vinculada; nada que sincronizar' });
    }

    const liq = await base44.asServiceRole.entities.Liquidacion.get(planilla.liquidacion_id);
    if (!liq) return Response.json({ error: 'Liquidación vinculada no encontrada' }, { status: 404 });

    if (liq.estado !== 'pagada') {
      await base44.asServiceRole.entities.Liquidacion.update(liq.id, { estado: 'pagada' });
    }

    if (liq.empleado_id) {
      await base44.asServiceRole.entities.Empleado.update(liq.empleado_id, {
        estado: 'liquidado',
        fecha_salida: liq.fecha_salida,
      });
    }

    return Response.json({
      ok: true,
      mensaje: 'Liquidación marcada como pagada y empleado cerrado (estado: liquidado)',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}