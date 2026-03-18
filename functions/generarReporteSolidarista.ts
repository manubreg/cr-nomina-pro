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

    const [periodo, empresa, planillas, empleados, parametros] = await Promise.all([
      base44.asServiceRole.entities.PeriodoPlanilla.filter({ id: periodo_id }),
      base44.asServiceRole.entities.Empresa.filter({ id: empresa_id }),
      base44.asServiceRole.entities.Planilla.filter({ periodo_id, empresa_id }),
      base44.asServiceRole.entities.Empleado.filter({ empresa_id }),
      base44.asServiceRole.entities.ParametroLegal.filter({ tipo: 'cuota_solidarista', empresa_id }),
    ]);

    if (!periodo.length || !empresa.length) {
      return Response.json({ error: 'Período o empresa no encontrados' }, { status: 404 });
    }

    const periodoData = periodo[0];
    const empresaData = empresa[0];
    const empleadosMap = new Map(empleados.map(e => [e.id, e]));
    const tarifaSolidarista = parametros.length > 0 
      ? JSON.parse(parametros[0].datos_json || '{}').porcentaje || 1 
      : 1;

    const detalles = planillas.length > 0 
      ? await base44.asServiceRole.entities.PlanillaDetalle.filter({ planilla_id: planillas[0].id })
      : [];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Solidarista');

    ws.columns = [
      { header: 'Cédula Empleado', key: 'cedula', width: 15 },
      { header: 'Nombre Empleado', key: 'nombre', width: 30 },
      { header: 'Salario Base', key: 'salario', width: 15 },
      { header: 'Tarifa Solidarista (%)', key: 'tarifa', width: 18 },
      { header: 'Aporte Empleado', key: 'aporte_empl', width: 15 },
      { header: 'Aporte Patrono', key: 'aporte_patr', width: 15 },
      { header: 'Total Mes', key: 'total', width: 15 },
    ];

    detalles.forEach(det => {
      const emp = empleadosMap.get(det.empleado_id);
      const aporteEmpl = Math.round((det.salario_base_periodo || 0) * (tarifaSolidarista / 100));
      const aportePatr = Math.round((det.salario_base_periodo || 0) * (tarifaSolidarista / 100));
      
      ws.addRow({
        cedula: emp?.identificacion || '-',
        nombre: emp ? `${emp.nombre} ${emp.apellidos}` : '-',
        salario: det.salario_base_periodo || 0,
        tarifa: tarifaSolidarista,
        aporte_empl: aporteEmpl,
        aporte_patr: aportePatr,
        total: aporteEmpl + aportePatr,
      });
    });

    ws.getRow(1).font = { bold: true, bg: '9B59B6', color: 'FFFFFF' };
    ws.columns.forEach(col => {
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ReporteSolidarista_${empresaData.cedula_juridica}_${periodoData.fecha_inicio}.xlsx"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});