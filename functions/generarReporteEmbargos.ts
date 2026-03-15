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

    const [periodo, empresa, empleados] = await Promise.all([
      base44.asServiceRole.entities.PeriodoPlanilla.filter({ id: periodo_id }),
      base44.asServiceRole.entities.Empresa.filter({ id: empresa_id }),
      base44.asServiceRole.entities.Empleado.filter({ empresa_id, estado: 'activo' }),
    ]);

    if (!periodo.length || !empresa.length) {
      return Response.json({ error: 'Período o empresa no encontrados' }, { status: 404 });
    }

    const periodoData = periodo[0];
    const empresaData = empresa[0];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Embargos');

    ws.columns = [
      { header: 'Cédula Empleado', key: 'cedula', width: 15 },
      { header: 'Nombre Empleado', key: 'nombre', width: 30 },
      { header: 'Tipo Embargo', key: 'tipo', width: 18 },
      { header: 'Descripción', key: 'descripcion', width: 30 },
      { header: 'Monto Embargo', key: 'monto', width: 15 },
      { header: 'Acreedor/Institución', key: 'acreedor', width: 25 },
      { header: 'Número Expediente', key: 'expediente', width: 18 },
    ];

    empleados.forEach(emp => {
      ws.addRow({
        cedula: emp.identificacion,
        nombre: `${emp.nombre} ${emp.apellidos}`,
        tipo: 'Pensión',
        descripcion: 'Por definir',
        monto: 0,
        acreedor: 'Por definir',
        expediente: '-',
      });
    });

    ws.getRow(1).font = { bold: true, bg: 'FFA500', color: 'FFFFFF' };
    ws.columns.forEach(col => {
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ReporteEmbargos_${empresaData.cedula_juridica}_${periodoData.fecha_inicio}.xlsx"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});