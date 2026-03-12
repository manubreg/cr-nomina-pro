import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { User, Phone, Mail, Calendar, Building2 } from "lucide-react";

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

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (!empleado) return <div className="p-8 text-center text-gray-400">No se encontró información de empleado.</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-700 text-2xl font-bold">{empleado.nombre?.[0]}{empleado.apellidos?.[0]}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{empleado.nombre} {empleado.apellidos}</h1>
          <p className="text-gray-500 text-sm">{empleado.puesto || "Empleado"} {empresa ? `· ${empresa.nombre_comercial || empresa.nombre_legal}` : ""}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Datos Personales</h2>
        <InfoRow label="Identificación" value={`${empleado.tipo_identificacion?.toUpperCase()} ${empleado.identificacion}`} />
        <InfoRow label="Fecha de Nacimiento" value={empleado.fecha_nacimiento} />
        <InfoRow label="Género" value={empleado.genero} />
        <InfoRow label="Nacionalidad" value={empleado.nacionalidad} />
        <InfoRow label="Dirección" value={empleado.direccion} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> Contacto</h2>
        <InfoRow label="Correo" value={empleado.correo} />
        <InfoRow label="Teléfono" value={empleado.telefono} />
        <InfoRow label="Contacto Emergencia" value={empleado.contacto_emergencia_nombre} />
        <InfoRow label="Tel. Emergencia" value={empleado.contacto_emergencia_tel} />
      </div>

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