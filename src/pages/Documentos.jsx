import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, FolderOpen, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tiposDoc = ["contrato_laboral","cedula","curriculum","constancia_bancaria","incapacidad","boleta_vacaciones","evaluacion","amonestacion","otro"];
const emptyDoc = { empleado_id: "", empresa_id: "", tipo_documento: "otro", nombre_archivo: "", url_archivo: "", fecha_documento: "", comentario: "" };

export default function Documentos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDoc);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: documentos = [], isLoading } = useQuery({ queryKey: ["documentos"], queryFn: () => base44.entities.DocumentoEmpleado.list("-created_date") });
  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => base44.entities.Empleado.list() });
  const empleadoMap = Object.fromEntries(empleados.map(e => [e.id, `${e.nombre} ${e.apellidos}`]));

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.DocumentoEmpleado.update(editing, data) : base44.entities.DocumentoEmpleado.create(data),
    onSuccess: () => { qc.invalidateQueries(["documentos"]); setOpen(false); },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("url_archivo", file_url);
    set("nombre_archivo", form.nombre_archivo || file.name);
    setUploading(false);
  };

  const openNew = () => { setForm(emptyDoc); setEditing(null); setOpen(true); };
  const openEdit = (d) => { setForm(d); setEditing(d.id); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 text-sm mt-1">{documentos.length} documentos cargados</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Subir Documento
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : documentos.length === 0 ? (
          <div className="p-12 text-center"><FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin documentos cargados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Archivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documentos.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-gray-800 text-xs">{d.nombre_archivo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{empleadoMap[d.empleado_id] || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell capitalize text-xs">{d.tipo_documento?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">{d.fecha_documento || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {d.url_archivo && (
                          <a href={d.url_archivo} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Ver
                          </a>
                        )}
                        <button onClick={() => openEdit(d)} className="text-xs text-gray-500 hover:text-blue-600">Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Documento" : "Subir Documento"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-1">
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={v => set("empleado_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de Documento</Label>
              <Select value={form.tipo_documento} onValueChange={v => set("tipo_documento", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{tiposDoc.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre del Archivo *</Label>
              <Input value={form.nombre_archivo} onChange={e => set("nombre_archivo", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Archivo</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => document.getElementById("docFile").click()}>
                {uploading ? (
                  <p className="text-sm text-gray-500">Subiendo archivo...</p>
                ) : form.url_archivo ? (
                  <p className="text-sm text-emerald-600">✓ Archivo cargado</p>
                ) : (
                  <p className="text-sm text-gray-400"><Upload className="w-4 h-4 mx-auto mb-1" />Haz clic para subir</p>
                )}
              </div>
              <input id="docFile" type="file" className="hidden" onChange={handleFileUpload} />
            </div>
            <div className="space-y-1">
              <Label>Fecha del Documento</Label>
              <Input type="date" value={form.fecha_documento} onChange={e => set("fecha_documento", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Comentario</Label>
              <Input value={form.comentario} onChange={e => set("comentario", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={save.isPending || uploading}>
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}