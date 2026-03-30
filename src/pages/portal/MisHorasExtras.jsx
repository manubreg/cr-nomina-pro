import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Zap, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tipoHoraExtraLabels = {
  diurna: { label: "Diurna", color: "bg-amber-100 text-amber-800" },
  nocturna: { label: "Nocturna", color: "bg-purple-100 text-purple-800" },
  feriado: { label: "Feriado", color: "bg-red-100 text-red-800" },
};

export default function MisHorasExtras() {
  const [empleado, setEmpleado] = useState(null);
  const [horasExtras, setHorasExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ fecha: "", cantidad: "", tipo: "diurna", comentario: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      if (me?.empleado_id) {
        // Cargar datos del empleado
        const empRes = await base44.entities.Empleado.filter({ id: me.empleado_id });
        const emp = empRes[0] || null;
        setEmpleado(emp);

        if (emp?.empresa_id) {
          const empsRes = await base44.entities.Empresa.filter({ id: emp.empresa_id });
          setEmpresa(empsRes[0] || null);
        }

        // Cargar horas extras aprobadas del empleado
        const novedadesRes = await base44.entities.Novedad.filter({
          empleado_id: me.empleado_id,
          tipo_novedad: "horas_extra",
          estado: "aprobada",
        }, "-fecha", 100);
        setHorasExtras(novedadesRes || []);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fecha || !formData.cantidad || formData.cantidad <= 0) {
      alert("Por favor completa los campos requeridos");
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Novedad.create({
        empleado_id: empleado.id,
        empresa_id: empresa.id,
        tipo_novedad: "horas_extra",
        tipo_hora_extra: formData.tipo,
        fecha: formData.fecha,
        cantidad: parseFloat(formData.cantidad),
        unidad: "horas",
        comentario: formData.comentario,
        estado: "pendiente",
      });

      // Recargar horas
      const novedadesRes = await base44.entities.Novedad.filter({
        empleado_id: empleado.id,
        tipo_novedad: "horas_extra",
      }, "-fecha", 100);
      setHorasExtras(novedadesRes || []);

      setFormData({ fecha: "", cantidad: "", tipo: "diurna", comentario: "" });
      setShowModal(false);
    } catch (error) {
      alert("Error al registrar horas: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;
  if (!empleado) return <div className="p-8 text-center text-gray-400">No se encontró información de empleado.</div>;

  const totalHoras = horasExtras.reduce((sum, h) => sum + (h.cantidad || 0), 0);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Horas Extras</h1>
            <p className="text-gray-500 text-sm">Historial de horas extra registradas</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Solicitar Horas
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total de Horas</div>
          <div className="text-3xl font-bold text-amber-700 mt-2">{totalHoras.toFixed(1)}h</div>
          <div className="text-xs text-gray-500 mt-1">{horasExtras.length} registros</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diurnas</div>
          <div className="text-3xl font-bold text-amber-600 mt-2">
            {horasExtras
              .filter(h => h.tipo_hora_extra === "diurna")
              .reduce((sum, h) => sum + (h.cantidad || 0), 0)
              .toFixed(1)}h
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nocturnas</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">
            {horasExtras
              .filter(h => h.tipo_hora_extra === "nocturna")
              .reduce((sum, h) => sum + (h.cantidad || 0), 0)
              .toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Historial de Horas Extras</h2>
        </div>

        {horasExtras.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tienes horas extras registradas aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Horas</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Tipo</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {horasExtras.map((hora) => {
                  const tipoInfo = tipoHoraExtraLabels[hora.tipo_hora_extra] || tipoHoraExtraLabels.diurna;
                  return (
                    <tr key={hora.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-800 font-medium">{hora.fecha}</td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">{hora.cantidad}h</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tipoInfo.color}`}>
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Aprobada
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{hora.comentario || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Solicitar Horas */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Horas Extras</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Horas</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Hora Extra</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="diurna">Diurna</option>
                <option value="nocturna">Nocturna</option>
                <option value="feriado">Feriado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea
                value={formData.comentario}
                onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                placeholder="Describe el motivo o detalles de las horas"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Guardando..." : "Solicitar Horas"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}