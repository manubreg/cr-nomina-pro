export default function MoneyInput({ value, onChange, moneda = "CRC", placeholder, ...props }) {
  const formatMoney = (num) => {
    if (!num && num !== 0) return "";
    const numValue = typeof num === "string" ? parseFloat(num.replace(/[^\d.]/g, "")) : num;
    if (isNaN(numValue)) return "";
    
    if (moneda === "USD") {
      return `$${numValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `₡${numValue.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    const numValue = rawValue === "" ? "" : parseFloat(rawValue);
    onChange(numValue);
  };

  const displayValue = formatMoney(value);

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || "0.00"}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  );
}