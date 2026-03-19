import { useState, useEffect } from "react";

export default function MoneyInput({ value, onChange, moneda = "CRC", placeholder, ...props }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const formatMoney = (num) => {
    if (!num && num !== 0) return "";
    const n = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(n)) return "";
    return moneda === "USD"
      ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleFocus = () => {
    setRaw(value !== "" && value != null ? String(value) : "");
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const cleaned = raw.replace(/[^\d.]/g, "");
    const num = cleaned === "" ? "" : parseFloat(cleaned);
    onChange(isNaN(num) ? "" : num);
  };

  const handleChange = (e) => {
    // Allow only digits and one dot
    const val = e.target.value.replace(/[^\d.]/g, "");
    setRaw(val);
  };

  return (
    <input
      type="text"
      value={editing ? raw : formatMoney(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || "0.00"}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  );
}