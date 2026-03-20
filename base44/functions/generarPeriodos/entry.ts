import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Genera periodos de planilla automáticamente para todas las empresas activas.
 * Detecta el tipo de periodo por empresa (basado en sus periodos previos).
 * Respeta feriados nacionales de Costa Rica y calcula fecha_pago hábil.
 *
 * Puede llamarse manualmente con body { empresa_id?, tipo_periodo? }
 * o ejecutarse desde una automatización programada sin payload.
 */

// Feriados nacionales de Costa Rica (mes 1-indexed, dia)
const FERIADOS_CR = [
  { mes: 1,  dia: 1  }, // Año Nuevo
  { mes: 4,  dia: 11 }, // Gesta Heroica Juan Santamaría
  { mes: 5,  dia: 1  }, // Día del Trabajador
  { mes: 7,  dia: 25 }, // Anexión de Guanacaste
  { mes: 8,  dia: 2  }, // Virgen de los Ángeles
  { mes: 8,  dia: 15 }, // Día de la Madre
  { mes: 9,  dia: 15 }, // Independencia
  { mes: 12, dia: 25 }, // Navidad
];

function esFeriado(date) {
  const mes = date.getMonth() + 1;
  const dia = date.getDate();
  return FERIADOS_CR.some(f => f.mes === mes && f.dia === dia);
}

function esDiaHabil(date) {
  const dow = date.getDay(); // 0=Dom, 6=Sab
  return dow !== 0 && dow !== 6 && !esFeriado(date);
}

// Retorna la siguiente fecha hábil (incluyendo la misma si ya es hábil)
function siguienteDiaHabil(date) {
  const d = new Date(date);
  while (!esDiaHabil(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Suma N días hábiles a una fecha
function sumarDiasHabiles(date, n) {
  let d = new Date(date);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (esDiaHabil(d)) count++;
  }
  return d;
}

function toISO(date) {
  return date.toISOString().split("T")[0];
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0);
}

/**
 * Dado el tipo_periodo y la fecha_fin del último periodo,
 * calcula { fecha_inicio, fecha_fin, fecha_pago } del siguiente.
 */
function calcularSiguientePeriodo(tipo, ultimaFechaFin) {
  const base = new Date(ultimaFechaFin);
  base.setDate(base.getDate() + 1); // día siguiente al último fin
  const inicio = new Date(base);

  let fin;
  let diasPago = 3; // días hábiles después del fin para calcular fecha_pago

  switch (tipo) {
    case "mensual": {
      // Inicio: día 1 del mes siguiente; fin: último día de ese mes
      const year = inicio.getFullYear();
      const month = inicio.getMonth();
      fin = lastDayOfMonth(year, month);
      diasPago = 5;
      break;
    }
    case "quincenal": {
      // Costa Rica: 1-15 / 16-último día del mes
      const d = inicio.getDate();
      if (d === 1) {
        fin = new Date(inicio.getFullYear(), inicio.getMonth(), 15);
      } else {
        // día 16
        fin = lastDayOfMonth(inicio.getFullYear(), inicio.getMonth());
      }
      diasPago = 3;
      break;
    }
    case "semanal": {
      // Lunes a domingo
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      diasPago = 2;
      break;
    }
    case "bisemanal": {
      // 14 días
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + 13);
      diasPago = 3;
      break;
    }
    default:
      return null;
  }

  // Fecha pago: N días hábiles después del fin del periodo
  const fechaPago = sumarDiasHabiles(fin, diasPago);

  return {
    fecha_inicio: toISO(inicio),
    fecha_fin: toISO(fin),
    fecha_pago: toISO(fechaPago),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Parámetros opcionales del body
    let params = {};
    try { params = await req.json(); } catch (_) { /* sin body */ }

    const { empresa_id: filterEmpresaId, tipo_periodo: filterTipo } = params;

    // 1. Obtener empresas activas
    let empresas = await base44.asServiceRole.entities.Empresa.list();
    empresas = empresas.filter(e => e.estado === "activa");
    if (filterEmpresaId) {
      empresas = empresas.filter(e => e.id === filterEmpresaId);
    }

    if (empresas.length === 0) {
      return Response.json({ mensaje: "No hay empresas activas", creados: 0 });
    }

    // 2. Para cada empresa, obtener el último periodo y generar el siguiente
    const creados = [];
    const omitidos = [];
    const errores = [];

    for (const empresa of empresas) {
      // Obtener periodos de esta empresa ordenados por fecha_fin desc
      let periodos = await base44.asServiceRole.entities.PeriodoPlanilla.filter(
        { empresa_id: empresa.id }
      );

      // Determinar qué tipos procesar para esta empresa
      const tiposUsados = filterTipo
        ? [filterTipo]
        : [...new Set(periodos.map(p => p.tipo_periodo).filter(t =>
            ["mensual", "quincenal", "semanal", "bisemanal"].includes(t)
          ))];

      if (tiposUsados.length === 0) {
        omitidos.push({ empresa: empresa.nombre_comercial || empresa.nombre_legal, razon: "Sin periodos previos y sin tipo especificado" });
        continue;
      }

      for (const tipo of tiposUsados) {
        // Último periodo de este tipo
        const ultimosPorTipo = periodos
          .filter(p => p.tipo_periodo === tipo && p.estado !== "anulado")
          .sort((a, b) => (b.fecha_fin > a.fecha_fin ? 1 : -1));

        if (ultimosPorTipo.length === 0) {
          omitidos.push({ empresa: empresa.nombre_comercial || empresa.nombre_legal, tipo, razon: "Sin periodo previo de este tipo" });
          continue;
        }

        const ultimo = ultimosPorTipo[0];
        const siguiente = calcularSiguientePeriodo(tipo, ultimo.fecha_fin);

        if (!siguiente) {
          omitidos.push({ empresa: empresa.nombre_comercial || empresa.nombre_legal, tipo, razon: "Tipo no soportado" });
          continue;
        }

        // Verificar que no exista ya un periodo para ese rango
        const yaExiste = periodos.some(p =>
          p.tipo_periodo === tipo &&
          p.fecha_inicio === siguiente.fecha_inicio &&
          p.estado !== "anulado"
        );

        if (yaExiste) {
          omitidos.push({ empresa: empresa.nombre_comercial || empresa.nombre_legal, tipo, razon: `Ya existe periodo ${siguiente.fecha_inicio}` });
          continue;
        }

        // Crear el nuevo periodo
        const nuevo = await base44.asServiceRole.entities.PeriodoPlanilla.create({
          empresa_id: empresa.id,
          tipo_periodo: tipo,
          fecha_inicio: siguiente.fecha_inicio,
          fecha_fin: siguiente.fecha_fin,
          fecha_pago: siguiente.fecha_pago,
          estado: "abierto",
          usuario_creacion: user.email,
          observaciones: `Generado automáticamente`,
        });

        creados.push({
          empresa: empresa.nombre_comercial || empresa.nombre_legal,
          tipo,
          fecha_inicio: siguiente.fecha_inicio,
          fecha_fin: siguiente.fecha_fin,
          fecha_pago: siguiente.fecha_pago,
        });
      }
    }

    return Response.json({
      mensaje: `Generación completada`,
      creados: creados.length,
      omitidos: omitidos.length,
      detalle_creados: creados,
      detalle_omitidos: omitidos,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});