import { useState, useMemo, useCallback } from "react";

/**
 * Custom hook for managing search, filtering, and sorting state
 * @param {Array} data - The data array to filter
 * @param {Function} getWorkflowState - Function to get workflow state
 * @returns {Object} Filter state and operations
 */
export function useFilters(data, getWorkflowState) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bulkList, setBulkList] = useState("");
  const [sortBy, setSortBy] = useState("Date");
  const [sortDir, setSortDir] = useState("desc");

  // Parse bulk list into searchable keys
  const bulkSet = useMemo(() => {
    if (!bulkList.trim()) return new Set();
    const parts = bulkList
      .split(/[\s,;\n\r\t]+/)
      .map(s => normalizeKey(s))
      .filter(Boolean);
    return new Set(parts);
  }, [bulkList]);

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return data.filter((rec) => {
      // Status filter
      if (statusFilter !== "All") {
        const state = getWorkflowState(rec);
        if (state !== statusFilter) return false;
      }

      // Search filter
      if (search.trim()) {
        const term = search.toLowerCase();
        const haystack = [
          rec["Invoice Number"],
          rec["Item Number"],
          rec["Customer Number"],
          rec["Ticket Number"],
          rec.RTN_CR_No,
          rec["Reason for Credit"],
          rec["Credit Type"],
          rec["Sales Rep"],
        ]
          .filter(Boolean)
          .map(v => String(v).toLowerCase())
          .join(" ");
        if (!haystack.includes(term)) return false;
      }

      // Bulk list filter
      if (bulkSet.size) {
        const inv = normalizeKey(rec["Invoice Number"]);
        const itm = normalizeKey(rec["Item Number"]);
        const tkt = normalizeKey(rec["Ticket Number"]);
        const bulkMatch = bulkSet.has(inv) || bulkSet.has(itm) || bulkSet.has(tkt);
        if (!bulkMatch) return false;
      }

      return true;
    });
  }, [data, search, statusFilter, bulkSet, getWorkflowState]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    const arr = [...filteredData];
    arr.sort((a, b) => {
      let va, vb;

      switch (sortBy) {
        case "Date":
          va = a.Date || "";
          vb = b.Date || "";
          break;
        case "Customer":
          va = a["Customer Number"] || "";
          vb = b["Customer Number"] || "";
          break;
        case "Invoice":
          va = a["Invoice Number"] || "";
          vb = b["Invoice Number"] || "";
          break;
        case "CreditTotal":
          va = parseFloat(a["Credit Request Total"] || 0);
          vb = parseFloat(b["Credit Request Total"] || 0);
          break;
        default:
          va = "";
          vb = "";
      }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filteredData, sortBy, sortDir]);

  // Toggle sort direction or change sort field
  const toggleSort = useCallback((columnKey) => {
    if (sortBy === columnKey) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnKey);
      setSortDir("asc");
    }
  }, [sortBy]);

  // Check if data is filtered
  const isFiltered = useMemo(() => {
    return Boolean(search.trim()) || statusFilter !== "All" || Boolean(bulkList.trim());
  }, [search, statusFilter, bulkList]);

  return {
    // State
    search,
    statusFilter,
    bulkList,
    sortBy,
    sortDir,

    // Computed
    filteredData,
    sortedData,
    isFiltered,

    // Actions
    setSearch,
    setStatusFilter,
    setBulkList,
    toggleSort,
  };
}

// Helper function to normalize keys for searching
function normalizeKey(val) {
  const raw = String(val || "").trim().toLowerCase();
  if (!raw) return "";
  // strip non-alphanumeric
  const cleaned = raw.replace(/[^a-z0-9]/g, "");
  // drop leading "inv" if present (e.g., inv12345 -> 12345) to match plain invoice numbers
  if (cleaned.startsWith("inv") && cleaned.length > 3) {
    return cleaned.slice(3);
  }
  return cleaned;
}
