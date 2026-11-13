import { AlertTriangle } from "lucide-react";
import AguinaldoSalariosMensuales from "@/components/aguinaldo/AguinaldoSalariosMensuales";

const moneda = value => `₡ ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function AguinaldoCalculoDetalle({ registro, resultado }) {
  const detalle = resultado._detalle;
  const diferencia = Number(registro.monto_aguinaldo || 0) - Number(resultado.monto_aguinaldo || 0);
  const coincide = Math.abs(diferencia) < 0.01 && Math.abs(Number(registro.total_salarios_computables || 0) - resultado.total_salarios_computables) < 0.01;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">Reconstrucción con los datos actuales, sin modificar el aguinaldo guardado. No es una copia histórica del cálculo original.</p>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4">
        <div><dt className="text-muted-foreground">Período de referencia</dt><dd>{detalle.periodo_inicio} al {detalle.periodo_fin}</dd></div>
        <div><dt className="text-muted-foreground">Fuente utilizada</dt><dd>Bases salariales de planillas aprobadas o pagadas · {detalle.provisional ? 'Acumulado provisional' : 'Período cerrado'} · Corte: {detalle.fin_efectivo}</dd></div>
        <div><dt className="text-muted-foreground">Salarios guardados</dt><dd>{moneda(registro.total_salarios_computables)}</dd></div>
        <div><dt className="text-muted-foreground">Aguinaldo guardado</dt><dd className="font-semibold">{moneda(registro.monto_aguinaldo)}</dd></div>
      </dl>
      <p className="flex items-start gap-2 rounded-lg border p-3"><AlertTriangle className="h-5 w-5 shrink-0" />{detalle.advertencia}</p>
      {detalle.fuente === "planillas" ? (
        <AguinaldoSalariosMensuales meses={detalle.salarios_mensuales} />
      ) : (
        <div className="rounded-lg border p-4 space-y-1"><p>Desde {detalle.inicio_efectivo} hasta {detalle.fin_efectivo}</p><p>Salario base: {moneda(detalle.salario_base)}</p><p>Meses proporcionales: {detalle.meses_en_periodo} (se usa la precisión completa para calcular).</p><p>Salarios estimados = salario base × meses proporcionales.</p></div>
      )}
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <p>{detalle.fundamento}</p>
        <p>Fórmula: suma de salarios ordinarios y extraordinarios computables ÷ 12, aunque se haya trabajado menos de un año. Sin rebajos de CCSS o renta.</p>
        <p>{moneda(resultado.total_salarios_computables)} ÷ 12 = <strong>{moneda(resultado.monto_aguinaldo)}</strong> (resultado redondeado).</p>
        <p>{coincide ? "El monto y los salarios guardados coinciden con el cálculo actual; esto no certifica la validez de los datos incluidos." : `Hay diferencias con el registro guardado. Diferencia en aguinaldo (guardado − actual): ${moneda(diferencia)}.`}</p>
      </div>
    </div>
  );
}