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

    const { empleado_id, fecha_salida, motivo_salida, empresa_id, preaviso_opcion, preaviso_dias } = await req.json();
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

    // Convertir salario a CRC si está en USD, usando TC del día de salida
    // (si es sábado/domingo, usa viernes anterior — lógica interna de obtenerTipoCambio)
    const salarioBaseOrig = Number(emp.salario_base) || 0;
    let tipoCambioVenta = 1;
    if (emp.moneda === "USD") {
      try {
        const tcRes = await base44.functions.invoke("obtenerTipoCambio", { fecha: fecha_salida });
        tipoCambioVenta = tcRes?.venta || tcRes?.compra || 1;
      } catch { /* usa 1 si falla */ }
    }
    const salarioBase = emp.moneda === "USD" ? Math.round(salarioBaseOrig * tipoCambioVenta) : salarioBaseOrig;

    // ---- SALARIO PROMEDIO (histórico de planillas, últimos 6 meses) ----
    // Promedio mensual = (Σ ingresos de planillas / Σ días de los períodos) * 30
    // Fallback: salario base del empleado cuando no hay planillas calculadas
    let salarioPromedio = salarioBase;
    let mesesCompletos = 0;
    const periodosEmpleado = []; // {ingresos, dias, inicio, fin} períodos ordinarios ya cerrados
    try {
      const detalles = await base44.asServiceRole.entities.PlanillaDetalle
        .filter({ empleado_id }, '-created_date', 300);
      const planillaIds = [...new Set(detalles.map(d => d.planilla_id).filter(Boolean))];
      const planillas = (await Promise.all(
        planillaIds.map(pid => base44.asServiceRole.entities.Planilla.get(pid).catch(() => null))
      )).filter(Boolean);
      const periodoIds = [...new Set(planillas.map(p => p.periodo_id).filter(Boolean))];
      const periodos = (await Promise.all(
        periodoIds.map(pdid => base44.asServiceRole.entities.PeriodoPlanilla.get(pdid).catch(() => null))
      )).filter(Boolean);
      const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]));
      const planillaMap = Object.fromEntries(planillas.map(p => [p.id, p]));
      for (const d of detalles) {
        const planilla = planillaMap[d.planilla_id];
        const periodo = planilla ? periodoMap[planilla.periodo_id] : null;
        if (!periodo || ['aguinaldo', 'liquidacion'].includes(periodo.tipo_periodo)) continue;
        const inicio = new Date(periodo.fecha_inicio);
        const fin = new Date(periodo.fecha_fin);
        const dias = Math.round((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
        if (dias <= 0 || fin > fechaSalidaDate) continue;
        periodosEmpleado.push({ ingresos: Number(d.ingresos_totales) || 0, dias, inicio, fin });
      }
      // Promedio MTSS: salario de cada mes COMPLETO trabajado de los últimos 6 meses
      // (se excluyen meses parciales, p.ej. el mes de ingreso o de salida)
      const salariosMensuales = [];
      for (let i = 0; i < 6; i++) {
        const inicioMes = new Date(Date.UTC(fechaSalidaDate.getFullYear(), fechaSalidaDate.getMonth() - i, 1));
        const finMes = new Date(Date.UTC(fechaSalidaDate.getFullYear(), fechaSalidaDate.getMonth() - i + 1, 0));
        if (fechaIngreso > inicioMes || finMes > fechaSalidaDate) continue;
        let suma = 0, diasCubiertos = 0;
        for (const p of periodosEmpleado) {
          const ini = p.inicio > inicioMes ? p.inicio : inicioMes;
          const f = p.fin < finMes ? p.fin : finMes;
          if (ini > f) continue;
          const diasSolap = Math.round((f - ini) / (1000 * 60 * 60 * 24)) + 1;
          suma += p.ingresos * diasSolap / p.dias;
          diasCubiertos += diasSolap;
        }
        if (diasCubiertos >= finMes.getUTCDate()) salariosMensuales.push(suma);
      }
      if (salariosMensuales.length > 0) {
        salarioPromedio = Math.round(salariosMensuales.reduce((s, x) => s + x, 0) / salariosMensuales.length);
        mesesCompletos = salariosMensuales.length;
      }
    } catch { /* sin histórico: usa salario base */ }

    // ---- SALARIO DIARIO ----
    const salarioDiario = salarioPromedio / 30;

    // ---- PREAVISO (Art. 28-29 CT) ----
    // Aplica cuando: renuncia, despido_sin_causa, mutuo_acuerdo
    let preaviso = 0;
    const motivosConPreaviso = ['renuncia', 'despido_sin_causa', 'mutuo_acuerdo', 'fin_contrato'];
    if (motivosConPreaviso.includes(motivo_salida)) {
      // Art. 28 CT: < 3 meses no corresponde; 3-6 meses: 1 semana;
      // 6-12 meses: 15 días; > 1 año: 1 mes
      let diasPreaviso = 0;
      if (aniosServicio >= 1) diasPreaviso = 30;
      else if (aniosServicio >= 0.5) diasPreaviso = 15;
      else if (aniosServicio >= 0.25) diasPreaviso = 7;
      // ¿Se ejerció el preaviso?
      // - 'trabajado': el empleado trabajó todo el preaviso → no se paga
      // - 'dias_pendientes': se pagan solo los días indicados que no se trabajaron
      // - 'pagar' (default): se paga completo
      if (preaviso_opcion === 'trabajado') diasPreaviso = 0;
      else if (preaviso_opcion === 'dias_pendientes') {
        diasPreaviso = Math.max(0, Math.min(Number(preaviso_dias) || 0, diasPreaviso));
      }
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
      let diasCesantia = 0;
      if (aniosServicio >= 1) {
        const aniosParaCesantia = Math.min(Math.floor(aniosServicio), 8);
        for (let a = 1; a <= aniosParaCesantia; a++) {
          if (a === 1) diasCesantia += 7;
          else if (a === 2) diasCesantia += 14;
          else if (a <= 4) diasCesantia += 19.5;
          else if (a <= 6) diasCesantia += 20;
          else if (a === 7) diasCesantia += 21;
          else diasCesantia += 22;
        }
        // Fracción del año en curso, proporcional a la tasa de ese año
        const fraccionAnio = aniosServicio - Math.floor(aniosServicio);
        if (fraccionAnio > 0 && aniosParaCesantia < 8) {
          const anioEnCurso = aniosParaCesantia + 1;
          const tasa = anioEnCurso === 2 ? 14 : anioEnCurso <= 4 ? 19.5 : anioEnCurso <= 6 ? 20 : anioEnCurso === 7 ? 21 : 22;
          diasCesantia += tasa * fraccionAnio;
        }
      } else if (aniosServicio >= 0.5) diasCesantia = 14; // Art. 29.b: 6-12 meses
      else if (aniosServicio >= 0.25) diasCesantia = 7;   // Art. 29.a: 3-6 meses
      // < 3 meses: no corresponde cesantía
      cesantia = salarioDiario * diasCesantia;
    }

    // ---- VACACIONES PENDIENTES (Art. 153-162 CT) ----
    // 15 días por cada 365 trabajados durante TODA la relación laboral,
    // menos los días de vacaciones con goce ya disfrutados (solicitudes aprobadas/aplicadas)
    const vacSolicitudes = await base44.asServiceRole.entities.VacacionSolicitud
      .filter({ empleado_id }, '-fecha_inicio', 500).catch(() => []);
    const diasTomados = vacSolicitudes
      .filter(v => ['aprobada', 'aplicada'].includes(v.estado) && v.tipo_vacacion !== 'sin_goce')
      .reduce((s, v) => s + (Number(v.dias_solicitados) || 0), 0);
    const diasVacacionesDevengadas = (diasServicio / 365) * 15;
    // Saldo en días completos (criterio MTSS)
    const vacacionesDias = Math.max(0, Math.floor(diasVacacionesDevengadas) - diasTomados);
    const vacaciones_pendientes = vacacionesDias * salarioDiario;

    // ---- AGUINALDO PROPORCIONAL (regla MTSS) ----
    // Suma de los salarios devengados dentro del período de aguinaldo
    // (1 dic año anterior - 30 nov, o desde el ingreso si es posterior), dividida entre 12.
    const anioSalida = fechaSalidaDate.getFullYear();
    const mesSalida = fechaSalidaDate.getMonth(); // 0=ene, 11=dic
    const inicioAguinaldo = mesSalida >= 11
      ? new Date(anioSalida, 11, 1)
      : new Date(anioSalida - 1, 11, 1); // 1 dic del año anterior
    const inicioAguinaldoEfectivo = fechaIngreso > inicioAguinaldo ? fechaIngreso : inicioAguinaldo;
    const mesesEnPeriodo = Math.max(0, Math.min(12,
      (fechaSalidaDate - inicioAguinaldoEfectivo) / (1000 * 60 * 60 * 24 * 30.44)));
    let sumaSalariosAguinaldo = 0;
    for (const p of periodosEmpleado) {
      const ini = p.inicio > inicioAguinaldoEfectivo ? p.inicio : inicioAguinaldoEfectivo;
      const f = p.fin < fechaSalidaDate ? p.fin : fechaSalidaDate;
      if (ini > f) continue;
      const diasSolap = Math.round((f - ini) / (1000 * 60 * 60 * 24)) + 1;
      sumaSalariosAguinaldo += p.ingresos * diasSolap / p.dias;
    }
    const aguinaldo_proporcional = periodosEmpleado.length > 0
      ? sumaSalariosAguinaldo / 12
      : (mesesEnPeriodo / 12) * salarioPromedio; // sin planillas: estimación proporcional

    // ---- SALARIO PENDIENTE ----
    // Días desde el fin del último período PAGADO hasta la fecha de salida.
    // Si la planilla que cubre la fecha de salida ya está pagada → 0 días.
    let diasSalarioPendiente = null;
    let ultimoPeriodoPagadoFin = null;
    try {
      const planillas = await base44.asServiceRole.entities.Planilla
        .filter({ empresa_id: empresa_id || emp.empresa_id }, '-fecha_calculo', 200);
      const planillasPagadas = planillas.filter(p => ['pagado', 'aprobado'].includes(p.estado));
      if (planillasPagadas.length > 0) {
        const periodoIds = [...new Set(planillasPagadas.map(p => p.periodo_id).filter(Boolean))];
        const periodos = (await Promise.all(
          periodoIds.map(pdid => base44.asServiceRole.entities.PeriodoPlanilla.get(pdid).catch(() => null))
        )).filter(Boolean);
        // Períodos pagados que cerraron en o antes de la fecha de salida
        const finesValidos = periodos
          .map(p => p.fecha_fin)
          .filter(f => f && new Date(f) <= fechaSalidaDate)
          .sort();
        if (finesValidos.length > 0) {
          ultimoPeriodoPagadoFin = finesValidos[finesValidos.length - 1];
          diasSalarioPendiente = Math.max(0, Math.round(
            (fechaSalidaDate - new Date(ultimoPeriodoPagadoFin)) / (1000 * 60 * 60 * 24)
          ));
        }
      }
    } catch { /* sin planillas pagadas: estimar por frecuencia */ }
    if (diasSalarioPendiente === null) {
      // Sin planillas pagadas registradas: estimación por frecuencia de pago
      const diaDelMes = fechaSalidaDate.getDate();
      if (emp.frecuencia_pago === 'quincenal') {
        diasSalarioPendiente = diaDelMes <= 15 ? diaDelMes : diaDelMes - 15;
      } else if (emp.frecuencia_pago === 'semanal') {
        diasSalarioPendiente = ((fechaSalidaDate.getDay() + 6) % 7) + 1;
      } else {
        diasSalarioPendiente = diaDelMes;
      }
    }
    const salario_pendiente = salarioDiario * diasSalarioPendiente;

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
        salario_promedio: salarioPromedio,
        preaviso: Math.round(preaviso),
        cesantia: Math.round(cesantia),
        vacaciones_pendientes: Math.round(vacaciones_pendientes),
        dias_vacaciones_pendientes: Math.round(vacacionesDias * 100) / 100,
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
          preaviso_opcion: preaviso_opcion || 'pagar',
          dias_preaviso_pagados: Math.round(preaviso / salarioDiario),
          salario_diario: Math.round(salarioDiario),
          meses_aguinaldo: Math.round(mesesEnPeriodo * 100) / 100,
          dias_vacaciones_devengadas: Math.round(diasVacacionesDevengadas * 100) / 100,
          dias_vacaciones_tomados: diasTomados,
          dias_salario_pendiente: diasSalarioPendiente,
          ultimo_periodo_pagado: ultimoPeriodoPagadoFin,
          meses_completos_promedio: mesesCompletos,
          salarios_aguinaldo: Math.round(sumaSalariosAguinaldo),
          fuente_salario: mesesCompletos > 0
            ? `promedio de ${mesesCompletos} mes(es) completo(s) de planilla (últimos 6 meses)`
            : 'salario base del empleado (sin planillas previas)',
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});