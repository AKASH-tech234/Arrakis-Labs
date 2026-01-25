

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

export default function DataTable({
  columns,
  data,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  loading = false,
  emptyMessage = "No data available",
  sortable = true,
  defaultSort = null,
}) {
  const [sortConfig, setSortConfig] = useState(defaultSort);

  const sortedData = useMemo(() => {
    if (!sortConfig || !sortable) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig, sortable]);

  const handleSort = (key) => {
    if (!sortable) return;

    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange?.(data.map((row) => row.id));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onSelectionChange?.(newSelection);
  };

  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < data.length;

  return (
    <div className="border border-[#1A1814] overflow-hidden">
      {}
      <div className="overflow-x-auto">
        <table className="w-full">
          {}
          <thead>
            <tr
              className="border-b border-[#1A1814]"
              style={{ backgroundColor: "#0D0D0B" }}
            >
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 bg-[#0A0A08] border border-[#1A1814] 
                               checked:bg-[#F59E0B] checked:border-[#F59E0B]
                               focus:ring-1 focus:ring-[#F59E0B] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left ${
                    sortable && col.sortable !== false
                      ? "cursor-pointer hover:bg-[#1A1814]/50"
                      : ""
                  }`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[#3D3D3D] text-[10px] uppercase tracking-wider"
                      style={{
                        fontFamily: "'Rajdhani', system-ui, sans-serif",
                      }}
                    >
                      {col.label}
                    </span>
                    {sortable &&
                      col.sortable !== false &&
                      sortConfig?.key === col.key && (
                        <span className="text-[#F59E0B] text-[10px]">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {}
          <tbody>
            {loading ? (
              
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-[#1A1814]/50">
                  {selectable && (
                    <td className="px-4 py-4">
                      <div className="w-4 h-4 bg-[#1A1814] animate-pulse" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <div
                        className="h-4 bg-[#1A1814] animate-pulse"
                        style={{ width: "60%" }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <p
                    className="text-[#78716C] text-sm uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                  >
                    {emptyMessage}
                  </p>
                </td>
              </tr>
            ) : (
              
              sortedData.map((row, idx) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-[#1A1814]/50 transition-colors duration-150
                              ${onRowClick ? "cursor-pointer" : ""}
                              ${selectedIds.includes(row.id) ? "bg-[#1A1814]/50" : "hover:bg-[#1A1814]/30"}`}
                >
                  {selectable && (
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="w-4 h-4 bg-[#0A0A08] border border-[#1A1814] 
                                   checked:bg-[#F59E0B] checked:border-[#F59E0B]
                                   focus:ring-1 focus:ring-[#F59E0B] cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render ? (
                        col.render(row[col.key], row)
                      ) : (
                        <span
                          className="text-[#E8E4D9] text-sm"
                          style={{
                            fontFamily: "'Rajdhani', system-ui, sans-serif",
                          }}
                        >
                          {row[col.key]}
                        </span>
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
