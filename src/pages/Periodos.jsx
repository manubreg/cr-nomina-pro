import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Trash2, Calendar, Download, Upload, FileSpreadsheet, Loader2, Receipt, Eye, Pencil } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import PlanillaDetalleModal from "@/components/planillas/PlanillaDetalleModal";

const estadoColors = {
  abierto: "bg-blue-100 text-blue-700",
  calculado: "bg-yellow-100 text-yellow-700",
  en_revision: "bg-orange-100 text-orange-700",
  aprobado: "bg-indigo-100 text-indigo-700",
  pagado: "bg-green-100 text-green-700",
  anulado: "bg-red-100 text-red-600",
};

// Genera y descarga la plantilla CSV para carga masiva
function descargarPlantilla() {
  const headers = ["empresa_id", "tipo_periodo", "fecha_inicio", "fecha_fin", "fecha_pago", "estado", "observaciones"];
  const ejemplo = ["ID_EMPRESA", "mensual", "2026-03-01", "2026-03-31", "2026-04-05", "abierto", "Periodo ejemplo"];
  const csv = [headers, ejemplo].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_periodos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Parsea CSV → array de objetos
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.replace(/\r/g, ""));
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.replace(/"/g, "").trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

export default function Periodos() {
  const { empresaId, filterByEmpresa, empresas } = useEmpresaContext();
  const { toast } = useToast();
  const [periodos, setPeriodos] = useState([]);
  const [planillas, setPlanillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo_periodo: "mensual", fecha_inicio: "", fecha_fin: "", fecha_pago: "", estado: "abierto", empresa_id: "" });
  const [saving, setSaving] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [fileError, setFileError] = useState("");
  const [detalleModal, setDetalleModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    const [data, planData] = await Promise.all([
      base44.entities.PeriodoPlanilla.list("-created_date", 100),
      base44.entities.Planilla.list("-created_date", 200),
    ]);
    setPeriodos(filterByEmpresa(data));
    setPlanillas(planData);
    setLoading(false);
  };

  useEffect(() => { load(); }, [empresaId]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PeriodoPlanilla.create(form);
    setSaving(false);
    setShowForm(false);
    setForm({ tipo_periodo: "mensual", fecha_inicio: "", fecha_fin: "", fecha_pago: "", estado: "abierto", empresa_id: empresaId || "" });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este periodo?")) return;
    await base44.entities.PeriodoPlanilla.delete(id);
    load();
  };

  const handleFileChange = (e) => {
    setFileError("");
    setPreview([]);
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) { setFileError("El archivo está vacío o no tiene el formato correcto."); return; }
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCargaMasiva = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setUploading(true);
    const text = await file.text();
    const rows = parseCSV(text);
    let ok = 0, err = 0;
    for (const row of rows) {
      if (!row.empresa_id || !row.fecha_inicio || !row.fecha_fin) { err++; continue; }
      await base44.entities.PeriodoPlanilla.create({
        empresa_id: row.empresa_id,
        tipo_periodo: row.tipo_periodo || "mensual",
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        fecha_pago: row.fecha_pago || "",
        estado: row.estado || "abierto",
        observaciones: row.observaciones || "",
      });
      ok++;
    }
    setUploading(false);
    setUploadModal(false);
    setPreview([]);
    if (fileRef.current) fileRef.current.value = "";
    load();
    toast({
      title: "Carga masiva completada",
      description: `${ok} periodos creados${err > 0 ? `, ${err} filas con error (empresa_id, fecha_inicio o fecha_fin vacíos)` : ""}`,
    });
  };

  // Obtener planilla asociada a un período
  const getPlanilla = (periodoId) => planillas.find(pl => pl.periodo_id === periodoId);

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Periodos de Planilla</h1>
          <p className="text-sm text-gray-500">{periodos.filter(p => p.estado === "abierto").length} periodos abiertos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Descargar plantilla */}
          <button
            onClick={descargarPlantilla}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
            title="Descargar plantilla CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Plantilla Excel
          </button>
          {/* Carga masiva */}
          <button
            onClick={() => setUploadModal(true)}
            className="flex items-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium"
          >
            <Upload className="w-4 h-4" /> Carga Masiva
          </button>
          {/* Nuevo periodo manual */}
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo Periodo
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear Nuevo Periodo</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Empresa</label>
              <Select value={form.empresa_id} onValueChange={v => setForm(p => ({ ...p, empresa_id: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Tipo</label>
              <select value={form.tipo_periodo} onChange={e => setForm(p => ({ ...p, tipo_periodo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="aguinaldo">Aguinaldo</option>
                <option value="liquidacion">Liquidación</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha Inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha Fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha de Pago</label>
              <input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar Periodo"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fin</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha Pago</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Planilla</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando...
              </td></tr>
            ) : periodos.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No hay periodos registrados.</td></tr>
            ) : periodos.map(p => {
              const planilla = getPlanilla(p.id);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="capitalize text-gray-700">{p.tipo_periodo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.fecha_inicio}</td>
                  <td className="px-4 py-3 text-gray-600">{p.fecha_fin}</td>
                  <td className="px-4 py-3 text-gray-600">{p.fecha_pago || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600"}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {planilla ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 font-mono">{planilla.codigo_planilla}</span>
                        <button
                          onClick={() => setDetalleModal(planilla)}
                          title="Ver detalle de planilla"
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Sin planilla</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal carga masiva */}
      <Dialog open={uploadModal} onOpenChange={setUploadModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Carga Masiva de Periodos
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Sube un archivo CSV con los periodos a crear. Descarga primero la plantilla para ver el formato correcto.
          </p>
          <div className="space-y-3 mt-1">
            <button
              onClick={descargarPlantilla}
              className="flex items-center gap-2 text-sm text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg w-full justify-center"
            >
              <FileSpreadsheet className="w-4 h-4" /> Descargar plantilla CSV
            </button>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">Haz clic para seleccionar un archivo CSV</p>
              </label>
            </div>
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            {preview.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Vista previa (primeras {preview.length} filas):</p>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-50">
                      <tr>{Object.keys(preview[0]).map(k => <th key={k} className="px-2 py-1.5 text-left font-semibold text-gray-500">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5 text-gray-600">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => { setUploadModal(false); setPreview([]); }} disabled={uploading}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleCargaMasiva}
              disabled={uploading || preview.length === 0}
            >
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando...</> : <><Upload className="w-4 h-4 mr-2" /> Importar Periodos</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle planilla */}
      {detalleModal && (
        <PlanillaDetalleModal planilla={detalleModal} onClose={() => setDetalleModal(null)} />
      )}
    </div>
  );
}