import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { UserCog, Mail, Shield, Building2, Pencil, X, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresaContext } from "@/components/EmpresaContext";

const roleColor = { admin: "bg-purple-100 text-purple-700", admin_rrhh: "bg-blue-100 text-blue-700", empleado: "bg-emerald-100 text-emerald-700", user: "bg-yellow-100 text-yellow-700" };
const roleLabel = { admin: "Super Admin", admin_rrhh: "Admin RRHH", empleado: "Empleado", user: "Sin acceso" };

export default function Usuarios() {
  const qc = useQueryClient();
  const { empresas } = useEmpresaContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [empresaId, setEmpresaId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [rolPersonalizadoId, setRolPersonalizadoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => base44.entities.RolPersonalizado.list(),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["users"]); setEditOpen(false); },
  });

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    setMsg("");
    // Invitar sin acceso inicial; el admin configura luego
    await base44.users.inviteUser(email, "user");
    setMsg("Invitación enviada. El usuario no tendrá acceso hasta que le asignes un rol desde la tabla.");
    setEmail("");
    setLoading(false);
  };

  const openEdit = (u) => {
    setSelectedUser(u);
    setRole(u.role || "admin_rrhh");
    setEmpresaId(u.empresa_id || "");
    setEmpleadoId(u.empleado_id || "");
    setRolPersonalizadoId(u.rol_personalizado_id || "");
    setEditOpen(true);
  };

  const handleSave = () => {
    const data = { role };
    if (role !== "user") {
      data.empresa_id = empresaId || null;
      data.empleado_id = empleadoId || null;
      data.rol_personalizado_id = rolPersonalizadoId || null;
    }
    updateUser.mutate({ id: selectedUser.id, data });
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

      {/* Alerta usuarios pendientes */}
      {users.filter(u => u.role === "user").length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {users.filter(u => u.role === "user").length} usuario(s) sin acceso configurado
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Los usuarios marcados con <Badge className="bg-yellow-100 text-yellow-700 text-xs">Sin acceso</Badge> no pueden ingresar al sistema. Edítalos para asignarles un rol y empresa.
            </p>
          </div>
        </div>
      )}

      {/* Leyenda de roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
        {roles.filter(r => r.estado === "activo").map(r => (
          <div key={r.id} className="bg-white border border-blue-200 rounded-lg p-3">
            <Badge className="bg-blue-100 text-blue-700"><ShieldCheck className="w-3 h-3 mr-1" />{r.nombre}</Badge>
            <p className="text-xs text-gray-500 mt-1.5">{r.descripcion || "Rol personalizado"}</p>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Rol Personalizado</th>
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
                      <td className="px-4 py-3 text-xs hidden xl:table-cell">
                        {(() => {
                          const rp = roles.find(r => r.id === u.rol_personalizado_id);
                          return rp ? (
                            <span className="flex items-center gap-1 text-blue-700"><ShieldCheck className="w-3 h-3" />{rp.nombre}</span>
                          ) : "—";
                        })()}
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

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar Usuario</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-1">
              <Label>Correo Electrónico *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              El usuario será invitado <strong>sin acceso</strong>. Luego de que se registre, podrás asignarle un rol y empresa desde la tabla.
            </div>
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
                  <SelectItem value="user">Sin acceso (pendiente)</SelectItem>
                  <SelectItem value="admin_rrhh">Admin RRHH</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                  <SelectItem value="admin">Super Admin</SelectItem>
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
            {role === "admin_rrhh" && (
              <div className="space-y-1">
                <Label>Rol Personalizado (opcional)</Label>
                <Select value={rolPersonalizadoId || "ninguno"} onValueChange={v => setRolPersonalizadoId(v === "ninguno" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin restricción de módulos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin restricción (acceso completo)</SelectItem>
                    {roles.filter(r => r.estado === "activo").map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">Si asigna un rol, el usuario solo verá los módulos definidos en ese rol.</p>
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