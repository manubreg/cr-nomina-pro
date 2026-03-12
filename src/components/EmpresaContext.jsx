import { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const EmpresaContext = createContext(null);

export function EmpresaProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Empresa.list().catch(() => []),
    ]).then(([me, emps]) => {
      setCurrentUser(me);
      setEmpresas(emps);
      if (me?.role !== "admin") {
        setSelectedEmpresaId(me?.empresa_id || null);
      }
      setLoading(false);
    });
  }, []);

  // Super admin puede cambiar empresa; otros tienen fija la suya
  const empresaId = currentUser?.role === "admin" ? selectedEmpresaId : currentUser?.empresa_id || null;

  const filterByEmpresa = (data) => {
    if (!empresaId) return data;
    return data.filter(item => item.empresa_id === empresaId);
  };

  const empresaActual = empresas.find(e => e.id === empresaId) || null;

  return (
    <EmpresaContext.Provider value={{
      currentUser,
      empresaId,
      empresas,
      empresaActual,
      selectedEmpresaId,
      setSelectedEmpresaId,
      filterByEmpresa,
      isAdmin: currentUser?.role === "admin",
      isAdminRRHH: currentUser?.role === "admin_rrhh",
      isEmpleado: currentUser?.role === "empleado",
      loading,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresaContext() {
  return useContext(EmpresaContext);
}