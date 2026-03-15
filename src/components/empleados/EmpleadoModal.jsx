import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save, User, Briefcase, CreditCard, MapPin } from "lucide-react";

const TABS = ["Personal", "Laboral", "Bancario", "Otros"];

export default function EmpleadoModal({ empleado, departamentos, onClose, onSaved }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(empleado || {
    empresa_id: "empresa_demo",
    nombre: "", apellidos: "", identificacion: "",
    tipo_identificacion: "cedula", fecha_nacimiento: "",
    fecha_ingreso: "", estado: "activo", genero: "no_especificado",
    nacionalidad: "costarricense", puesto: "", departamento_id: "",
    salario_base: "", frecuencia_pago: "mensual", moneda: "CRC",
    tipo_jornada: "diurna", horas_jornada: 8, correo: "", telefono: "",
    banco: "", cuenta_bancaria: "", cuenta_iban: "",
    asegurado_ccss: true, observaciones: ""
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (empleado?.id) {
      await base44.entities.Empleado.update(empleado.id, form);
    } else {
      const codigo = `EMP-${Date.now().toString().slice(-6)}`;
      await base44.entities.Empleado.create({ ...form, codigo_empleado: form.codigo_empleado || codigo });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const F = ({ label, children, required }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  const Input = ({ field, type = "text", ...props }) => (
    <input
      type={type}
      value={form[field] || ""}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  );

  const Select = ({ field, options }) => (
    <select
      value={form[field] || ""}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {empleado ? "Editar Empleado" : "Nuevo Empleado"}
            </h2>
            {empleado && <p className="text-xs text-gray-400">{empleado.nombre} {empleado.apellidos}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <F label="Nombre" required><Input field="nombre" placeholder="Nombre(s)" /></F>
              <F label="Apellidos" required><Input field="apellidos" placeholder="Apellidos" /></F>
              <F label="Tipo ID">
                <Select field="tipo_identificacion" options={[
                  { value: "cedula", label: "Cédula" },
                  { value: "dimex", label: "DIMEX" },
                  { value: "pasaporte", label: "Pasaporte" },
                ]} />
              </F>
              <F label="Identificación" required><Input field="identificacion" placeholder="0-0000-0000" /></F>
              <F label="Fecha Nacimiento"><Input field="fecha_nacimiento" type="date" /></F>
              <F label="Fecha Ingreso" required><Input field="fecha_ingreso" type="date" /></F>
              <F label="Género">
                <Select field="genero" options={[
                  { value: "masculino", label: "Masculino" },
                  { value: "femenino", label: "Femenino" },
                  { value: "no_especificado", label: "No especificado" },
                ]} />
              </F>
              <F label="Nacionalidad"><Input field="nacionalidad" placeholder="Costarricense" /></F>
              <F label="Correo"><Input field="correo" type="email" placeholder="correo@ejemplo.com" /></F>
              <F label="Teléfono"><Input field="telefono" placeholder="8888-8888" /></F>
              <div className="col-span-2">
                <F label="Dirección"><Input field="direccion" placeholder="Dirección completa" /></F>
              </div>
              <F label="Contacto Emergencia"><Input field="contacto_emergencia_nombre" placeholder="Nombre" /></F>
              <F label="Tel. Emergencia"><Input field="contacto_emergencia_tel" placeholder="8888-8888" /></F>
            </div>
          )}

          {tab === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <F label="Código Empleado"><Input field="codigo_empleado" placeholder="EMP-001" /></F>
              <F label="Estado">
                <Select field="estado" options={[
                  { value: "activo", label: "Activo" },
                  { value: "suspendido", label: "Suspendido" },
                  { value: "inactivo", label: "Inactivo" },
                  { value: "liquidado", label: "Liquidado" },
                ]} />
              </F>
              <F label="Puesto" required><Input field="puesto" placeholder="Ej. Analista de TI" /></F>
              <F label="Departamento">
                <select value={form.departamento_id || ""} onChange={e => set("departamento_id", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Sin departamento —</option>
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </F>
              <F label="Salario Base" required>
                <input type="number" value={form.salario_base || ""} onChange={e => set("salario_base", parseFloat(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="750000" />
              </F>
              <F label="Tipo Salario">
                <Select field="tipo_salario" options={[
                  { value: "mensual", label: "Mensual" },
                  { value: "quincenal", label: "Quincenal" },
                  { value: "semanal", label: "Semanal" },
                  { value: "por_hora", label: "Por Hora" },
                ]} />
              </F>
              <F label="Frecuencia de Pago">
                <Select field="frecuencia_pago" options={[
                  { value: "mensual", label: "Mensual" },
                  { value: "quincenal", label: "Quincenal" },
                  { value: "semanal", label: "Semanal" },
                ]} />
              </F>
              <F label="Tipo Jornada">
                <Select field="tipo_jornada" options={[
                  { value: "diurna", label: "Diurna" },
                  { value: "mixta", label: "Mixta" },
                  { value: "nocturna", label: "Nocturna" },
                ]} />
              </F>
              <F label="Horas Jornada">
                <input type="number" value={form.horas_jornada || 8} onChange={e => set("horas_jornada", parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </F>
              <F label="Sucursal"><Input field="sucursal" placeholder="Oficina central" /></F>
            </div>
          )}

          {tab === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <F label="Banco"><Input field="banco" placeholder="BCR, BNCR, BAC..." /></F>
              <F label="Número de Cuenta"><Input field="cuenta_bancaria" placeholder="000-000000-0" /></F>
              <div className="col-span-2">
                <F label="Cuenta IBAN"><Input field="cuenta_iban" placeholder="CR00 0000 0000 0000 0000 00" /></F>
              </div>
              <F label="SINPE Móvil"><Input field="sinpe_movil" placeholder="8888-8888" /></F>
              <F label="Asegurado CCSS">
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="ccss" checked={form.asegurado_ccss || false}
                    onChange={e => set("asegurado_ccss", e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="ccss" className="text-sm text-gray-600">Asegurado en CCSS</label>
                </div>
              </F>
            </div>
          )}

          {tab === 3 && (
            <div className="grid grid-cols-1 gap-4">
              <F label="Fecha Salida"><Input field="fecha_salida" type="date" /></F>
              <F label="Observaciones">
                <textarea value={form.observaciones || ""} onChange={e => set("observaciones", e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones internas..." />
              </F>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex gap-2">
            {tab > 0 && <button onClick={() => setTab(tab - 1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">Anterior</button>}
            {tab < TABS.length - 1 && <button onClick={() => setTab(tab + 1)} className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">Siguiente</button>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}