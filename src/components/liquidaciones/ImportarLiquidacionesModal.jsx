import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";

const motivos = ["renuncia","despido_sin_causa","despido_con_causa","mutuo_acuerdo","fin_contrato","fallecimiento","otro"];

export default function ImportarLiquidacionesModal({ open, onOpenChange, empresaId, empleados, onSuccess }) {
  const [preview, setPreview] = useState([]);
  const [errores, setErrores] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  const reset = () => { setPreview([]); setErrores([]); setResultado(null); if (fileRef.current) fileRef.current.value = ""; };

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["identificacion_empleado","fecha_salida","motivo_salida","salario_promedio","preaviso","cesantia","vacaciones_pendientes","aguinaldo_proporcional","salario_pendiente","deducciones_finales","observaciones"],
      ["123456789","2026-03-31","renuncia","750000","187500","0","25000","62500","0","0","Renuncia voluntaria"],
    ]);
    ws["!cols"] = Array(11).fill({ wch: 22 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liquidaciones");
    XLSX.writeFile(wb, "plantilla_liquidaciones.xlsx");
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const errs = [];
      const parsed = rows.map((row, i) => {
        const num = i + 2;
        const emp = empleados.find(e =>
          String(e.identificacion).trim() === String(row.identificacion_empleado).trim()
        );
        if (!emp) errs.push(`Fila ${num}: empleado con ID "${row.identificacion_empleado}" no encontrado.`);
        if (!row.fecha_salida) errs.push(`Fila ${num}: fecha_salida requerida.`);
        if (!motivos.includes(row.motivo_salida)) errs.push(`Fila ${num}: motivo_salida inválido ("${row.motivo_salida}"). Use: ${motivos.join(", ")}`);
        const preaviso = Number(row.preaviso) || 0;
        const cesantia = Number(row.cesantia) || 0;
        const vacaciones = Number(row.vacaciones_pendientes) || 0;
        const aguinaldo = Number(row.aguinaldo_proporcional) || 0;
        const salPendiente = Number(row.salario_pendiente) || 0;
        const deducciones = Number(row.deducciones_finales) || 0;
        const total = preaviso + cesantia + vacaciones + aguinaldo + salPendiente;
        const neto = total - deducciones;
        return {
          empleado_id: emp?.id || null,
          empleado_nombre: emp ? `${emp.nombre} ${emp.apellidos}` : `? (${row.identificacion_empleado})`,
          empresa_id: empresaId,
          fecha_salida: row.fecha_salida,
          motivo_salida: row.motivo_salida,
          salario_promedio: Number(row.salario_promedio) || 0,
          preaviso,
          cesantia,
          vacaciones_pendientes: vacaciones,
          aguinaldo_proporcional: aguinaldo,
          salario_pendiente: salPendiente,
          deducciones_finales: deducciones,
          total_liquidacion: total,
          neto_liquidar: neto,
          estado: "borrador",
          observaciones: row.observaciones || "",
          _valido: !errs.some(e => e.startsWith(`Fila ${num}:`)),
        };
      });
      setErrores(errs);
      setPreview(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportar = async () => {
    const validos = preview.filter(r => r._valido && r.empleado_id);
    if (!validos.length) return;
    setImportando(true);
    let ok = 0; let fail = 0;
    for (const row of validos) {
      const { empleado_nombre: _, _valido: __, ...data } = row;
      await base44.entities.Liquidacion.create(data).then(() => ok++).catch(() => fail++);
    }
    setImportando(false);
    setResultado({ ok, fail });
    if (ok > 0) onSuccess?.();
  };

  const validos = preview.filter(r => r._valido && r.empleado_id);
  const fmt = (n) => `₡${Number(n||0).toLocaleString("es-CR")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Liquidaciones desde Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Descargue la plantilla y complete los datos de cada empleado a liquidar.</li>
              <li>Use la <strong>identificación</strong> del empleado (cédula/DIMEX) para vincular el registro.</li>
              <li>Motivos válidos: {motivos.join(", ")}</li>
              <li>Fechas en formato YYYY-MM-DD (ej: 2026-03-31).</li>
              <li>Los montos deben ser números sin formato (sin ₡ ni comas).</li>
            </ul>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={descargarPlantilla} className="gap-2">
              <Download className="w-4 h-4" /> Descargar Plantilla
            </Button>
            <div>
              <Label htmlFor="file-liq" className="sr-only">Archivo</Label>
              <input id="file-liq" type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={handleFile} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Cargar Archivo
              </Button>
            </div>
          </div>

          {/* Errores */}
          {errores.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {errores.length} error(es) encontrados</p>
              {errores.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !resultado && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{preview.length} filas leídas · {validos.length} válidas para importar</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-56">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Empleado</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">F. Salida</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Motivo</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Cesantía</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Neto</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((r, i) => (
                      <tr key={i} className={r._valido ? "bg-white" : "bg-red-50"}>
                        <td className="px-3 py-2">{r.empleado_nombre}</td>
                        <td className="px-3 py-2">{r.fecha_salida}</td>
                        <td className="px-3 py-2 capitalize">{r.motivo_salida?.replace(/_/g," ")}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(r.cesantia)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{fmt(r.neto_liquidar)}</td>
                        <td className="px-3 py-2">
                          {r._valido
                            ? <span className="text-emerald-600 font-semibold">✓ OK</span>
                            : <span className="text-red-600 font-semibold">✗ Error</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800">Importación completada</p>
                <p className="text-sm text-emerald-700">{resultado.ok} liquidaciones importadas correctamente.{resultado.fail > 0 ? ` ${resultado.fail} fallaron.` : ""}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cerrar</Button>
          {validos.length > 0 && !resultado && (
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleImportar} disabled={importando}>
              {importando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : `Importar ${validos.length} liquidaciones`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}