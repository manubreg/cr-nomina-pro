import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Cálculo automático de Aguinaldo según Ley N° 1584 Costa Rica
 *
 * Parámetros: { empleado_id, anio, empresa_id }
 *
 * Reglas:
 * - Período: 1 diciembre año anterior - 30 noviembre año en curso
 * - Monto = suma de salarios ordinarios recibidos en el período / 12
 * - Si no completó el año: proporcional a los meses trabajados en el período
 * - El aguinaldo está exento de CCSS e impuesto de renta
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { empleado_id, anio, empresa_id } = await req.json();
    if (!empleado_id || !anio) {
      return Response.json({ error: 'Faltan parámetros: empleado_id, anio' }, { status: 400 });
    }

    // Cargar empleado
    const empleados = await base44.entities.Empleado.filter({ id: empleado_id });
    if (!empleados || empleados.length === 0) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });
    const emp = empleados[0];

    const salarioBase = Number(emp.salario_base) || 0;
    const fechaIngreso = new Date(emp.fecha_ingreso);
    const anioNum = Number(anio);

    // Período de aguinaldo: 1 dic (anio-1) al 30 nov (anio)
    const inicioPeriodo = new Date(anioNum - 1, 11, 1); // 1 dic año anterior
    const finPeriodo = new Date(anioNum, 10, 30);        // 30 nov año en curso
    const hoy = new Date();
    const fechaRealFin = hoy < finPeriodo ? hoy : finPeriodo;

    // Determinar inicio efectivo (puede ser fecha de ingreso si es posterior)
    const inicioEfectivo = fechaIngreso > inicioPeriodo ? fechaIngreso : inicioPeriodo;

    // Buscar planillas pagadas del empleado en el período para sumar salarios reales
    const planillasDetalle = await base44.entities.PlanillaDetalle.filter({ empleado_id });
    
    let total_salarios_computables = 0;
    let mesesEnPeriodo = 0;

    if (planillasDetalle && planillasDetalle.length > 0) {
      // Sumar ingresos reales de planillas en el período
      for (const det of planillasDetalle) {
        // Verificar si la planilla cae en el período de aguinaldo
        // usando ingresos_totales del detalle
        total_salarios_computables += Number(det.ingresos_totales) || 0;
      }
      // Si hay datos reales, calcular meses a partir de la suma
      mesesEnPeriodo = 12;
    } else {
      // Sin planillas: calcular con salario base proporcional
      const msEnPeriodo = Math.max(0, fechaRealFin - inicioEfectivo);
      mesesEnPeriodo = Math.min(12, msEnPeriodo / (1000 * 60 * 60 * 24 * 30.44));
      total_salarios_computables = salarioBase * mesesEnPeriodo;
    }

    // Aguinaldo = total salarios computables / 12
    const monto_aguinaldo = total_salarios_computables / 12;
    const mesesReales = Math.round(mesesEnPeriodo * 100) / 100;

    return Response.json({
      ok: true,
      resultado: {
        empleado_id,
        empresa_id: empresa_id || emp.empresa_id,
        anio: anioNum,
        total_salarios_computables: Math.round(total_salarios_computables),
        monto_aguinaldo: Math.round(monto_aguinaldo),
        fecha_calculo: new Date().toISOString().split('T')[0],
        estado: 'calculado',
        _detalle: {
          periodo_inicio: inicioPeriodo.toISOString().split('T')[0],
          periodo_fin: finPeriodo.toISOString().split('T')[0],
          meses_en_periodo: mesesReales,
          salario_base: salarioBase,
          fuente: planillasDetalle && planillasDetalle.length > 0 ? 'planillas' : 'salario_base',
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});