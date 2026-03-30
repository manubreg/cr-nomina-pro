import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { FileText, Umbrella, User, LogOut, Receipt, Zap, Award, BarChart3, ChevronRight } from "lucide-react";

const portalNav = [
  {
    section: "Información Personal",
    items: [
      { label: "Mis Datos", path: "/portal/datos", icon: User },
    ]
  },
  {
    section: "Nómina",
    items: [
      { label: "Mis Colillas", path: "/portal/colillas", icon: FileText },
      { label: "Mis Horas Extras", path: "/portal/horas-extras", icon: Zap },
    ]
  },
  {
    section: "Beneficios",
    items: [
      { label: "Mis Vacaciones", path: "/portal/vacaciones", icon: Umbrella },
    ]
  },
  {
    section: "Documentos",
    items: [
      { label: "Certificado de Ingresos", path: "/portal/certificado", icon: Award },
      { label: "Resumen Anual", path: "/portal/resumen-anual", icon: BarChart3 },
    ]
  },
];

export default function PortalLayout() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar portal */}
      <aside className="w-64 bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col shrink-0 shadow-lg">
        {/* Header */}
        <div className="px-6 py-6 border-b border-blue-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-base">Mi Portal</div>
              <div className="text-blue-300 text-xs font-medium">Gestión de Nómina</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {portalNav.map((section) => (
            <div key={section.section} className="space-y-2">
              <h3 className="px-3 text-xs font-bold text-blue-300 uppercase tracking-wider opacity-70">
                {section.section}
              </h3>
              <div className="space-y-1">
                {section.items.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all group
                      ${location.pathname === item.path
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "text-blue-100 hover:bg-blue-800/60 hover:text-white"}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 shrink-0" />
                      {item.label}
                    </div>
                    {location.pathname === item.path && (
                      <ChevronRight className="w-4 h-4 opacity-75" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-blue-800/50 p-4 bg-blue-900/50 backdrop-blur">
          <div className="flex items-center gap-3 p-3 bg-blue-800/40 rounded-lg border border-blue-700/50">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center shrink-0 font-bold text-white shadow-md">
              {user?.full_name?.[0]?.toUpperCase() || "E"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.full_name || user?.email}</div>
              <div className="text-blue-300 text-xs">Empleado</div>
            </div>
            <button 
              onClick={() => base44.auth.logout("/")} 
              className="text-blue-300 hover:text-white hover:bg-blue-700/50 p-2 rounded-lg transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}