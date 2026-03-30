import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";

export default function ImportarHorasExtrasModal({ open, onOpenChange, empresaId, empleados, onSuccess }) {
  const [preview, setPreview] = useState([]);
  const [errores, setErrores] = useState([]);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  const reset = () => {
    setPreview([]);
    setErrores([]);
    setResultado(null);
    setProgreso({ actual: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["identificacion_empleado", "fecha", "cantidad_horas", "tipo_hora_extra", "observaciones"],
      ["123456789", "2026-03-30", "2.5", "diurna", "Proyecto urgente"],
      ["987654321", "2026-03-30", "4", "nocturna", "Mantenimiento nocturno"],
      ["123456789", "2026-04-01", "8", "feriado", "Feriado trabajado"],
    ]);
    ws["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HorasExtras");
    XLSX.writeFile(wb, "plantilla_horas_extras.xlsx");
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
        const emp = empleados.find(
          (e) => String(e.identificacion).trim() === String(row.identificacion_empleado).trim()
        );
        if (!emp) errs.push(`Fila ${num}: empleado con cédula "${row.identificacion_empleado}" no encontrado.`);
        if (!row.fecha) errs.push(`Fila ${num}: fecha requerida.`);
        if (!row.cantidad_horas) errs.push(`Fila ${num}: cantidad_horas requerida.`);
        const cantidad = Number(row.cantidad_horas) || 0;
        if (cantidad <= 0) errs.push(`Fila ${num}: cantidad_horas debe ser > 0.`);
        const tipoHoraExtra = String(row.tipo_hora_extra || "diurna").trim().toLowerCase();
        if (!["diurna", "nocturna", "feriado"].includes(tipoHoraExtra)) {
          errs.push(`Fila ${num}: tipo_hora_extra debe ser 'diurna', 'nocturna' o 'feriado'.`);
        }
        const valido = !errs.some((e) => e.startsWith(`Fila ${num}:`));
        return {
          _valido: valido,
          empleado_id: emp?.id || null,
          empleado_nombre: emp ? `${emp.nombre} ${emp.apellidos}` : `? (${row.identificacion_empleado})`,
          empresa_id: empresaId,
          fecha: String(row.fecha).trim(),
          cantidad_horas: cantidad,
          tipo_hora_extra: tipoHoraExtra,
          observaciones: String(row.observaciones || "").trim(),
        };
      });
      setErrores(errs);
      setPreview(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportar = async () => {
    const validos = preview.filter((r) => r._valido && r.empleado_id);
    if (!validos.length) return;
    setImportando(true);
    setProgreso({ actual: 0, total: validos.length });
    let ok = 0;
    let fail = 0;

    for (const row of validos) {
      await base44.entities.Novedad.create({
        empleado_id: row.empleado_id,
        empresa_id: row.empresa_id,
        tipo_novedad: "horas_extra",
        tipo_hora_extra: row.tipo_hora_extra,
        fecha: row.fecha,
        cantidad: row.cantidad_horas,
        unidad: "horas",
        monto: 0,
        comentario: row.observaciones,
        estado: "pendiente",
        usuario_registro: "sistema",
      })
        .then(() => ok++)
        .catch(() => fail++);

      setProgreso((p) => ({ ...p, actual: p.actual + 1 }));
    }

    setImportando(false);
    setResultado({ ok, fail });
    if (ok > 0) onSuccess?.();
  };

  const validos = preview.filter((r) => r._valido && r.empleado_id);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Horas Extras desde Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
           <p className="font-semibold mb-1">Instrucciones:</p>
           <ul className="list-disc list-inside space-y-0.5 text-xs">
             <li>Descargue la plantilla y complete los 5 campos.</li>
             <li>Use la <strong>cédula o DIMEX</strong> del empleado tal como está registrada.</li>
             <li>Fechas en formato YYYY-MM-DD (ej: 2026-03-30).</li>
             <li>Cantidad de horas: números decimales (ej: 2, 4.5, etc).</li>
             <li>Tipo de hora extra: <strong>diurna</strong> (25%), <strong>nocturna</strong> (35%) o <strong>feriado</strong>.</li>
             <li>Observaciones es opcional.</li>
           </ul>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={descargarPlantilla} className="gap-2">
              <Download className="w-4 h-4" /> Descargar Plantilla
            </Button>
            <div>
              <Label htmlFor="file-he" className="sr-only">Archivo</Label>
              <input id="file-he" type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={handleFile} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Cargar Archivo
              </Button>
            </div>
          </div>

          {/* Errores */}
          {errores.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errores.length} error(es) encontrados
              </p>
              {errores.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !resultado && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{preview.length} filas leídas · {validos.length} válidas</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-56">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Empleado</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Fecha</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Horas</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Tipo</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Observaciones</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((r, i) => (
                       <tr key={i} className={r._valido ? "bg-white" : "bg-red-50"}>
                         <td className="px-3 py-2">{r.empleado_nombre}</td>
                         <td className="px-3 py-2">{r.fecha}</td>
                         <td className="px-3 py-2 text-right font-mono">{r.cantidad_horas}h</td>
                         <td className="px-3 py-2 text-xs font-medium">
                           <span className={
                             r.tipo_hora_extra === "diurna" ? "bg-amber-100 text-amber-800 px-2 py-1 rounded" :
                             r.tipo_hora_extra === "nocturna" ? "bg-purple-100 text-purple-800 px-2 py-1 rounded" :
                             "bg-red-100 text-red-800 px-2 py-1 rounded"
                           }>
                             {r.tipo_hora_extra === "diurna" ? "Diurna" : r.tipo_hora_extra === "nocturna" ? "Nocturna" : "Feriado"}
                           </span>
                         </td>
                         <td className="px-3 py-2 text-xs text-gray-600">{r.observaciones || "—"}</td>
                         <td className="px-3 py-2">
                           {r._valido ? (
                             <span className="text-emerald-600 font-semibold">✓ OK</span>
                           ) : (
                             <span className="text-red-600 font-semibold">✗ Error</span>
                           )}
                         </td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progreso */}
          {importando && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">Importando horas extras...</p>
                <p className="text-xs text-blue-600">{progreso.actual} de {progreso.total} procesadas</p>
                <div className="mt-1.5 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${progreso.total ? (progreso.actual / progreso.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800">Importación completada</p>
                <p className="text-sm text-emerald-700">
                  {resultado.ok} registros importados correctamente.
                  {resultado.fail > 0 ? ` ${resultado.fail} fallaron.` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cerrar
          </Button>
          {validos.length > 0 && !resultado && !importando && (
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleImportar}>
              Importar {validos.length} registros
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}