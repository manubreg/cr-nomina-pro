import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresaContext } from '@/components/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Loader2, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportesLegales() {
  const { empresaId } = useEmpresaContext();
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth);
  const [fechaFin, setFechaFin] = useState(today);

  const rangoValido = fechaInicio && fechaFin && fechaInicio <= fechaFin;

  const generarCCSS = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generarReporteCCSS', {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        empresa_id: empresaId,
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReporteCCSS_${fechaInicio}_${fechaFin}.xlsx`;
      a.click();
    },
    onSuccess: () => toast.success('Reporte CCSS descargado'),
    onError: (err) => toast.error(err.message),
  });

  const generarINS = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generarReporteINS', {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        empresa_id: empresaId,
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReporteINS_${fechaInicio}_${fechaFin}.xlsx`;
      a.click();
    },
    onSuccess: () => toast.success('Reporte INS descargado'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Reportes Legales</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-600" />
            Rango de Fechas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium text-gray-700">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium text-gray-700">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!rangoValido && fechaInicio && fechaFin && (
              <p className="text-xs text-red-500">La fecha inicio debe ser menor o igual a la fecha fin.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold mt-8 mb-4">Reportes de Gobierno</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporte CCSS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Reporte CCSS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Genera el reporte de aportes a la Caja de Seguro Social (CCSS) con salarios base, aportaciones de empleado y patrono.
            </p>
            <Button
              onClick={() => generarCCSS.mutate()}
              disabled={!rangoValido || generarCCSS.isPending}
              className="w-full gap-2"
            >
              {generarCCSS.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Reporte INS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Reporte INS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Genera el reporte de riesgos ocupacionales e incapacidades para el Instituto Nacional de Seguros (INS).
            </p>
            <Button
              onClick={() => generarINS.mutate()}
              disabled={!rangoValido || generarINS.isPending}
              className="w-full gap-2"
            >
              {generarINS.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Reportes de Retenciones</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporte ISR */}
        <ReporteRetenciones 
          titulo="Retenciones ISR"
          descripcion="Retenciones de Impuesto sobre la Renta por empleado."
          color="text-red-600"
          funcionName="generarReporteISR"
          fechaInicio={fechaInicio} fechaFin={fechaFin} rangoValido={rangoValido}
          empresa_id={empresaId}
        />
        <ReporteRetenciones 
          titulo="Embargos y Pensiones"
          descripcion="Embargos judiciales y retenciones por pensiones."
          color="text-orange-600"
          funcionName="generarReporteEmbargos"
          fechaInicio={fechaInicio} fechaFin={fechaFin} rangoValido={rangoValido}
          empresa_id={empresaId}
        />
        <ReporteRetenciones 
          titulo="Asociación Solidarista"
          descripcion="Aportes a asociación solidarista del empleado."
          color="text-purple-600"
          funcionName="generarReporteSolidarista"
          fechaInicio={fechaInicio} fechaFin={fechaFin} rangoValido={rangoValido}
          empresa_id={empresaId}
        />
        <ReporteRetenciones 
          titulo="Otras Deducciones"
          descripcion="Deducciones varias no clasificadas en otras categorías."
          color="text-gray-600"
          funcionName="generarReporteOtrasDeducciones"
          fechaInicio={fechaInicio} fechaFin={fechaFin} rangoValido={rangoValido}
          empresa_id={empresaId}
        />
        <ReporteRetenciones 
          titulo="Retenciones Banco Popular"
          descripcion="Retenciones del Banco Popular por seguro y servicios bancarios."
          color="text-blue-600"
          funcionName="generarReporteBancoPopular"
          fechaInicio={fechaInicio} fechaFin={fechaFin} rangoValido={rangoValido}
          empresa_id={empresaId}
        />
      </div>
    </div>
  );
}

function ReporteRetenciones({ titulo, descripcion, color, colorBg, funcionName, selectedPeriodo, empresa_id }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke(funcionName, {
        periodo_id: selectedPeriodo,
        empresa_id,
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${funcionName}_${selectedPeriodo}.xlsx`;
      a.click();
    },
    onSuccess: () => toast.success('Reporte descargado'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className={`w-5 h-5 ${color}`} />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{descripcion}</p>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!selectedPeriodo || mutation.isPending}
          className="w-full gap-2"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Descargar Excel
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}