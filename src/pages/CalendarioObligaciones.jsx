import { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, AlertTriangle, CheckCircle2, Clock, Building2, FileText, DollarSign, Umbrella } from "lucide-react";
import { format, addMonths, setDate, isAfter, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const hoy = new Date();

function generarObligaciones() {
  const year = hoy.getFullYear();
  const obligaciones = [];

  for (let i = 0; i < 6; i++) {
    const fecha = setDate(addMonths(new Date(year, hoy.getMonth(), 1), i), 10);
    obligaciones.push({ id: `ccss-${i}`, titulo: "Pago Planilla CCSS", descripcion: "Presentar y pagar planilla mensual ante la Caja Costarricense de Seguro Social.", fecha, categoria: "ccss", icono: Building2, referencia: "Art. 31 Ley Constitutiva CCSS" });
  }

  for (let i = 0; i < 6; i++) {
    const fecha = setDate(addMonths(new Date(year, hoy.getMonth(), 1), i), 15);
    obligaciones.push({ id: `ins-${i}`, titulo: "Pago Póliza INS (RT)", descripcion: "Pago de la póliza de riesgos del trabajo al Instituto Nacional de Seguros.", fecha, categoria: "ins", icono: Building2, referencia: "Ley de Riesgos del Trabajo" });
  }

  const aguinaldo = new Date(year, 11, 20);
  obligaciones.push({ id: "aguinaldo", titulo: "Pago de Aguinaldo", descripcion: "Pago obligatorio del aguinaldo proporcional a todos los empleados activos.", fecha: aguinaldo, categoria: "laboral", icono: DollarSign, referencia: "Art. 1 Ley de Aguinaldo (N° 2412)" });
  if (isAfter(hoy, aguinaldo)) {
    obligaciones.push({ id: "aguinaldo-next", titulo: "Pago de Aguinaldo", descripcion: "Pago obligatorio del aguinaldo proporcional a todos los empleados activos.", fecha: new Date(year + 1, 11, 20), categoria: "laboral", icono: DollarSign, referencia: "Art. 1 Ley de Aguinaldo (N° 2412)" });
  }

  const d151 = new Date(year, 2, 15);
  obligaciones.push({ id: "d151", titulo: "Declaración D-151 (ISR Hacienda)", descripcion: "Presentar declaración anual de retenciones del impuesto sobre la renta a empleados.", fecha: d151, categoria: "hacienda", icono: FileText, referencia: "Art. 23 Ley del Impuesto sobre la Renta" });
  if (isAfter(hoy, d151)) {
    obligaciones.push({ id: "d151-next", titulo: "Declaración D-151 (ISR Hacienda)", descripcion: "Presentar declaración anual de retenciones del impuesto sobre la renta a empleados.", fecha: new Date(year + 1, 2, 15), categoria: "hacienda", icono: FileText, referencia: "Art. 23 Ley del Impuesto sobre la Renta" });
  }

  [new Date(year, 0, 1), new Date(year, 6, 1), new Date(year + 1, 0, 1)].forEach((fecha, idx) => {
    obligaciones.push({ id: `salarios-${idx}`, titulo: "Entrada en vigor Decreto Salarios Mínimos", descripcion: "Verificar y actualizar salarios de empleados con base en el decreto del MTSS.", fecha, categoria: "mtss", icono: DollarSign, referencia: "Art. 177 Código de Trabajo - MTSS" });
  });

  for (let i = 1; i <= 4; i++) {
    const fecha = addMonths(new Date(year, 0, 1), i * 3);
    obligaciones.push({ id: `vacaciones-${i}`, titulo: "Revisión Saldos de Vacaciones", descripcion: "Verificar saldos vencidos o próximos a vencer según antigüedad de los empleados.", fecha, categoria: "laboral", icono: Umbrella, referencia: "Art. 153-162 Código de Trabajo" });
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

  const [completadas, setCompletadas] = useState(() => {
    try {
      const saved = localStorage.getItem("cal_obligaciones_completadas");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleCompletada = useCallback((id) => {
    setCompletadas(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("cal_obligaciones_completadas", JSON.stringify(next));
      return next;
    });
  }, []);

  const pendientes = obligaciones.filter(o => !completadas[o.id]);
  const proximas = pendientes.filter(o => differenceInDays(o.fecha, hoy) >= 0 && differenceInDays(o.fecha, hoy) <= 30);
  const vencidas = pendientes.filter(o => differenceInDays(o.fecha, hoy) < 0);
  const futuras = pendientes.filter(o => differenceInDays(o.fecha, hoy) > 30);
  const totalCompletadas = Object.values(completadas).filter(Boolean).length;

  const renderItem = (o) => {
    const estado = getEstado(o.fecha);
    const cat = categoriaConfig[o.categoria];
    const Icon = o.icono;
    const EstadoIcon = estado.icon;
    const done = !!completadas[o.id];

    return (
      <div
        key={o.id}
        className={`flex gap-4 p-4 rounded-xl border shadow-sm transition-all ${done ? "bg-gray-50 border-gray-200 opacity-60" : "bg-white border-gray-100 hover:shadow-md"}`}
      >
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${done ? "bg-green-100" : "bg-gray-50"}`}>
          {done ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Icon className="w-5 h-5 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${done ? "line-through text-gray-400" : "text-gray-800"}`}>{o.titulo}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>{cat.label}</span>
            {done && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">✓ Completada</span>}
          </div>
          <p className="text-xs text-gray-500 mb-2">{o.descripcion}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-gray-400">📅 {format(o.fecha, "dd 'de' MMMM yyyy", { locale: es })}</span>
            <span className="text-xs text-gray-400">📋 {o.referencia}</span>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {!done && (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${estado.color}`}>
              <EstadoIcon className="w-3 h-3" />
              {estado.label}
            </span>
          )}
          <button
            onClick={() => toggleCompletada(o.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
              done
                ? "border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                : "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
            }`}
          >
            {done ? "Desmarcar" : "Marcar listo"}
          </button>
        </div>
      </div>
    );
  };

  const seccion = (titulo, items, colorHeader) => {
    const diasFiltro = titulo.includes("Vencidas") ? (d) => d < 0
      : titulo.includes("30 días") ? (d) => d >= 0 && d <= 30
      : (d) => d > 30;

    const completadasDeSeccion = obligaciones.filter(o => {
      const dias = differenceInDays(o.fecha, hoy);
      return diasFiltro(dias) && !!completadas[o.id];
    });

    const total = items.length;
    const comp = completadasDeSeccion.length;

    return (total + comp) > 0 && (
      <div>
        <h3 className={`text-sm font-semibold mb-3 ${colorHeader}`}>
          {titulo} ({total} pendiente{total !== 1 ? "s" : ""}{comp > 0 ? `, ${comp} lista${comp !== 1 ? "s" : ""}` : ""})
        </h3>
        <div className="space-y-3">
          {items.map(renderItem)}
          {completadasDeSeccion.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de Obligaciones Legales</h1>
          <p className="text-sm text-gray-500">Costa Rica · {format(hoy, "MMMM yyyy", { locale: es })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Futuras</p>
                <p className="text-3xl font-bold text-blue-700">{futuras.length}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Completadas</p>
                <p className="text-3xl font-bold text-green-700">{totalCompletadas}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(categoriaConfig).map(([k, v]) => (
          <span key={k} className={`text-xs px-3 py-1 rounded-full border font-medium ${v.color}`}>{v.label}</span>
        ))}
      </div>

      <div className="space-y-8">
        {seccion("🔴 Vencidas", vencidas, "text-red-600")}
        {seccion("🟡 Próximas 30 días", proximas, "text-amber-600")}
        {seccion("🟢 Futuras", futuras, "text-green-700")}
      </div>
    </div>
  );
}