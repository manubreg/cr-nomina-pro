import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { ShieldCheck, Plus, Pencil, Trash2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const MODULOS_DISPONIBLES = [
  { key: "Dashboard",          label: "Dashboard" },
  { key: "Empresas",           label: "Empresas" },
  { key: "Empleados",          label: "Empleados" },
  { key: "Contratos",          label: "Contratos" },
  { key: "Documentos",         label: "Documentos" },
  { key: "Periodos",           label: "Períodos" },
  { key: "Planillas",          label: "Planillas" },
  { key: "Novedades",          label: "Novedades" },
  { key: "Conceptos",          label: "Conceptos de Pago" },
  { key: "Vacaciones",         label: "Vacaciones" },
  { key: "Incapacidades",      label: "Incapacidades" },
  { key: "Aguinaldo",          label: "Aguinaldo" },
  { key: "Liquidaciones",      label: "Liquidaciones" },
  { key: "HistorialSalarial",  label: "Historial Salarial" },
  { key: "HistorialBoletas",   label: "Historial de Boletas" },
  { key: "Reportes",           label: "Reportes Generales" },
  { key: "ReportesLegales",    label: "Reportes Legales" },
  { key: "ReporteHistorialSalarial", label: "Reporte Historial Salarial" },
  { key: "CalendarioObligaciones", label: "Calendario Legal" },
  { key: "Parametros",         label: "Parámetros" },
  { key: "Configuracion",      label: "Configuración" },
  { key: "Usuarios",           label: "Usuarios" },
  { key: "Auditoria",          label: "Auditoría" },
  { key: "Notificaciones",     label: "Notificaciones" },
];

const GRUPOS = [
  { label: "General",        keys: ["Dashboard", "Notificaciones"] },
  { label: "Empresa",        keys: ["Empresas"] },
  { label: "Empleados",      keys: ["Empleados", "Contratos", "Documentos"] },
  { label: "Planilla",       keys: ["Periodos", "Planillas", "Novedades", "Conceptos"] },
  { label: "Beneficios",     keys: ["Vacaciones", "Incapacidades", "Aguinaldo", "Liquidaciones", "HistorialSalarial", "HistorialBoletas"] },
  { label: "Reportes",       keys: ["Reportes", "ReportesLegales", "ReporteHistorialSalarial"] },
  { label: "Administración", keys: ["CalendarioObligaciones", "Parametros", "Configuracion", "Usuarios", "Auditoria"] },
];

const EMPTY = { nombre: "", descripcion: "", permisos: [], estado: "activo" };

export default function Roles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => base44.entities.RolPersonalizado.list(),
  });

  const save = useMutation({
    mutationFn: (data) => editId
      ? base44.entities.RolPersonalizado.update(editId, data)
      : base44.entities.RolPersonalizado.create(data),
    onSuccess: () => { qc.invalidateQueries(["roles"]); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.RolPersonalizado.delete(id),
    onSuccess: () => qc.invalidateQueries(["roles"]),
  });

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (r) => { setForm({ nombre: r.nombre, descripcion: r.descripcion || "", permisos: r.permisos || [], estado: r.estado || "activo" }); setEditId(r.id); setOpen(true); };

  const togglePermiso = (key) => {
    setForm(f => ({
      ...f,
      permisos: f.permisos.includes(key) ? f.permisos.filter(p => p !== key) : [...f.permisos, key],
    }));
  };

  const toggleGrupo = (keys) => {
    const allSelected = keys.every(k => form.permisos.includes(k));
    setForm(f => ({
      ...f,
      permisos: allSelected
        ? f.permisos.filter(p => !keys.includes(p))
        : [...new Set([...f.permisos, ...keys])],
    }));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles y Permisos</h1>
          <p className="text-gray-500 text-sm mt-1">Define qué módulos puede ver cada rol personalizado</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Rol
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <div className="grid gap-4">
          {roles.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{r.nombre}</span>
                    <Badge className={r.estado === "activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>
                      {r.estado}
                    </Badge>
                  </div>
                  {r.descripcion && <p className="text-xs text-gray-400 mt-0.5">{r.descripcion}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(r.permisos || []).map(p => {
                      const mod = MODULOS_DISPONIBLES.find(m => m.key === p);
                      return <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{mod?.label || p}</span>;
                    })}
                    {(!r.permisos || r.permisos.length === 0) && <span className="text-xs text-gray-400 italic">Sin permisos asignados</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => del.mutate(r.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {roles.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
              No hay roles creados. Haga clic en "Nuevo Rol" para comenzar.
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre del Rol *</Label>
                <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="ej: Contador, Supervisor" />
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción breve" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Módulos con acceso</Label>
              {GRUPOS.map(grupo => {
                const modulos = MODULOS_DISPONIBLES.filter(m => grupo.keys.includes(m.key));
                const allSelected = modulos.every(m => form.permisos.includes(m.key));
                return (
                  <div key={grupo.label} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{grupo.label}</span>
                      <button
                        onClick={() => toggleGrupo(grupo.keys)}
                        className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${allSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600"}`}
                      >
                        {allSelected ? "Quitar todos" : "Seleccionar todos"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {modulos.map(m => {
                        const selected = form.permisos.includes(m.key);
                        return (
                          <button
                            key={m.key}
                            onClick={() => togglePermiso(m.key)}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                              selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-gray-400">{form.permisos.length} módulo(s) seleccionado(s)</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={!form.nombre || save.isPending}>
                  {save.isPending ? "Guardando..." : "Guardar Rol"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}