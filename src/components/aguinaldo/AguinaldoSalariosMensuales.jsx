const moneda = value => `₡ ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fecha = value => value ? value.slice(0, 10).split("-").reverse().join("/") : "No registrada";
const mesNombre = value => value === "sin_fecha" ? "Sin mes identificado" : new Date(`${value}-01T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });

export default function AguinaldoSalariosMensuales({ meses = [] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Agrupado por mes de cierre del período. La base computable de aguinaldo suma salarios ordinarios y extraordinarios devengados antes de CCSS y renta, descontando tiempos no remunerados. El neto pagado se muestra solo como referencia y no se utiliza para calcular el aguinaldo.</p>
      {meses.length === 0 && <p className="text-muted-foreground">Sin desglose mensual disponible.</p>}
      {meses.map(mes => (
        <section key={mes.mes} className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap justify-between gap-2 bg-muted p-3 text-xs">
            <h3 className="font-semibold capitalize">{mesNombre(mes.mes)}</h3>
            <span>Base computable: <strong>{moneda(mes.base_aguinaldo)}</strong></span>
            <span>Total neto pagado: <strong>{moneda(mes.monto_pagado)}</strong></span>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead><tr><th className="p-3">Pago / frecuencia</th><th className="p-3">Fecha de pago</th><th className="p-3 text-right">Base computable</th><th className="p-3 text-right">Monto pagado (neto)</th></tr></thead>
            <tbody>{mes.pagos.map(pago => (
              <tr key={pago.id} className="border-t">
                <td className="p-3"><div>{pago.referencia}</div><div className="text-muted-foreground capitalize">{pago.frecuencia} · {pago.estado}</div></td>
                <td className="p-3 whitespace-nowrap">{fecha(pago.fecha_pago)}{!pago.fecha_pago && pago.fecha_programada && <div className="text-muted-foreground">Programada: {fecha(pago.fecha_programada)}</div>}</td>
                <td className="p-3 text-right whitespace-nowrap">{moneda(pago.base_aguinaldo)}</td>
                <td className="p-3 text-right whitespace-nowrap">{pago.monto_pagado === null ? "Sin pago confirmado" : moneda(pago.monto_pagado)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ))}
    </div>
  );
}