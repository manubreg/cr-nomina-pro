import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, Download } from "lucide-react";

export default function ReporteActualizacionMensual() {
  const { empresaId } = useEmpresaContext();
  const qc = useQueryClient();
  const [ejecutando, setEjecutando] = useState(false);
  const [ultimaEjecucion, setUltimaEjecucion] = useState(null);

  const { data: reportes = [] } = useQuery({
    queryKey: ["reportes-actualizacion"],
    queryFn: () => base44.entities.ReporteActualizacionMensual?.list?.() || [],
    enabled: false
  });

  const ejecutar = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke("actualizarMensual", {});
      return res.data;
    },
    onSuccess: (data) => {
      setUltimaEjecucion(data);
      setEjecutando(false);
      qc.invalidateQueries({ queryKey: ["reportes-actualizacion"] });
    },
    onError: () => setEjecutando(false)
  });

  const handleEjecutar = () => {
    setEjecutando(true);
    ejecutar.mutate();
  };

  const formatCurrency = (valor, moneda = "CRC") => {
    if (!valor && valor !== 0) return "-";
    return moneda === "USD" 
      ? `$${Number(valor).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `₡${Number(valor).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Actualización Mensual</h1>
            <p className="text-gray-500 mt-1">Vacaciones, aguinaldo, preaviso y cesantía</p>
          </div>
          <Button 
            onClick={handleEjecutar} 
            disabled={ejecutando}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {ejecutando ? "Ejecutando..." : "Ejecutar Ahora"}
          </Button>
        </div>

        {/* Resumen de última ejecución */}
        {ultimaEjecucion && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Empleados Procesados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{ultimaEjecucion.resumen?.empleados_procesados || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Vacaciones Actualizadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{ultimaEjecucion.resumen?.vacaciones_actualizadas || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Aguinaldos Calculados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">{ultimaEjecucion.resumen?.aguinaldos_calculados || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Estimaciones Generadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{ultimaEjecucion.resumen?.estimaciones_generadas || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs de reportes */}
        {ultimaEjecucion && (
          <Tabs defaultValue="vacaciones" className="bg-white rounded-lg">
            <TabsList className="w-full justify-start border-b rounded-none bg-white p-0">
              <TabsTrigger value="vacaciones">Vacaciones</TabsTrigger>
              <TabsTrigger value="aguinaldo">Aguinaldo</TabsTrigger>
              <TabsTrigger value="estimaciones">Preaviso & Cesantía</TabsTrigger>
            </TabsList>

            {/* Vacaciones */}
            <TabsContent value="vacaciones">
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Empleado</th>
                        <th className="px-4 py-2 text-right font-semibold">Días Acumulados</th>
                        <th className="px-4 py-2 text-center font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimaEjecucion.resultados?.vacaciones?.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{item.nombre}</td>
                          <td className="px-4 py-3 text-right font-semibold">{item.dias_acumulados?.toFixed(1)} días</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className="bg-green-100 text-green-800">Actualizado</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Aguinaldo */}
            <TabsContent value="aguinaldo">
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Empleado</th>
                        <th className="px-4 py-2 text-right font-semibold">Monto Acumulado</th>
                        <th className="px-4 py-2 text-center font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimaEjecucion.resultados?.aguinaldo?.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{item.nombre}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.monto_aguinaldo)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className="bg-purple-100 text-purple-800">Calculado</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Estimaciones */}
            <TabsContent value="estimaciones">
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Empleado</th>
                        <th className="px-4 py-2 text-center font-semibold">Meses</th>
                        <th className="px-4 py-2 text-right font-semibold">Preaviso</th>
                        <th className="px-4 py-2 text-right font-semibold">Cesantía</th>
                        <th className="px-4 py-2 text-right font-semibold">Total Obligaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimaEjecucion.resultados?.estimaciones?.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{item.nombre}</td>
                          <td className="px-4 py-3 text-center">{item.meses_trabajados}</td>
                          <td className="px-4 py-3 text-right">
                            <div>{formatCurrency(item.monto_previo)}</div>
                            <div className="text-xs text-gray-500">{item.dias_previo?.toFixed(1)} días</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div>{formatCurrency(item.monto_cesantia)}</div>
                            <div className="text-xs text-gray-500">{item.dias_cesantia?.toFixed(1)} días</div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.total_obligaciones)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Estado cuando no hay ejecución */}
        {!ultimaEjecucion && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No hay ejecuciones realizadas aún</p>
              <p className="text-gray-400 text-sm mt-1">Haz clic en "Ejecutar Ahora" para procesar la actualización mensual</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}