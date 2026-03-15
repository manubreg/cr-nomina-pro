import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BCCR_WS = "https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML";

async function fetchIndicador(codigo, fecha, email, token) {
  const fechaStr = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}/${fecha.getFullYear()}`;
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
  // El XML viene como string dentro de otro XML, hay que extraer el valor
  const match = text.match(/<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const email = Deno.env.get("BCCR_EMAIL");
    const token = Deno.env.get("BCCR_TOKEN");

    if (!email || !token) {
      return Response.json({ error: "Faltan credenciales BCCR (BCCR_EMAIL, BCCR_TOKEN)" }, { status: 500 });
    }

    const hoy = new Date();
    const fechaISO = hoy.toISOString().split("T")[0]; // YYYY-MM-DD

    // Código 317 = compra, 318 = venta (USD)
    const [compra, venta] = await Promise.all([
      fetchIndicador("317", hoy, email, token),
      fetchIndicador("318", hoy, email, token),
    ]);

    if (!compra && !venta) {
      return Response.json({ error: "No se obtuvo tipo de cambio del BCCR para hoy. Puede ser fin de semana o feriado." }, { status: 404 });
    }

    const datos_json = JSON.stringify({ moneda: "USD", compra: compra || null, venta: venta || null });

    // Verificar si ya existe un registro para hoy
    const existentes = await base44.asServiceRole.entities.ParametroLegal.filter({
      tipo: "tipo_cambio",
      fecha_inicio_vigencia: fechaISO,
    });

    let resultado;
    if (existentes.length > 0) {
      // Actualizar el existente
      resultado = await base44.asServiceRole.entities.ParametroLegal.update(existentes[0].id, {
        datos_json,
        nombre: `Tipo de Cambio BCCR ${fechaISO}`,
        estado: "vigente",
        version: new Date().toISOString(),
      });
      return Response.json({ accion: "actualizado", id: resultado.id, compra, venta, fecha: fechaISO });
    } else {
      // Crear nuevo
      resultado = await base44.asServiceRole.entities.ParametroLegal.create({
        tipo: "tipo_cambio",
        nombre: `Tipo de Cambio BCCR ${fechaISO}`,
        version: "auto",
        datos_json,
        fecha_inicio_vigencia: fechaISO,
        estado: "vigente",
        observacion: "Generado automáticamente desde el Web Service del BCCR",
      });
      return Response.json({ accion: "creado", id: resultado.id, compra, venta, fecha: fechaISO });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});