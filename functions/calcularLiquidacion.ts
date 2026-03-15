import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Cálculo de liquidación según Código de Trabajo de Costa Rica
 *
 * Parámetros recibidos: { empleado_id, fecha_salida, motivo_salida, empresa_id }
 *
 * Reglas legales aplicadas:
 * - Preaviso (Art. 28-29 CT): según antigüedad y motivo (renuncia/despido_sin_causa/mutuo_acuerdo)
 * - Cesantía (Art. 29 CT): solo cuando aplica por motivo, tope 8 años, escala por tramos
 * - Vacaciones proporcionales (Art. 153-162 CT): (días_trabajados_en_año / 365) * 15 días
 * - Aguinaldo proporcional (Ley Aguinaldo 1 dic - 30 nov): meses/12 * salario_mensual
 * - Salario pendiente: días trabajados en último período no pagado
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const { empleado_id, fecha_salida, motivo_salida, empresa_id } = await req.json();
    if (!empleado_id || !fecha_salida || !motivo_salida) {
      return Response.json({ error: 'Faltan parámetros requeridos: empleado_id, fecha_salida, motivo_salida' }, { status: 400 });
    }

    // Cargar datos del empleado
    const emp = await base44.entities.Empleado.get(empleado_id);
    if (!emp) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const fechaSalidaDate = new Date(fecha_salida);
    const fechaIngreso = new Date(emp.fecha_ingreso);

    // Años completos de servicio
    const msAnio = 1000 * 60 * 60 * 24 * 365.25;
    const aniosServicio = (fechaSalidaDate - fechaIngreso) / msAnio;
    const diasServicio = Math.floor((fechaSalidaDate - fechaIngreso) / (1000 * 60 * 60 * 24));

    const salarioBase = Number(emp.salario_base) || 0;

    // ---- SALARIO DIARIO ----
    const salarioDiario = salarioBase / 30;

    // ---- PREAVISO (Art. 28-29 CT) ----
    // Aplica cuando: renuncia, despido_sin_causa, mutuo_acuerdo
    let preaviso = 0;
    const motivosConPreaviso = ['renuncia', 'despido_sin_causa', 'mutuo_acuerdo', 'fin_contrato'];
    if (motivosConPreaviso.includes(motivo_salida)) {
      let diasPreaviso = 0;
      if (aniosServicio < 0.25) diasPreaviso = 7;         // < 3 meses: 1 semana
      else if (aniosServicio < 0.5) diasPreaviso = 14;    // 3-6 meses: 2 semanas
      else if (aniosServicio < 1) diasPreaviso = 21;      // 6-12 meses: 3 semanas
      else diasPreaviso = 30;                              // > 1 año: 1 mes
      preaviso = salarioDiario * diasPreaviso;
    }

    // ---- CESANTÍA (Art. 29 CT) ----
    // Solo aplica: despido_sin_causa, mutuo_acuerdo, fin_contrato, fallecimiento
    // NO aplica en renuncia ni despido_con_causa
    let cesantia = 0;
    const motivosConCesantia = ['despido_sin_causa', 'mutuo_acuerdo', 'fin_contrato', 'fallecimiento'];
    if (motivosConCesantia.includes(motivo_salida)) {
      // Escala según Art. 29:
      // 1er año: 7 días / 2do año: 14 días / 3er-4to: 19.5 días / 5to-6to: 20 días / 7mo: 21 días / 8vo+: 22 días
      // Tope: 8 años de cesantía
      const aniosParaCesantia = Math.min(Math.floor(aniosServicio), 8);
      let diasCesantia = 0;
      for (let a = 1; a <= aniosParaCesantia; a++) {
        if (a === 1) diasCesantia += 7;
        else if (a === 2) diasCesantia += 14;
        else if (a <= 4) diasCesantia += 19.5;
        else if (a <= 6) diasCesantia += 20;
        else if (a === 7) diasCesantia += 21;
        else diasCesantia += 22;
      }
      // Fracción del año en curso (proporcional)
      const fraccionAnio = aniosServicio - Math.floor(aniosServicio);
      if (fraccionAnio > 0 && aniosParaCesantia < 8) {
        const diasPorAnioActual = aniosParaCesantia < 2 ? 7 : aniosParaCesantia < 4 ? 19.5 : aniosParaCesantia < 6 ? 20 : aniosParaCesantia < 7 ? 21 : 22;
        diasCesantia += diasPorAnioActual * fraccionAnio;
      }
      cesantia = salarioDiario * diasCesantia;
    }

    // ---- VACACIONES PROPORCIONALES (Art. 153-162 CT) ----
    // 2 semanas (15 días hábiles) por cada 50 semanas trabajadas
    // Si no completó el año, proporcional: (diasTrabajadosEnAnioActual / 365) * 15 * salarioDiario
    const diasEnAnioActual = diasServicio % 365;
    const vacacionesDias = (diasEnAnioActual / 365) * 15;
    const vacaciones_pendientes = vacacionesDias * salarioDiario;

    // ---- AGUINALDO PROPORCIONAL ----
    // Período aguinaldo: 1 dic año anterior - 30 nov año en curso
    // Proporcional según meses en el período
    const anioSalida = fechaSalidaDate.getFullYear();
    const mesSalida = fechaSalidaDate.getMonth(); // 0=ene, 11=dic
    let inicioAguinaldo;
    if (mesSalida >= 11) { // diciembre: período dic año actual - nov año siguiente (pero mide lo acumulado)
      inicioAguinaldo = new Date(anioSalida, 11, 1);
    } else {
      inicioAguinaldo = new Date(anioSalida - 1, 11, 1); // 1 dic del año anterior
    }
    const msEnPeriodo = Math.max(0, fechaSalidaDate - inicioAguinaldo);
    const mesesEnPeriodo = Math.min(12, msEnPeriodo / (1000 * 60 * 60 * 24 * 30.44));
    const aguinaldo_proporcional = (mesesEnPeriodo / 12) * salarioBase;

    // ---- SALARIO PENDIENTE ----
    // Días del mes en curso que no han sido pagados (asumiendo pago mensual)
    const diaDelMes = fechaSalidaDate.getDate();
    const salario_pendiente = salarioDiario * diaDelMes;

    // ---- TOTALES ----
    const total_liquidacion = preaviso + cesantia + vacaciones_pendientes + aguinaldo_proporcional + salario_pendiente;
    const neto_liquidar = total_liquidacion; // sin deducciones extra por defecto

    return Response.json({
      ok: true,
      resultado: {
        empleado_id,
        empresa_id: empresa_id || emp.empresa_id,
        fecha_salida,
        motivo_salida,
        salario_promedio: salarioBase,
        preaviso: Math.round(preaviso),
        cesantia: Math.round(cesantia),
        vacaciones_pendientes: Math.round(vacaciones_pendientes),
        aguinaldo_proporcional: Math.round(aguinaldo_proporcional),
        salario_pendiente: Math.round(salario_pendiente),
        deducciones_finales: 0,
        total_liquidacion: Math.round(total_liquidacion),
        neto_liquidar: Math.round(neto_liquidar),
        estado: 'borrador',
        // metadata del cálculo
        _detalle: {
          anios_servicio: Math.round(aniosServicio * 100) / 100,
          dias_servicio: diasServicio,
          salario_diario: Math.round(salarioDiario),
          meses_aguinaldo: Math.round(mesesEnPeriodo * 100) / 100,
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});