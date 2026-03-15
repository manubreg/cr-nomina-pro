import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresaContext } from '@/components/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportesLegales() {
  const { empresaId } = useEmpresaContext();
  const [selectedPeriodo, setSelectedPeriodo] = useState('');

  const { data: periodos = [] } = useQuery({
    queryKey: ['periodos', empresaId],
    queryFn: () => base44.entities.PeriodoPlanilla.filter({ empresa_id: empresaId }),
    enabled: !!empresaId,
  });

  const generarCCSS = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generarReporteCCSS', {
        periodo_id: selectedPeriodo,
        empresa_id: empresaId,
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReporteCCSS_${selectedPeriodo}.xlsx`;
      a.click();
    },
    onSuccess: () => toast.success('Reporte CCSS descargado'),
    onError: (err) => toast.error(err.message),
  });

  const generarINS = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generarReporteINS', {
        periodo_id: selectedPeriodo,
        empresa_id: empresaId,
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReporteINS_${selectedPeriodo}.xlsx`;
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
          <CardTitle>Seleccionar Período</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un período..." />
            </SelectTrigger>
            <SelectContent>
              {periodos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fecha_inicio} a {p.fecha_fin} ({p.tipo_periodo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              disabled={!selectedPeriodo || generarCCSS.isPending}
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
              disabled={!selectedPeriodo || generarINS.isPending}
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
          colorBg="bg-red-100"
          funcionName="generarReporteISR"
          selectedPeriodo={selectedPeriodo}
          empresa_id={empresaId}
        />

        {/* Reporte Embargos */}
        <ReporteRetenciones 
          titulo="Embargos y Pensiones"
          descripcion="Embargos judiciales y retenciones por pensiones."
          color="text-orange-600"
          colorBg="bg-orange-100"
          funcionName="generarReporteEmbargos"
          selectedPeriodo={selectedPeriodo}
          empresa_id={empresaId}
        />

        {/* Reporte Solidarista */}
        <ReporteRetenciones 
          titulo="Asociación Solidarista"
          descripcion="Aportes a asociación solidarista del empleado."
          color="text-purple-600"
          colorBg="bg-purple-100"
          funcionName="generarReporteSolidarista"
          selectedPeriodo={selectedPeriodo}
          empresa_id={empresaId}
        />

        {/* Reporte Otras Deducciones */}
        <ReporteRetenciones 
          titulo="Otras Deducciones"
          descripcion="Deducciones varias no clasificadas en otras categorías."
          color="text-gray-600"
          colorBg="bg-gray-100"
          funcionName="generarReporteOtrasDeducciones"
          selectedPeriodo={selectedPeriodo}
          empresa_id={empresaId}
        />

        {/* Reporte Banco Popular */}
        <ReporteRetenciones 
          titulo="Retenciones Banco Popular"
          descripcion="Retenciones del Banco Popular por seguro y servicios bancarios."
          color="text-blue-600"
          colorBg="bg-blue-100"
          funcionName="generarReporteBancoPopular"
          selectedPeriodo={selectedPeriodo}
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