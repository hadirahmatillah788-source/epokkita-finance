/**
 * EPOKKITA - Charts & Analytics Manager
 * Memakai Chart.js v4 untuk visualisasi grafik perbandingan dan distribusi keuangan
 */

class ChartManager {
  constructor() {
    this.charts = {};
  }

  // Helper untuk destroy chart lama sebelum re-render
  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  }

  // 1. Grafik Perbandingan Pengeluaran & Pemasukan Bulanan
  renderMonthlyComparison(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const data = window.epokStore.getMonthlyComparisonData();
    const ctx = canvas.getContext("2d");

    // Gradients
    const incomeGrad = ctx.createLinearGradient(0, 0, 0, 300);
    incomeGrad.addColorStop(0, "rgba(16, 185, 129, 0.9)");
    incomeGrad.addColorStop(1, "rgba(5, 150, 105, 0.4)");

    const expenseGrad = ctx.createLinearGradient(0, 0, 0, 300);
    expenseGrad.addColorStop(0, "rgba(244, 63, 94, 0.9)");
    expenseGrad.addColorStop(1, "rgba(225, 29, 72, 0.4)");

    this.charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Pemasukan",
            data: data.incomeData,
            backgroundColor: incomeGrad,
            borderColor: "#10b981",
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: "Pengeluaran",
            data: data.expenseData,
            backgroundColor: expenseGrad,
            borderColor: "#f43f5e",
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: "600", size: 12 }
            }
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleFont: { size: 13, weight: "bold" },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${window.epokStore.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { weight: "600" } }
          },
          y: {
            grid: { color: "rgba(148, 163, 184, 0.15)" },
            ticks: {
              callback: (value) => {
                if (value >= 1000000) return (value / 1000000).toFixed(0) + " Jt";
                return value;
              }
            }
          }
        }
      }
    });
  }

  // 2. Donut Chart: Distribusi Kategori Pengeluaran
  renderCategoryDonut(canvasId, monthPrefix = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const dist = window.epokStore.getCategoryExpenseDistribution(monthPrefix);
    const labels = Object.keys(dist);
    const amounts = Object.values(dist);

    if (labels.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "14px Plus Jakarta Sans";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Belum ada pengeluaran", canvas.width / 2, canvas.height / 2);
      return;
    }

    const palette = [
      "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6",
      "#ec4899", "#14b8a6", "#f43f5e", "#64748b"
    ];

    const ctx = canvas.getContext("2d");
    this.charts[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: amounts,
            backgroundColor: palette.slice(0, labels.length),
            borderWidth: 2,
            borderColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#131b2e" : "#ffffff",
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 10,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: "600" }
            }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${window.epokStore.formatCurrency(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 3. Line Chart Arus Kas & Tren Saldo Kumulatif
  renderCashflowTrend(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const compData = window.epokStore.getMonthlyComparisonData();
    const ctx = canvas.getContext("2d");

    // Cumulative surplus line
    const surplusData = [];
    let runningTotal = 0;
    compData.incomeData.forEach((inc, idx) => {
      const exp = compData.expenseData[idx] || 0;
      runningTotal += (inc - exp);
      surplusData.push(runningTotal);
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

    this.charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: compData.labels,
        datasets: [
          {
            label: "Akumulasi Tabungan Kas",
            data: surplusData,
            borderColor: "#3b82f6",
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#3b82f6",
            pointBorderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Saldo Bersih: ${window.epokStore.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: "rgba(148, 163, 184, 0.15)" },
            ticks: {
              callback: (val) => (val / 1000000).toFixed(0) + " Jt"
            }
          }
        }
      }
    });
  }

  // 4. Horizontal Bar Chart Pengeluaran Tiap Anggota Keluarga
  renderMemberSpendingBar(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const membersData = window.epokStore.getMemberSpendingBreakdown();
    const labels = membersData.map(m => m.member.name);
    const expenses = membersData.map(m => m.totalExpense);
    const colors = membersData.map(m => m.member.color || "#059669");

    const ctx = canvas.getContext("2d");
    this.charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total Pengeluaran",
            data: expenses,
            backgroundColor: colors,
            borderRadius: 6,
            barPercentage: 0.65
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Pengeluaran: ${window.epokStore.formatCurrency(ctx.parsed.x)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(148, 163, 184, 0.15)" },
            ticks: {
              callback: (v) => (v / 1000000).toFixed(1) + " Jt"
            }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }
}

window.chartManager = new ChartManager();
