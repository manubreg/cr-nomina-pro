import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { Workbook } from 'npm:exceljs@4.4.0';

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

    // Obtener datos
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

    // Obtener detalles de planilla
    const detalles = planillas.length > 0 
      ? await base44.asServiceRole.entities.PlanillaDetalle.filter({ planilla_id: planillas[0].id })
      : [];

    // Crear Excel
    const wb = new Workbook();
    const ws = wb.addWorksheet('CCSS');

    // Encabezados
    ws.columns = [
      { header: 'Código Empresa', key: 'codigo_empresa', width: 15 },
      { header: 'Empresa', key: 'nombre_empresa', width: 30 },
      { header: 'Período', key: 'periodo', width: 12 },
      { header: 'Cédula Empleado', key: 'cedula', width: 15 },
      { header: 'Nombre Empleado', key: 'nombre', width: 30 },
      { header: 'Salario Base', key: 'salario_base', width: 15 },
      { header: 'Días Trabajados', key: 'dias', width: 15 },
      { header: 'Base CCSS', key: 'base_ccss', width: 15 },
      { header: 'Aporte Empleado (%)', key: 'aporte_empl', width: 15 },
      { header: 'Aporte Patrono (%)', key: 'aporte_patr', width: 15 },
    ];

    // Datos
    detalles.forEach(det => {
      const emp = empleadosMap.get(det.empleado_id);
      ws.addRow({
        codigo_empresa: empresaData.cedula_juridica,
        nombre_empresa: empresaData.nombre_comercial || empresaData.nombre_legal,
        periodo: `${periodoData.fecha_inicio} a ${periodoData.fecha_fin}`,
        cedula: emp?.identificacion || '-',
        nombre: emp ? `${emp.nombre} ${emp.apellidos}` : '-',
        salario_base: det.salario_base_periodo || 0,
        dias: 30,
        base_ccss: det.base_ccss || 0,
        aporte_empl: 9.34,
        aporte_patr: 14.33,
      });
    });

    // Estilos
    ws.getRow(1).font = { bold: true, bg: '4472C4', color: 'FFFFFF' };
    ws.columns.forEach(col => {
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ReporteCCSS_${empresaData.cedula_juridica}_${periodoData.fecha_inicio}.xlsx"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});