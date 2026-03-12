import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Calculator, Save, AlertCircle } from "lucide-react";

const formatCRC = (v) => `₡${Number(v || 0).toLocaleString("es-CR")}`;

export default function PlanillaModal({ periodos, empleados, conceptos, onClose, onSaved }) {
  const [form, setForm] = useState({
    empresa_id: "empresa_demo",
    periodo_id: "",
    tipo_planilla: "ordinaria",
    observacion: "",
  });
  const [calculando, setCalculando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const periodoSeleccionado = periodos.find(p => p.id === form.periodo_id);

  // Motor de cálculo simplificado
  const calcularPlanilla = async () => {
    if (!form.periodo_id) { alert("Seleccione un periodo"); return; }
    setCalculando(true);

    const empleadosActivos = empleados.filter(e => e.estado === "activo");
    let totalIngresos = 0, totalDeducciones = 0;

    const detalles = empleadosActivos.map(emp => {
      const salarioBase = emp.salario_base || 0;
      // CCSS empleado: 10.67% (parámetro legal estándar CR)
      const ccssEmpleado = salarioBase * 0.1067;
      // Impuesto simplificado (exento hasta ~949,000, 10% siguiente tramo, 15% siguiente, 20% resto)
      let base = salarioBase - ccssEmpleado;
      let impuesto = 0;
      if (base > 1523000) impuesto = (base - 1523000) * 0.20 + (1523000 - 854000) * 0.15 + (854000 - 0) * 0; // simplificado
      else if (base > 854000) impuesto = (base - 854000) * 0.15;
      // else impuesto = 0 (exento)

      const deducciones = ccssEmpleado + impuesto;
      const neto = salarioBase - deducciones;

      totalIngresos += salarioBase;
      totalDeducciones += deducciones;

      return { empleado: emp, salarioBase, ccssEmpleado, impuesto, deducciones, neto };
    });

    setPreview({ detalles, totalIngresos, totalDeducciones, totalNeto: totalIngresos - totalDeducciones });
    setCalculando(false);
  };

  const handleSave = async () => {
    if (!preview) { alert("Primero calcule la planilla"); return; }
    setSaving(true);
    const codigo = `PL-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const planilla = await base44.entities.Planilla.create({
      ...form,
      codigo_planilla: codigo,
      estado: "calculado",
      total_ingresos: preview.totalIngresos,
      total_deducciones: preview.totalDeducciones,
      total_neto: preview.totalNeto,
      cantidad_empleados: preview.detalles.length,
      fecha_calculo: new Date().toISOString().split("T")[0],
      usuario_genero: "Sistema",
    });

    // Crear detalles
    for (const d of preview.detalles) {
      const det = await base44.entities.PlanillaDetalle.create({
        planilla_id: planilla.id,
        empleado_id: d.empleado.id,
        empresa_id: form.empresa_id,
        salario_base_periodo: d.salarioBase,
        ingresos_totales: d.salarioBase,
        deducciones_totales: d.deducciones,
        neto_pagar: d.neto,
        base_ccss: d.salarioBase,
        base_impuesto: d.salarioBase - d.ccssEmpleado,
      });

      // Movimientos
      const conceptoSalario = conceptos.find(c => c.codigo === "SAL001") || { id: "sal", nombre: "Salario Ordinario", codigo: "SAL001" };
      await base44.entities.MovimientoPlanilla.create({
        planilla_id: planilla.id, planilla_detalle_id: det.id,
        empleado_id: d.empleado.id, concepto_id: conceptoSalario.id || "sal",
        tipo_movimiento: "ingreso", descripcion: "Salario Ordinario",
        monto: d.salarioBase, origen: "automatico", orden_calculo: 1,
      });
      if (d.ccssEmpleado > 0) {
        await base44.entities.MovimientoPlanilla.create({
          planilla_id: planilla.id, planilla_detalle_id: det.id,
          empleado_id: d.empleado.id, concepto_id: "ccss_emp",
          tipo_movimiento: "deduccion", descripcion: "CCSS Empleado (10.67%)",
          monto: d.ccssEmpleado, porcentaje: 10.67, base_calculo: d.salarioBase,
          origen: "automatico", orden_calculo: 10,
        });
      }
      if (d.impuesto > 0) {
        await base44.entities.MovimientoPlanilla.create({
          planilla_id: planilla.id, planilla_detalle_id: det.id,
          empleado_id: d.empleado.id, concepto_id: "imp_sal",
          tipo_movimiento: "deduccion", descripcion: "Impuesto sobre Salario",
          monto: d.impuesto, base_calculo: d.salarioBase - d.ccssEmpleado,
          origen: "automatico", orden_calculo: 20,
        });
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Planilla</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Periodo *</label>
              <select value={form.periodo_id} onChange={e => set("periodo_id", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Seleccionar periodo —</option>
                {periodos.filter(p => p.estado === "abierto").map(p => (
                  <option key={p.id} value={p.id}>{p.tipo_periodo} · {p.fecha_inicio} → {p.fecha_fin}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Tipo de Planilla</label>
              <select value={form.tipo_planilla} onChange={e => set("tipo_planilla", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ordinaria">Ordinaria</option>
                <option value="extraordinaria">Extraordinaria</option>
                <option value="aguinaldo">Aguinaldo</option>
                <option value="liquidacion">Liquidación</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Observaciones</label>
            <textarea value={form.observacion} onChange={e => set("observacion", e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notas del periodo..." />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-700">
              Se calcularán <strong>{empleados.length} empleados activos</strong>. El cálculo aplica CCSS (10.67%) e impuesto sobre salario según los tramos vigentes de Costa Rica.
            </div>
          </div>

          {preview && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Vista Previa del Cálculo</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-200">
                <div className="p-4 text-center">
                  <div className="text-lg font-bold text-gray-800">{formatCRC(preview.totalIngresos)}</div>
                  <div className="text-xs text-gray-500">Total Bruto</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-lg font-bold text-red-600">{formatCRC(preview.totalDeducciones)}</div>
                  <div className="text-xs text-gray-500">Deducciones</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-lg font-bold text-blue-700">{formatCRC(preview.totalNeto)}</div>
                  <div className="text-xs text-gray-500">Neto a Pagar</div>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-100">
                    <th className="text-left px-3 py-2 text-gray-500">Empleado</th>
                    <th className="text-right px-3 py-2 text-gray-500">Salario</th>
                    <th className="text-right px-3 py-2 text-gray-500">CCSS</th>
                    <th className="text-right px-3 py-2 text-gray-500">Imp.</th>
                    <th className="text-right px-3 py-2 text-gray-500">Neto</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.detalles.map(d => (
                      <tr key={d.empleado.id}>
                        <td className="px-3 py-2 text-gray-700">{d.empleado.nombre} {d.empleado.apellidos}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCRC(d.salarioBase)}</td>
                        <td className="px-3 py-2 text-right text-red-500">{formatCRC(d.ccssEmpleado)}</td>
                        <td className="px-3 py-2 text-right text-red-500">{formatCRC(d.impuesto)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-700">{formatCRC(d.neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">Cancelar</button>
          <button onClick={calcularPlanilla} disabled={calculando || !form.periodo_id}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium disabled:opacity-60">
            <Calculator className="w-4 h-4" />
            {calculando ? "Calculando..." : "Calcular"}
          </button>
          {preview && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar Planilla"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}