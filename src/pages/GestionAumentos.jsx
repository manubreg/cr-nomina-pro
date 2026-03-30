import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { TrendingUp, Plus, Pencil, Trash2, AlertCircle, Calendar, Upload, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEmpresaContext } from "@/components/EmpresaContext";
import ImportarAumentosModal from "@/components/aumentos/ImportarAumentosModal";

const motivoLabel = {
  decreto_mtss: "Decreto MTSS",
  merito: "Por Mérito",
  reclasificacion: "Reclasificación",
  promocion: "Promoción",
  ajuste_mercado: "Ajuste de Mercado",
  otro: "Otro"
};

const motivoColor = {
  decreto_mtss: "bg-blue-100 text-blue-700",
  merito: "bg-green-100 text-green-700",
  reclasificacion: "bg-purple-100 text-purple-700",
  promocion: "bg-yellow-100 text-yellow-700",
  ajuste_mercado: "bg-orange-100 text-orange-700",
  otro: "bg-gray-100 text-gray-700"
};

export default function GestionAumentos() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [openDialog, setOpenDialog] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAumento, setSelectedAumento] = useState(null);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");

  const [empleadoId, setEmpleadoId] = useState("");
  const [salarioAnterior, setSalarioAnterior] = useState("");
  const [salarioNuevo, setSalarioNuevo] = useState("");
  const [fechaEfectiva, setFechaEfectiva] = useState("");
  const [motivo, setMotivo] = useState("merito");
  const [descripcion, setDescripcion] = useState("");

  const { data: aumentos = [], isLoading } = useQuery({
    queryKey: ["aumentos", empresaId],
    queryFn: async () => {
      const data = await base44.entities.HistorialSalario.list();
      return filterByEmpresa(data);
    }
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });

  const createAumento = useMutation({
    mutationFn: (data) => base44.entities.HistorialSalario.create(data),
    onSuccess: () => { qc.invalidateQueries(["aumentos"]); resetForm(); setOpenDialog(false); }
  });

  const updateAumento = useMutation({
    mutationFn: ({ id, data }) => base44.entities.HistorialSalario.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["aumentos"]); resetForm(); setOpenDialog(false); }
  });

  const deleteAumento = useMutation({
    mutationFn: (id) => base44.entities.HistorialSalario.delete(id),
    onSuccess: () => qc.invalidateQueries(["aumentos"])
  });

  const resetForm = () => {
    setEmpleadoId(""); setSalarioAnterior(""); setSalarioNuevo("");
    setFechaEfectiva(""); setMotivo("merito"); setDescripcion("");
    setSelectedAumento(null);
  };

  const handleOpenNew = () => { resetForm(); setOpenDialog(true); };

  const handleEdit = (aumento) => {
    setSelectedAumento(aumento);
    setEmpleadoId(aumento.empleado_id);
    setSalarioAnterior(aumento.salario_anterior);
    setSalarioNuevo(aumento.salario_nuevo);
    setFechaEfectiva(aumento.fecha_efectiva);
    setMotivo(aumento.motivo);
    setDescripcion(aumento.descripcion || "");
    setOpenDialog(true);
  };

  const handleSave = () => {
    const data = {
      empleado_id: empleadoId,
      empresa_id: empresaId,
      salario_anterior: parseFloat(salarioAnterior),
      salario_nuevo: parseFloat(salarioNuevo),
      porcentaje_aumento: ((parseFloat(salarioNuevo) - parseFloat(salarioAnterior)) / parseFloat(salarioAnterior) * 100).toFixed(2),
      fecha_efectiva: fechaEfectiva,
      motivo,
      descripcion,
    };
    if (selectedAumento) {
      updateAumento.mutate({ id: selectedAumento.id, data });
    } else {
      createAumento.mutate(data);
    }
  };

  const aumentosFiltrados = aumentos.filter(a => {
    if (!a.empleado_id) return false;
    const emp = empleados.find(e => e.id === a.empleado_id);
    if (!emp) return false;
    const nombre = (emp.nombre || "").trim();
    const apellidos = (emp.apellidos || "").trim();
    if (!nombre && !apellidos) return false;
    if (!filtroEmpleado) return true;
    return `${nombre} ${apellidos}`.toLowerCase().includes(filtroEmpleado.toLowerCase());
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" /> Gestión de Aumentos Salariales
          </h1>
          <p className="text-gray-500 text-sm mt-1">Registre y consulte histórico de aumentos de salario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar Excel
          </Button>
          <Button onClick={handleOpenNew} className="bg-blue-700 hover:bg-blue-800">
            <Plus className="w-4 h-4 mr-2" /> Registrar Aumento
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <Input
          placeholder="Buscar empleado..."
          value={filtroEmpleado}
          onChange={e => setFiltroEmpleado(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando aumentos...</div>
        ) : aumentosFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay registros de aumentos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Nuevo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">% Aumento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha Efectiva</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aumentosFiltrados.map(aumento => {
                  const emp = empleados.find(e => e.id === aumento.empleado_id);
                  return (
                    <tr key={aumento.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                            {emp?.nombre?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</div>
                            <div className="text-xs text-gray-400">{emp?.puesto}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">₡ {aumento.salario_anterior?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">₡ {aumento.salario_nuevo?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge className="bg-blue-100 text-blue-700">+{aumento.porcentaje_aumento}%</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={motivoColor[aumento.motivo]}>{motivoLabel[aumento.motivo]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(aumento.fecha_efectiva).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button onClick={() => handleEdit(aumento)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 inline-block">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteAumento.mutate(aumento.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 inline-block">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog registro manual */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAumento ? "Editar Aumento" : "Registrar Aumento Salarial"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 mt-4">
            <div className="space-y-1">
              <Label>Empleado *</Label>
              <Select value={empleadoId} onValueChange={setEmpleadoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>
                  {empleados.filter(e => e.empresa_id === empresaId).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Salario Anterior *</Label>
                <Input type="number" value={salarioAnterior} onChange={e => setSalarioAnterior(e.target.value)} placeholder="0.00" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label>Salario Nuevo *</Label>
                <Input type="number" value={salarioNuevo} onChange={e => setSalarioNuevo(e.target.value)} placeholder="0.00" step="0.01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fecha Efectiva *</Label>
              <Input type="date" value={fechaEfectiva} onChange={e => setFechaEfectiva(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(motivoLabel).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Notas adicionales..." rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleSave}>
              {selectedAumento ? "Actualizar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal importar Excel */}
      <ImportarAumentosModal
        open={importOpen}
        onOpenChange={setImportOpen}
        empresaId={empresaId}
        empleados={empleados.filter(e => e.empresa_id === empresaId)}
        onSuccess={() => qc.invalidateQueries(["aumentos"])}
      />
    </div>
  );
}