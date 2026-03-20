import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const COLORES = [
  "bg-blue-200 text-blue-800",
  "bg-emerald-200 text-emerald-800",
  "bg-violet-200 text-violet-800",
  "bg-amber-200 text-amber-800",
  "bg-rose-200 text-rose-800",
  "bg-cyan-200 text-cyan-800",
  "bg-orange-200 text-orange-800",
  "bg-pink-200 text-pink-800",
];

function estaEnRango(fecha, inicio, fin) {
  return fecha >= inicio && fecha <= fin;
}

export default function CalendarioAusencias({ solicitudes = [], empleadoMap = {} }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-indexed
  const [tooltipDia, setTooltipDia] = useState(null);

  // Solo solicitudes aprobadas
  const aprobadas = solicitudes.filter(s => s.estado === "aprobada" && s.fecha_inicio && s.fecha_fin);

  // Asignar color a cada empleado
  const empleadosConColor = useMemo(() => {
    const ids = [...new Set(aprobadas.map(s => s.empleado_id))];
    return Object.fromEntries(ids.map((id, i) => [id, COLORES[i % COLORES.length]]));
  }, [aprobadas]);

  const prevMes = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  };
  const nextMes = () => {
    if (mes === 11) { setMes(0); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  };

  // Calcular días del mes
  const primerDia = new Date(anio, mes, 1).getDay(); // 0=dom
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  // Para cada día, qué solicitudes aplican
  const ausenciasPorDia = useMemo(() => {
    const map = {};
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      map[d] = aprobadas.filter(s => estaEnRango(fecha, s.fecha_inicio, s.fecha_fin));
    }
    return map;
  }, [aprobadas, anio, mes, diasEnMes]);

  // Total empleados ausentes este mes
  const ausentes = new Set(aprobadas.filter(s => {
    const inicio = s.fecha_inicio.substring(0, 7);
    const fin = s.fecha_fin.substring(0, 7);
    const mesStr = `${anio}-${String(mes + 1).padStart(2, "0")}`;
    return inicio <= mesStr && fin >= mesStr;
  }).map(s => s.empleado_id));

  return (
    <div className="space-y-4">
      {/* Header navegación */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={prevMes} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
              {MESES[mes]} {anio}
            </h3>
            <button onClick={nextMes} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {ausentes.size} empleado{ausentes.size !== 1 ? "s" : ""} con vacaciones este mes
          </div>
        </div>

        {/* Grilla del calendario */}
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1.5">{d}</div>
          ))}

          {/* Celdas vacías antes del día 1 */}
          {Array.from({ length: primerDia }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Días del mes */}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const ausencias = ausenciasPorDia[dia] || [];
            const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
            const esFinde = [0, 6].includes(new Date(anio, mes, dia).getDay());

            return (
              <div
                key={dia}
                className={`relative min-h-[56px] rounded-lg p-1 border transition-colors cursor-pointer
                  ${esHoy ? "border-blue-400 bg-blue-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"}
                  ${esFinde ? "bg-gray-50/50" : ""}
                `}
                onMouseEnter={() => ausencias.length > 0 && setTooltipDia(dia)}
                onMouseLeave={() => setTooltipDia(null)}
              >
                <span className={`text-xs font-medium ${esHoy ? "text-blue-700" : esFinde ? "text-gray-400" : "text-gray-700"}`}>
                  {dia}
                </span>
                {ausencias.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {ausencias.slice(0, 2).map(s => (
                      <div
                        key={s.id}
                        className={`text-[9px] font-medium px-1 py-0.5 rounded truncate ${empleadosConColor[s.empleado_id] || "bg-gray-200 text-gray-700"}`}
                      >
                        {(empleadoMap[s.empleado_id] || "—").split(" ")[0]}
                      </div>
                    ))}
                    {ausencias.length > 2 && (
                      <div className="text-[9px] text-gray-500 px-1">+{ausencias.length - 2} más</div>
                    )}
                  </div>
                )}

                {/* Tooltip */}
                {tooltipDia === dia && ausencias.length > 0 && (
                  <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[140px] text-xs">
                    <div className="font-semibold text-gray-700 mb-1">Día {dia}</div>
                    {ausencias.map(s => (
                      <div key={s.id} className="text-gray-600 py-0.5 border-b border-gray-100 last:border-0">
                        {empleadoMap[s.empleado_id] || "—"}
                        <span className="text-gray-400 ml-1">({s.dias_solicitados}d)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda de empleados */}
      {ausentes.size > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Empleados con vacaciones en {MESES[mes]}</h4>
          <div className="flex flex-wrap gap-2">
            {[...ausentes].map(empId => (
              <span key={empId} className={`px-2.5 py-1 rounded-full text-xs font-medium ${empleadosConColor[empId] || "bg-gray-100 text-gray-700"}`}>
                {empleadoMap[empId] || empId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}