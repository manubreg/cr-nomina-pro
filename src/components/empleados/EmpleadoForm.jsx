import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MoneyInput from "./MoneyInput";

const empty = {
  nombre: "", apellidos: "", identificacion: "", tipo_identificacion: "cedula",
  fecha_nacimiento: "", fecha_ingreso: "", estado: "activo", genero: "no_especificado",
  nacionalidad: "Costa Rica", puesto: "", departamento_id: "", empresa_id: "",
  correo: "", telefono: "", direccion: "", salario_base: "",
  frecuencia_pago: "mensual", moneda: "CRC", tipo_jornada: "diurna", horas_jornada: 8,
  banco: "", cuenta_bancaria: "", cuenta_iban: "", sinpe_movil: "",
  asegurado_ccss: true, observaciones: "", codigo_empleado: "", centro_costo_id: "", jefatura_id: ""
};

export default function EmpleadoForm({ open, onClose, editId, empresas = [], departamentos: depsPropsssss = [], centrosCosto = [], puestos = [], empleados = [] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [jefaturaBusqueda, setJefaturaBusqueda] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: departamentosApi = [] } = useQuery({
    queryKey: ["departamentos", form.empresa_id],
    queryFn: () => form.empresa_id ? base44.entities.Departamento.filter({ empresa_id: form.empresa_id }) : Promise.resolve([]),
  });
  
  const { data: centrosCostoApi = [] } = useQuery({
    queryKey: ["centrosCosto", form.empresa_id],
    queryFn: () => form.empresa_id ? base44.entities.CentroCosto.filter({ empresa_id: form.empresa_id }) : Promise.resolve([]),
  });

  const { data: puestosApi = [] } = useQuery({
    queryKey: ["puestos", form.empresa_id],
    queryFn: () => form.empresa_id ? base44.entities.Puesto?.filter?.({ empresa_id: form.empresa_id }) : Promise.resolve([]),
  });
  
  const departamentos = depsPropsssss?.length > 0 ? depsPropsssss : departamentosApi;
  const centrosCostoFinal = centrosCosto?.length > 0 ? centrosCosto : centrosCostoApi;
  const puestosFinal = puestos?.length > 0 ? puestos : puestosApi;

  useEffect(() => {
    if (editId) {
      base44.entities.Empleado.filter({ id: editId }).then(r => r[0] && setForm({ ...empty, ...r[0] }));
    } else {
      setForm(empty);
    }
  }, [editId, open]);

  const save = useMutation({
    mutationFn: (data) => editId ? base44.entities.Empleado.update(editId, data) : base44.entities.Empleado.create(data),
    onSuccess: () => { qc.invalidateQueries(["empleados"]); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="personal">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="laboral">Laboral</TabsTrigger>
            <TabsTrigger value="pago">Pago</TabsTrigger>
            <TabsTrigger value="banco">Banco</TabsTrigger>
          </TabsList>

          {/* Personal */}
          <TabsContent value="personal" className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => set("nombre", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Apellidos *</Label>
              <Input value={form.apellidos} onChange={e => set("apellidos", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo ID</Label>
              <Select value={form.tipo_identificacion} onValueChange={v => set("tipo_identificacion", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cedula">Cédula</SelectItem>
                  <SelectItem value="dimex">DIMEX</SelectItem>
                  <SelectItem value="pasaporte">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Identificación *</Label>
              <Input value={form.identificacion} onChange={e => set("identificacion", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha Nacimiento</Label>
              <Input type="date" value={form.fecha_nacimiento} onChange={e => set("fecha_nacimiento", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Género</Label>
              <Select value={form.genero} onValueChange={v => set("genero", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                  <SelectItem value="no_especificado">No especificado</SelectItem>
                </SelectContent>
              </Select>
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
          </TabsContent>

          {/* Laboral */}
          <TabsContent value="laboral" className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <Label>Código Empleado</Label>
              <Input value={form.codigo_empleado} onChange={e => set("codigo_empleado", e.target.value)} placeholder="EMP-001" />
            </div>
            <div className="space-y-1">
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={v => set("empresa_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha Ingreso *</Label>
              <Input type="date" value={form.fecha_ingreso} onChange={e => set("fecha_ingreso", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Puesto</Label>
              <Select value={form.puesto} onValueChange={v => set("puesto", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar puesto" /></SelectTrigger>
                <SelectContent>
                  {puestosFinal.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Departamento</Label>
              <Select value={form.departamento_id} onValueChange={v => set("departamento_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {departamentos.map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Centro de Costos</Label>
              <Select value={form.centro_costo_id} onValueChange={v => set("centro_costo_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar centro" /></SelectTrigger>
                <SelectContent>
                  {centrosCostoFinal.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Jefatura</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar empleado..."
                  value={jefaturaBusqueda}
                  onChange={e => setJefaturaBusqueda(e.target.value)}
                />
                {jefaturaBusqueda && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {empleados
                      .filter(e => `${e.nombre} ${e.apellidos}`.toLowerCase().includes(jefaturaBusqueda.toLowerCase()))
                      .map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            set("jefatura_id", e.id);
                            setJefaturaBusqueda(`${e.nombre} ${e.apellidos}`);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0"
                        >
                          {e.nombre} {e.apellidos}
                        </button>
                      ))}
                      {empleados.filter(e => `${e.nombre} ${e.apellidos}`.toLowerCase().includes(jefaturaBusqueda.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tipo Jornada</Label>
              <Select value={form.tipo_jornada} onValueChange={v => set("tipo_jornada", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurna">Diurna</SelectItem>
                  <SelectItem value="mixta">Mixta</SelectItem>
                  <SelectItem value="nocturna">Nocturna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Horas Jornada</Label>
              <Input type="number" value={form.horas_jornada} onChange={e => set("horas_jornada", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="suspendido">Suspendido</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="liquidado">Liquidado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Asegurado CCSS</Label>
              <Select value={form.asegurado_ccss ? "si" : "no"} onValueChange={v => set("asegurado_ccss", v === "si")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Pago */}
          <TabsContent value="pago" className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <Label>Salario Base</Label>
              <MoneyInput value={form.salario_base} onChange={v => set("salario_base", v)} moneda={form.moneda} placeholder="750000.00" />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={v => set("moneda", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">Colones (CRC)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frecuencia de Pago</Label>
              <Select value={form.frecuencia_pago} onValueChange={v => set("frecuencia_pago", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Banco */}
          <TabsContent value="banco" className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <Label>Banco</Label>
              <Input value={form.banco} onChange={e => set("banco", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Número de Cuenta</Label>
              <Input value={form.cuenta_bancaria} onChange={e => set("cuenta_bancaria", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>IBAN</Label>
              <Input value={form.cuenta_iban} onChange={e => set("cuenta_iban", e.target.value)} placeholder="CR00 0000 0000 0000 0000 00" />
            </div>
            <div className="space-y-1">
              <Label>SINPE Móvil</Label>
              <Input value={form.sinpe_movil} onChange={e => set("sinpe_movil", e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}