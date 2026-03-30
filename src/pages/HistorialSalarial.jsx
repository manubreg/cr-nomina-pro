import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Plus, ArrowUp, Calendar, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const motivoLabel = {
  decreto_mtss: "Decreto MTSS",
  merito: "Mérito",
  reclasificacion: "Reclasificación",
  promocion: "Promoción",
  ajuste_mercado: "Ajuste de Mercado",
  otro: "Otro",
};

const motivoColor = {
  decreto_mtss: "bg-blue-100 text-blue-700",
  merito: "bg-emerald-100 text-emerald-700",
  reclasificacion: "bg-purple-100 text-purple-700",
  promocion: "bg-amber-100 text-amber-700",
  ajuste_mercado: "bg-cyan-100 text-cyan-700",
  otro: "bg-gray-100 text-gray-600",
};

const empty = {
  empleado_id: "",
  salario_anterior: "",
  salario_nuevo: "",
  fecha_efectiva: new Date().toISOString().split("T")[0],
  motivo: "merito",
  descripcion: "",
};

export default function HistorialSalarial() {
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [user, setUser] = useState(null);
  const [empleadoDelUsuario, setEmpleadoDelUsuario] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role === "empleado") {
        base44.entities.Empleado.filter({ correo: u.email }).then(emps => {
          if (emps.length > 0) setEmpleadoDelUsuario(emps[0].id);
        });
      }
    });
  }, []);

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ["historial_salario", empresaId],
    queryFn: async () => {
      const data = await base44.entities.HistorialSalario.list("-fecha_efectiva");
      return filterByEmpresa(data);
    }
  });

  const { data: empleadosRaw = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => base44.entities.Empleado.list(),
  });
  const empleadoMap = Object.fromEntries(empleadosRaw.map(e => [e.id, e]));

  const historialFiltrado = historial.filter(h => {
    // Si es empleado, mostrar solo su propio historial
    if (user?.role === "empleado" && empleadoDelUsuario && h.empleado_id !== empleadoDelUsuario) {
      return false;
    }
    if (!filtroEmpleado) return true;
    const emp = empleadoMap[h.empleado_id];
    return emp && `${emp.nombre} ${emp.apellidos}`.toLowerCase().includes(filtroEmpleado.toLowerCase());
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Historial Salarial</h1>
        <p className="text-gray-500 text-sm mt-1">Consulte todos los aumentos salariales registrados</p>
      </div>

      {/* Filtro */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Buscar empleado..."
          value={filtroEmpleado}
          onChange={e => setFiltroEmpleado(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando historial...</div>
        ) : historialFiltrado.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay registros salariales</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Motivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Anterior</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Salario Nuevo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">% Aumento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Fecha Efectiva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historialFiltrado.map(h => {
                  const emp = empleadoMap[h.empleado_id];
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp ? `${emp.nombre} ${emp.apellidos}` : "—"}</div>
                        <div className="text-xs text-gray-400">{emp?.puesto || ""}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge className={motivoColor[h.motivo]}>{motivoLabel[h.motivo]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        ₡{Number(h.salario_anterior).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                        ₡{Number(h.salario_nuevo).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <ArrowUp className="w-3 h-3" />
                          {h.porcentaje_aumento}%
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{h.fecha_efectiva}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}