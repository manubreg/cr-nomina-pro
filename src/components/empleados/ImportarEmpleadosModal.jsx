import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle, Loader2, FileSpreadsheet } from "lucide-react";

const CAMPOS_REQUERIDOS = ["nombre", "apellidos", "identificacion", "fecha_ingreso", "salario_base", "empresa_id"];

const PLANTILLA_HEADERS = [
  "nombre", "apellidos", "identificacion", "tipo_identificacion",
  "fecha_ingreso", "fecha_nacimiento", "puesto", "departamento_id",
  "salario_base", "moneda", "frecuencia_pago", "tipo_jornada",
  "correo", "telefono", "estado", "empresa_id"
];

const EJEMPLO_FILAS = [
  ["Juan", "Pérez Mora", "101110222", "cedula", "2024-01-15", "1990-05-20",
   "Desarrollador", "", "850000", "CRC", "mensual", "diurna",
   "juan@empresa.com", "88001234", "activo", ""],
];

function descargarPlantilla() {
  const ws = XLSX.utils.aoa_to_sheet([PLANTILLA_HEADERS, ...EJEMPLO_FILAS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Empleados");
  XLSX.writeFile(wb, "plantilla_empleados.xlsx");
}

function validarFila(fila, idx) {
  const errores = [];
  if (!fila.nombre?.toString().trim()) errores.push("nombre requerido");
  if (!fila.apellidos?.toString().trim()) errores.push("apellidos requerido");
  if (!fila.identificacion?.toString().trim()) errores.push("identificación requerida");
  if (!fila.fecha_ingreso?.toString().trim()) errores.push("fecha_ingreso requerida");
  if (!fila.salario_base || isNaN(Number(fila.salario_base))) errores.push("salario_base inválido");
  return errores;
}

export default function ImportarEmpleadosModal({ open, onClose, empresaId, onSuccess }) {
  const inputRef = useRef();
  const [filas, setFilas] = useState([]);
  const [errores, setErrores] = useState({});
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [archivoNombre, setArchivoNombre] = useState("");

  const handleArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivoNombre(file.name);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const nuevosErrores = {};
      data.forEach((fila, idx) => {
        const errs = validarFila(fila, idx);
        if (errs.length > 0) nuevosErrores[idx] = errs;
      });

      setFilas(data);
      setErrores(nuevosErrores);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportar = async () => {
    if (Object.keys(errores).length > 0) return;
    setImportando(true);

    let ok = 0, fail = 0, failMsgs = [];
    for (const fila of filas) {
      const emp = {
        nombre: fila.nombre?.toString().trim(),
        apellidos: fila.apellidos?.toString().trim(),
        identificacion: fila.identificacion?.toString().trim(),
        tipo_identificacion: fila.tipo_identificacion || "cedula",
        fecha_ingreso: fila.fecha_ingreso?.toString().trim(),
        fecha_nacimiento: fila.fecha_nacimiento?.toString().trim() || undefined,
        puesto: fila.puesto?.toString().trim() || undefined,
        departamento_id: fila.departamento_id?.toString().trim() || undefined,
        salario_base: Number(fila.salario_base),
        moneda: fila.moneda || "CRC",
        frecuencia_pago: fila.frecuencia_pago || "mensual",
        tipo_jornada: fila.tipo_jornada || "diurna",
        correo: fila.correo?.toString().trim() || undefined,
        telefono: fila.telefono?.toString().trim() || undefined,
        estado: fila.estado || "activo",
        empresa_id: fila.empresa_id?.toString().trim() || empresaId,
      };
      try {
        await base44.entities.Empleado.create(emp);
        ok++;
      } catch (err) {
        fail++;
        failMsgs.push(`${emp.nombre} ${emp.apellidos}: ${err.message}`);
      }
    }

    setImportando(false);
    setResultado({ ok, fail, failMsgs });
    if (ok > 0) onSuccess?.();
  };

  const limpiar = () => {
    setFilas([]);
    setErrores({});
    setResultado(null);
    setArchivoNombre("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalErrores = Object.keys(errores).length;
  const filasValidas = filas.length - totalErrores;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importando) { limpiar(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Importar Empleados Masivo
          </DialogTitle>
        </DialogHeader>

        {/* Descargar plantilla */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">¿Primera vez?</p>
            <p className="text-xs text-blue-600 mt-0.5">Descarga la plantilla Excel con los campos requeridos.</p>
          </div>
          <Button variant="outline" size="sm" onClick={descargarPlantilla} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100">
            <Download className="w-4 h-4" /> Plantilla
          </Button>
        </div>

        {/* Upload */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-600">
            {archivoNombre || "Haz clic o arrastra tu archivo CSV / Excel"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleArchivo} />
        </div>

        {/* Vista previa y errores */}
        {filas.length > 0 && !resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> {filasValidas} válidas
              </span>
              {totalErrores > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-medium">
                  <XCircle className="w-4 h-4" /> {totalErrores} con errores
                </span>
              )}
            </div>

            {/* Tabla preview */}
            <div className="border border-gray-200 rounded-lg overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-gray-500">Nombre</th>
                    <th className="px-3 py-2 text-left text-gray-500">Apellidos</th>
                    <th className="px-3 py-2 text-left text-gray-500">Cédula</th>
                    <th className="px-3 py-2 text-left text-gray-500">Salario</th>
                    <th className="px-3 py-2 text-left text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((f, idx) => (
                    <tr key={idx} className={errores[idx] ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2">{f.nombre}</td>
                      <td className="px-3 py-2">{f.apellidos}</td>
                      <td className="px-3 py-2 font-mono">{f.identificacion}</td>
                      <td className="px-3 py-2">{f.salario_base}</td>
                      <td className="px-3 py-2">
                        {errores[idx] ? (
                          <span className="text-red-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {errores[idx].join(", ")}
                          </span>
                        ) : (
                          <span className="text-emerald-600">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalErrores > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ Corrige los errores en el archivo y vuelve a subirlo antes de importar.
              </p>
            )}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`rounded-lg p-4 border ${resultado.fail === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <p className="font-medium text-sm mb-1">
              {resultado.fail === 0 ? "✅ Importación completada" : "⚠️ Importación con errores"}
            </p>
            <p className="text-sm text-gray-600">{resultado.ok} empleados importados correctamente.</p>
            {resultado.fail > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-0.5">
                {resultado.failMsgs.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => { limpiar(); onClose(); }} disabled={importando}>
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          {filas.length > 0 && !resultado && (
            <Button
              className="bg-blue-700 hover:bg-blue-800 gap-2"
              onClick={handleImportar}
              disabled={importando || totalErrores > 0}
            >
              {importando ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Importar {filasValidas} empleados</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}