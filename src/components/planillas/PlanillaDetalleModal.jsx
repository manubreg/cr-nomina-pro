import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, RefreshCw, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BoletaPagoGenerator, { generarBoletaPDF } from "./BoletaPagoGenerator";

const formatCRC = (v) => `₡${Number(v || 0).toLocaleString("es-CR")}`;

export default function PlanillaDetalleModal({ planilla, onClose }) {
  const [detalles, setDetalles]       = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [empleados, setEmpleados]     = useState([]);
  const [empresa, setEmpresa]         = useState(null);
  const [periodo, setPeriodo]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [generandoTodas, setGenerandoTodas]   = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.PlanillaDetalle.list(),
      base44.entities.MovimientoPlanilla.list(),
      base44.entities.Empleado.list(),
      base44.entities.Empresa.list(),
      base44.entities.PeriodoPlanilla.list(),
    ]).then(([dets, movs, emps, emps2, periodos]) => {
      setDetalles(dets.filter(d => d.planilla_id === planilla.id));
      setMovimientos(movs.filter(m => m.planilla_id === planilla.id));
      setEmpleados(emps);
      setEmpresa(emps2.find(e => e.id === planilla.empresa_id) || null);
      setPeriodo(periodos.find(p => p.id === planilla.periodo_id) || null);
      setLoading(false);
    });
  }, [planilla.id]);

  const movsDe = (detalleId) => movimientos.filter(m => m.planilla_detalle_id === detalleId);

  // Descargar todas las boletas en PDF una por una
  const handleDescargarTodas = async () => {
    const { generarBoletaPDF } = await import("./BoletaPagoGenerator");
    setGenerandoTodas(true);
    for (const det of detalles) {
      const emp  = empleados.find(e => e.id === det.empleado_id);
      const movs = movsDe(det.id);
      await generarBoletaPDF(empresa, emp, periodo, det, movs);
      await new Promise(r => setTimeout(r, 300)); // pequeño delay entre descargas
    }
    setGenerandoTodas(false);
  };

  const selectedEmp = selectedDetalle ? empleados.find(e => e.id === selectedDetalle.empleado_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detalle de Planilla</h2>
            <p className="text-xs text-gray-500">{planilla.codigo_planilla} · {planilla.tipo_planilla}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Botón descargar todas */}
            {!loading && detalles.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDescargarTodas}
                disabled={generandoTodas}
                className="h-8 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {generandoTodas
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />
                }
                {generandoTodas ? "Generando..." : "Todas las boletas"}
              </Button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-6 py-4">
            <div className="text-xl font-bold text-gray-800">{formatCRC(planilla.total_ingresos)}</div>
            <div className="text-xs text-gray-500">Total Bruto</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xl font-bold text-red-600">{formatCRC(planilla.total_deducciones)}</div>
            <div className="text-xs text-gray-500">Deducciones</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xl font-bold text-blue-700">{formatCRC(planilla.total_neto)}</div>
            <div className="text-xs text-gray-500">Neto a Pagar</div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Lista empleados */}
          <div className="w-72 border-r border-gray-100 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              </div>
            ) : detalles.map(d => {
              const emp = empleados.find(e => e.id === d.empleado_id);
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDetalle(d)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedDetalle?.id === d.id ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {emp?.nombre?.[0]}{emp?.apellidos?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {emp ? `${emp.nombre} ${emp.apellidos}` : d.empleado_id}
                      </div>
                      <div className="text-xs text-blue-700 font-medium">{formatCRC(d.neto_pagar)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalle empleado */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedDetalle ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Seleccione un empleado para ver el detalle
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumen + botones boleta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {[
                      { label: "Salario Base",     val: selectedDetalle.salario_base_periodo },
                      { label: "Ingresos Totales", val: selectedDetalle.ingresos_totales },
                      { label: "Deducciones",      val: selectedDetalle.deducciones_totales },
                      { label: "Neto a Pagar",     val: selectedDetalle.neto_pagar, highlight: true },
                    ].map(item => (
                      <div key={item.label} className={`rounded-lg p-3 ${item.highlight ? "bg-blue-50 border border-blue-100" : "bg-gray-50"}`}>
                        <div className="text-xs text-gray-500">{item.label}</div>
                        <div className={`text-sm font-bold mt-0.5 ${item.highlight ? "text-blue-700" : "text-gray-800"}`}>
                          {formatCRC(item.val)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Botones descarga individual */}
                  <div className="flex flex-col gap-2 items-end">
                    <span className="text-xs text-gray-400 font-medium">Boleta individual</span>
                    <BoletaPagoGenerator
                      empresa={empresa}
                      empleado={selectedEmp}
                      periodo={periodo}
                      detalle={selectedDetalle}
                      movimientos={movsDe(selectedDetalle.id)}
                    />
                  </div>
                </div>

                {/* Ingresos */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Ingresos</h4>
                  <div className="space-y-1">
                    {movsDe(selectedDetalle.id).filter(m => m.tipo_movimiento === "ingreso").map(m => (
                      <div key={m.id} className="flex justify-between items-center text-sm py-2 px-3 bg-green-50 rounded-lg">
                        <span className="text-gray-700">{m.descripcion}</span>
                        <span className="font-medium text-green-700">{formatCRC(m.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deducciones */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Deducciones</h4>
                  <div className="space-y-1">
                    {movsDe(selectedDetalle.id).filter(m => m.tipo_movimiento === "deduccion").map(m => (
                      <div key={m.id} className="flex justify-between items-center text-sm py-2 px-3 bg-red-50 rounded-lg">
                        <div>
                          <span className="text-gray-700">{m.descripcion}</span>
                          {m.porcentaje > 0 && <span className="text-xs text-gray-400 ml-2">({m.porcentaje}%)</span>}
                        </div>
                        <span className="font-medium text-red-600">({formatCRC(m.monto)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}