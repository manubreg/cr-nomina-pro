import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Settings, Pencil, Trash2 } from "lucide-react";
import { useEmpresaContext } from "@/components/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const estadoColor = { vigente: "bg-emerald-100 text-emerald-700", vencido: "bg-red-100 text-red-600", borrador: "bg-gray-100 text-gray-500" };
const tipos = ["tramo_impuesto","cuota_ccss_empleado","cuota_ccss_patrono","regla_vacaciones","regla_aguinaldo","regla_horas_extra","regla_liquidacion","tipo_cambio"];
const emptyParam = { tipo: "", nombre: "", version: "1.0", datos_json: "", fecha_inicio_vigencia: "", fecha_fin_vigencia: "", estado: "vigente", observacion: "" };

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseJson(str, fallback) { try { const v = JSON.parse(str || "{}"); return v ?? fallback; } catch { return fallback; } }
function pct(v) { return v !== undefined && v !== "" ? Number(v) * 100 : ""; }
function fromPct(v) { return v === "" ? "" : Number(v) / 100; }

// ── Tramos impuesto ───────────────────────────────────────────────────────────
function TramosEditor({ value, onChange }) {
  let tramos = [];
  try { tramos = JSON.parse(value || "[]"); if (!Array.isArray(tramos)) tramos = []; } catch { tramos = []; }

  const upd = (i, field, val) => { const a = tramos.map((t,idx) => idx===i ? {...t,[field]:val} : t); onChange(JSON.stringify(a)); };
  const add = () => onChange(JSON.stringify([...tramos, { hasta: "", tasa: "" }]));
  const del = (i) => onChange(JSON.stringify(tramos.filter((_,idx) => idx !== i)));

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Tope hasta (₡)</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">% Retención</th>
            <th className="px-2 py-2 w-8"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {tramos.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">Sin tramos. Agregue el primero.</td></tr>}
            {tramos.map((t, i) => (
              <tr key={i} className="bg-white">
                <td className="px-2 py-1.5">
                  {i === tramos.length - 1
                    ? <span className="text-xs text-gray-400 italic px-1">En adelante</span>
                    : <Input type="number" className="h-8 text-sm" placeholder="929000" value={t.hasta ?? ""} onChange={e => upd(i, "hasta", e.target.value === "" ? "" : Number(e.target.value))} />}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Input type="number" step="0.01" min="0" max="100" className="h-8 text-sm" placeholder="0" value={pct(t.tasa)} onChange={e => upd(i, "tasa", fromPct(e.target.value))} />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center"><button onClick={() => del(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
        <Plus className="w-3 h-3 mr-1" /> Agregar tramo
      </Button>
      {tramos.length > 0 && <p className="text-xs text-gray-400">El último tramo aplica "en adelante" sin tope.</p>}
    </div>
  );
}

// ── Cuota CCSS (porcentaje único) ─────────────────────────────────────────────
function CuotaCCSSEditor({ value, onChange }) {
  const obj = parseJson(value, { porcentaje: "" });
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
      <div className="flex items-center gap-3">
        <Label className="w-40 text-xs">Porcentaje cuota</Label>
        <div className="flex items-center gap-1 flex-1">
          <Input type="number" step="0.01" min="0" max="100" className="h-8 text-sm" placeholder="9.17"
            value={obj.porcentaje !== undefined && obj.porcentaje !== "" ? Number(obj.porcentaje) * 100 : ""}
            onChange={e => set("porcentaje", e.target.value === "" ? "" : Number(e.target.value) / 100)} />
          <span className="text-xs text-gray-400">%</span>
        </div>
      </div>
    </div>
  );
}

// ── Regla vacaciones (acumulación: X días por cada Y días/meses laborados) ────
function ReglasVacacionesEditor({ value, onChange }) {
  const obj = parseJson(value, { dias_vacaciones: "", periodo_cantidad: "", periodo_unidad: "meses" });
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
      <p className="text-xs text-gray-500 italic">Define cuántos días de vacaciones se acumulan por cada período laborado.</p>
      <div className="flex items-center gap-2">
        <Label className="w-48 text-xs shrink-0">Días de vacaciones que acumula</Label>
        <Input type="number" step="0.5" min="0" className="h-8 text-sm flex-1" placeholder="1"
          value={obj.dias_vacaciones ?? ""}
          onChange={e => set("dias_vacaciones", e.target.value === "" ? "" : Number(e.target.value))} />
        <span className="text-xs text-gray-400 shrink-0">día(s)</span>
      </div>
      <div className="flex items-center gap-2">
        <Label className="w-48 text-xs shrink-0">Por cada</Label>
        <Input type="number" min="1" className="h-8 text-sm w-20 shrink-0" placeholder="1"
          value={obj.periodo_cantidad ?? ""}
          onChange={e => set("periodo_cantidad", e.target.value === "" ? "" : Number(e.target.value))} />
        <select className="h-8 text-sm border border-gray-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={obj.periodo_unidad ?? "meses"}
          onChange={e => set("periodo_unidad", e.target.value)}>
          <option value="dias">día(s) laborado(s)</option>
          <option value="meses">mes(es) laborado(s)</option>
        </select>
      </div>
      {obj.dias_vacaciones !== "" && obj.periodo_cantidad !== "" && (
        <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-700">
          Resumen: por cada <strong>{obj.periodo_cantidad} {obj.periodo_unidad}</strong> laborado(s), el empleado acumula <strong>{obj.dias_vacaciones} día(s)</strong> de vacaciones.
        </div>
      )}
    </div>
  );
}

// ── Regla aguinaldo (% sobre salario o fracción) ──────────────────────────────
function ReglaAguinaldoEditor({ value, onChange }) {
  const obj = parseJson(value, { porcentaje: "", meses_periodo: 12 });
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
      <div className="flex items-center gap-3">
        <Label className="w-44 text-xs">Meses del período</Label>
        <Input type="number" className="h-8 text-sm flex-1" placeholder="12" value={obj.meses_periodo ?? ""} onChange={e => set("meses_periodo", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-44 text-xs">% sobre salario computable</Label>
        <div className="flex items-center gap-1 flex-1">
          <Input type="number" step="0.01" min="0" max="100" className="h-8 text-sm" placeholder="8.33"
            value={obj.porcentaje !== undefined && obj.porcentaje !== "" ? Number(obj.porcentaje) * 100 : ""}
            onChange={e => set("porcentaje", e.target.value === "" ? "" : Number(e.target.value) / 100)} />
          <span className="text-xs text-gray-400">%</span>
        </div>
      </div>
    </div>
  );
}

// ── Regla horas extra ─────────────────────────────────────────────────────────
function ReglaHorasExtraEditor({ value, onChange }) {
  const obj = parseJson(value, { diurna: "", mixta: "", nocturna: "", feriado: "" });
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));
  const campos = [
    { key: "diurna", label: "Hora extra diurna" },
    { key: "mixta", label: "Hora extra mixta" },
    { key: "nocturna", label: "Hora extra nocturna" },
    { key: "feriado", label: "Hora extra feriado" },
  ];
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Tipo</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Factor / Recargo (%)</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {campos.map(c => (
            <tr key={c.key} className="bg-white">
              <td className="px-3 py-2 text-xs text-gray-600">{c.label}</td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" min="0" className="h-8 text-sm w-24" placeholder="50"
                    value={obj[c.key] !== undefined && obj[c.key] !== "" ? Number(obj[c.key]) * 100 : ""}
                    onChange={e => set(c.key, e.target.value === "" ? "" : Number(e.target.value) / 100)} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Regla liquidación (Código de Trabajo CR) ──────────────────────────────────
function ReglaLiquidacionEditor({ value, onChange }) {
  const defaults = {
    tope_anios_cesantia: 8,
    preaviso: [
      { meses_desde: 3, meses_hasta: 6, dias_salario: 7 },
      { meses_desde: 6, meses_hasta: 12, dias_salario: 15 },
      { meses_desde: 12, meses_hasta: null, dias_salario: 30 },
    ],
    cesantia: [
      { anio: 1, dias: 19.5 },
      { anio: 2, dias: 20 },
      { anio: 3, dias: 20 },
      { anio: 4, dias: 20 },
      { anio: 5, dias: 20 },
      { anio: 6, dias: 20 },
      { anio: 7, dias: 21 },
      { anio: 8, dias: 22 },
    ],
  };

  const obj = parseJson(value, defaults);
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));

  // Preaviso
  const updPreaviso = (i, field, val) => {
    const arr = (obj.preaviso || []).map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    set("preaviso", arr);
  };
  const addPreaviso = () => set("preaviso", [...(obj.preaviso || []), { meses_desde: "", meses_hasta: "", dias_salario: "" }]);
  const delPreaviso = (i) => set("preaviso", (obj.preaviso || []).filter((_, idx) => idx !== i));

  // Cesantía
  const updCesantia = (i, field, val) => {
    const arr = (obj.cesantia || []).map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    set("cesantia", arr);
  };
  const addCesantia = () => {
    const last = (obj.cesantia || []).length;
    set("cesantia", [...(obj.cesantia || []), { anio: last + 1, dias: "" }]);
  };
  const delCesantia = (i) => set("cesantia", (obj.cesantia || []).filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">

      {/* Tope máximo cesantía */}
      <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
        <div className="flex items-center gap-3">
          <Label className="w-52 text-xs shrink-0">Tope máximo de años de cesantía</Label>
          <Input type="number" min="1" className="h-8 text-sm w-24" placeholder="8"
            value={obj.tope_anios_cesantia ?? ""}
            onChange={e => set("tope_anios_cesantia", e.target.value === "" ? "" : Number(e.target.value))} />
          <span className="text-xs text-gray-400">año(s)</span>
        </div>
      </div>

      {/* Preaviso */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">Preaviso (solo despido con responsabilidad patronal)</p>
        </div>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Desde (meses)</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Hasta (meses)</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Días de salario</th>
              <th className="px-2 py-2 w-8"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(obj.preaviso || []).length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">Sin reglas.</td></tr>}
              {(obj.preaviso || []).map((r, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-2 py-1.5"><Input type="number" className="h-8 text-sm" placeholder="3" value={r.meses_desde ?? ""} onChange={e => updPreaviso(i,"meses_desde", e.target.value === "" ? "" : Number(e.target.value))} /></td>
                  <td className="px-2 py-1.5">
                    {i === (obj.preaviso || []).length - 1
                      ? <span className="text-xs text-gray-400 italic px-1">En adelante</span>
                      : <Input type="number" className="h-8 text-sm" placeholder="6" value={r.meses_hasta ?? ""} onChange={e => updPreaviso(i,"meses_hasta", e.target.value === "" ? "" : Number(e.target.value))} />}
                  </td>
                  <td className="px-2 py-1.5"><Input type="number" className="h-8 text-sm" placeholder="7" value={r.dias_salario ?? ""} onChange={e => updPreaviso(i,"dias_salario", e.target.value === "" ? "" : Number(e.target.value))} /></td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => delPreaviso(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPreaviso} className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Agregar tramo preaviso
        </Button>
      </div>

      {/* Cesantía */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-600">Cesantía — tabla progresiva (Art. 29 Código de Trabajo)</p>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Año de servicio</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Días de salario</th>
              <th className="px-2 py-2 w-8"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(obj.cesantia || []).length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">Sin tramos.</td></tr>}
              {(obj.cesantia || []).map((t, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-2 py-1.5"><Input type="number" min="1" className="h-8 text-sm" placeholder={i+1} value={t.anio ?? ""} onChange={e => updCesantia(i,"anio", e.target.value === "" ? "" : Number(e.target.value))} /></td>
                  <td className="px-2 py-1.5"><Input type="number" step="0.5" className="h-8 text-sm" placeholder="19.5" value={t.dias ?? ""} onChange={e => updCesantia(i,"dias", e.target.value === "" ? "" : Number(e.target.value))} /></td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => delCesantia(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCesantia} className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Agregar año
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-md px-3 py-2 text-xs text-amber-700">
        Aguinaldo proporcional y vacaciones no disfrutadas son derechos irrenunciables y se calculan automáticamente en toda liquidación, independientemente del motivo de salida.
      </div>
    </div>
  );
}

// ── Tipo de cambio ────────────────────────────────────────────────────────────
function TipoCambioEditor({ value, onChange }) {
  const obj = parseJson(value, { compra: "", venta: "", moneda: "USD" });
  const set = (k, v) => onChange(JSON.stringify({ ...obj, [k]: v }));
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
      <div className="flex items-center gap-3">
        <Label className="w-44 text-xs">Moneda</Label>
        <select className="h-8 text-sm border border-gray-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={obj.moneda ?? "USD"} onChange={e => set("moneda", e.target.value)}>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="CAD">CAD</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-44 text-xs">Tipo compra (₡)</Label>
        <Input type="number" step="0.01" className="h-8 text-sm flex-1" placeholder="500.00" value={obj.compra ?? ""} onChange={e => set("compra", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-44 text-xs">Tipo venta (₡)</Label>
        <Input type="number" step="0.01" className="h-8 text-sm flex-1" placeholder="510.00" value={obj.venta ?? ""} onChange={e => set("venta", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
    </div>
  );
}

// ── Selector de editor según tipo ─────────────────────────────────────────────
function DatosEditor({ tipo, value, onChange }) {
  if (tipo === "tramo_impuesto") return <TramosEditor value={value} onChange={onChange} />;
  if (tipo === "cuota_ccss_empleado" || tipo === "cuota_ccss_patrono") return <CuotaCCSSEditor value={value} onChange={onChange} />;
  if (tipo === "regla_vacaciones") return <ReglasVacacionesEditor value={value} onChange={onChange} />;
  if (tipo === "regla_aguinaldo") return <ReglaAguinaldoEditor value={value} onChange={onChange} />;
  if (tipo === "regla_horas_extra") return <ReglaHorasExtraEditor value={value} onChange={onChange} />;
  if (tipo === "regla_liquidacion") return <ReglaLiquidacionEditor value={value} onChange={onChange} />;
  if (tipo === "tope_base") return <TopeBaseEditor value={value} onChange={onChange} />;
  if (tipo === "tipo_cambio") return <TipoCambioEditor value={value} onChange={onChange} />;
  // fallback: textarea JSON
  return (
    <textarea
      className="w-full border border-gray-200 rounded-lg p-2 text-xs font-mono resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value} onChange={e => onChange(e.target.value)} placeholder='{"clave": "valor"}' />
  );
}

export default function Parametros() {
  const qc = useQueryClient();
  const { empresaId, filterByEmpresa } = useEmpresaContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyParam);
  const [editing, setEditing] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: paramsRaw = [], isLoading } = useQuery({ queryKey: ["parametros", empresaId], queryFn: () => base44.entities.ParametroLegal.list("-fecha_inicio_vigencia") });
  const params = filterByEmpresa(paramsRaw);

  const save = useMutation({
    mutationFn: (data) => editing ? base44.entities.ParametroLegal.update(editing, data) : base44.entities.ParametroLegal.create(data),
    onSuccess: () => { qc.invalidateQueries(["parametros"]); setOpen(false); },
  });

  const openNew = () => { setForm({ ...emptyParam, datos_json: "" }); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setOpen(true); };
  const filtered = tipoFiltro === "todos" ? params : params.filter(p => p.tipo === tipoFiltro);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parámetros Legales</h1>
          <p className="text-gray-500 text-sm mt-1">CCSS, Impuestos, Vacaciones y más</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Parámetro
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTipoFiltro("todos")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tipoFiltro === "todos" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Todos</button>
        {tipos.map(t => (
          <button key={t} onClick={() => setTipoFiltro(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${tipoFiltro === t ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t.replace(/_/g," ")}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Cargando parámetros...</div> : filtered.length === 0 ? (
          <div className="p-12 text-center"><Settings className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Sin parámetros registrados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Versión</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Vigencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">{p.tipo?.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.version}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{p.fecha_inicio_vigencia} → {p.fecha_fin_vigencia || "Sin venc."}</td>
                    <td className="px-4 py-3"><Badge className={estadoColor[p.estado]}>{p.estado}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Parámetro" : "Nuevo Parámetro Legal"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Cuota obrera CCSS 2025" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>{tipos.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Versión</Label>
              <Input value={form.version} onChange={e => set("version", e.target.value)} placeholder="1.0" />
            </div>
            <div className="space-y-1">
              <Label>Inicio Vigencia *</Label>
              <Input type="date" value={form.fecha_inicio_vigencia} onChange={e => set("fecha_inicio_vigencia", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin Vigencia</Label>
              <Input type="date" value={form.fecha_fin_vigencia} onChange={e => set("fecha_fin_vigencia", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Configuración</Label>
              <DatosEditor tipo={form.tipo} value={form.datos_json} onChange={v => set("datos_json", v)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observación</Label>
              <Input value={form.observacion} onChange={e => set("observacion", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}