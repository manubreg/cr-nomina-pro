import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { User, Phone, Mail, Building2, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-400 uppercase w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 mt-1 sm:mt-0">{value || "—"}</span>
    </div>
  );
}

export default function MisDatos() {
  const [empleado, setEmpleado] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (me?.empleado_id) {
        const emp = await base44.entities.Empleado.filter({ id: me.empleado_id });
        const empl = emp[0] || null;
        setEmpleado(empl);
        if (empl?.empresa_id) {
          const emps = await base44.entities.Empresa.filter({ id: empl.empresa_id });
          setEmpresa(emps[0] || null);
        }
      }
      setLoading(false);
    });
  }, []);

  const startEdit = () => {
    setForm({
      fecha_nacimiento: empleado.fecha_nacimiento || "",
      genero: empleado.genero || "no_especificado",
      nacionalidad: empleado.nacionalidad || "",
      direccion: empleado.direccion || "",
      correo: empleado.correo || "",
      telefono: empleado.telefono || "",
      contacto_emergencia_nombre: empleado.contacto_emergencia_nombre || "",
      contacto_emergencia_tel: empleado.contacto_emergencia_tel || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = await base44.entities.Empleado.update(empleado.id, form);
    setEmpleado(prev => ({ ...prev, ...form }));
    setEditing(false);
    setSaving(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (!empleado) return <div className="p-8 text-center text-gray-400">No se encontró información de empleado.</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-700 text-2xl font-bold">{empleado.nombre?.[0]}{empleado.apellidos?.[0]}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{empleado.nombre} {empleado.apellidos}</h1>
            <p className="text-gray-500 text-sm">{empleado.puesto || "Empleado"} {empresa ? `· ${empresa.nombre_comercial || empresa.nombre_legal}` : ""}</p>
          </div>
        </div>
        {!editing ? (
          <Button variant="outline" onClick={startEdit} className="gap-2">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800 gap-2" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      {/* Datos Personales */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Datos Personales</h2>
        {/* Cédula: siempre solo lectura */}
        <InfoRow label="Identificación" value={`${empleado.tipo_identificacion?.toUpperCase()} ${empleado.identificacion}`} />

        {editing ? (
          <div className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha de Nacimiento</Label>
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
                <Label>Nacionalidad</Label>
                <Input value={form.nacionalidad} onChange={e => set("nacionalidad", e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Dirección</Label>
                <Input value={form.direccion} onChange={e => set("direccion", e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <InfoRow label="Fecha de Nacimiento" value={empleado.fecha_nacimiento} />
            <InfoRow label="Género" value={empleado.genero} />
            <InfoRow label="Nacionalidad" value={empleado.nacionalidad} />
            <InfoRow label="Dirección" value={empleado.direccion} />
          </>
        )}
      </div>

      {/* Contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> Contacto</h2>
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Correo</Label>
              <Input type="email" value={form.correo} onChange={e => set("correo", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => set("telefono", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Contacto Emergencia</Label>
              <Input value={form.contacto_emergencia_nombre} onChange={e => set("contacto_emergencia_nombre", e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1">
              <Label>Tel. Emergencia</Label>
              <Input value={form.contacto_emergencia_tel} onChange={e => set("contacto_emergencia_tel", e.target.value)} placeholder="8888-8888" />
            </div>
          </div>
        ) : (
          <>
            <InfoRow label="Correo" value={empleado.correo} />
            <InfoRow label="Teléfono" value={empleado.telefono} />
            <InfoRow label="Contacto Emergencia" value={empleado.contacto_emergencia_nombre} />
            <InfoRow label="Tel. Emergencia" value={empleado.contacto_emergencia_tel} />
          </>
        )}
      </div>

      {/* Datos Laborales — siempre solo lectura */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Datos Laborales</h2>
        <InfoRow label="Fecha Ingreso" value={empleado.fecha_ingreso} />
        <InfoRow label="Jornada" value={empleado.tipo_jornada} />
        <InfoRow label="Horas Jornada" value={empleado.horas_jornada ? `${empleado.horas_jornada} horas` : null} />
        <InfoRow label="Frecuencia de Pago" value={empleado.frecuencia_pago} />
        <InfoRow label="Banco" value={empleado.banco} />
        <InfoRow label="IBAN" value={empleado.cuenta_iban} />
      </div>
    </div>
  );
}