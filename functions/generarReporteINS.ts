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

    // Obtener datos
    const [periodo, empresa, empleados, incapacidades] = await Promise.all([
      base44.asServiceRole.entities.PeriodoPlanilla.filter({ id: periodo_id }),
      base44.asServiceRole.entities.Empresa.filter({ id: empresa_id }),
      base44.asServiceRole.entities.Empleado.filter({ empresa_id, estado: 'activo' }),
      base44.asServiceRole.entities.Incapacidad.filter({ empresa_id, estado: 'activa' }),
    ]);

    if (!periodo.length || !empresa.length) {
      return Response.json({ error: 'Período o empresa no encontrados' }, { status: 404 });
    }

    const periodoData = periodo[0];
    const empresaData = empresa[0];
    const incapacidadesMap = new Map();
    
    incapacidades.forEach(inc => {
      if (!incapacidadesMap.has(inc.empleado_id)) {
        incapacidadesMap.set(inc.empleado_id, []);
      }
      incapacidadesMap.get(inc.empleado_id).push(inc);
    });

    // Crear Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('INS');

    // Encabezados
    ws.columns = [
      { header: 'Código Empresa', key: 'codigo_empresa', width: 15 },
      { header: 'Empresa', key: 'nombre_empresa', width: 30 },
      { header: 'Período', key: 'periodo', width: 12 },
      { header: 'Cédula Empleado', key: 'cedula', width: 15 },
      { header: 'Nombre Empleado', key: 'nombre', width: 30 },
      { header: 'Puesto', key: 'puesto', width: 25 },
      { header: 'Tipo Jornada', key: 'jornada', width: 12 },
      { header: 'Horas Mes', key: 'horas_mes', width: 12 },
      { header: 'Riesgo Ocupacional', key: 'riesgo', width: 18 },
      { header: 'Incapacidades Activas', key: 'incapacidades', width: 20 },
    ];

    // Datos
    empleados.forEach(emp => {
      const incs = incapacidadesMap.get(emp.id) || [];
      const descIncs = incs.map(i => `${i.tipo_incapacidad} (${i.dias} días)`).join('; ');
      
      ws.addRow({
        codigo_empresa: empresaData.cedula_juridica,
        nombre_empresa: empresaData.nombre_comercial || empresaData.nombre_legal,
        periodo: `${periodoData.fecha_inicio} a ${periodoData.fecha_fin}`,
        cedula: emp.identificacion,
        nombre: `${emp.nombre} ${emp.apellidos}`,
        puesto: emp.puesto || '-',
        jornada: emp.tipo_jornada || 'diurna',
        horas_mes: (emp.horas_jornada || 8) * 22,
        riesgo: 'No clasificado',
        incapacidades: descIncs || 'Ninguna',
      });
    });

    // Estilos
    ws.getRow(1).font = { bold: true, bg: '70AD47', color: 'FFFFFF' };
    ws.columns.forEach(col => {
      col.alignment = { horizontal: 'center', vertical: 'center' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ReporteINS_${empresaData.cedula_juridica}_${periodoData.fecha_inicio}.xlsx"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});