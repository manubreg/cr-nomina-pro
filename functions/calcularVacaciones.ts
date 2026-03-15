import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Cálculo automático de saldo de vacaciones según Código de Trabajo CR
 *
 * Parámetros: { empleado_id, empresa_id }
 *
 * Reglas (Art. 153-162 CT):
 * - Mínimo: 2 semanas (14 días) por cada 50 semanas trabajadas
 * - Para efectos prácticos: 15 días hábiles por año laborado
 * - Los días se acumulan proporcionalmente
 * - Vacaciones no son acumulables más allá de lo que la ley permite
 * - El pago es con el salario ordinario vigente
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { empleado_id, empresa_id } = await req.json();
    if (!empleado_id) {
      return Response.json({ error: 'Falta parámetro: empleado_id' }, { status: 400 });
    }

    // Cargar empleado
    const emp = await base44.entities.Empleado.get(empleado_id);
    if (!emp) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const fechaIngreso = new Date(emp.fecha_ingreso);
    const hoy = new Date();
    const salarioBase = Number(emp.salario_base) || 0;

    // Calcular días trabajados totales
    const diasTotales = Math.floor((hoy - fechaIngreso) / (1000 * 60 * 60 * 24));

    // Vacaciones ganadas: 15 días hábiles por cada 365 días
    const diasGanados = Math.floor((diasTotales / 365) * 15);

    // Buscar solicitudes de vacaciones aplicadas para restar los usados
    const solicitudes = await base44.entities.VacacionSolicitud.filter({ empleado_id });
    const diasUsados = solicitudes
      .filter(s => s.estado === 'aplicada' || s.estado === 'aprobada')
      .reduce((acc, s) => acc + (Number(s.dias_solicitados) || 0), 0);

    const saldo_actual = Math.max(0, diasGanados - diasUsados);

    // Fecha de vencimiento: 1 año después de generarse el derecho
    const aniosCompletos = Math.floor(diasTotales / 365);
    const fechaVencimiento = new Date(fechaIngreso);
    fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + aniosCompletos + 1);

    // Estado del saldo
    let estado = 'vigente';
    if (saldo_actual <= 0) estado = 'agotado';
    else if (hoy > fechaVencimiento) estado = 'vencido';

    return Response.json({
      ok: true,
      resultado: {
        empleado_id,
        empresa_id: empresa_id || emp.empresa_id,
        fecha_generacion: hoy.toISOString().split('T')[0],
        dias_ganados: diasGanados,
        dias_disponibles: saldo_actual,
        dias_usados: diasUsados,
        saldo_actual,
        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
        estado,
        _detalle: {
          fecha_ingreso: emp.fecha_ingreso,
          dias_trabajados: diasTotales,
          anios_completos: aniosCompletos,
          salario_diario: Math.round(salarioBase / 30),
          valor_dia_vacacion: Math.round(salarioBase / 30),
          valor_saldo_total: Math.round(saldo_actual * (salarioBase / 30)),
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});