import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Obtener todos los empleados con contratos temporales
    const empleados = await base44.asServiceRole.entities.Empleado.filter({
      tipo_contrato: "temporal",
      estado: "activo"
    });

    const hoy = new Date();
    const alertasCreadas = [];

    for (const empleado of empleados) {
      if (!empleado.fecha_fin_contrato) continue;

      const fechaFin = new Date(empleado.fecha_fin_contrato);
      const diasRestantes = Math.floor((fechaFin - hoy) / (1000 * 60 * 60 * 24));

      // Crear alertas si faltan 45, 30 o 15 días
      if ([45, 30, 15].includes(diasRestantes)) {
        const tiempoTexto = diasRestantes === 45 ? "45 días" : diasRestantes === 30 ? "30 días" : "15 días";
        
        await base44.asServiceRole.entities.Notificacion.create({
          empresa_id: empleado.empresa_id,
          usuario_id: "",
          tipo: "contrato_vencer",
          titulo: `Vencimiento de Contrato: ${empleado.nombre} ${empleado.apellidos}`,
          mensaje: `El contrato temporal de ${empleado.nombre} ${empleado.apellidos} vencerá en ${tiempoTexto} (${empleado.fecha_fin_contrato})`,
          entidad_referencia: "Empleado",
          entidad_id: empleado.id,
          leida: false,
          fecha_hora: new Date().toISOString()
        });

        alertasCreadas.push({
          empleado: empleado.nombre,
          diasRestantes,
          fechaVencimiento: empleado.fecha_fin_contrato
        });
      }
    }

    return Response.json({
      success: true,
      alertasCreadas: alertasCreadas.length,
      detalles: alertasCreadas
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});