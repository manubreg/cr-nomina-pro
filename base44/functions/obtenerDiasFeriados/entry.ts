import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Te solicito información sobre los días feriados en Costa Rica según la ley laboral vigente.
      
      Para cada día feriado, proporciona:
      1. Nombre del día
      2. Fecha (mes y día, sin año)
      3. Si es pago obligatorio (sí/no)
      4. Si el trabajador labora ese día, qué recargo aplica (ej: 100%, 150%, 200%)
      5. Observaciones legales relevantes
      
      Enfócate en los días feriados definidos en el Código de Trabajo de Costa Rica y leyes complementarias.
      Devuelve la información en formato JSON estructurado.`,
      response_json_schema: {
        type: "object",
        properties: {
          dias_feriados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                mes: { type: "number" },
                dia: { type: "number" },
                pago_obligatorio: { type: "boolean" },
                recargo_porcentaje: { type: "number" },
                se_trabaja_que_ocurre: { type: "string" },
                observaciones: { type: "string" }
              }
            }
          },
          nota_legal: { type: "string" }
        }
      }
    });

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});