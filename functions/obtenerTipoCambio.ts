import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Función helper que retorna el tipo de cambio (compra/venta USD) vigente para una fecha dada.
 * Si la fecha es sábado o domingo, retrocede al viernes anterior.
 * Busca primero en los ParametroLegal tipo "tipo_cambio". 
 * Si no existe en BD, consulta directamente el WS del BCCR.
 *
 * Parámetros: { fecha } (YYYY-MM-DD, default = hoy)
 * Retorna: { fecha, compra, venta, fuente }
 */

const BCCR_WS = "https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML";

function viernessAnteriorSiFinDeSemana(dateObj) {
  const dow = dateObj.getUTCDay(); // 0=Dom, 6=Sab
  if (dow === 0) { // domingo → viernes anterior
    const d = new Date(dateObj);
    d.setUTCDate(d.getUTCDate() - 2);
    return d;
  }
  if (dow === 6) { // sábado → viernes anterior
    const d = new Date(dateObj);
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  return dateObj;
}

async function fetchBCCR(codigo, fecha, email, token) {
  const d = fecha;
  const fechaStr = `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
  const params = new URLSearchParams({
    Indicador: codigo,
    FechaInicio: fechaStr,
    FechaFinal: fechaStr,
    Nombre: "CRNominaPro",
    SubNiveles: "N",
    CorreoElectronico: email,
    Token: token,
  });
  const res = await fetch(`${BCCR_WS}?${params.toString()}`);
  const text = await res.text();
  // El BCCR devuelve el XML dentro de un string HTML-encoded, hay que decodificarlo
  const decoded = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const match = decoded.match(/<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const fechaInput = body.fecha || new Date().toISOString().split("T")[0];

    // Construir fecha y ajustar si es fin de semana
    let fechaDate = new Date(fechaInput + "T12:00:00Z");
    fechaDate = viernessAnteriorSiFinDeSemana(fechaDate);
    const fechaISO = fechaDate.toISOString().split("T")[0];

    // 1. Buscar en BD (ParametroLegal tipo_cambio para esa fecha)
    const params = await base44.asServiceRole.entities.ParametroLegal.filter({
      tipo: "tipo_cambio",
      fecha_inicio_vigencia: fechaISO,
    });

    if (params && params.length > 0) {
      const datos = JSON.parse(params[0].datos_json || "{}");
      if (datos.compra || datos.venta) {
        return Response.json({
          fecha: fechaISO,
          compra: datos.compra,
          venta: datos.venta,
          fuente: "bd",
        });
      }
    }

    // 2. No está en BD → consultar BCCR en tiempo real
    const email = Deno.env.get("BCCR_EMAIL");
    const token = Deno.env.get("BCCR_TOKEN");

    if (!email || !token) {
      return Response.json({ error: "No hay credenciales BCCR configuradas" }, { status: 500 });
    }

    // Intentar hasta 7 días atrás (para cubrir feriados prolongados)
    let intentoDate = new Date(fechaDate);
    let compra = null;
    let venta = null;
    let fechaEncontrada = fechaISO;

    for (let i = 0; i < 7; i++) {
      // Saltar fines de semana al retroceder
      intentoDate = viernessAnteriorSiFinDeSemana(intentoDate);
      const [c, v] = await Promise.all([
        fetchBCCR("317", intentoDate, email, token),
        fetchBCCR("318", intentoDate, email, token),
      ]);
      if (c || v) {
        compra = c;
        venta = v;
        fechaEncontrada = intentoDate.toISOString().split("T")[0];
        break;
      }
      // Retroceder un día más
      intentoDate.setUTCDate(intentoDate.getUTCDate() - 1);
    }

    if (!compra && !venta) {
      return Response.json({ error: `No se encontró tipo de cambio para ${fechaISO}` }, { status: 404 });
    }

    return Response.json({
      fecha: fechaEncontrada,
      compra,
      venta,
      fuente: "bccr_live",
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});