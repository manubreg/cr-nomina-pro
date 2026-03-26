import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { UserCog, Mail, Shield, Building2, Pencil, UserPlus, CheckCircle2, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { useToast } from "@/components/ui/use-toast";

const roleColor = { admin: "bg-purple-100 text-purple-700", admin_rrhh: "bg-blue-100 text-blue-700", empleado: "bg-emerald-100 text-emerald-700" };
const roleLabel = { admin: "Super Admin", admin_rrhh: "Admin RRHH", empleado: "Empleado" };

export default function Usuarios() {
  const qc = useQueryClient();
  const { empresas, empresaId: ctxEmpresaId, filterByEmpresa } = useEmpresaContext();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin_rrhh");
  const [empresaId, setEmpresaId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [invitandoEmpleado, setInvitandoEmpleado] = useState(null); // empleado.id en proceso
  const [tab, setTab] = useState("usuarios"); // "usuarios" | "accesos"

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["users"]); setEditOpen(false); },
  });

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    setMsg("");
    const baseRole = role === "admin" ? "admin" : "user";
    await base44.users.inviteUser(email, baseRole);
    setMsg("Invitación enviada. Asigna empresa y rol después de que el usuario se registre.");
    setEmail("");
    setLoading(false);
  };

  // Invitar empleado al portal directamente
  const handleInvitarEmpleado = async (emp) => {
    if (!emp.correo) {
      toast({ title: "Sin correo", description: `${emp.nombre} ${emp.apellidos} no tiene correo registrado.`, variant: "destructive" });
      return;
    }
    setInvitandoEmpleado(emp.id);
    await base44.users.inviteUser(emp.correo, "user");
    toast({ title: "✅ Invitación enviada", description: `Se envió acceso al portal a ${emp.correo}` });
    setInvitandoEmpleado(null);
  };

  // Empleados que YA tienen acceso (tienen usuario vinculado con rol empleado)
  const empleadosConAcceso = new Set(users.filter(u => u.role === "empleado" && u.empleado_id).map(u => u.empleado_id));
  const empleadosFiltradosAcceso = filterByEmpresa(empleados).filter(e => e.estado === "activo");

  const openEdit = (u) => {
    setSelectedUser(u);
    setRole(u.role || "admin_rrhh");
    setEmpresaId(u.empresa_id || "");
    setEmpleadoId(u.empleado_id || "");
    setEditOpen(true);
  };

  const handleSave = () => {
    updateUser.mutate({ id: selectedUser.id, data: { role, empresa_id: empresaId, empleado_id: empleadoId } });
  };

  // Filtrar empleados por empresa seleccionada en el edit
  const empleadosFiltrados = empresaId ? empleados.filter(e => e.empresa_id === empresaId) : empleados;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de acceso y roles por empresa</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-blue-700 hover:bg-blue-800">
          <Mail className="w-4 h-4 mr-2" /> Invitar Usuario
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("usuarios")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === "usuarios" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />Usuarios del Sistema
        </button>
        <button
          onClick={() => setTab("accesos")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === "accesos" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />Accesos de Empleados
        </button>
      </div>

      {tab === "usuarios" && <>
      {/* Leyenda de roles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { role: "admin", desc: "Ve y gestiona todas las empresas" },
          { role: "admin_rrhh", desc: "Gestiona solo su empresa asignada" },
          { role: "empleado", desc: "Portal personal: colillas y vacaciones" },
        ].map(r => (
          <div key={r.role} className="bg-white border border-gray-200 rounded-lg p-3">
            <Badge className={roleColor[r.role]}>{roleLabel[r.role]}</Badge>
            <p className="text-xs text-gray-500 mt-1.5">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando usuarios...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Empleado Vinculado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => {
                  const empresa = empresas.find(e => e.id === u.empresa_id);
                  const empleado = empleados.find(e => e.id === u.empleado_id);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-700 text-xs font-bold">{u.full_name?.[0] || u.email?.[0] || "U"}</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{u.full_name || "—"}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={roleColor[u.role] || "bg-gray-100 text-gray-600"}>
                          <Shield className="w-3 h-3 mr-1" />{roleLabel[u.role] || u.role || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                        {empresa ? (
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{empresa.nombre_comercial || empresa.nombre_legal}</span>
                        ) : u.role === "admin" ? <span className="text-purple-600 font-medium">Todas</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden lg:table-cell">
                        {empleado ? `${empleado.nombre} ${empleado.apellidos}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50">
                          <Pencil className="w-4 h-4" />
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

      </>}

      {tab === "accesos" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Accesos al Portal del Empleado</p>
              <p className="text-xs text-gray-400 mt-0.5">Gestiona quién puede ingresar al portal de autoservicio</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full inline-block" /> Con acceso</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full inline-block" /> Sin acceso</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Correo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado Acceso</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empleadosFiltradosAcceso.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No hay empleados activos</td></tr>
                ) : empleadosFiltradosAcceso.map(emp => {
                  const tieneAcceso = empleadosConAcceso.has(emp.id);
                  const empresa = empresas.find(e => e.id === emp.empresa_id);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold">
                            {emp.nombre?.[0]}{emp.apellidos?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{emp.nombre} {emp.apellidos}</div>
                            <div className="text-xs text-gray-400">{emp.puesto || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                        {empresa?.nombre_comercial || empresa?.nombre_legal || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                        {emp.correo || <span className="text-orange-400">Sin correo</span>}
                      </td>
                      <td className="px-4 py-3">
                        {tieneAcceso ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Con acceso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                            Sin acceso
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!tieneAcceso && (
                          <button
                            onClick={() => handleInvitarEmpleado(emp)}
                            disabled={invitandoEmpleado === emp.id || !emp.correo}
                            title={!emp.correo ? "El empleado no tiene correo registrado" : "Invitar al portal"}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {invitandoEmpleado === emp.id
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                              : <><UserPlus className="w-3 h-3" /> Invitar</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar Usuario</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-1">
              <Label>Correo Electrónico *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label>Rol inicial</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_rrhh">Admin RRHH</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                  <SelectItem value="admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded p-2">Después de que el usuario se registre, asígnale empresa y empleado vinculado desde la tabla.</p>
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleInvite} disabled={loading}>
              {loading ? "Enviando..." : "Enviar Invitación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role/Empresa Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Configurar Acceso — {selectedUser?.full_name || selectedUser?.email}</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Super Admin</SelectItem>
                  <SelectItem value="admin_rrhh">Admin RRHH</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== "admin" && (
              <div className="space-y-1">
                <Label>Empresa Asignada *</Label>
                <Select value={empresaId} onValueChange={v => { setEmpresaId(v); setEmpleadoId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {role === "empleado" && empresaId && (
              <div className="space-y-1">
                <Label>Empleado Vinculado *</Label>
                <Select value={empleadoId} onValueChange={setEmpleadoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                  <SelectContent>
                    {empleadosFiltrados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={handleSave} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}