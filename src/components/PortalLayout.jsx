import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { FileText, Umbrella, User, LogOut, Receipt, Zap } from "lucide-react";

const portalNav = [
  { label: "Mis Datos", path: "/portal/datos", icon: User },
  { label: "Mis Colillas", path: "/portal/colillas", icon: FileText },
  { label: "Mis Vacaciones", path: "/portal/vacaciones", icon: Umbrella },
  { label: "Mis Horas Extras", path: "/portal/horas-extras", icon: Zap },
];

export default function PortalLayout() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar portal */}
      <aside className="w-56 bg-blue-900 flex flex-col shrink-0">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-700">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Receipt className="w-5 h-5 text-blue-800" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Mi Portal</div>
            <div className="text-blue-300 text-xs">Empleado</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {portalNav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${location.pathname === item.path
                  ? "bg-blue-600 text-white"
                  : "text-blue-100 hover:bg-blue-700/50 hover:text-white"}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-blue-700 p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{user?.full_name?.[0] || "E"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.full_name || user?.email}</div>
              <div className="text-blue-300 text-xs">Empleado</div>
            </div>
            <button onClick={() => base44.auth.logout("/")} className="text-blue-300 hover:text-white">
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