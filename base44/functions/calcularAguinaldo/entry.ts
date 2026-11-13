import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resumenMensualAguinaldo } from '../../shared/resumenMensualAguinaldo.ts';
import { calcularBaseAguinaldo, fechaCostaRica } from '../../shared/calculoAguinaldo.ts';

/**
 * Cálculo de aguinaldo del sector privado según Ley N° 2412, Costa Rica.
 *
 * Parámetros: { empleado_id, anio, empresa_id }
 *
 * Reglas:
 * - Período: 1 diciembre año anterior - 30 noviembre año en curso
 * - Monto = salarios ordinarios y extraordinarios devengados en el período / 12
 * - También se divide entre 12 cuando se trabajó menos de un año; sin doble prorrateo.
 * - El aguinaldo está exento de CCSS e impuesto de renta
 */

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { empleado_id, anio, empresa_id, visualizar = false } = await req.json().catch(() => ({}));
    if (!empleado_id || !Number.isInteger(Number(anio)) || Number(anio) < 1900 || Number(anio) > 9998) {
      return Response.json({ error: 'Faltan parámetros: empleado_id, anio' }, { status: 400 });
    }

    // Cargar empleado
    const emp = await base44.entities.Empleado.get(empleado_id).catch(e => e.status === 404 ? null : Promise.reject(e));
    if (!emp) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });
    if ((empresa_id && empresa_id !== emp.empresa_id) || (user.role !== 'admin' && user.empresa_id !== emp.empresa_id)) return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
    if (!emp.fecha_ingreso) return Response.json({ error: 'El empleado no tiene fecha de ingreso.' }, { status: 400 });
    if (emp.estado === 'liquidado' && !visualizar) {
      return Response.json({ error: 'No se puede calcular un aguinaldo para una persona liquidada. El aguinaldo proporcional se gestiona en su liquidación.' }, { status: 400 });
    }

    const anioNum = Number(anio);
    const calculo = await calcularBaseAguinaldo(base44, emp, anioNum);
    const salariosMensuales = visualizar ? await resumenMensualAguinaldo(base44, calculo.incluidos) : [];
    return Response.json({
      ok: true,
      resultado: {
        empleado_id,
        empresa_id: emp.empresa_id,
        anio: anioNum,
        total_salarios_computables: calculo.total,
        monto_aguinaldo: calculo.monto,
        fecha_calculo: fechaCostaRica(),
        estado: 'calculado',
        _detalle: {
          periodo_inicio: calculo.inicio,
          periodo_fin: calculo.fin,
          meses_en_periodo: calculo.meses,
          salarios_mensuales: salariosMensuales,
          inicio_efectivo: calculo.desde,
          fin_efectivo: calculo.corte,
          provisional: calculo.provisional,
          registrable: calculo.registrable,
          tiene_derecho: calculo.tieneDerecho,
          planillas_incluidas: calculo.incluidos.map(det => ({
            id: det.id, planilla_id: det.planilla_id,
            salario_base_periodo: det.salario_base_periodo,
            ingresos_totales: det.ingresos_totales,
            base_aguinaldo: det._base_computable,
          })),
          advertencia: calculo.advertencia,
          fuente: 'planillas',
          fundamento: 'Ley 2412 y Decreto Ejecutivo 20236-TSS. Sector privado. Pago del 1 al 20 de diciembre.',
        },
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}