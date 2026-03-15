import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { periodo_id, empresa_id } = body;

    if (!periodo_id || !empresa_id) {
      return Response.json({ error: 'Faltan parámetros: periodo_id, empresa_id' }, { status: 400 });
    }

    const [periodo, empresa, planillas, empleados] = await Promise.all([
      base44.asServiceRole.entities.PeriodoPlanilla.filter({ id: periodo_id }),
      base44.asServiceRole.entities.Empresa.filter({ id: empresa_id }),
      base44.asServiceRole.entities.Planilla.filter({ periodo_id, empresa_id }),
      base44.asServiceRole.entities.Empleado.filter({ empresa_id }),
    ]);

    if (!periodo.length || !empresa.length) {
      return Response.json({ error: 'Período o empresa no encontrados' }, { status: 404 });
    }

    const periodoData = periodo[0];
    const empresaData = empresa[0];
    const empleadosMap = new Map(empleados.map(e => [e.id, e]));

    const detalles = planillas.length > 0 
      ? await base44.asServiceRole.entities.PlanillaDetalle.filter({ planilla_id: planillas[0].id })
      : [];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Banco Popular');

    ws.columns = [
      { header: 'Cédula Empleado', key: 'cedula', width: 15 },
      { header: 'Nombre Empleado', key: 'nombre', width: 30 },
      { header: 'Cuenta Bancaria', key: 'cuenta', width: 18 },
      { header: 'Tarifa (%)', key: 'tarifa', width: 12 },
      { header: 'Base de Cálculo', key: 'base', width: 15 },
      { header: 'Retención BP', key: 'retencion', width: 15 },
      { header: 'Estado', key: 'estado', width: 12 },
    ];

    detalles.forEach(det => {
      const emp = empleadosMap.get(det.empleado_id);
      const retencion = Math.round((det.base_ccss || 0) * 0.01);
      
      ws.addRow({
        cedula: emp?.identificacion || '-',
        nombre: emp ? `${emp.nombre} ${emp.apellidos}` : '-',
        cuenta: emp?.cuenta_bancaria || 'Sin cuenta',
        tarifa: 1.0,
        base: det.base_ccss || 0,
        retencion,
        estado: retencion > 0 ? 'Procesado' : 'N/A',
      });
    });

    ws.getRow(1).font = { bold: true, bg: '0066CC', color: 'FFFFFF' };
    ws.columns.forEach(col => {
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ReporteBancoPopular_${empresaData.cedula_juridica}_${periodoData.fecha_inicio}.xlsx"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});