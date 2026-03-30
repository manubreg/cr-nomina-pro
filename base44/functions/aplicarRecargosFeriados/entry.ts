import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fecha, salario_diario, tipo_jornada } = await req.json();

    if (!fecha || !salario_diario) {
      return Response.json({ error: 'fecha y salario_diario requeridos' }, { status: 400 });
    }

    // Obtener lista de feriados
    const diasFeriadosResp = await base44.functions.invoke('obtenerDiasFeriados', {});
    const diasFeriados = diasFeriadosResp?.data?.dias_feriados || [];

    // Parsear fecha (formato YYYY-MM-DD)
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const fechaObj = new Date(anio, mes - 1, dia);

    // Buscar si la fecha es feriado
    const esFeriado = diasFeriados.find(f => f.mes === mes && f.dia === dia);

    if (!esFeriado) {
      return Response.json({
        es_feriado: false,
        recargo_porcentaje: 0,
        monto_recargo: 0,
        descripcion: 'Día laboral normal'
      });
    }

    // Factor de recargo según tipo de jornada (Costa Rica)
    let factor = 1.5; // Default diurna
    if (tipo_jornada === 'nocturna') factor = 1.75;
    if (tipo_jornada === 'mixta') factor = 1.625;

    const recargo_porcentaje = Math.round((factor - 1) * 100);
    const monto_recargo = Math.round(salario_diario * (recargo_porcentaje / 100));

    return Response.json({
      es_feriado: true,
      pago_obligatorio: esFeriado.pago_obligatorio,
      recargo_porcentaje,
      recargo_factor: factor,
      monto_recargo,
      monto_total: Math.round(salario_diario * factor),
      nombre_feriado: esFeriado.nombre,
      descripcion: esFeriado.observaciones || esFeriado.se_trabaja_que_ocurre
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});