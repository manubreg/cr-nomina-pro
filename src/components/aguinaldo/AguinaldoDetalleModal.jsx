import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AguinaldoCalculoDetalle from "@/components/aguinaldo/AguinaldoCalculoDetalle";

export default function AguinaldoDetalleModal({ registro, empleado, onClose }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["detalleAguinaldo", registro.id],
    staleTime: 0,
    queryFn: async () => {
      const response = await base44.functions.invoke("calcularAguinaldo", {
        empleado_id: registro.empleado_id,
        empresa_id: registro.empresa_id,
        anio: registro.anio,
      });
      if (!response.data?.ok) throw new Error(response.data?.error || "No se pudo obtener el detalle.");
      return response.data.resultado;
    },
    retry: false,
  });
  return (
    <Dialog open onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detalle de aguinaldo · {registro.anio}</DialogTitle></DialogHeader>
        <p className="font-medium">{empleado || "Empleado"} · Fecha de cálculo guardada: {registro.fecha_calculo || "—"}</p>
        {isLoading && <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando desglose...</div>}
        {error && <div role="alert" className="space-y-2 text-destructive"><p>{error.message}</p><Button variant="outline" onClick={() => refetch()}>Reintentar</Button></div>}
        {data && <AguinaldoCalculoDetalle registro={registro} resultado={data} />}
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}