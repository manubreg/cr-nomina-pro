import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const motivoOpciones = [
  { value: "decreto_mtss", label: "Decreto MTSS" },
  { value: "merito", label: "Por Mérito" },
  { value: "reclasificacion", label: "Reclasificación" },
  { value: "promocion", label: "Promoción" },
  { value: "ajuste_mercado", label: "Ajuste de Mercado" },
  { value: "otro", label: "Otro" },
];

export default function ImportarAumentosModal({ open, onOpenChange, empresaId, empleados, onSuccess }) {
  const [file, setFile] = useState(null);
  const [tipoAumento, setTipoAumento] = useState("porcentaje"); // porcentaje | monto
  const [motivo, setMotivo] = useState("merito");
  const [fechaEfectiva, setFechaEfectiva] = useState("");
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      setPreview(rows.slice(0, 5)); // Muestra solo las primeras 5 filas de preview
    };
    reader.readAsBinaryString(f);
  };

  const descargarPlantilla = () => {
    const datos = [
      { identificacion: "1-0000-0000", nombre: "Ejemplo Empleado", valor_aumento: 10 },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aumentos");
    XLSX.writeFile(wb, "plantilla_aumentos.xlsx");
  };

  const handleImportar = async () => {
    if (!file || !fechaEfectiva) {
      setError("Selecciona el archivo y la fecha efectiva.");
      return;
    }

    setLoading(true);
    setError(null);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      let exitosos = 0;
      let errores = [];

      for (const row of rows) {
        const identificacion = String(row["identificacion"] || "").trim();
        const valorAumento = parseFloat(row["valor_aumento"]);

        if (!identificacion || isNaN(valorAumento)) {
          errores.push(`Fila inválida: ${JSON.stringify(row)}`);
          continue;
        }

        const empleado = empleados.find(e => e.identificacion === identificacion);
        if (!empleado) {
          errores.push(`Empleado no encontrado: ${identificacion}`);
          continue;
        }

        const salarioAnterior = empleado.salario_base || 0;
        let salarioNuevo;
        let porcentaje;

        if (tipoAumento === "porcentaje") {
          porcentaje = valorAumento;
          salarioNuevo = salarioAnterior * (1 + valorAumento / 100);
        } else {
          salarioNuevo = salarioAnterior + valorAumento;
          porcentaje = salarioAnterior > 0 ? ((valorAumento / salarioAnterior) * 100).toFixed(2) : 0;
        }

        await base44.entities.HistorialSalario.create({
          empleado_id: empleado.id,
          empresa_id: empresaId,
          salario_anterior: salarioAnterior,
          salario_nuevo: Math.round(salarioNuevo),
          porcentaje_aumento: parseFloat(porcentaje),
          fecha_efectiva: fechaEfectiva,
          motivo,
          descripcion: `Importado desde Excel (${tipoAumento === "porcentaje" ? `${valorAumento}%` : `+₡${valorAumento}`})`,
        });

        exitosos++;
      }

      setResultado({ exitosos, errores });
      if (exitosos > 0) onSuccess();
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResultado(null);
    setError(null);
    setTipoAumento("porcentaje");
    setMotivo("merito");
    setFechaEfectiva("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" /> Importar Aumentos desde Excel
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">{resultado.exitosos} aumento(s) registrados correctamente.</p>
              </div>
            </div>
            {resultado.errores.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 mb-1">Errores ({resultado.errores.length}):</p>
                <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {resultado.errores.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Plantilla */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-700">
                <p className="font-medium">Columnas requeridas:</p>
                <p className="text-xs mt-0.5"><code>identificacion</code>, <code>valor_aumento</code></p>
              </div>
              <Button variant="outline" size="sm" onClick={descargarPlantilla}>
                <Download className="w-4 h-4 mr-1" /> Plantilla
              </Button>
            </div>

            {/* Tipo de aumento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de Aumento *</Label>
                <Select value={tipoAumento} onValueChange={setTipoAumento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentaje">Por Porcentaje (%)</SelectItem>
                    <SelectItem value="monto">Por Monto (₡)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {motivoOpciones.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Fecha Efectiva *</Label>
              <Input type="date" value={fechaEfectiva} onChange={e => setFechaEfectiva(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Archivo Excel *</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">Vista previa (primeras {preview.length} filas):</p>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-gray-500">
                      {Object.keys(preview[0]).map(k => <th key={k} className="text-left pr-4 pb-1">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => <td key={j} className="pr-4 py-0.5">{String(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleImportar} disabled={loading || !file}>
                {loading ? "Procesando..." : <><Upload className="w-4 h-4 mr-2" />Importar</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}