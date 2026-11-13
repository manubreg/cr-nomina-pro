const moneda = value => `₡ ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fecha = value => value ? value.slice(0, 10).split("-").reverse().join("/") : "No registrada";
const mesNombre = value => value === "sin_fecha" ? "Sin mes identificado" : new Date(`${value}-01T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });

export default function AguinaldoSalariosMensuales({ meses = [] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Agrupado por el mes de cierre del período; si no está disponible, se utiliza la fecha de pago. El monto pagado es el neto del empleado en planillas marcadas como pagadas; los ingresos brutos son la base que suma el cálculo actual.</p>
      {meses.length === 0 && <p className="text-muted-foreground">Sin desglose mensual disponible.</p>}
      {meses.map(mes => (
        <section key={mes.mes} className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap justify-between gap-2 bg-muted p-3 text-xs">
            <h3 className="font-semibold capitalize">{mesNombre(mes.mes)}</h3>
            <span>Ingresos brutos: <strong>{moneda(mes.ingresos_totales)}</strong></span>
            <span>Total neto pagado: <strong>{moneda(mes.monto_pagado)}</strong></span>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead><tr><th className="p-3">Pago / frecuencia</th><th className="p-3">Fecha de pago</th><th className="p-3 text-right">Ingresos brutos</th><th className="p-3 text-right">Monto pagado (neto)</th></tr></thead>
            <tbody>{mes.pagos.map(pago => (
              <tr key={pago.id} className="border-t">
                <td className="p-3"><div>{pago.referencia}</div><div className="text-muted-foreground capitalize">{pago.frecuencia} · {pago.estado}</div></td>
                <td className="p-3 whitespace-nowrap">{fecha(pago.fecha_pago)}{!pago.fecha_pago && pago.fecha_programada && <div className="text-muted-foreground">Programada: {fecha(pago.fecha_programada)}</div>}</td>
                <td className="p-3 text-right whitespace-nowrap">{moneda(pago.ingresos_totales)}</td>
                <td className="p-3 text-right whitespace-nowrap">{pago.monto_pagado === null ? "Sin pago confirmado" : moneda(pago.monto_pagado)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ))}
    </div>
  );
}