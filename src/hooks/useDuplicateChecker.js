import { useCallback } from "react";
import { get, ref } from "firebase/database";

export function useDuplicateChecker({ db, setError }) {
  const checkDuplicates = useCallback(
    async (rows = []) => {
      if (!db || !rows.length) {
        return { rows, duplicates: 0 };
      }

      try {
        setError?.("Checking for duplicates in Firebase...");
        const allSnap = await get(ref(db, "credit_requests"));
        const existing = allSnap.val() || {};
        const existingCombos = new Set();
        const existingIds = new Set();

        Object.values(existing).forEach((rec) => {
          if (rec.id) existingIds.add(rec.id);
          if (rec.combo_key) {
            existingCombos.add(String(rec.combo_key).trim().toUpperCase());
          }
          const inv =
            rec["Invoice Number"] || rec["InvoiceNumber"] || rec.invoice_number;
          const item =
            rec["Item Number"] || rec["ItemNumber"] || rec.item_number;
          if (inv && item) {
            existingCombos.add(
              `${String(inv).trim().toUpperCase()}|${String(item).trim().toUpperCase()}`
            );
          }
        });

        const updatedRows = rows.map((row) => {
          const inv = row["Invoice Number"] || row["InvoiceNumber"];
          const item = row["Item Number"] || row["ItemNumber"];
          const comboCandidate =
            (row.combo_key && String(row.combo_key).trim().toUpperCase()) ||
            (inv && item
              ? `${String(inv).trim().toUpperCase()}|${String(item).trim().toUpperCase()}`
              : null);
          const isDuplicate =
            (row.id && existingIds.has(row.id)) ||
            (comboCandidate && existingCombos.has(comboCandidate));
          return { ...row, __firebase_duplicate: isDuplicate };
        });
        setError?.("");
        const duplicates = updatedRows.filter((row) => row.__firebase_duplicate).length;
        return { rows: updatedRows, duplicates };
      } catch (err) {
        console.error("Error checking duplicates:", err);
        setError?.("Failed to check duplicates: " + err.message);
        return { rows, duplicates: 0 };
      }
    },
    [db, setError]
  );

  return { checkDuplicates };
}
