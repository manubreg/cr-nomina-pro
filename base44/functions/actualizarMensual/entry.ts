import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { calcularBaseAguinaldo, fechaCostaRica } from '../../shared/calculoAguinaldo.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Validar que sea admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { solo_consulta = false } = await req.json().catch(() => ({}));
    const empresas = await base44.asServiceRole.entities.Empresa.list();
    const resultados = {
      vacaciones: [],
      aguinaldo: [],
      estimaciones: []
    };

    for (const empresa of empresas) {
      const empleados = await base44.asServiceRole.entities.Empleado.filter({ empresa_id: empresa.id, estado: "activo" });

      for (const empleado of empleados) {
        // 1. Actualizar vacaciones (acumular 1 día/mes = 12 días anuales)
        const vacacionesActuales = await base44.asServiceRole.entities.VacacionSaldo.filter({ empleado_id: empleado.id });
        const vacacion = vacacionesActuales[0];

        if (vacacion && !solo_consulta) {
          const diasGanados = (vacacion.dias_ganados || 0) + 1;
          const diasDisponibles = (vacacion.dias_disponibles || 0) + 1;
          
          await base44.asServiceRole.entities.VacacionSaldo.update(vacacion.id, {
            dias_ganados: diasGanados,
            dias_disponibles: diasDisponibles,
            fecha_generacion: new Date().toISOString().split('T')[0]
          });

          resultados.vacaciones.push({
            empleado_id: empleado.id,
            nombre: `${empleado.nombre} ${empleado.apellidos}`,
            dias_acumulados: diasGanados,
            empresa_id: empresa.id
          });
        }

        // 2. Recalcular desde salarios devengados, sin acumular estimaciones ni alterar pagos.
        const fecha = fechaCostaRica();
        const anioActual = Number(fecha.slice(0, 4)) + (fecha.slice(5, 7) === '12' ? 1 : 0);
        const aguinaldos = await base44.asServiceRole.entities.Aguinaldo.filter({ empleado_id: empleado.id, anio: anioActual });
        const existentes = aguinaldos.filter(a => a.estado !== 'anulado');
        const protegido = existentes.length > 1 || aguinaldos.some(a => a.estado === 'pagado' || a.estado === 'anulado');
        const calculo = await calcularBaseAguinaldo(base44.asServiceRole, empleado, anioActual);
        const datos = {
          empleado_id: empleado.id, empresa_id: empresa.id, anio: anioActual,
          total_salarios_computables: calculo.total, monto_aguinaldo: calculo.monto,
          fecha_calculo: fecha, estado: 'calculado',
        };
        if (!solo_consulta && !protegido && calculo.registrable) {
          if (existentes[0]) await base44.asServiceRole.entities.Aguinaldo.update(existentes[0].id, datos);
          else await base44.asServiceRole.entities.Aguinaldo.create(datos);
        }
        resultados.aguinaldo.push({
          empleado_id: empleado.id, nombre: `${empleado.nombre} ${empleado.apellidos}`,
          monto_aguinaldo: calculo.monto, empresa_id: empresa.id,
          actualizado: !solo_consulta && !protegido && calculo.registrable,
          advertencia: protegido ? 'Registro pagado, anulado o duplicado: no se modifica.' : calculo.advertencia,
        });

        // 3. Calcular estimaciones de preaviso y cesantía
        const fechaIngreso = new Date(empleado.fecha_ingreso);
        const hoy = new Date();
        const mesesTrabajados = (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12 + (hoy.getMonth() - fechaIngreso.getMonth());

        const salarioPromedio = empleado.salario_base || 0;
        
        // Preaviso: 30 días por cada año de servicio (máximo 3 meses)
        const diasPrevio = Math.min(Math.floor(mesesTrabajados / 12) * 30, 90);
        const montoPrevio = (salarioPromedio / 30) * diasPrevio;

        // Cesantía: 7.5 días por cada año de servicio
        const diasCesantia = Math.floor(mesesTrabajados / 12) * 7.5;
        const montoCesantia = (salarioPromedio / 30) * diasCesantia;

        resultados.estimaciones.push({
          empleado_id: empleado.id,
          nombre: `${empleado.nombre} ${empleado.apellidos}`,
          meses_trabajados: mesesTrabajados,
          dias_previo: diasPrevio,
          monto_previo: montoPrevio,
          dias_cesantia: diasCesantia,
          monto_cesantia: montoCesantia,
          total_obligaciones: montoPrevio + montoCesantia,
          empresa_id: empresa.id
        });
      }
    }

    // Guardar reporte en una entidad temporal (si existe)
    const reporteFecha = new Date().toISOString().split('T')[0];
    try {
      if (!solo_consulta) await base44.asServiceRole.entities.ReporteActualizacionMensual.create({
        fecha_ejecucion: reporteFecha,
        tipo_reporte: 'actualizacion_mensual',
        datos_json: JSON.stringify(resultados),
        estado: 'completado'
      });
    } catch (e) {
      // Entidad podría no existir, continuamos
    }

    return Response.json({
      success: true,
      fecha_ejecucion: reporteFecha,
      resumen: {
        empleados_procesados: resultados.vacaciones.length,
        vacaciones_actualizadas: resultados.vacaciones.length,
        aguinaldos_calculados: resultados.aguinaldo.length,
        estimaciones_generadas: resultados.estimaciones.length
      },
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}