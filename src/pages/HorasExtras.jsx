import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Search, Upload, CheckCircle2 } from "lucide-react";
import ImportarHorasExtrasModal from "@/components/horasExtras/ImportarHorasExtrasModal";

export default function HorasExtras() {
  const { empresaId } = useEmpresaContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ empleado_id: "", fecha: "", cantidad: "", observaciones: "" });

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados", empresaId],
    queryFn: () => base44.entities.Empleado.filter({ empresa_id: empresaId }),
    enabled: !!empresaId,
  });

  const { data: novedades = [] } = useQuery({
    queryKey: ["novedades", empresaId],
    queryFn: () => base44.entities.Novedad.filter({ empresa_id: empresaId, tipo_novedad: "horas_extra" }),
    enabled: !!empresaId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Novedad.create({
      ...data,
      empresa_id: empresaId,
      tipo_novedad: "horas_extra",
      unidad: "horas",
      estado: "pendiente",
      usuario_registro: "sistema",
    }),
    onSuccess: () => {
      qc.invalidateQueries(["novedades"]);
      setOpen(false);
      setForm({ empleado_id: "", fecha: "", cantidad: "", observaciones: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Novedad.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries(["novedades"]);
      setOpen(false);
      setEditingId(null);
      setForm({ empleado_id: "", fecha: "", cantidad: "", observaciones: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Novedad.delete(id),
    onSuccess: () => qc.invalidateQueries(["novedades"]),
  });

  const handleSubmit = () => {
    if (!form.empleado_id || !form.fecha || !form.cantidad) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { ...form, cantidad: Number(form.cantidad) } });
    } else {
      createMutation.mutate({ ...form, cantidad: Number(form.cantidad) });
    }
  };

  const handleEdit = (novedad) => {
    setForm({
      empleado_id: novedad.empleado_id,
      fecha: novedad.fecha,
      cantidad: String(novedad.cantidad),
      observaciones: novedad.observaciones || "",
    });
    setEditingId(novedad.id);
    setOpen(true);
  };

  const handleApprobar = async (id, estado) => {
    const novedad = novedades.find(n => n.id === id);
    if (!novedad) return;

    const nuevoEstado = estado === "pendiente" ? "aprobada" : "pendiente";
    
    updateMutation.mutate(
      { id, data: { estado: nuevoEstado } },
      {
        onSuccess: async () => {
          // Si se aprueba, crear movimiento en planilla
          if (nuevoEstado === "aprobada") {
            try {
              await base44.functions.invoke("crearMovimientoHorasExtras", {
                novedad_id: id,
                empleado_id: novedad.empleado_id,
                cantidad_horas: novedad.cantidad,
                fecha: novedad.fecha,
                empresa_id: empresaId,
              });
              qc.invalidateQueries(["planillas"]);
            } catch (error) {
              console.error("Error al crear movimiento en planilla:", error);
            }
          }
        },
      }
    );
  };

  const handleNew = () => {
    setForm({ empleado_id: "", fecha: "", cantidad: "", observaciones: "" });
    setEditingId(null);
    setOpen(true);
  };

  const filteredNovedades = novedades.filter(n => {
    const emp = empleados.find(e => e.id === n.empleado_id);
    const nombre = emp ? `${emp.nombre} ${emp.apellidos}` : "";
    return nombre.toLowerCase().includes(search.toLowerCase()) || String(n.fecha).includes(search);
  });

  const estadoColor = (estado) => {
    const map = { pendiente: "bg-yellow-100 text-yellow-800", aprobada: "bg-green-100 text-green-800", rechazada: "bg-red-100 text-red-800", aplicada: "bg-blue-100 text-blue-800" };
    return map[estado] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (fecha) => {
    if (!fecha) return "—";
    try {
      const num = Number(fecha);
      if (!isNaN(num) && num > 30000) {
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
        return format(date, "dd/MM/yyyy", { locale: es });
      }
      const parsed = parse(String(fecha), "yyyy-MM-dd", new Date());
      if (!isNaN(parsed.getTime())) {
        return format(parsed, "dd/MM/yyyy", { locale: es });
      }
      return String(fecha);
    } catch {
      return String(fecha);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Horas Extras</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Importar Excel
          </Button>
          <Button onClick={handleNew} className="bg-blue-700 hover:bg-blue-800 gap-2">
            <Plus className="w-4 h-4" /> Nueva Novedad
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por empleado o fecha..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNovedades.length === 0 ? (
              <TableRow>
                <TableCell colSpan="6" className="text-center py-8 text-gray-500">
                  No hay horas extras registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredNovedades.map((nov) => {
                const emp = empleados.find(e => e.id === nov.empleado_id);
                return (
                  <TableRow key={nov.id}>
                    <TableCell className="font-medium">{emp ? `${emp.nombre} ${emp.apellidos}` : "?"}</TableCell>
                    <TableCell>{formatDate(nov.fecha)}</TableCell>
                    <TableCell className="text-right font-mono">{nov.cantidad}h</TableCell>
                    <TableCell>
                      <Badge className={estadoColor(nov.estado)} variant="outline">
                        {nov.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{nov.observaciones || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleApprobar(nov.id, nov.estado)}
                        title={nov.estado === "pendiente" ? "Aprobar" : "Desaprobar"}
                        className={nov.estado === "aprobada" ? "text-green-600" : "text-gray-400 hover:text-green-600"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(nov)}>
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(nov.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Horas Extras" : "Nueva Novedad - Horas Extras"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Empleado *</Label>
              <Select value={form.empleado_id} onValueChange={(v) => setForm({ ...form, empleado_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre} {emp.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Cantidad de Horas *</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="ej: 2, 4.5"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input
                placeholder="Motivo o comentario adicional"
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleSubmit}>
              {editingId ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportarHorasExtrasModal
        open={importOpen}
        onOpenChange={setImportOpen}
        empresaId={empresaId}
        empleados={empleados}
        onSuccess={() => qc.invalidateQueries(["novedades"])}
      />
    </div>
  );
}