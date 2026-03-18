import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Cálculo del subsidio de incapacidad según normativa CCSS Costa Rica
 *
 * Parámetros: { empleado_id, fecha_inicio, fecha_fin, tipo_incapacidad, empresa_id }
 *
 * Reglas CCSS:
 * - Enfermedad común / accidente no laboral (Seguro de Salud):
 *   * Días 1-3: sin pago (período de espera, patrono puede cubrir voluntariamente)
 *   * Días 4 en adelante: CCSS paga 60% del salario reportado
 *   * El patrono puede complementar voluntariamente hasta el 100%
 * - Accidente de trabajo (Seguro de Riesgos INS):
 *   * Desde el día 1: INS paga entre 75% y 100% según el caso
 * - Maternidad:
 *   * Pre/post-parto: CCSS paga el 100% por 4 meses (1 antes + 3 después)
 * - Paternidad: 8 días hábiles con goce de salario (patrono paga, no CCSS)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { empleado_id, fecha_inicio, fecha_fin, tipo_incapacidad, empresa_id } = await req.json();
    if (!empleado_id || !fecha_inicio || !fecha_fin || !tipo_incapacidad) {
      return Response.json({ error: 'Faltan parámetros: empleado_id, fecha_inicio, fecha_fin, tipo_incapacidad' }, { status: 400 });
    }

    // Cargar empleado
    const emp = await base44.entities.Empleado.get(empleado_id);
    if (!emp) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const salarioBase = Number(emp.salario_base) || 0;
    const salarioDiario = salarioBase / 30;

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const dias = Math.max(1, Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)) + 1);

    // Calcular subsidios según tipo
    let porcentaje_reconocimiento = 60;
    let dias_periodo_espera = 0;
    let entidad_paga = 'CCSS';
    let descripcion_calculo = '';

    switch (tipo_incapacidad) {
      case 'enfermedad_comun':
        porcentaje_reconocimiento = 60;
        dias_periodo_espera = 3; // primeros 3 días sin subsidio CCSS
        entidad_paga = 'CCSS';
        descripcion_calculo = 'Días 1-3 sin subsidio CCSS. Del día 4 en adelante: 60% del salario reportado a la CCSS';
        break;

      case 'accidente_trabajo':
        porcentaje_reconocimiento = 75; // INS paga entre 75%-100%
        dias_periodo_espera = 0;
        entidad_paga = 'INS';
        descripcion_calculo = 'INS paga desde el primer día: 75% del salario asegurado (puede aumentar según evaluación)';
        break;

      case 'riesgo_trabajo':
        porcentaje_reconocimiento = 75;
        dias_periodo_espera = 0;
        entidad_paga = 'INS';
        descripcion_calculo = 'INS paga desde el primer día: 75% del salario asegurado';
        break;

      case 'maternidad':
        porcentaje_reconocimiento = 100;
        dias_periodo_espera = 0;
        entidad_paga = 'CCSS';
        descripcion_calculo = 'CCSS paga 100% del salario por 4 meses (1 mes pre-parto + 3 meses post-parto)';
        break;

      case 'paternidad':
        porcentaje_reconocimiento = 100;
        dias_periodo_espera = 0;
        entidad_paga = 'PATRONO';
        descripcion_calculo = 'Patrono paga 8 días hábiles con goce de salario (100%), no hay subsidio CCSS';
        break;

      default:
        porcentaje_reconocimiento = 60;
        dias_periodo_espera = 3;
        entidad_paga = 'CCSS';
        descripcion_calculo = 'Regla general: 60% del salario desde el día 4';
    }

    // Días efectivos con subsidio
    const dias_con_subsidio = Math.max(0, dias - dias_periodo_espera);
    const monto_subsidio = dias_con_subsidio * salarioDiario * (porcentaje_reconocimiento / 100);
    const monto_sin_subsidio = Math.min(dias, dias_periodo_espera) * salarioDiario;

    return Response.json({
      ok: true,
      resultado: {
        empleado_id,
        empresa_id: empresa_id || emp.empresa_id,
        tipo_incapacidad,
        entidad_emisora: entidad_paga === 'PATRONO' ? 'CCSS' : entidad_paga,
        fecha_inicio,
        fecha_fin,
        dias,
        porcentaje_reconocimiento,
        afecta_planilla: true,
        estado: 'activa',
        _detalle: {
          salario_diario: Math.round(salarioDiario),
          dias_periodo_espera,
          dias_con_subsidio,
          monto_subsidio: Math.round(monto_subsidio),
          monto_sin_subsidio_patrono: Math.round(monto_sin_subsidio),
          entidad_responsable: entidad_paga,
          descripcion: descripcion_calculo,
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});