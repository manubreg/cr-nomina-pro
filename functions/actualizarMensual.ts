import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Validar que sea admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const empresas = await base44.asServiceRole.entities.Empresa.list();
    const resultados = {
      vacaciones: [],
      aguinaldo: [],
      estimaciones: []
    };

    for (const empresa of empresas) {
      const empleados = await base44.asServiceRole.entities.Empleado.filter({ empresa_id: empresa.id, estado: "activo" });

      for (const empleado of empleados) {
        // 1. Actualizar vacaciones (acumular 2.5 días/mes)
        const vacacionesActuales = await base44.asServiceRole.entities.VacacionSaldo.filter({ empleado_id: empleado.id });
        const vacacion = vacacionesActuales[0];

        if (vacacion) {
          const diasGanados = (vacacion.dias_ganados || 0) + 2.5;
          const diasDisponibles = (vacacion.dias_disponibles || 0) + 2.5;
          
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

        // 2. Calcular aguinaldo acumulado (8.33% del salario mensual)
        const aguinaldos = await base44.asServiceRole.entities.Aguinaldo.filter({ empleado_id: empleado.id });
        const anioActual = new Date().getFullYear();
        let aguinaldo = aguinaldos.find(a => a.anio === anioActual);

        const salarioComputado = (empleado.salario_base || 0) * (1 / 12);
        const montoMensual = salarioComputado * 0.0833;

        if (aguinaldo) {
          const totalSalarios = (aguinaldo.total_salarios_computables || 0) + salarioComputado;
          const montoAguinaldo = totalSalarios * 0.0833;

          await base44.asServiceRole.entities.Aguinaldo.update(aguinaldo.id, {
            total_salarios_computables: totalSalarios,
            monto_aguinaldo: montoAguinaldo,
            fecha_calculo: new Date().toISOString().split('T')[0]
          });
        } else {
          aguinaldo = await base44.asServiceRole.entities.Aguinaldo.create({
            empleado_id: empleado.id,
            empresa_id: empresa.id,
            anio: anioActual,
            total_salarios_computables: salarioComputado,
            monto_aguinaldo: montoMensual,
            fecha_calculo: new Date().toISOString().split('T')[0],
            estado: 'calculado'
          });
        }

        resultados.aguinaldo.push({
          empleado_id: empleado.id,
          nombre: `${empleado.nombre} ${empleado.apellidos}`,
          monto_aguinaldo: aguinaldo.monto_aguinaldo || montoMensual,
          empresa_id: empresa.id
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
      await base44.asServiceRole.entities.ReporteActualizacionMensual.create({
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
});