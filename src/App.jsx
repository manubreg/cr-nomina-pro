import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './Layout';
import PortalLayout from './components/PortalLayout';
import { EmpresaProvider } from './components/EmpresaContext';

// Admin pages
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import Empleados from './pages/Empleados';
import EmpleadoPerfil from './pages/EmpleadoPerfil';
import Contratos from './pages/Contratos';
import Documentos from './pages/Documentos';
import Periodos from './pages/Periodos';
import Planillas from './pages/Planillas';
import Novedades from './pages/Novedades';
import Conceptos from './pages/Conceptos';
import Vacaciones from './pages/Vacaciones';
import Incapacidades from './pages/Incapacidades';
import AguinaldoPage from './pages/AguinaldoPage';
import Liquidaciones from './pages/Liquidaciones';
import Reportes from './pages/Reportes';
import ReportesLegales from './pages/ReportesLegales';
import Parametros from './pages/Parametros';
import Usuarios from './pages/Usuarios';
import AuditoriaPage from './pages/Auditoria';
import Notificaciones from './pages/Notificaciones';

import ReporteHistorialSalarial from './pages/ReporteHistorialSalarial';
import HistorialBoletas from './pages/HistorialBoletas';
import HistorialSalarial from './pages/HistorialSalarial';
import Configuracion from './pages/Configuracion';
import Roles from './pages/Roles';
import CalendarioObligaciones from './pages/CalendarioObligaciones';
import GestionAumentos from './pages/GestionAumentos';

// Portal empleado
import MisDatos from './pages/portal/MisDatos';
import MisColillas from './pages/portal/MisColillas';
import MisVacaciones from './pages/portal/MisVacaciones';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  // Redirigir empleados al portal
  if (user?.role === "empleado") {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/portal/datos" replace />} />
        <Route element={<PortalLayout />}>
          <Route path="/portal/datos" element={<MisDatos />} />
          <Route path="/portal/colillas" element={<MisColillas />} />
          <Route path="/portal/vacaciones" element={<MisVacaciones />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal/datos" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Empresas" element={<Empresas />} />
        <Route path="/Empleados" element={<Empleados />} />
        <Route path="/EmpleadoPerfil" element={<EmpleadoPerfil />} />
        <Route path="/Contratos" element={<Contratos />} />
        <Route path="/Documentos" element={<Documentos />} />
        <Route path="/Periodos" element={<Periodos />} />
        <Route path="/Planillas" element={<Planillas />} />
        <Route path="/Novedades" element={<Novedades />} />
        <Route path="/Conceptos" element={<Conceptos />} />
        <Route path="/Vacaciones" element={<Vacaciones />} />
        <Route path="/Incapacidades" element={<Incapacidades />} />
        <Route path="/Aguinaldo" element={<AguinaldoPage />} />
        <Route path="/Liquidaciones" element={<Liquidaciones />} />
        <Route path="/Reportes" element={<Reportes />} />
        <Route path="/ReportesLegales" element={<ReportesLegales />} />
        <Route path="/Parametros" element={<Parametros />} />
        <Route path="/Usuarios" element={<Usuarios />} />
        <Route path="/Auditoria" element={<AuditoriaPage />} />
        <Route path="/Notificaciones" element={<Notificaciones />} />
        <Route path="/ReporteHistorialSalarial" element={<ReporteHistorialSalarial />} />
        <Route path="/HistorialSalarial" element={<HistorialSalarial />} />
        <Route path="/HistorialBoletas" element={<HistorialBoletas />} />
        <Route path="/Configuracion" element={<Configuracion />} />
        <Route path="/Roles" element={<Roles />} />
        <Route path="/CalendarioObligaciones" element={<CalendarioObligaciones />} />
        <Route path="/GestionAumentos" element={<GestionAumentos />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <EmpresaProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </EmpresaProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App