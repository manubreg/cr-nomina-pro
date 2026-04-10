import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ArrowLeft, User, Briefcase, CreditCard, FileText, Activity, Calendar, ChevronRight, TrendingUp, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const estadoColor = { activo: "bg-emerald-100 text-emerald-700", suspendido: "bg-amber-100 text-amber-700", inactivo: "bg-gray-100 text-gray-600", liquidado: "bg-red-100 text-red-600" };
const InfoRow = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-800">{value || "—"}</span>
  </div>
);

export default function EmpleadoPerfil() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const [emp, setEmp] = useState(null);
  const [contratos, setContratos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [aumentos, setAumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editContacto, setEditContacto] = useState(false);
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTel, setContactoTel] = useState("");
  const [savingContacto, setSavingContacto] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      base44.entities.Empleado.filter({ id }),
      base44.entities.Contrato.filter({ empleado_id: id }),
      base44.entities.DocumentoEmpleado.filter({ empleado_id: id }),
      base44.entities.Novedad.filter({ empleado_id: id }),
      base44.entities.HistorialSalario.filter({ empleado_id: id }),
    ]).then(([emps, contratos, docs, novedades, aumentos]) => {
      const e = emps[0];
      setEmp(e);
      setContactoNombre(e?.contacto_emergencia_nombre || "");
      setContactoTel(e?.contacto_emergencia_tel || "");
      setContratos(contratos);
      setDocumentos(docs);
      setNovedades(novedades);
      setAumentos(aumentos.sort((a, b) => new Date(b.fecha_efectiva) - new Date(a.fecha_efectiva)));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-10 text-center text-gray-400">Cargando perfil...</div>;
  if (!emp) return <div className="p-10 text-center text-gray-400">Empleado no encontrado.</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/Empleados" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{emp.nombre} {emp.apellidos}</h1>
          <p className="text-gray-500 text-sm">{emp.puesto || "Sin puesto asignado"}</p>
        </div>
        <Badge className={estadoColor[emp.estado]}>{emp.estado}</Badge>
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal"><User className="w-3.5 h-3.5 mr-1.5" />Personal</TabsTrigger>
          <TabsTrigger value="laboral"><Briefcase className="w-3.5 h-3.5 mr-1.5" />Laboral</TabsTrigger>
          <TabsTrigger value="contratos"><FileText className="w-3.5 h-3.5 mr-1.5" />Contratos ({contratos.length})</TabsTrigger>
          <TabsTrigger value="documentos"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Documentos ({documentos.length})</TabsTrigger>
          <TabsTrigger value="novedades"><Activity className="w-3.5 h-3.5 mr-1.5" />Novedades ({novedades.length})</TabsTrigger>
          <TabsTrigger value="aumentos"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Aumentos ({aumentos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-lg">
            <InfoRow label="Identificación" value={`${emp.tipo_identificacion?.toUpperCase()} - ${emp.identificacion}`} />
            <InfoRow label="Fecha Nacimiento" value={emp.fecha_nacimiento} />
            <InfoRow label="Género" value={emp.genero} />
            <InfoRow label="Nacionalidad" value={emp.nacionalidad} />
            <InfoRow label="Correo" value={emp.correo} />
            <InfoRow label="Teléfono" value={emp.telefono} />
            <InfoRow label="Dirección" value={emp.direccion} />
            <div className="flex justify-between py-2 border-b border-gray-100 items-center">
              <span className="text-sm text-gray-500">Contacto Emergencia</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {emp.contacto_emergencia_nombre ? (
                    <span>{emp.contacto_emergencia_nombre}{emp.contacto_emergencia_tel ? ` · ${emp.contacto_emergencia_tel}` : ""}</span>
                  ) : "—"}
                </span>
                <button onClick={() => setEditContacto(true)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Modal Editar Contacto Emergencia */}
          <Dialog open={editContacto} onOpenChange={setEditContacto}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Contacto de Emergencia</DialogTitle></DialogHeader>
              <div className="grid gap-4 mt-2">
                <div className="space-y-1">
                  <Label>Nombre del Contacto</Label>
                  <Input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono del Contacto</Label>
                  <Input value={contactoTel} onChange={e => setContactoTel(e.target.value)} placeholder="Ej: 8888-1234" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setEditContacto(false)}>Cancelar</Button>
                <Button className="bg-blue-700 hover:bg-blue-800" disabled={savingContacto} onClick={async () => {
                  setSavingContacto(true);
                  await base44.entities.Empleado.update(emp.id, {
                    contacto_emergencia_nombre: contactoNombre,
                    contacto_emergencia_tel: contactoTel,
                  });
                  setEmp({ ...emp, contacto_emergencia_nombre: contactoNombre, contacto_emergencia_tel: contactoTel });
                  setSavingContacto(false);
                  setEditContacto(false);
                }}>
                  {savingContacto ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="laboral" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-lg">
            <InfoRow label="Fecha Ingreso" value={emp.fecha_ingreso} />
            <InfoRow label="Salario Base" value={emp.salario_base ? `₡ ${Number(emp.salario_base).toLocaleString()}` : "—"} />
            <InfoRow label="Tipo Salario" value={emp.tipo_salario} />
            <InfoRow label="Frecuencia Pago" value={emp.frecuencia_pago} />
            <InfoRow label="Jornada" value={`${emp.tipo_jornada} - ${emp.horas_jornada}h`} />
            <InfoRow label="CCSS" value={emp.asegurado_ccss ? "Asegurado" : "No asegurado"} />
            <InfoRow label="Banco" value={emp.banco} />
            <InfoRow label="IBAN" value={emp.cuenta_iban} />
          </div>
        </TabsContent>

        <TabsContent value="contratos" className="mt-4">
          {contratos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin contratos registrados</div>
          ) : (
            <div className="space-y-3">
              {contratos.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800 capitalize">{c.tipo_contrato}</span>
                    <Badge className={c.estado === "activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>{c.estado}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-gray-500">
                    <div><span className="text-xs block">Inicio</span>{c.fecha_inicio}</div>
                    <div><span className="text-xs block">Fin</span>{c.fecha_fin || "Indefinido"}</div>
                    <div><span className="text-xs block">Salario</span>₡ {Number(c.salario_pactado).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          {documentos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin documentos cargados</div>
          ) : (
            <div className="space-y-2">
              {documentos.map(d => (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-800">{d.nombre_archivo}</div>
                    <div className="text-xs text-gray-400 capitalize">{d.tipo_documento?.replace(/_/g, " ")} · {d.fecha_documento}</div>
                  </div>
                  {d.url_archivo && (
                    <a href={d.url_archivo} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Ver</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="novedades" className="mt-4">
           {novedades.length === 0 ? (
             <div className="text-center py-10 text-gray-400">Sin novedades registradas</div>
           ) : (
             <div className="space-y-2">
               {novedades.map(n => (
                 <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                   <div>
                     <div className="font-medium text-sm text-gray-800 capitalize">{n.tipo_novedad?.replace(/_/g, " ")}</div>
                     <div className="text-xs text-gray-400">{n.fecha} · {n.cantidad} {n.unidad}</div>
                   </div>
                   <Badge className={n.estado === "aprobada" ? "bg-emerald-100 text-emerald-700" : n.estado === "rechazada" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}>
                     {n.estado}
                   </Badge>
                 </div>
               ))}
             </div>
           )}
         </TabsContent>

        <TabsContent value="aumentos" className="mt-4">
          {aumentos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin registros de aumentos salariales</div>
          ) : (
            <div className="space-y-2">
              {aumentos.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">Aumento Salarial</span>
                      <Badge className="bg-blue-100 text-blue-700">+{a.porcentaje_aumento}%</Badge>
                    </div>
                    <span className="text-xs text-gray-400">{a.fecha_efectiva}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-gray-500">
                    <div><span className="text-xs block text-gray-400">Anterior</span>₡ {Number(a.salario_anterior).toLocaleString()}</div>
                    <div><span className="text-xs block text-gray-400">Nuevo</span><span className="text-emerald-700 font-semibold">₡ {Number(a.salario_nuevo).toLocaleString()}</span></div>
                    <div><span className="text-xs block text-gray-400">Motivo</span><span className="capitalize text-gray-700">{a.motivo?.replace(/_/g, " ")}</span></div>
                  </div>
                  {a.descripcion && <p className="text-xs text-gray-500 mt-2 italic">{a.descripcion}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
    </div>
  );
}