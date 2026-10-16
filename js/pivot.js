/**
 * EPOKKITA - Interactive Dynamic Pivot Table Engine
 * Mengolah seluruh transaksi menjadi pivot multidimensi dengan aggregasi fleksibel
 */

class PivotEngine {
  constructor() {
    this.tableContainer = null;
  }

  /**
   * Menghasilkan pivot matrix berdasarkan konfigurasi
   * @param {Array} transactions 
   * @param {Object} config { rowField, colField, valField, aggType, filterType, filterYear }
   */
  generatePivot(transactions, config) {
    const {
      rowField = "categoryName",
      colField = "month",
      aggType = "sum", // 'sum', 'count', 'avg'
      filterType = "all", // 'all', 'expense', 'income'
      filterYear = "all"
    } = config;

    // 1. Filter Transactions
    let filtered = transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterYear !== "all" && !t.date.startsWith(filterYear)) return false;
      return true;
    });

    // Helper to resolve field value from transaction object
    const resolveValue = (item, field) => {
      if (field === "month") {
        return item.date.slice(0, 7); // e.g. "2026-10"
      }
      if (field === "year") {
        return item.date.slice(0, 4);
      }
      return item[field] || "Tidak Terdefinisi";
    };

    // 2. Extract unique row and col keys
    const rowKeysSet = new Set();
    const colKeysSet = new Set();

    filtered.forEach(t => {
      rowKeysSet.add(resolveValue(t, rowField));
      colKeysSet.add(resolveValue(t, colField));
    });

    const rowKeys = Array.from(rowKeysSet).sort();
    const colKeys = Array.from(colKeysSet).sort();

    // 3. Build data matrix cell bucket: cellData[rowKey][colKey] = [amount1, amount2, ...]
    const cellBuckets = {};
    rowKeys.forEach(r => {
      cellBuckets[r] = {};
      colKeys.forEach(c => {
        cellBuckets[r][c] = [];
      });
    });

    filtered.forEach(t => {
      const r = resolveValue(t, rowField);
      const c = resolveValue(t, colField);
      if (cellBuckets[r] && cellBuckets[r][c]) {
        cellBuckets[r][c].push(t.amount);
      }
    });

    // 4. Calculate aggregated values
    const computeAgg = (arr) => {
      if (!arr || arr.length === 0) return 0;
      if (aggType === "count") return arr.length;
      const sum = arr.reduce((a, b) => a + b, 0);
      if (aggType === "avg") return Math.round(sum / arr.length);
      return sum;
    };

    // Calculate matrix, row totals, col totals, grand total
    const matrix = {};
    const rowTotals = {};
    const colBucketsForTotal = {};
    colKeys.forEach(c => { colBucketsForTotal[c] = []; });
    const grandBucket = [];
    let maxCellValue = 0;

    rowKeys.forEach(r => {
      matrix[r] = {};
      const rowBucket = [];
      colKeys.forEach(c => {
        const val = computeAgg(cellBuckets[r][c]);
        matrix[r][c] = val;
        if (val > maxCellValue) maxCellValue = val;
        rowBucket.push(...cellBuckets[r][c]);
        colBucketsForTotal[c].push(...cellBuckets[r][c]);
        grandBucket.push(...cellBuckets[r][c]);
      });
      rowTotals[r] = computeAgg(rowBucket);
    });

    const colTotals = {};
    colKeys.forEach(c => {
      colTotals[c] = computeAgg(colBucketsForTotal[c]);
    });

    const grandTotal = computeAgg(grandBucket);

    return {
      rowKeys,
      colKeys,
      matrix,
      rowTotals,
      colTotals,
      grandTotal,
      maxCellValue,
      totalRecords: filtered.length,
      config
    };
  }

  /**
   * Render HTML Table dari hasil pivot
   */
  renderPivotTable(pivotResult, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal, maxCellValue, totalRecords, config } = pivotResult;

    if (rowKeys.length === 0 || colKeys.length === 0) {
      container.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i data-lucide="inbox" style="width: 48px; height: 48px; margin: 0 auto 0.75rem; opacity: 0.5;"></i>
          <h4>Tidak ada data yang sesuai filter</h4>
          <p style="font-size: 0.85rem;">Coba ubah kriteria filter jenis transaksi atau periode waktu.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Label dimension mappings for UI headers
    const fieldLabels = {
      categoryName: "Kategori",
      memberName: "Anggota Keluarga",
      paymentMethod: "Metode Pembayaran",
      type: "Tipe Transaksi",
      month: "Bulan",
      year: "Tahun"
    };

    const rowLabel = fieldLabels[config.rowField] || config.rowField;
    const colLabel = fieldLabels[config.colField] || config.colField;

    // Helper format value
    const formatVal = (val) => {
      if (val === 0) return "-";
      if (config.aggType === "count") return `${val}x`;
      return window.epokStore ? window.epokStore.formatCurrency(val) : `Rp ${val.toLocaleString()}`;
    };

    // Format column header name
    const formatColHeader = (colKey) => {
      if (config.colField === "month") {
        const [y, m] = colKey.split("-");
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
      }
      if (config.colField === "type") {
        return colKey === "income" ? "Pemasukan" : "Pengeluaran";
      }
      return colKey;
    };

    let html = `
      <table class="pivot-grid">
        <thead>
          <tr>
            <th style="min-width: 180px;">${rowLabel} \\ ${colLabel}</th>
    `;

    colKeys.forEach(c => {
      html += `<th>${formatColHeader(c)}</th>`;
    });

    html += `
            <th style="background-color: var(--border-color); color: var(--text-primary);">Total Baris</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Render Rows
    rowKeys.forEach(r => {
      html += `<tr>`;
      let displayRowName = r;
      if (config.rowField === "type") {
        displayRowName = r === "income" ? "Pemasukan" : "Pengeluaran";
      }

      html += `<td><strong>${displayRowName}</strong></td>`;

      colKeys.forEach(c => {
        const val = matrix[r][c];
        let cellStyle = "";
        // Soft heatmap shading for non-zero values
        if (val > 0 && maxCellValue > 0 && config.aggType !== "count") {
          const ratio = Math.min(1, val / maxCellValue);
          const opacity = (ratio * 0.18).toFixed(2);
          const colorCode = config.filterType === "income" ? `rgba(16, 185, 129, ${opacity})` : `rgba(244, 63, 94, ${opacity})`;
          cellStyle = `style="background-color: ${colorCode}; font-weight: ${ratio > 0.4 ? '700' : '500'};"`;
        }

        html += `<td ${cellStyle}>${formatVal(val)}</td>`;
      });

      html += `<td style="font-weight: 800; background-color: rgba(0,0,0,0.02);">${formatVal(rowTotals[r])}</td>`;
      html += `</tr>`;
    });

    // Render Grand Total Row
    html += `
        </tbody>
        <tfoot>
          <tr class="pivot-grandtotal">
            <td><strong>TOTAL KESELURUHAN</strong></td>
    `;

    colKeys.forEach(c => {
      html += `<td>${formatVal(colTotals[c])}</td>`;
    });

    html += `<td>${formatVal(grandTotal)}</td>`;
    html += `
          </tr>
        </tfoot>
      </table>
    `;

    container.innerHTML = html;
  }

  /**
   * Export Pivot Matrix ke file CSV
   */
  exportToCSV(pivotResult) {
    const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal, config } = pivotResult;
    const rows = [];

    // Header row
    const header = [`"${config.rowField} \\ ${config.colField}"`, ...colKeys.map(c => `"${c}"`), '"Total"'];
    rows.push(header.join(","));

    // Data rows
    rowKeys.forEach(r => {
      const row = [`"${r}"`];
      colKeys.forEach(c => {
        row.push(matrix[r][c]);
      });
      row.push(rowTotals[r]);
      rows.push(row.join(","));
    });

    // Total row
    const totalRow = ['"TOTAL"', ...colKeys.map(c => colTotals[c]), grandTotal];
    rows.push(totalRow.join(","));

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pivot_epokkita_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

window.pivotEngine = new PivotEngine();
