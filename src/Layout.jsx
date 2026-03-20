import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, Building2, Users, FileText, CalendarDays, ClipboardList,
  Receipt, Umbrella, Activity, Gift, LogOut as LogOutIcon, Settings, Search,
  Bell, ChevronDown, Menu, X, ShieldCheck, BookOpen, BarChart3, Briefcase,
  ChevronRight, UserCog, Calendar
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/Dashboard", icon: LayoutDashboard },
  { label: "Empresas", path: "/Empresas", icon: Building2 },
  {
    label: "Empleados", icon: Users, path: "/Empleados",
    children: [
      { label: "Lista de Empleados", path: "/Empleados" },
      { label: "Contratos", path: "/Contratos" },
      { label: "Documentos", path: "/Documentos" },
    ]
  },
  {
    label: "Planilla", icon: Receipt, path: "/Periodos",
    children: [
      { label: "Periodos", path: "/Periodos" },
      { label: "Planillas", path: "/Planillas" },
      { label: "Novedades", path: "/Novedades" },
      { label: "Conceptos de Pago", path: "/Conceptos" },
    ]
  },
  {
    label: "Beneficios", icon: Umbrella, path: "/Vacaciones",
    children: [
      { label: "Vacaciones", path: "/Vacaciones" },
      { label: "Incapacidades", path: "/Incapacidades" },
      { label: "Aguinaldo", path: "/Aguinaldo" },
      { label: "Liquidaciones", path: "/Liquidaciones" },
      { label: "Historial Salarial", path: "/HistorialSalarial" },
    ]
  },
  {
    label: "Reportes", icon: BarChart3, path: "/Reportes",
    children: [
      { label: "Reportes Generales", path: "/Reportes" },
      { label: "Reportes Legales", path: "/ReportesLegales" },
      { label: "Actualización Mensual", path: "/ReporteActualizacionMensual" },
      { label: "Historial Salarial", path: "/ReporteHistorialSalarial" },
    ]
  },
  {
    label: "Administración", icon: Settings, path: "/Parametros",
    children: [
      { label: "Calendario Legal", path: "/CalendarioObligaciones" },
      { label: "Parámetros", path: "/Parametros" },
      { label: "Configuración", path: "/Configuracion" },
      { label: "Usuarios", path: "/Usuarios" },
      { label: "Auditoría", path: "/Auditoria" },
    ]
  },
];

function NavItem({ item, collapsed, location }) {
  const [open, setOpen] = useState(false);
  const isActive = item.path && location.pathname === item.path;
  const isChildActive = item.children?.some(c => location.pathname === c.path);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
            ${isChildActive ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700/50 hover:text-white"}`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open || isChildActive ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
        {(open || isChildActive) && !collapsed && (
          <div className="ml-7 mt-1 space-y-0.5 border-l border-blue-600 pl-3">
            {item.children.map(child => (
              <Link
                key={child.path}
                to={child.path}
                className={`flex items-center gap-2 px-2 py-2 rounded-md text-xs font-medium transition-all
                  ${location.pathname === child.path ? "text-white bg-blue-600" : "text-blue-200 hover:text-white hover:bg-blue-700/40"}`}
              >
                <ChevronRight className="w-3 h-3" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
        ${isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-100 hover:bg-blue-700/50 hover:text-white"}`}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin, empresas, selectedEmpresaId, setSelectedEmpresaId, empresaActual } = useEmpresaContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => base44.auth.logout("/");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-700">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
          <Receipt className="w-5 h-5 text-blue-800" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-bold text-sm leading-tight">CR Nómina</div>
            <div className="text-blue-300 text-xs">Pro</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(item => (
          <NavItem key={item.label} item={item} collapsed={collapsed} location={location} />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-blue-700 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.full_name?.[0] || user?.email?.[0] || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.full_name || user?.email}</div>
              <div className="text-blue-300 text-xs capitalize">{user?.role || "usuario"}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} className="text-blue-300 hover:text-white transition-colors">
              <LogOutIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-blue-900 transition-all duration-300 shrink-0 ${collapsed ? "w-16" : "w-60"}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-4 left-52 z-50 bg-blue-800 text-white rounded-full p-1 shadow-md hidden lg:flex items-center justify-center transition-all duration-300"
          style={{ left: collapsed ? "52px" : "228px" }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <X className="w-3 h-3" />}
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-blue-900 z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            {/* Selector de empresa — solo para super admin */}
            {isAdmin && empresas.length > 0 && (
              <div className="hidden md:flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <Select value={selectedEmpresaId || "todas"} onValueChange={v => setSelectedEmpresaId(v === "todas" ? null : v)}>
                  <SelectTrigger className="w-52 h-8 text-sm border-gray-200">
                    <SelectValue placeholder="Todas las empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las empresas</SelectItem>
                    {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_comercial || e.nombre_legal}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Empresa fija para admin_rrhh */}
            {!isAdmin && empresaActual && (
              <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">{empresaActual.nombre_comercial || empresaActual.nombre_legal}</span>
              </div>
            )}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/Notificaciones" className="relative text-gray-500 hover:text-gray-700 p-2">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.full_name?.[0] || "U"}
                </span>
              </div>
              <span className="text-sm text-gray-700 hidden md:block">{user?.full_name || user?.email}</span>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}