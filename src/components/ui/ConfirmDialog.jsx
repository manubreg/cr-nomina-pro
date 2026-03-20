import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, CheckCircle, RefreshCw, BadgeCheck } from "lucide-react";

const iconMap = {
  danger: <Trash2 className="w-10 h-10 text-red-500" />,
  warning: <AlertTriangle className="w-10 h-10 text-amber-500" />,
  success: <CheckCircle className="w-10 h-10 text-emerald-500" />,
  info: <BadgeCheck className="w-10 h-10 text-blue-500" />,
  recalcular: <RefreshCw className="w-10 h-10 text-blue-500" />,
};

const confirmBtnVariant = {
  danger: "bg-red-600 hover:bg-red-700 text-white",
  warning: "bg-amber-500 hover:bg-amber-600 text-white",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  info: "bg-blue-600 hover:bg-blue-700 text-white",
  recalcular: "bg-blue-600 hover:bg-blue-700 text-white",
};

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", type = "warning", loading = false }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          {iconMap[type]}
          <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-gray-500 text-center">{description}</DialogDescription>
          )}
        </div>
        <DialogFooter className="flex gap-2 justify-center mt-2 sm:justify-center">
          <Button variant="outline" onClick={onClose} disabled={loading} className="min-w-[100px]">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={`min-w-[120px] ${confirmBtnVariant[type]}`}
          >
            {loading ? "Procesando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}