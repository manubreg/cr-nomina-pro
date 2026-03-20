import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, AlertTriangle, CheckCircle2, Clock, Building2, FileText, DollarSign, Umbrella } from "lucide-react";
import { format, addMonths, setDate, setMonth, isAfter, isBefore, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const hoy = new Date();

function generarObligaciones() {
  const year = hoy.getFullYear();
  const obligaciones = [];

  // CCSS mensual - día 10 de cada mes (próximos 6 meses)
  for (let i = 0; i < 6; i++) {
    const fecha = setDate(addMonths(new Date(year, hoy.getMonth(), 1), i), 10);
    obligaciones.push({
      id: `ccss-${i}`,
      titulo: "Pago Planilla CCSS",
      descripcion: "Presentar y pagar planilla mensual ante la Caja Costarricense de Seguro Social.",
      fecha,
      categoria: "ccss",
      icono: Building2,
      referencia: "Art. 31 Ley Constitutiva CCSS",
    });
  }

  // INS mensual - día 15 de cada mes (próximos 6 meses)
  for (let i = 0; i < 6; i++) {
    const fecha = setDate(addMonths(new Date(year, hoy.getMonth(), 1), i), 15);
    obligaciones.push({
      id: `ins-${i}`,
      titulo: "Pago Póliza INS (RT)",
      descripcion: "Pago de la póliza de riesgos del trabajo al Instituto Nacional de Seguros.",
      fecha,
      categoria: "ins",
      icono: Building2,
      referencia: "Ley de Riesgos del Trabajo",
    });
  }

  // Aguinaldo - 20 de diciembre
  const aguinaldo = new Date(year, 11, 20);
  obligaciones.push({
    id: "aguinaldo",
    titulo: "Pago de Aguinaldo",
    descripcion: "Pago obligatorio del aguinaldo proporcional a todos los empleados activos.",
    fecha: aguinaldo,
    categoria: "laboral",
    icono: DollarSign,
    referencia: "Art. 1 Ley de Aguinaldo (N° 2412)",
  });

  // Si ya pasó el aguinaldo de este año, agregar el del próximo
  if (isAfter(hoy, aguinaldo)) {
    obligaciones.push({
      id: "aguinaldo-next",
      titulo: "Pago de Aguinaldo",
      descripcion: "Pago obligatorio del aguinaldo proporcional a todos los empleados activos.",
      fecha: new Date(year + 1, 11, 20),
      categoria: "laboral",
      icono: DollarSign,
      referencia: "Art. 1 Ley de Aguinaldo (N° 2412)",
    });
  }

  // D-151 Hacienda - 15 de marzo
  const d151 = new Date(year, 2, 15);
  obligaciones.push({
    id: "d151",
    titulo: "Declaración D-151 (ISR Hacienda)",
    descripcion: "Presentar declaración anual de retenciones del impuesto sobre la renta a empleados.",
    fecha: d151,
    categoria: "hacienda",
    icono: FileText,
    referencia: "Art. 23 Ley del Impuesto sobre la Renta",
  });
  if (isAfter(hoy, d151)) {
    obligaciones.push({
      id: "d151-next",
      titulo: "Declaración D-151 (ISR Hacienda)",
      descripcion: "Presentar declaración anual de retenciones del impuesto sobre la renta a empleados.",
      fecha: new Date(year + 1, 2, 15),
      categoria: "hacienda",
      icono: FileText,
      referencia: "Art. 23 Ley del Impuesto sobre la Renta",
    });
  }

  // Decreto salarios mínimos - enero y julio
  [new Date(year, 0, 1), new Date(year, 6, 1), new Date(year + 1, 0, 1)].forEach((fecha, idx) => {
    obligaciones.push({
      id: `salarios-${idx}`,
      titulo: "Entrada en vigor Decreto Salarios Mínimos",
      descripcion: "Verificar y actualizar salarios de empleados con base en el decreto del MTSS.",
      fecha,
      categoria: "mtss",
      icono: DollarSign,
      referencia: "Art. 177 Código de Trabajo - MTSS",
    });
  });

  // Vacaciones acumuladas - recordatorio trimestral (heurístico)
  for (let i = 1; i <= 4; i++) {
    const fecha = addMonths(new Date(year, 0, 1), i * 3);
    obligaciones.push({
      id: `vacaciones-${i}`,
      titulo: "Revisión Saldos de Vacaciones",
      descripcion: "Verificar saldos vencidos o próximos a vencer según antigüedad de los empleados.",
      fecha,
      categoria: "laboral",
      icono: Umbrella,
      referencia: "Art. 153-162 Código de Trabajo",
    });
  }

  return obligaciones.sort((a, b) => a.fecha - b.fecha);
}

const categoriaConfig = {
  ccss:     { label: "CCSS",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  ins:      { label: "INS",       color: "bg-purple-100 text-purple-700 border-purple-200" },
  hacienda: { label: "Hacienda",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  mtss:     { label: "MTSS",      color: "bg-green-100 text-green-700 border-green-200" },
  laboral:  { label: "Laboral",   color: "bg-teal-100 text-teal-700 border-teal-200" },
};

function getEstado(fecha) {
  const dias = differenceInDays(fecha, hoy);
  if (dias < 0) return { label: "Vencida", color: "bg-red-100 text-red-700", icon: AlertTriangle };
  if (dias <= 7) return { label: `${dias}d`, color: "bg-red-50 text-red-600", icon: AlertTriangle };
  if (dias <= 15) return { label: `${dias}d`, color: "bg-amber-100 text-amber-700", icon: Clock };
  if (dias <= 30) return { label: `${dias}d`, color: "bg-yellow-50 text-yellow-700", icon: Clock };
  return { label: `${dias}d`, color: "bg-green-50 text-green-700", icon: CheckCircle2 };
}

export default function CalendarioObligaciones() {
  const obligaciones = useMemo(() => generarObligaciones(), []);

  const proximas = obligaciones.filter(o => differenceInDays(o.fecha, hoy) >= 0 && differenceInDays(o.fecha, hoy) <= 30);
  const vencidas = obligaciones.filter(o => differenceInDays(o.fecha, hoy) < 0);
  const futuras = obligaciones.filter(o => differenceInDays(o.fecha, hoy) > 30);

  const seccion = (titulo, items, colorHeader) => (
    items.length > 0 && (
      <div>
        <h3 className={`text-sm font-semibold mb-3 ${colorHeader}`}>{titulo} ({items.length})</h3>
        <div className="space-y-3">
          {items.map(o => {
            const estado = getEstado(o.fecha);
            const cat = categoriaConfig[o.categoria];
            const Icon = o.icono;
            const EstadoIcon = estado.icon;
            return (
              <div key={o.id} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">{o.titulo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>{cat.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{o.descripcion}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-gray-400">📅 {format(o.fecha, "dd 'de' MMMM yyyy", { locale: es })}</span>
                    <span className="text-xs text-gray-400">📋 {o.referencia}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-start">
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${estado.color}`}>
                    <EstadoIcon className="w-3 h-3" />
                    {estado.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de Obligaciones Legales</h1>
          <p className="text-sm text-gray-500">Costa Rica · {format(hoy, "MMMM yyyy", { locale: es })}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Vencidas</p>
                <p className="text-3xl font-bold text-red-700">{vencidas.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Próximas 30 días</p>
                <p className="text-3xl font-bold text-amber-700">{proximas.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Futuras</p>
                <p className="text-3xl font-bold text-green-700">{futuras.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda categorías */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoriaConfig).map(([k, v]) => (
          <span key={k} className={`text-xs px-3 py-1 rounded-full border font-medium ${v.color}`}>{v.label}</span>
        ))}
      </div>

      {/* Listado */}
      <div className="space-y-8">
        {seccion("🔴 Vencidas", vencidas, "text-red-600")}
        {seccion("🟡 Próximas 30 días", proximas, "text-amber-600")}
        {seccion("🟢 Futuras", futuras, "text-green-700")}
      </div>
    </div>
  );
}