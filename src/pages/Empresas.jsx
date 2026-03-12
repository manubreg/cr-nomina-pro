import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Building2, Globe, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const emptyEmpresa = { nombre_legal: "", nombre_comercial: "", cedula_juridica: "", correo: "", telefono: "", direccion: "", moneda_base: "CRC", estado: "activa" };

export default function Empresas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEmpresa);
  const [editing, setEditing] = useState(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => base44.entities.Empresa.list("-created_date"),
  });

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.Empresa.update(editing, data) : base44.entities.Empresa.create(data),
    onSuccess: () => { qc.invalidateQueries(["empresas"]); setOpen(false); },
  });

  const openNew = () => { setForm(emptyEmpresa); setEditing(null); setOpen(true); };
  const openEdit = (e) => { setForm(e); setEditing(e.id); setOpen(true); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de empresas registradas</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nueva Empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border h-36 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {empresas.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={e.estado === "activa" ? "default" : "secondary"} className={e.estado === "activa" ? "bg-emerald-100 text-emerald-700" : ""}>
                    {e.estado}
                  </Badge>
                  <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-blue-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{e.nombre_legal}</h3>
              {e.nombre_comercial && <p className="text-xs text-gray-400 mb-2">{e.nombre_comercial}</p>}
              <p className="text-xs text-gray-500 font-mono mb-3">{e.cedula_juridica}</p>
              <div className="space-y-1">
                {e.correo && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3 h-3" />{e.correo}</p>}
                {e.telefono && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3 h-3" />{e.telefono}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Moneda: {e.moneda_base}</span>
              </div>
            </div>
          ))}
          {empresas.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay empresas registradas. Cree una para comenzar.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Nombre Legal *</Label>
              <Input value={form.nombre_legal} onChange={e => set("nombre_legal", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nombre Comercial</Label>
              <Input value={form.nombre_comercial} onChange={e => set("nombre_comercial", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cédula Jurídica *</Label>
              <Input value={form.cedula_juridica} onChange={e => set("cedula_juridica", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Correo</Label>
              <Input value={form.correo} onChange={e => set("correo", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => set("telefono", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => set("direccion", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda Base</Label>
              <Select value={form.moneda_base} onValueChange={v => set("moneda_base", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC - Colón</SelectItem>
                  <SelectItem value="USD">USD - Dólar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="inactiva">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}