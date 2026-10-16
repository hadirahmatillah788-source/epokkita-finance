/**
 * EPOKKITA - Main Application Controller
 * Terintegrasi penuh dengan Database PostgreSQL epokkita_db
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // App State & Controllers
  const app = {
    currentView: "dashboard",
    editingTxId: null,
    cachedAuthProfiles: [],

    async init() {
      this.initTheme();
      this.bindAuthGate();
      this.bindPwaInstallation();
      this.bindNavigation();
      this.bindUserSwitching();
      this.bindNotificationPanel();
      this.bindTransactionModal();
      this.bindFamilyManagementModals();
      this.bindPivotControls();
      this.bindTransactionFilters();
      this.bindNotificationEvents();
      this.bindSetBudgetModal();

      // Cek apakah browser memiliki token sesi otentikasi aktif
      if (!window.epokStore.isAuthenticated()) {
        this.showAuthGate();
        return;
      }

      this.hideAuthGate();

      // Inisialisasi data dari PostgreSQL
      await window.epokStore.initAsync();

      this.updateDbStatusBadge();
      this.updateActiveUserBadge();
      this.updateNotificationBadge();
      this.renderCurrentView();

      window.addEventListener("epokkita-data-ready", () => {
        this.updateDbStatusBadge();
        this.updateActiveUserBadge();
        this.updateNotificationBadge();
        this.renderCurrentView();
      });
    },

    // --- FAMILY AUTH GATE CONTROLLER ---
    bindAuthGate() {
      const form = document.getElementById("authLoginForm");
      const togglePinBtn = document.getElementById("authTogglePinBtn");
      const pinInput = document.getElementById("authPinInput");
      const btnLockSidebar = document.getElementById("btnLockAppSidebar");
      const btnLockHeader = document.getElementById("btnLockAppHeader");

      if (form) {
        form.addEventListener("submit", (e) => this.handleAuthSubmit(e));
      }

      if (togglePinBtn && pinInput) {
        togglePinBtn.addEventListener("click", () => {
          const isPwd = pinInput.getAttribute("type") === "password";
          pinInput.setAttribute("type", isPwd ? "text" : "password");
          togglePinBtn.innerHTML = `<i data-lucide="${isPwd ? 'eye-off' : 'eye'}"></i>`;
          if (window.lucide) lucide.createIcons();
        });
      }

      const handleLock = async () => {
        await window.epokStore.logout();
        this.showAuthGate();
      };

      if (btnLockSidebar) btnLockSidebar.addEventListener("click", handleLock);
      if (btnLockHeader) btnLockHeader.addEventListener("click", handleLock);

      window.addEventListener("epokkita-auth-required", () => {
        this.showAuthGate();
      });

      window.addEventListener("epokkita-auth-success", async () => {
        this.hideAuthGate();
        await window.epokStore.initAsync();
        this.updateDbStatusBadge();
        this.updateActiveUserBadge();
        this.updateNotificationBadge();
        this.renderCurrentView();
      });
    },

    // --- PWA INSTALLATION & SERVICE WORKER ---
    deferredInstallPrompt: null,

    bindPwaInstallation() {
      // 1. Daftarkan Service Worker
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("/sw.js")
            .then(reg => {
              console.log("[PWA] Service Worker berhasil didaftarkan:", reg.scope);
            })
            .catch(err => {
              console.warn("[PWA] Service Worker gagal didaftarkan:", err);
            });
        });
      }

      const btnInstallHeader = document.getElementById("btnPwaInstall");
      const banner = document.getElementById("pwaInstallBanner");
      const btnBannerInstall = document.getElementById("btnPwaBannerInstall");
      const btnBannerClose = document.getElementById("btnPwaBannerClose");
      const iosModal = document.getElementById("pwaIosModal");
      const closeIosModal = document.getElementById("closePwaIosModal");
      const btnUnderstandIos = document.getElementById("btnUnderstandIos");

      // Cek apakah sudah berjalan dalam mode standalone (aplikasi terinstal)
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      if (isStandalone) {
        console.log("[PWA] Aplikasi berjalan dalam mode Standalone PWA.");
        if (btnInstallHeader) btnInstallHeader.style.display = "none";
        if (banner) banner.style.display = "none";
        return;
      }

      // Deteksi iOS / iPadOS
      const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

      // 2. Tangkap event beforeinstallprompt (Android / Chrome / Edge)
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        this.deferredInstallPrompt = e;

        // Tampilkan tombol instal di header
        if (btnInstallHeader) {
          btnInstallHeader.style.display = "inline-flex";
        }

        // Tampilkan banner instal di handphone jika belum pernah ditutup sesi ini
        const bannerDismissed = sessionStorage.getItem("epokkita_pwa_banner_dismissed");
        if (banner && !bannerDismissed && window.innerWidth <= 768) {
          banner.style.display = "flex";
        }
      });

      // Jika di iOS, selalu sediakan tombol instalasi di header (karena Safari tidak ada beforeinstallprompt)
      if (isIos && !isStandalone) {
        if (btnInstallHeader) {
          btnInstallHeader.style.display = "inline-flex";
        }
      }

      // Handler aksi instalasi
      const triggerInstall = async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          console.log("[PWA] Hasil instalasi pengguna:", outcome);
          this.deferredInstallPrompt = null;
          if (banner) banner.style.display = "none";
          if (btnInstallHeader) btnInstallHeader.style.display = "none";
        } else if (isIos) {
          // Buka panduan instalasi iOS
          if (iosModal) iosModal.classList.add("show");
        } else {
          // Fallback informasi instalasi
          alert("Untuk menginstal di handphone:\n1. Buka menu browser (titik 3 di kanan atas)\n2. Pilih 'Instal Aplikasi' atau 'Tambahkan ke Layar Utama'\n\nAplikasi akan terpasang di HP Anda tanpa browser!");
        }
      };

      if (btnInstallHeader) btnInstallHeader.addEventListener("click", triggerInstall);
      if (btnBannerInstall) btnBannerInstall.addEventListener("click", triggerInstall);

      if (btnBannerClose && banner) {
        btnBannerClose.addEventListener("click", () => {
          banner.style.display = "none";
          sessionStorage.setItem("epokkita_pwa_banner_dismissed", "true");
        });
      }

      if (closeIosModal && iosModal) {
        closeIosModal.addEventListener("click", () => iosModal.classList.remove("show"));
      }
      if (btnUnderstandIos && iosModal) {
        btnUnderstandIos.addEventListener("click", () => iosModal.classList.remove("show"));
      }

      // Event ketika aplikasi sukses terpasang
      window.addEventListener("appinstalled", () => {
        console.log("[PWA] EPOKKITA berhasil diinstal sebagai aplikasi standalone!");
        if (banner) banner.style.display = "none";
        if (btnInstallHeader) btnInstallHeader.style.display = "none";
        this.deferredInstallPrompt = null;
        window.dispatchEvent(new CustomEvent("epokkita-notification", {
          detail: {
            title: "🎉 Aplikasi Berhasil Dipasang!",
            message: "EPOKKITA kini siap diakses langsung dari layar utama HP Anda.",
            type: "info"
          }
        }));
      });
    },

    showAuthGate() {
      const gate = document.getElementById("familyAuthGate");
      const appLayout = document.querySelector(".app-layout");
      if (gate) gate.style.display = "flex";
      if (appLayout) appLayout.style.display = "none";
      this.loadAuthGateProfiles();
    },

    hideAuthGate() {
      const gate = document.getElementById("familyAuthGate");
      const appLayout = document.querySelector(".app-layout");
      if (gate) gate.style.display = "none";
      if (appLayout) appLayout.style.display = "flex";
    },

    async loadAuthGateProfiles() {
      const grid = document.getElementById("authProfilesGrid");
      if (!grid) return;

      grid.innerHTML = `
        <div class="auth-profile-loading">
          <span class="auth-spinner"></span>
          <span>Memuat profil keluarga...</span>
        </div>
      `;

      try {
        const profiles = await window.epokStore.fetchAuthProfiles();
        this.cachedAuthProfiles = profiles;
        this.renderAuthProfiles(profiles);
      } catch (err) {
        console.error("Gagal memuat profil keluarga:", err);
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 1.5rem;">
            <p>Gagal memuat profil keluarga dari server.</p>
            <button class="btn-primary" style="margin-top: 0.5rem;" onclick="window.epokApp.loadAuthGateProfiles()">Coba Lagi</button>
          </div>
        `;
      }
    },

    renderAuthProfiles(profiles) {
      const grid = document.getElementById("authProfilesGrid");
      if (!grid) return;

      if (!profiles || profiles.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Tidak ada profil ditemukan</div>`;
        return;
      }

      let html = "";
      profiles.forEach(p => {
        const initial = (p.name || "U").charAt(0).toUpperCase();
        html += `
          <div class="auth-profile-card" data-id="${p.id}" onclick="window.epokApp.selectAuthProfile('${p.id}')">
            ${p.hasPin ? '<div class="auth-profile-pin-badge" title="Dilindungi PIN"><i data-lucide="lock"></i></div>' : ''}
            <div class="auth-profile-avatar ${p.avatarClass || 'avatar-ayah'}">${initial}</div>
            <div class="auth-profile-name">${p.name}</div>
            <div class="auth-profile-role">${p.roleTitle || 'Anggota'}</div>
          </div>
        `;
      });

      grid.innerHTML = html;
      if (window.lucide) lucide.createIcons();

      // Reset form state
      const hiddenInput = document.getElementById("authSelectedMemberId");
      if (hiddenInput) hiddenInput.value = "";
      const selectedInfo = document.getElementById("authSelectedInfo");
      if (selectedInfo) selectedInfo.style.display = "none";
      const pinGroup = document.getElementById("authPinGroup");
      if (pinGroup) pinGroup.style.display = "none";
      const noPinNotice = document.getElementById("authNoPinNotice");
      if (noPinNotice) noPinNotice.style.display = "none";
      const errAlert = document.getElementById("authErrorAlert");
      if (errAlert) errAlert.style.display = "none";
      const submitBtn = document.getElementById("authSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        document.getElementById("authSubmitBtnText").textContent = "Pilih Profil Terlebih Dahulu";
      }

      // Auto-select Kepala Keluarga (Ayah) atau profil pertama
      if (profiles.length > 0) {
        const defaultProfile = profiles.find(p => p.role === "admin") || profiles[0];
        this.selectAuthProfile(defaultProfile.id);
      }
    },

    selectAuthProfile(memberId) {
      const profile = (this.cachedAuthProfiles || []).find(p => p.id === memberId);
      if (!profile) return;

      // Update selected cards
      document.querySelectorAll(".auth-profile-card").forEach(c => {
        if (c.getAttribute("data-id") === memberId) {
          c.classList.add("selected");
        } else {
          c.classList.remove("selected");
        }
      });

      // Update hidden input
      const hiddenInput = document.getElementById("authSelectedMemberId");
      if (hiddenInput) hiddenInput.value = memberId;

      // Update preview
      const selectedInfo = document.getElementById("authSelectedInfo");
      const selectedAvatar = document.getElementById("authSelectedAvatar");
      const selectedName = document.getElementById("authSelectedName");
      const selectedRole = document.getElementById("authSelectedRole");

      if (selectedInfo) selectedInfo.style.display = "flex";
      if (selectedAvatar) {
        selectedAvatar.className = `auth-selected-avatar ${profile.avatarClass || 'avatar-ayah'}`;
        selectedAvatar.textContent = (profile.name || "U").charAt(0).toUpperCase();
      }
      if (selectedName) selectedName.textContent = profile.fullName || profile.name;
      if (selectedRole) selectedRole.textContent = profile.roleTitle || "Anggota Keluarga";

      // Toggle PIN vs Direct Login
      const pinGroup = document.getElementById("authPinGroup");
      const noPinNotice = document.getElementById("authNoPinNotice");
      const pinInput = document.getElementById("authPinInput");
      const submitBtn = document.getElementById("authSubmitBtn");
      const submitBtnText = document.getElementById("authSubmitBtnText");
      const errAlert = document.getElementById("authErrorAlert");
      if (errAlert) errAlert.style.display = "none";

      if (profile.hasPin) {
        if (pinGroup) pinGroup.style.display = "flex";
        if (noPinNotice) noPinNotice.style.display = "none";
        if (submitBtnText) submitBtnText.textContent = `Buka Dashboard ${profile.name}`;
        if (pinInput) {
          pinInput.value = "";
          setTimeout(() => pinInput.focus(), 100);
        }
      } else {
        if (pinGroup) pinGroup.style.display = "none";
        if (noPinNotice) noPinNotice.style.display = "flex";
        if (submitBtnText) submitBtnText.textContent = `Masuk Langsung sebagai ${profile.name} 🚀`;
      }

      if (submitBtn) {
        submitBtn.disabled = false;
      }
    },

    async handleAuthSubmit(e) {
      e.preventDefault();
      const memberId = document.getElementById("authSelectedMemberId")?.value;
      const pinInput = document.getElementById("authPinInput");
      const pin = pinInput ? pinInput.value.trim() : "";
      const rememberMe = document.getElementById("authRememberMe")?.checked ?? true;
      const errAlert = document.getElementById("authErrorAlert");
      const errText = document.getElementById("authErrorText");
      const submitBtn = document.getElementById("authSubmitBtn");
      const submitBtnText = document.getElementById("authSubmitBtnText");

      if (!memberId) {
        if (errAlert && errText) {
          errText.textContent = "Silakan pilih salah satu profil keluarga!";
          errAlert.style.display = "flex";
        }
        return;
      }

      const originalBtnText = submitBtnText?.textContent || "Masuk";
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = "Memverifikasi...";

      try {
        const res = await window.epokStore.login(memberId, pin, rememberMe);
        if (res.success) {
          if (errAlert) errAlert.style.display = "none";
          window.dispatchEvent(new CustomEvent("epokkita-auth-success"));
        } else {
          if (errAlert && errText) {
            errText.textContent = res.message || "PIN yang Anda masukkan tidak sesuai!";
            errAlert.style.display = "flex";
          }
          if (pinInput) {
            pinInput.value = "";
            pinInput.focus();
          }
          if (submitBtn) submitBtn.disabled = false;
          if (submitBtnText) submitBtnText.textContent = originalBtnText;
        }
      } catch (err) {
        if (errAlert && errText) {
          errText.textContent = err.message || "Terjadi kendala saat verifikasi. Coba lagi.";
          errAlert.style.display = "flex";
        }
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = originalBtnText;
      }
    },

    updateDbStatusBadge() {
      const badge = document.getElementById("dbStatusBadge");
      if (!badge) return;
      if (window.epokStore.isOnline) {
        badge.innerHTML = `
          <span class="db-pulse-dot"></span>
          <i data-lucide="database"></i>
          <span>PostgreSQL: ${window.epokStore.dbStatus.database || 'epokkita_db'}</span>
        `;
        badge.style.display = "inline-flex";
      } else {
        badge.innerHTML = `
          <i data-lucide="database-zap"></i>
          <span>Offline Cache</span>
        `;
      }
      if (window.lucide) lucide.createIcons();
    },

    // --- THEME ---
    initTheme() {
      const savedTheme = localStorage.getItem("epokkita_theme_v1") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      const themeToggleBtn = document.getElementById("themeToggleBtn");
      if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
          const current = document.documentElement.getAttribute("data-theme");
          const next = current === "dark" ? "light" : "dark";
          document.documentElement.setAttribute("data-theme", next);
          localStorage.setItem("epokkita_theme_v1", next);
          if (window.lucide) lucide.createIcons();
          this.refreshCharts();
        });
      }
    },

    // --- NAVIGATION ---
    bindNavigation() {
      const navItems = document.querySelectorAll("[data-nav-target]");
      navItems.forEach(item => {
        item.addEventListener("click", (e) => {
          e.preventDefault();
          const target = item.getAttribute("data-nav-target");
          this.switchView(target);
          this.closeMobileDrawer();
        });
      });

      const mobileBtn = document.getElementById("mobileMenuBtn");
      const closeBtn = document.getElementById("sidebarCloseBtn");
      const backdrop = document.getElementById("sidebarBackdrop");

      if (mobileBtn) {
        mobileBtn.addEventListener("click", () => {
          this.toggleMobileDrawer();
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          this.closeMobileDrawer();
        });
      }

      if (backdrop) {
        backdrop.addEventListener("click", () => {
          this.closeMobileDrawer();
        });
      }
    },

    toggleMobileDrawer() {
      const sidebar = document.querySelector(".sidebar");
      const backdrop = document.getElementById("sidebarBackdrop");
      if (sidebar) {
        const isOpen = sidebar.classList.toggle("mobile-open");
        if (backdrop) {
          if (isOpen) backdrop.classList.add("show");
          else backdrop.classList.remove("show");
        }
      }
    },

    closeMobileDrawer() {
      document.querySelector(".sidebar")?.classList.remove("mobile-open");
      document.getElementById("sidebarBackdrop")?.classList.remove("show");
    },

    switchView(viewName) {
      this.currentView = viewName;

      document.querySelectorAll("[data-nav-target]").forEach(nav => {
        if (nav.getAttribute("data-nav-target") === viewName) {
          nav.classList.add("active");
        } else {
          nav.classList.remove("active");
        }
      });

      document.querySelectorAll(".app-view").forEach(v => {
        v.classList.remove("active");
      });

      const activeView = document.getElementById(`view-${viewName}`);
      if (activeView) {
        activeView.classList.add("active");
      }

      const titles = {
        dashboard: { title: "Dashboard Keuangan", desc: "Ringkasan kondisi finansial seluruh anggota keluarga" },
        transactions: { title: "Daftar Transaksi", desc: "Riwayat lengkap pemasukan dan pengeluaran (Database PostgreSQL)" },
        pivot: { title: "Tabel Pivot Multidimensi", desc: "Analisis aggregasi transaksi berdasarkan kategori, anggota & bulan" },
        analytics: { title: "Grafik & Perbandingan", desc: "Perbandingan tren pengeluaran bulanan dan pertumbuhan tabungan" },
        family: { title: "Kelola Keluarga & Pengguna", desc: "Manajemen anggota keluarga, jabatan anak & hak akses (Kepala Keluarga & Bendahara)" },
        budget: { title: "Anggaran & Kuota", desc: "Pantau batas maksimal pengeluaran setiap kategori kebutuhan" }
      };

      const titleConfig = titles[viewName] || titles.dashboard;
      const pageTitleEl = document.getElementById("pageTitle");
      const pageDescEl = document.getElementById("pageDescription");
      if (pageTitleEl) pageTitleEl.innerHTML = `<img src="/assets/icon-192.png" class="header-brand-logo" alt="Logo"> ${titleConfig.title}`;
      if (pageDescEl) pageDescEl.textContent = titleConfig.desc;

      this.renderCurrentView();
      if (window.lucide) lucide.createIcons();
    },

    renderCurrentView() {
      if (this.currentView === "dashboard") {
        this.renderDashboard();
      } else if (this.currentView === "transactions") {
        this.renderTransactionsView();
      } else if (this.currentView === "pivot") {
        this.renderPivotView();
      } else if (this.currentView === "analytics") {
        this.renderAnalyticsView();
      } else if (this.currentView === "family") {
        this.renderFamilyView();
      } else if (this.currentView === "budget") {
        this.renderBudgetView();
      }
    },

    refreshCharts() {
      if (this.currentView === "dashboard") {
        window.chartManager.renderMonthlyComparison("chartMonthlyComp");
        window.chartManager.renderCategoryDonut("chartCategoryDonut");
      } else if (this.currentView === "analytics") {
        window.chartManager.renderCashflowTrend("chartCashflowTrend");
        window.chartManager.renderMemberSpendingBar("chartMemberSpendingBar");
      }
    },

    // --- DASHBOARD VIEW ---
    renderDashboard() {
      const totals = window.epokStore.calculateTotals();
      const activeUser = window.epokStore.getActiveUser();

      const greetingUserEl = document.getElementById("bannerUserName");
      if (greetingUserEl) greetingUserEl.textContent = `Halo, ${activeUser.name}! 👋`;

      const elBalance = document.getElementById("kpiTotalBalance");
      const elIncome = document.getElementById("kpiCurrentIncome");
      const elExpense = document.getElementById("kpiCurrentExpense");
      const elBudgetLeft = document.getElementById("kpiBudgetLeft");
      const elBudgetFill = document.getElementById("kpiBudgetFill");

      if (elBalance) elBalance.textContent = window.epokStore.formatCurrency(totals.netBalance);
      if (elIncome) elIncome.textContent = window.epokStore.formatCurrency(totals.currentMonthIncome);
      if (elExpense) elExpense.textContent = window.epokStore.formatCurrency(totals.currentMonthExpense);
      if (elBudgetLeft) elBudgetLeft.textContent = window.epokStore.formatCurrency(totals.budgetLeft);

      if (elBudgetFill) {
        elBudgetFill.style.width = `${totals.budgetUsedPct}%`;
        if (totals.budgetUsedPct > 85) {
          elBudgetFill.classList.add("warning");
        } else {
          elBudgetFill.classList.remove("warning");
        }
      }

      const expBadge = document.getElementById("kpiExpenseTrendBadge");
      if (expBadge) {
        const trend = totals.expenseTrendPct;
        const isUp = trend > 0;
        expBadge.className = `trend-badge ${isUp ? 'down' : 'up'}`;
        expBadge.innerHTML = `<i data-lucide="${isUp ? 'trending-up' : 'trending-down'}"></i> ${Math.abs(trend).toFixed(1)}%`;
      }

      const incBadge = document.getElementById("kpiIncomeTrendBadge");
      if (incBadge) {
        const trend = totals.incomeTrendPct;
        const isUp = trend >= 0;
        incBadge.className = `trend-badge ${isUp ? 'up' : 'down'}`;
        incBadge.innerHTML = `<i data-lucide="${isUp ? 'trending-up' : 'trending-down'}"></i> ${Math.abs(trend).toFixed(1)}%`;
      }

      setTimeout(() => {
        window.chartManager.renderMonthlyComparison("chartMonthlyComp");
        window.chartManager.renderCategoryDonut("chartCategoryDonut");
        if (window.lucide) lucide.createIcons();
      }, 50);

      this.renderRecentTransactions();
      this.renderMemberSpendingWidget();
    },

    renderRecentTransactions() {
      const container = document.getElementById("recentTransactionsList");
      if (!container) return;

      const txs = window.epokStore.getTransactions().slice(0, 5);
      if (txs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:1.5rem; color:var(--text-muted);">Belum ada transaksi di database.</p>`;
        return;
      }

      let html = "";
      txs.forEach(t => {
        const isIncome = t.type === "income";
        const iconName = isIncome ? "arrow-down-left" : "arrow-up-right";
        const sign = isIncome ? "+" : "-";
        const iconColor = isIncome ? "var(--primary-600)" : "var(--accent-rose)";

        html += `
          <div class="transaction-card-item">
            <div class="tx-left">
              <div class="tx-icon-pill" style="background-color: ${isIncome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}; color: ${iconColor};">
                <i data-lucide="${iconName}"></i>
              </div>
              <div class="tx-info">
                <span class="tx-title">${t.description}</span>
                <span class="tx-meta">
                  <span class="tx-user-tag"><i data-lucide="user" style="width:12px;height:12px;"></i> ${t.memberName}</span>
                  <span>•</span>
                  <span>${t.categoryName}</span>
                </span>
              </div>
            </div>
            <div class="tx-amount-col">
              <div class="tx-amount ${t.type}">${sign} ${window.epokStore.formatCurrency(t.amount)}</div>
              <div class="tx-date">${window.epokStore.formatDate(t.date)}</div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    },

    renderMemberSpendingWidget() {
      const container = document.getElementById("memberSpendingWidget");
      if (!container) return;

      const breakdown = window.epokStore.getMemberSpendingBreakdown();
      const totalExpAll = breakdown.reduce((sum, b) => sum + b.totalExpense, 0) || 1;

      let html = "";
      breakdown.forEach(item => {
        const pct = Math.round((item.totalExpense / totalExpAll) * 100);
        html += `
          <div class="member-progress-card">
            <div class="member-top-row">
              <div class="member-profile-snippet">
                <div class="user-avatar ${item.member.avatarClass || 'avatar-ayah'}" style="width:30px; height:30px; font-size:0.75rem;">
                  ${item.member.name.charAt(0)}
                </div>
                <div>
                  <div style="font-size:0.825rem; font-weight:700;">${item.member.name}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${item.member.roleTitle || 'Anggota'}</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div class="member-spending-num">${window.epokStore.formatCurrency(item.totalExpense)}</div>
                <div class="member-spending-pct">${pct}% dari total keluarga</div>
              </div>
            </div>
            <div class="member-bar-track">
              <div class="member-bar-fill" style="width: ${pct}%; background-color: ${item.member.color || '#059669'};"></div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    },

    // --- TRANSACTIONS VIEW ---
    renderTransactionsView() {
      // Tampilkan tombol Hapus Semua Transaksi HANYA untuk Kepala Keluarga (admin)
      const activeUser = window.epokStore.getActiveUser();
      const btnReset = document.getElementById("btnResetAllTx");
      if (btnReset) {
        btnReset.style.display = (activeUser && activeUser.role === "admin") ? "inline-flex" : "none";
      }

      // Pastikan opsi filter bulan selalu terupdate dengan data terbaru
      this.populateMonthFilterOptions();

      const txs = this.getFilteredTransactions();
      const tbody = document.getElementById("allTransactionsTableBody");
      const summaryEl = document.getElementById("txFilteredSummary");
      if (!tbody) return;

      let totalInc = 0;
      let totalExp = 0;

      if (txs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-muted);">
              <i data-lucide="search-x" style="width: 40px; height: 40px; margin: 0 auto 0.5rem; opacity: 0.5;"></i>
              <p>Tidak ada transaksi yang cocok untuk periode / filter ini.</p>
            </td>
          </tr>
        `;
        if (summaryEl) summaryEl.textContent = "0 transaksi ditemukan";
        if (window.lucide) lucide.createIcons();
        return;
      }

      let html = "";
      txs.forEach(t => {
        if (t.type === "income") totalInc += t.amount;
        if (t.type === "expense") totalExp += t.amount;

        const isIncome = t.type === "income";
        const sign = isIncome ? "+" : "-";

        html += `
          <tr>
            <td><strong>${window.epokStore.formatDate(t.date)}</strong></td>
            <td>
              <div style="font-weight:600; color:var(--text-primary); font-size:0.875rem;">${t.description}</div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${t.paymentMethod || 'Metode Umum'}</div>
            </td>
            <td><span class="badge-tag ${t.category || 'lainnya'}">${t.categoryName || t.category}</span></td>
            <td>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="user" style="width:14px; height:14px; color:var(--primary-600);"></i>
                <span style="font-weight:600; font-size:0.825rem;">${t.memberName}</span>
              </div>
            </td>
            <td><span class="trend-badge ${isIncome ? 'up' : 'down'}">${isIncome ? 'Pemasukan' : 'Pengeluaran'}</span></td>
            <td style="text-align: right;" class="tx-amount ${t.type}">
              ${sign} ${window.epokStore.formatCurrency(t.amount)}
            </td>
            <td style="text-align: center;">
              <div class="action-btn-group" style="justify-content: center;">
                <button class="icon-btn-subtle delete" title="Hapus dari Database" onclick="window.epokApp.handleDeleteTransaction('${t.id}')">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

      // Update summary chips with active month context
      const selectedMonth = document.getElementById("txMonthFilter")?.value || "all";
      let monthText = "Semua Periode";
      if (selectedMonth !== "all") {
        const [y, m] = selectedMonth.split("-");
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        monthText = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
      }

      if (summaryEl) {
        const netBalance = totalInc - totalExp;
        summaryEl.innerHTML = `
          <div class="summary-chip">
            <i data-lucide="calendar"></i>
            <span>Periode: <strong>${monthText}</strong></span>
          </div>
          <div class="summary-chip">
            <i data-lucide="receipt"></i>
            <span>Total: <strong>${txs.length} Transaksi</strong></span>
          </div>
          <div class="summary-chip income">
            <i data-lucide="arrow-down-left"></i>
            <span>Pemasukan: <strong>+${window.epokStore.formatCurrency(totalInc)}</strong></span>
          </div>
          <div class="summary-chip expense">
            <i data-lucide="arrow-up-right"></i>
            <span>Pengeluaran: <strong>-${window.epokStore.formatCurrency(totalExp)}</strong></span>
          </div>
          <div class="summary-chip ${netBalance >= 0 ? 'net-positive' : 'net-negative'}">
            <i data-lucide="${netBalance >= 0 ? 'sparkles' : 'alert-circle'}"></i>
            <span>Arus Bersih: <strong>${netBalance >= 0 ? '+' : ''}${window.epokStore.formatCurrency(netBalance)}</strong></span>
          </div>
        `;
      }
      if (window.lucide) lucide.createIcons();
    },

    populateMonthFilterOptions() {
      const monthSelect = document.getElementById("txMonthFilter");
      const pillBar = document.getElementById("txMonthPillBar");
      if (!monthSelect) return;

      const txs = window.epokStore.getTransactions();
      const monthSet = new Set();
      txs.forEach(t => {
        if (t.date && t.date.length >= 7) {
          monthSet.add(t.date.slice(0, 7));
        }
      });

      const sortedMonths = Array.from(monthSet).sort().reverse();
      const currentVal = monthSelect.value || "all";

      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const shortMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

      let optHtml = `<option value="all">📅 Semua Bulan</option>`;
      let pillHtml = `<button type="button" class="month-pill-btn ${currentVal === 'all' ? 'active' : ''}" data-month="all" onclick="window.epokApp.selectMonthFilter('all')"><i data-lucide="layers" style="width:13px;height:13px;"></i> Semua Bulan</button>`;

      sortedMonths.forEach(m => {
        const [y, mm] = m.split("-");
        const idx = parseInt(mm, 10) - 1;
        const fullLabel = `${monthNames[idx]} ${y}`;
        const shortLabel = `${shortMonths[idx]} '${y.slice(2)}`;
        const isSelected = m === currentVal ? "selected" : "";
        const isPillActive = m === currentVal ? "active" : "";

        optHtml += `<option value="${m}" ${isSelected}>📅 ${fullLabel}</option>`;
        pillHtml += `<button type="button" class="month-pill-btn ${isPillActive}" data-month="${m}" onclick="window.epokApp.selectMonthFilter('${m}')">${shortLabel}</button>`;
      });

      monthSelect.innerHTML = optHtml;
      if (pillBar) {
        pillBar.innerHTML = pillHtml;
      }
      if (window.lucide) lucide.createIcons();
    },

    selectMonthFilter(monthVal) {
      const select = document.getElementById("txMonthFilter");
      if (select) {
        select.value = monthVal;
      }
      const pillButtons = document.querySelectorAll(".month-pill-btn");
      pillButtons.forEach(btn => {
        if (btn.getAttribute("data-month") === monthVal) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      this.renderTransactionsView();
    },

    getFilteredTransactions() {
      const searchKeyword = (document.getElementById("txSearchInput")?.value || "").toLowerCase().trim();
      const monthFilter = document.getElementById("txMonthFilter")?.value || "all";
      const typeFilter = document.getElementById("txTypeFilter")?.value || "all";
      const memberFilter = document.getElementById("txMemberFilter")?.value || "all";
      const categoryFilter = document.getElementById("txCategoryFilter")?.value || "all";

      return window.epokStore.getTransactions().filter(t => {
        // Filter spesifik per bulan
        if (monthFilter !== "all" && !t.date.startsWith(monthFilter)) return false;
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (memberFilter !== "all" && t.memberId !== memberFilter) return false;
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (searchKeyword) {
          const matchDesc = t.description.toLowerCase().includes(searchKeyword);
          const matchCat = (t.categoryName || "").toLowerCase().includes(searchKeyword);
          const matchMember = (t.memberName || "").toLowerCase().includes(searchKeyword);
          if (!matchDesc && !matchCat && !matchMember) return false;
        }
        return true;
      });
    },

    bindTransactionFilters() {
      const inputs = ["txSearchInput", "txMonthFilter", "txTypeFilter", "txMemberFilter", "txCategoryFilter"];
      inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener("input", () => this.renderTransactionsView());
          el.addEventListener("change", () => {
            if (id === "txMonthFilter") {
              const val = el.value;
              document.querySelectorAll(".month-pill-btn").forEach(btn => {
                if (btn.getAttribute("data-month") === val) {
                  btn.classList.add("active");
                } else {
                  btn.classList.remove("active");
                }
              });
            }
            this.renderTransactionsView();
          });
        }
      });

      // Handler Tombol Khusus Kepala Keluarga: Hapus Semua Transaksi
      const btnResetAll = document.getElementById("btnResetAllTx");
      if (btnResetAll) {
        btnResetAll.addEventListener("click", async () => {
          const activeUser = window.epokStore.getActiveUser();
          if (activeUser.role !== "admin") {
            alert("Hanya Kepala Keluarga yang berwenang menghapus seluruh data transaksi!");
            return;
          }

          const confirmed = confirm(
            "⚠️ PERINGATAN KEPALA KELUARGA:\n\nApakah Anda yakin ingin MENGHAPUS SELURUH DATA TRANSAKSI dari database PostgreSQL?\n\nSemua riwayat pengeluaran dan pemasukan akan direset bersih."
          );
          if (!confirmed) return;

          const verifyCode = prompt("Ketik kata 'HAPUS' dengan huruf besar untuk konfirmasi penghapusan seluruh transaksi:");
          if (verifyCode !== "HAPUS") {
            alert("Penghapusan dibatalkan. Kata konfirmasi tidak cocok.");
            return;
          }

          try {
            await window.epokStore.deleteAllTransactions();
            window.soundFx.playAlertTone();
            this.renderCurrentView();
            this.showToast({
              title: "Semua Transaksi Telah Dihapus",
              message: "Database transaksi keluarga telah berhasil direset bersih oleh Kepala Keluarga.",
              type: "alert"
            });
          } catch (err) {
            alert("Gagal menghapus semua transaksi: " + err.message);
          }
        });
      }

      const memberFilter = document.getElementById("txMemberFilter");
      if (memberFilter) {
        let optHtml = `<option value="all">Semua Anggota</option>`;
        window.epokStore.getMembers().forEach(m => {
          optHtml += `<option value="${m.id}">${m.name}</option>`;
        });
        memberFilter.innerHTML = optHtml;
      }

      const catFilter = document.getElementById("txCategoryFilter");
      if (catFilter) {
        let catHtml = `<option value="all">Semua Kategori</option>`;
        [...INITIAL_CATEGORIES.expense, ...INITIAL_CATEGORIES.income].forEach(c => {
          catHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        catFilter.innerHTML = catHtml;
      }

      const exportBtn = document.getElementById("exportTxCsvBtn");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          this.exportTransactionsToCSV();
        });
      }
    },

    exportTransactionsToCSV() {
      const txs = this.getFilteredTransactions();
      const rows = [
        ["ID", "Tanggal", "Tipe", "Kategori", "Deskripsi", "Anggota", "Metode Pembayaran", "Jumlah (IDR)"]
      ];

      txs.forEach(t => {
        rows.push([
          `"${t.id}"`,
          `"${t.date}"`,
          `"${t.type}"`,
          `"${t.categoryName}"`,
          `"${t.description.replace(/"/g, '""')}"`,
          `"${t.memberName}"`,
          `"${t.paymentMethod}"`,
          t.amount
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transaksi_epokkita_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    async handleDeleteTransaction(txId) {
      const activeUser = window.epokStore.getActiveUser();
      const tx = window.epokStore.getTransactions().find(t => t.id === txId);
      if (!tx) return;

      const isPrivileged = window.epokStore.isPrivilegedAdmin();
      if (!isPrivileged && tx.memberId !== activeUser.id) {
        alert("Hanya Kepala Keluarga, Bendahara, atau pembuat transaksi yang dapat menghapus data ini!");
        return;
      }

      if (confirm(`Yakin ingin menghapus transaksi: "${tx.description}" dari PostgreSQL?`)) {
        try {
          await window.epokStore.deleteTransaction(txId);
          window.soundFx.playAlertTone();
          this.renderCurrentView();
          this.showToast({
            title: "Transaksi Dihapus",
            message: `Transaksi "${tx.description}" berhasil dihapus dari database PostgreSQL.`,
            type: "alert"
          });
        } catch (e) {
          alert("Gagal menghapus transaksi: " + e.message);
        }
      }
    },

    // --- PIVOT TABLE VIEW ---
    renderPivotView() {
      const config = {
        rowField: document.getElementById("pivotRowField")?.value || "categoryName",
        colField: document.getElementById("pivotColField")?.value || "month",
        aggType: document.getElementById("pivotAggType")?.value || "sum",
        filterType: document.getElementById("pivotFilterType")?.value || "expense"
      };

      const result = window.pivotEngine.generatePivot(window.epokStore.getTransactions(), config);
      window.pivotEngine.renderPivotTable(result, "pivotTableOutputContainer");

      const summaryEl = document.getElementById("pivotSummaryInfo");
      if (summaryEl) {
        summaryEl.innerHTML = `Menganalisis <strong>${result.totalRecords} transaksi</strong> di PostgreSQL | Grand Total: <strong>${window.epokStore.formatCurrency(result.grandTotal)}</strong>`;
      }

      this.currentPivotResult = result;
    },

    bindPivotControls() {
      const selects = ["pivotRowField", "pivotColField", "pivotAggType", "pivotFilterType"];
      selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener("change", () => this.renderPivotView());
        }
      });

      const exportPivotBtn = document.getElementById("exportPivotCsvBtn");
      if (exportPivotBtn) {
        exportPivotBtn.addEventListener("click", () => {
          if (this.currentPivotResult) {
            window.pivotEngine.exportToCSV(this.currentPivotResult);
          }
        });
      }
    },

    // --- ANALYTICS VIEW ---
    renderAnalyticsView() {
      setTimeout(() => {
        window.chartManager.renderCashflowTrend("chartCashflowTrend");
        window.chartManager.renderMemberSpendingBar("chartMemberSpendingBar");
        this.renderMonthlyDeepDiveTable();
        if (window.lucide) lucide.createIcons();
      }, 50);
    },

    renderMonthlyDeepDiveTable() {
      const container = document.getElementById("monthlyComparisonTableBody");
      if (!container) return;

      const comp = window.epokStore.getMonthlyComparisonData();
      let html = "";

      comp.keys.forEach((k, idx) => {
        const inc = comp.incomeData[idx];
        const exp = comp.expenseData[idx];
        const net = inc - exp;
        const savingRatio = inc > 0 ? ((net / inc) * 100).toFixed(1) : 0;
        const statusBadge = net >= 0 ? "trend-badge up" : "trend-badge down";
        const statusText = net >= 0 ? "Surplus Sehat" : "Defisit";

        html += `
          <tr>
            <td><strong>${comp.labels[idx]}</strong></td>
            <td style="color:var(--primary-600); font-weight:700;">${window.epokStore.formatCurrency(inc)}</td>
            <td style="color:var(--accent-rose); font-weight:700;">${window.epokStore.formatCurrency(exp)}</td>
            <td style="font-weight:800; color:${net >= 0 ? 'var(--primary-700)' : 'var(--accent-rose)'};">${window.epokStore.formatCurrency(net)}</td>
            <td><strong>${savingRatio}%</strong></td>
            <td><span class="${statusBadge}">${statusText}</span></td>
          </tr>
        `;
      });

      container.innerHTML = html;
    },

    // --- FAMILY & USER MANAGEMENT VIEW ---
    renderFamilyView() {
      const members = window.epokStore.getMembers();
      const container = document.getElementById("familyMembersGrid");
      const activeUser = window.epokStore.getActiveUser();
      const isPrivileged = window.epokStore.isPrivilegedAdmin(); // True untuk Kepala Keluarga & Bendahara
      if (!container) return;

      let html = "";
      members.forEach(m => {
        const isCurrent = m.id === activeUser.id;
        const roleChipClass = m.role === "admin" ? "admin" : (m.role === "co-admin" ? "co-admin" : "member");

        html += `
          <div class="member-admin-card ${isCurrent ? 'selected-card' : ''}" style="${isCurrent ? 'border-color:var(--primary-500);' : ''}">
            <div class="member-card-header">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <div class="user-avatar ${m.avatarClass || 'avatar-ayah'}" style="width:44px; height:44px; font-size:1.1rem;">
                  ${m.name.charAt(0)}
                </div>
                <div>
                  <h4 style="font-size:1rem; font-weight:800;">${m.fullName || m.name}</h4>
                  <span class="member-role-chip ${roleChipClass}">${m.roleTitle}</span>
                </div>
              </div>
              ${isCurrent ? '<span class="trend-badge up" style="font-size:0.65rem;">Sedang Aktif</span>' : ''}
            </div>

            <div class="member-stats-row">
              <div class="member-stat-box">
                <p>Pagu Anggaran</p>
                <h5>${window.epokStore.formatCurrency(m.monthlyLimit || 0)}</h5>
              </div>
              <div class="member-stat-box">
                <p>Keamanan PIN</p>
                <h5>${m.hasPin ? 'Terproteksi PIN 🔒' : 'Bebas PIN'}</h5>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:space-between; align-items:center; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border-light);">
              <button class="btn-secondary btn-sm" onclick="window.epokApp.quickSwitchUser('${m.id}')" title="Beralih ke akun ini">
                <i data-lucide="log-in" style="width:13px; height:13px;"></i> Masuk
              </button>

              <div style="display:flex; gap:0.35rem;">
                ${isPrivileged ? `
                  <button class="btn-secondary btn-sm" onclick="window.epokApp.openEditMemberModal('${m.id}')" title="Edit nama, jabatan anak, atau limit">
                    <i data-lucide="edit-3" style="width:13px; height:13px;"></i> Edit
                  </button>
                ` : ''}

                ${isPrivileged && m.role !== 'admin' ? `
                  <button class="icon-btn-subtle delete" onclick="window.epokApp.handleDeleteMember('${m.id}', '${m.name}')" title="Hapus dari database">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    },

    // Buka Modal Edit Anggota & Jabatan Anak
    openEditMemberModal(memberId) {
      const member = window.epokStore.getMembers().find(m => m.id === memberId);
      if (!member) return;

      document.getElementById("editMemberId").value = member.id;
      document.getElementById("editMemberName").value = member.name;
      document.getElementById("editMemberFullName").value = member.fullName || member.name;
      document.getElementById("editMemberRoleTitle").value = member.roleTitle;
      document.getElementById("editMemberRole").value = member.role;
      document.getElementById("editMemberMonthlyLimit").value = member.monthlyLimit || 2000000;

      document.getElementById("editMemberModal")?.classList.add("show");
      if (window.lucide) lucide.createIcons();
    },

    // Buka Modal Ubah PIN Login Keamanan
    openPinChangeModal() {
      const targetSelect = document.getElementById("pinTargetMemberSelect");
      if (targetSelect) {
        let html = "";
        const active = window.epokStore.getActiveUser();
        // Tampilkan akun admin & co-admin yang berhak mengatur PIN
        window.epokStore.getMembers().filter(m => m.role === "admin" || m.role === "co-admin").forEach(m => {
          const selected = m.id === active.id ? "selected" : "";
          html += `<option value="${m.id}" ${selected}>${m.name} (${m.roleTitle})</option>`;
        });
        targetSelect.innerHTML = html;
      }

      document.getElementById("pinCurrentInput").value = "";
      document.getElementById("pinNewInput").value = "";
      document.getElementById("pinConfirmInput").value = "";

      document.getElementById("pinChangeModal")?.classList.add("show");
      if (window.lucide) lucide.createIcons();
    },

    // Hapus Anggota Keluarga dari PostgreSQL
    async handleDeleteMember(memberId, memberName) {
      if (!window.epokStore.isPrivilegedAdmin()) {
        alert("Hanya Kepala Keluarga dan Bendahara yang memiliki hak akses menghapus anggota keluarga!");
        return;
      }

      if (confirm(`Yakin ingin menghapus anggota keluarga '${memberName}' dari database PostgreSQL?\n\nSemua riwayat transaksi masa lalu tetap akan tersimpan secara anonim.`)) {
        try {
          await window.epokStore.deleteMember(memberId);
          window.soundFx.playAlertTone();
          this.renderFamilyView();
          this.showToast({
            title: "Anggota Dihapus",
            message: `Data anggota '${memberName}' telah berhasil dihapus dari database PostgreSQL.`,
            type: "alert"
          });
        } catch (e) {
          alert("Gagal menghapus: " + e.message);
        }
      }
    },

    bindFamilyManagementModals() {
      // Tombol Buka Modal Tambah
      const btnOpenAdd = document.getElementById("btnOpenAddMemberModal");
      const addModal = document.getElementById("addMemberModal");
      const closeAdd = document.getElementById("closeAddMemberModal");
      const addForm = document.getElementById("addMemberForm");

      if (btnOpenAdd && addModal) {
        btnOpenAdd.addEventListener("click", () => {
          if (!window.epokStore.isPrivilegedAdmin()) {
            alert("Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang dapat mendaftarkan anggota baru!");
            return;
          }
          addForm?.reset();
          addModal.classList.add("show");
          if (window.lucide) lucide.createIcons();
        });
      }

      if (closeAdd && addModal) {
        closeAdd.addEventListener("click", () => addModal.classList.remove("show"));
      }

      // Submit Tambah Anggota
      addForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("newMemberName").value.trim();
        const fullName = document.getElementById("newMemberFullName").value.trim() || name;
        const roleTitle = document.getElementById("newMemberRoleTitle").value.trim();
        const role = document.getElementById("newMemberRole").value;
        const monthlyLimit = Number(document.getElementById("newMemberLimit").value) || 2000000;

        try {
          await window.epokStore.addMember(name, fullName, role, roleTitle, monthlyLimit);
          addModal.classList.remove("show");
          window.soundFx.playCashRegister();
          this.renderFamilyView();
          this.showToast({
            title: "Anggota Terdaftar di PostgreSQL",
            message: `${name} (${roleTitle}) telah resmi tersimpan dalam database.`,
            type: "income"
          });
        } catch (err) {
          alert("Gagal menyimpan anggota baru: " + err.message);
        }
      });

      // Modal Edit Anggota & Jabatan
      const editModal = document.getElementById("editMemberModal");
      const closeEdit = document.getElementById("closeEditMemberModal");
      const editForm = document.getElementById("editMemberForm");

      if (closeEdit && editModal) {
        closeEdit.addEventListener("click", () => editModal.classList.remove("show"));
      }

      editForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("editMemberId").value;
        const name = document.getElementById("editMemberName").value.trim();
        const fullName = document.getElementById("editMemberFullName").value.trim();
        const roleTitle = document.getElementById("editMemberRoleTitle").value.trim();
        const role = document.getElementById("editMemberRole").value;
        const monthlyLimit = Number(document.getElementById("editMemberMonthlyLimit").value) || 0;

        try {
          await window.epokStore.updateMember(id, { name, fullName, roleTitle, role, monthlyLimit });
          editModal.classList.remove("show");
          window.soundFx.playCashRegister();
          this.renderFamilyView();
          this.updateActiveUserBadge();
          this.showToast({
            title: "Perubahan Tersimpan di DB",
            message: `Data ${name} dan jabatan '${roleTitle}' berhasil diperbarui di PostgreSQL.`,
            type: "income"
          });
        } catch (err) {
          alert("Gagal memperbarui anggota: " + err.message);
        }
      });

      // Modal Ubah PIN
      const btnOpenPin = document.getElementById("btnOpenChangePinModal");
      const pinModal = document.getElementById("pinChangeModal");
      const closePin = document.getElementById("closePinChangeModal");
      const pinForm = document.getElementById("pinChangeForm");

      if (btnOpenPin && pinModal) {
        btnOpenPin.addEventListener("click", () => {
          if (!window.epokStore.isPrivilegedAdmin()) {
            alert("Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang berwenang mengubah PIN login!");
            return;
          }
          this.openPinChangeModal();
        });
      }

      if (closePin && pinModal) {
        closePin.addEventListener("click", () => pinModal.classList.remove("show"));
      }

      pinForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const memberId = document.getElementById("pinTargetMemberSelect").value;
        const currentPin = document.getElementById("pinCurrentInput").value.trim();
        const newPin = document.getElementById("pinNewInput").value.trim();
        const confirmPin = document.getElementById("pinConfirmInput").value.trim();

        if (newPin !== confirmPin) {
          alert("Konfirmasi PIN baru tidak cocok! Silakan periksa kembali.");
          return;
        }

        try {
          await window.epokStore.updatePin(memberId, currentPin, newPin);
          pinModal.classList.remove("show");
          window.soundFx.playCashRegister();
          this.renderFamilyView();
          this.showToast({
            title: "PIN Keamanan Berhasil Diperbarui",
            message: "PIN login baru telah aktif dan tersimpan aman di database PostgreSQL.",
            type: "income"
          });
        } catch (err) {
          alert(err.message);
        }
      });
    },

    // --- BUDGET & PAGU VIEW ---
    renderBudgetView() {
      const activeUser = window.epokStore.getActiveUser();
      const totals = window.epokStore.calculateTotals();
      const currentExpenses = window.epokStore.getCategoryExpenseDistribution();
      const categories = window.epokStore.getExpenseCategories();
      const members = window.epokStore.getMembers();

      // 1. Calculate and update KPI Overview
      let totalPlafon = 0;
      categories.forEach(c => {
        totalPlafon += (Number(c.budget) || 0);
      });

      const spentThisMonth = totals.currentMonthExpense;
      const remainingPlafon = Math.max(0, totalPlafon - spentThisMonth);
      const usagePct = totalPlafon > 0 ? Math.round((spentThisMonth / totalPlafon) * 100) : 0;

      const elTotalPlafon = document.getElementById("kpiBudgetTotalPlafon");
      const elSpent = document.getElementById("kpiBudgetSpentThisMonth");
      const elRemaining = document.getElementById("kpiBudgetRemaining");
      const elSpentBadge = document.getElementById("kpiBudgetSpentPctBadge");
      const elStatusText = document.getElementById("kpiBudgetStatusText");
      const elStatusDesc = document.getElementById("kpiBudgetStatusDesc");
      const elStatusIcon = document.getElementById("kpiBudgetStatusIcon");

      if (elTotalPlafon) elTotalPlafon.textContent = window.epokStore.formatCurrency(totalPlafon);
      if (elSpent) elSpent.textContent = window.epokStore.formatCurrency(spentThisMonth);
      if (elRemaining) elRemaining.textContent = window.epokStore.formatCurrency(remainingPlafon);

      if (elSpentBadge) {
        elSpentBadge.textContent = `${usagePct}% Terpakai`;
        if (usagePct > 100) {
          elSpentBadge.className = "trend-badge down";
        } else if (usagePct > 75) {
          elSpentBadge.className = "trend-badge warning";
        } else {
          elSpentBadge.className = "trend-badge up";
        }
      }

      if (elStatusText && elStatusDesc) {
        if (usagePct > 100) {
          elStatusText.textContent = "Melebihi Kuota!";
          elStatusText.style.color = "var(--accent-rose)";
          elStatusDesc.textContent = "Pengeluaran melampaui plafon anggaran yang diset";
          if (elStatusIcon) elStatusIcon.innerHTML = `<i data-lucide="alert-triangle" style="color:var(--accent-rose);"></i>`;
        } else if (usagePct > 75) {
          elStatusText.textContent = "Waspada (>75%)";
          elStatusText.style.color = "var(--accent-amber)";
          elStatusDesc.textContent = "Mendekati batas maksimal pengeluaran bulanan";
          if (elStatusIcon) elStatusIcon.innerHTML = `<i data-lucide="alert-circle" style="color:var(--accent-amber);"></i>`;
        } else {
          elStatusText.textContent = "Aman & Terkendali";
          elStatusText.style.color = "var(--primary-600)";
          elStatusDesc.textContent = "Semua pos belanja masih dalam batas wajar";
          if (elStatusIcon) elStatusIcon.innerHTML = `<i data-lucide="shield-check" style="color:var(--primary-600);"></i>`;
        }
      }

      // 2. Render Category Budget Grid
      const catContainer = document.getElementById("categoryBudgetList");
      if (catContainer) {
        if (categories.length === 0) {
          catContainer.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-muted); grid-column:1/-1;">Belum ada kategori pengeluaran di database.</p>`;
        } else {
          let catHtml = "";
          categories.forEach(cat => {
            const spent = currentExpenses[cat.name] || 0;
            const budget = Number(cat.budget) || 0;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : (spent > 0 ? 100 : 0);
            const clampedPct = Math.min(100, pct);
            const isOver = budget > 0 && spent > budget;
            const remaining = Math.max(0, budget - spent);

            let badgeClass = "safe";
            let fillClass = "";
            if (isOver) {
              badgeClass = "danger";
              fillClass = "danger";
            } else if (pct >= 75) {
              badgeClass = "warning";
              fillClass = "warning";
            }

            catHtml += `
              <div class="category-budget-card">
                <div class="category-budget-top">
                  <div class="category-budget-title-wrap">
                    <div class="category-budget-icon-wrap">
                      <i data-lucide="${cat.icon || 'tag'}"></i>
                    </div>
                    <div>
                      <div class="category-budget-name">${cat.name}</div>
                      <div class="category-budget-limit-sub">Pagu: ${window.epokStore.formatCurrency(budget)}</div>
                    </div>
                  </div>
                  <button type="button" class="btn-card-edit-budget" title="Ubah Pagu ${cat.name}" onclick="window.epokApp.openSetBudgetModal('category', '${cat.id}')">
                    <i data-lucide="pencil" style="width:12px;height:12px;"></i> Ubah Pagu
                  </button>
                </div>

                <div class="category-budget-numbers">
                  <div>
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Realisasi Belanja:</span>
                    <span class="category-spent-val ${isOver ? 'is-over' : ''}">${window.epokStore.formatCurrency(spent)}</span>
                  </div>
                  <span class="category-pct-badge ${badgeClass}">${pct}% ${isOver ? 'OVER!' : 'Terpakai'}</span>
                </div>

                <div class="budget-track">
                  <div class="budget-fill-bar ${fillClass}" style="width: ${clampedPct}%;"></div>
                </div>

                <div class="category-budget-footer">
                  <span>${isOver ? 'Melebihi Batas:' : 'Sisa Kuota:'}</span>
                  <strong style="color: ${isOver ? 'var(--accent-rose)' : 'var(--primary-700)'};">
                    ${isOver ? '+ ' + window.epokStore.formatCurrency(spent - budget) : window.epokStore.formatCurrency(remaining)}
                  </strong>
                </div>
              </div>
            `;
          });
          catContainer.innerHTML = catHtml;
        }
      }

      // 3. Render Member Budget Grid
      const memberContainer = document.getElementById("memberBudgetList");
      if (memberContainer) {
        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const allTx = window.epokStore.getTransactions();

        let memberHtml = "";
        members.forEach(m => {
          const mSpent = allTx
            .filter(t => t.type === "expense" && t.memberId === m.id && t.date && t.date.startsWith(currentMonthKey))
            .reduce((sum, t) => sum + t.amount, 0);

          const limit = Number(m.monthlyLimit) || 0;
          const pct = limit > 0 ? Math.round((mSpent / limit) * 100) : (mSpent > 0 ? 100 : 0);
          const clampedPct = Math.min(100, pct);
          const isOver = limit > 0 && mSpent > limit;
          const remaining = Math.max(0, limit - mSpent);

          let badgeClass = "safe";
          let fillClass = "";
          if (isOver) {
            badgeClass = "danger";
            fillClass = "danger";
          } else if (pct >= 75) {
            badgeClass = "warning";
            fillClass = "warning";
          }

          memberHtml += `
            <div class="member-budget-card">
              <div class="member-budget-top">
                <div class="member-budget-user">
                  <div class="user-avatar ${m.avatarClass || 'avatar-ayah'}" style="width:38px; height:38px; font-size:0.9rem;">
                    ${m.name.charAt(0)}
                  </div>
                  <div>
                    <div class="member-budget-name">${m.name}</div>
                    <div class="member-budget-role">${m.roleTitle || 'Anggota'}</div>
                  </div>
                </div>
                <button type="button" class="btn-card-edit-budget" title="Atur Pagu ${m.name}" onclick="window.epokApp.openSetBudgetModal('member', '${m.id}')">
                  <i data-lucide="sliders" style="width:12px;height:12px;"></i> Atur Limit
                </button>
              </div>

              <div class="category-budget-numbers">
                <div>
                  <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Belanja Bulan Ini:</span>
                  <span class="category-spent-val ${isOver ? 'is-over' : ''}">${window.epokStore.formatCurrency(mSpent)}</span>
                </div>
                <div style="text-align:right;">
                  <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Pagu: ${window.epokStore.formatCurrency(limit)}</span>
                  <span class="category-pct-badge ${badgeClass}">${pct}% Terpakai</span>
                </div>
              </div>

              <div class="budget-track">
                <div class="budget-fill-bar ${fillClass}" style="width: ${clampedPct}%;"></div>
              </div>

              <div class="category-budget-footer">
                <span>${isOver ? 'Melebihi Kuota:' : 'Sisa Plafon Anggota:'}</span>
                <strong style="color: ${isOver ? 'var(--accent-rose)' : 'var(--primary-700)'};">
                  ${isOver ? '+ ' + window.epokStore.formatCurrency(mSpent - limit) : window.epokStore.formatCurrency(remaining)}
                </strong>
              </div>
            </div>
          `;
        });
        memberContainer.innerHTML = memberHtml;
      }

      if (window.lucide) lucide.createIcons();
    },

    // --- MODAL SET BUDGET HANDLERS ---
    openSetBudgetModal(targetType = "category", preselectedId = null) {
      if (!window.epokStore.isPrivilegedAdmin()) {
        alert("Akses Terbatas: Hanya Kepala Keluarga dan Bendahara yang memiliki wewenang untuk mengatur pagu dan anggaran di database!");
        return;
      }

      this.setBudgetTypeModal(targetType, preselectedId);
      const modal = document.getElementById("setBudgetModal");
      if (modal) {
        modal.classList.add("show");
        if (window.lucide) lucide.createIcons();
      }
    },

    setBudgetTypeModal(type, preselectedId = null) {
      const typeInput = document.getElementById("budgetTargetType");
      if (typeInput) typeInput.value = type;

      const btnCat = document.getElementById("btnToggleTypeCategory");
      const btnMem = document.getElementById("btnToggleTypeMember");
      const label = document.getElementById("budgetSubjectLabel");
      const select = document.getElementById("budgetSubjectSelect");

      if (type === "category") {
        if (btnCat) btnCat.classList.add("active");
        if (btnMem) btnMem.classList.remove("active");
        if (label) label.textContent = "Pilih Pos / Kategori Belanja:";

        const categories = window.epokStore.getExpenseCategories();
        let html = "";
        categories.forEach(c => {
          const selected = (preselectedId && c.id === preselectedId) ? "selected" : "";
          html += `<option value="${c.id}" data-current="${c.budget || 0}" ${selected}>${c.name} (Pagu: ${window.epokStore.formatCurrency(c.budget || 0)})</option>`;
        });
        if (select) select.innerHTML = html;
      } else {
        if (btnMem) btnMem.classList.add("active");
        if (btnCat) btnCat.classList.remove("active");
        if (label) label.textContent = "Pilih Anggota Keluarga:";

        const members = window.epokStore.getMembers();
        let html = "";
        members.forEach(m => {
          const selected = (preselectedId && m.id === preselectedId) ? "selected" : "";
          html += `<option value="${m.id}" data-current="${m.monthlyLimit || 0}" ${selected}>${m.name} - ${m.roleTitle || 'Anggota'} (Pagu: ${window.epokStore.formatCurrency(m.monthlyLimit || 0)})</option>`;
        });
        if (select) select.innerHTML = html;
      }

      this.syncCurrentBudgetDisplay();
    },

    syncCurrentBudgetDisplay() {
      const select = document.getElementById("budgetSubjectSelect");
      const currentLabel = document.getElementById("currentBudgetValLabel");
      const inputAmount = document.getElementById("newBudgetAmountInput");

      if (!select || !select.options || select.selectedIndex < 0) return;

      const selectedOpt = select.options[select.selectedIndex];
      const currentVal = Number(selectedOpt.getAttribute("data-current")) || 0;

      if (currentLabel) {
        currentLabel.textContent = window.epokStore.formatCurrency(currentVal);
      }
      if (inputAmount) {
        inputAmount.value = currentVal;
      }
    },

    setBudgetAmountPreset(amount) {
      const input = document.getElementById("newBudgetAmountInput");
      if (input) {
        input.value = amount;
        input.focus();
      }
    },

    bindSetBudgetModal() {
      const select = document.getElementById("budgetSubjectSelect");
      if (select) {
        select.addEventListener("change", () => {
          const selectedOpt = select.options[select.selectedIndex];
          const currentVal = Number(selectedOpt?.getAttribute("data-current")) || 0;
          const currentLabel = document.getElementById("currentBudgetValLabel");
          const inputAmount = document.getElementById("newBudgetAmountInput");
          if (currentLabel) currentLabel.textContent = window.epokStore.formatCurrency(currentVal);
          if (inputAmount) inputAmount.value = currentVal;
        });
      }

      const form = document.getElementById("setBudgetForm");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();

          if (!window.epokStore.isPrivilegedAdmin()) {
            alert("Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang berwenang mengatur pagu di database!");
            return;
          }

          const targetType = document.getElementById("budgetTargetType")?.value || "category";
          const targetId = document.getElementById("budgetSubjectSelect")?.value;
          const newAmount = Number(document.getElementById("newBudgetAmountInput")?.value);

          if (!targetId) {
            alert("Silakan pilih target kategori atau anggota!");
            return;
          }

          if (isNaN(newAmount) || newAmount < 0) {
            alert("Nominal pagu anggaran harus angka positif!");
            return;
          }

          const saveBtn = document.getElementById("btnSaveBudgetSubmit");
          const originalBtnHtml = saveBtn ? saveBtn.innerHTML : "";
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Menyimpan ke DB...`;
            if (window.lucide) lucide.createIcons();
          }

          try {
            if (targetType === "category") {
              await window.epokStore.updateCategoryBudget(targetId, newAmount);
              const cat = window.epokStore.getExpenseCategories().find(c => c.id === targetId);
              const catName = cat ? cat.name : "Kategori";

              window.soundFx.playCashRegister();
              this.showToast({
                title: "Pagu Kategori Tersimpan di DB",
                message: `Pagu pos '${catName}' berhasil diatur menjadi ${window.epokStore.formatCurrency(newAmount)} di PostgreSQL.`,
                type: "income"
              });
            } else {
              await window.epokStore.updateMemberLimit(targetId, newAmount);
              const mem = window.epokStore.getMembers().find(m => m.id === targetId);
              const memName = mem ? mem.name : "Anggota";

              window.soundFx.playCashRegister();
              this.showToast({
                title: "Pagu Anggota Tersimpan di DB",
                message: `Pagu belanja untuk ${memName} berhasil diatur menjadi ${window.epokStore.formatCurrency(newAmount)}/bulan di PostgreSQL.`,
                type: "income"
              });
            }

            document.getElementById("setBudgetModal")?.classList.remove("show");
            this.renderBudgetView();
            this.renderDashboard();
          } catch (err) {
            alert("Gagal menyimpan pagu: " + err.message);
          } finally {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = originalBtnHtml;
              if (window.lucide) lucide.createIcons();
            }
          }
        });
      }
    },

    // --- USER SWITCHING & PROFILE ---
    bindUserSwitching() {
      const activeCard = document.getElementById("sidebarActiveUserCard");
      const switchModal = document.getElementById("userSwitchModal");
      const closeBtn = document.getElementById("closeUserSwitchModal");

      if (activeCard && switchModal) {
        activeCard.addEventListener("click", () => {
          this.renderUserSwitchModalList();
          switchModal.classList.add("show");
          if (window.lucide) lucide.createIcons();
        });
      }

      if (closeBtn && switchModal) {
        closeBtn.addEventListener("click", () => {
          switchModal.classList.remove("show");
        });
      }
    },

    renderUserSwitchModalList() {
      const container = document.getElementById("userSwitchOptionsList");
      if (!container) return;

      const members = window.epokStore.getMembers();
      const activeUser = window.epokStore.getActiveUser();

      let html = "";
      members.forEach(m => {
        const isCurrent = m.id === activeUser.id;
        html += `
          <div class="user-switch-option ${isCurrent ? 'selected' : ''}" onclick="window.epokApp.handleUserSelect('${m.id}')">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="user-avatar ${m.avatarClass || 'avatar-ayah'}" style="width:38px; height:38px;">
                ${m.name.charAt(0)}
              </div>
              <div>
                <div style="font-weight:800; font-size:0.9rem;">${m.name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${m.roleTitle} ${m.hasPin ? '🔒' : ''}</div>
              </div>
            </div>
            ${isCurrent ? '<i data-lucide="check" style="color:var(--primary-600);"></i>' : '<i data-lucide="chevron-right" style="color:var(--text-muted);"></i>'}
          </div>
        `;
      });

      container.innerHTML = html;
    },

    async handleUserSelect(memberId) {
      const member = window.epokStore.getMembers().find(m => m.id === memberId);
      if (!member) return;

      let enteredPin = "";
      if (member.hasPin) {
        enteredPin = prompt(`Masukkan PIN Keamanan untuk ${member.name} (${member.roleTitle}):`);
        if (enteredPin === null) return;
      }

      const res = await window.epokStore.setActiveUser(memberId, enteredPin);
      if (!res.success) {
        alert(res.message);
        return;
      }

      document.getElementById("userSwitchModal")?.classList.remove("show");
      this.updateActiveUserBadge();
      this.renderCurrentView();

      this.showToast({
        title: "Pengguna Berganti",
        message: `Sekarang aktif sebagai: ${res.user.name} (${res.user.roleTitle})`,
        type: "income"
      });
    },

    quickSwitchUser(memberId) {
      this.handleUserSelect(memberId);
    },

    updateActiveUserBadge() {
      const user = window.epokStore.getActiveUser();
      const nameEl = document.getElementById("sidebarUserName");
      const roleEl = document.getElementById("sidebarUserRole");
      const avatarEl = document.getElementById("sidebarUserAvatar");

      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.roleTitle;
      if (avatarEl) {
        avatarEl.className = `user-avatar ${user.avatarClass || 'avatar-ayah'}`;
        avatarEl.innerHTML = `${user.name.charAt(0)}<span class="user-status-dot"></span>`;
      }
    },

    // --- TRANSACTION MODAL (ADD / EDIT) ---
    bindTransactionModal() {
      const openBtn = document.getElementById("btnOpenAddTxModal");
      const modal = document.getElementById("transactionModal");
      const closeBtn = document.getElementById("closeTxModal");
      const form = document.getElementById("transactionForm");

      if (openBtn && modal) {
        openBtn.addEventListener("click", () => {
          this.resetTransactionForm();
          modal.classList.add("show");
          if (window.lucide) lucide.createIcons();
        });
      }

      if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
          modal.classList.remove("show");
          this.resetTransactionForm();
        });
      }

      // Tombol Force Submit & Batal dari Banner Peringatan Duplikat
      const forceSubmitBtn = document.getElementById("btnForceSubmitTx");
      if (forceSubmitBtn) {
        forceSubmitBtn.addEventListener("click", () => {
          this.submitTransactionForm(true);
        });
      }

      const cancelDupBtn = document.getElementById("btnCancelDuplicateTx");
      if (cancelDupBtn) {
        cancelDupBtn.addEventListener("click", () => {
          const warnBox = document.getElementById("txDuplicateWarningBox");
          if (warnBox) warnBox.style.display = "none";
        });
      }

      const toggleExpense = document.getElementById("txTypeToggleExpense");
      const toggleIncome = document.getElementById("txTypeToggleIncome");
      const typeInput = document.getElementById("txTypeInput");

      const setType = (type) => {
        if (typeInput) typeInput.value = type;
        if (type === "expense") {
          toggleExpense?.classList.add("active", "expense");
          toggleIncome?.classList.remove("active", "income");
        } else {
          toggleIncome?.classList.add("active", "income");
          toggleExpense?.classList.remove("active", "expense");
        }
        this.populateCategoryOptions(type);
      };

      toggleExpense?.addEventListener("click", () => setType("expense"));
      toggleIncome?.addEventListener("click", () => setType("income"));

      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitTransactionForm(false);
      });
    },

    resetTransactionForm() {
      const form = document.getElementById("transactionForm");
      if (form) form.reset();

      const dateInput = document.getElementById("txDateInput");
      if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

      const memberSelect = document.getElementById("txMemberSelect");
      if (memberSelect) {
        const activeUser = window.epokStore.getActiveUser();
        let html = "";
        window.epokStore.getMembers().forEach(m => {
          const isSelected = m.id === activeUser.id ? "selected" : "";
          html += `<option value="${m.id}" ${isSelected}>${m.name} (${m.roleTitle})</option>`;
        });
        memberSelect.innerHTML = html;
      }

      const toggleExpense = document.getElementById("txTypeToggleExpense");
      const toggleIncome = document.getElementById("txTypeToggleIncome");
      const typeInput = document.getElementById("txTypeInput");
      if (typeInput) typeInput.value = "expense";
      toggleExpense?.classList.add("active", "expense");
      toggleIncome?.classList.remove("active", "income");

      this.populateCategoryOptions("expense");

      // Reset Anti-Double Input Warning & Button State
      const warnBox = document.getElementById("txDuplicateWarningBox");
      if (warnBox) warnBox.style.display = "none";

      this.isSubmittingTx = false;
      const submitBtn = document.getElementById("btnSubmitTx");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="check"></i> <span id="btnSubmitTxText">Simpan Transaksi</span>`;
      }
      if (window.lucide) lucide.createIcons();
    },

    populateCategoryOptions(type) {
      const catSelect = document.getElementById("txCategorySelect");
      if (!catSelect) return;

      const categories = type === "income" ? INITIAL_CATEGORIES.income : INITIAL_CATEGORIES.expense;
      let html = "";
      categories.forEach(c => {
        html += `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`;
      });
      catSelect.innerHTML = html;
    },

    async submitTransactionForm(forceAllowDuplicate = false) {
      // 1. Double-click & concurrent submission lock
      if (this.isSubmittingTx) return;

      const type = document.getElementById("txTypeInput")?.value || "expense";
      const amount = Number(document.getElementById("txAmountInput")?.value);
      const description = document.getElementById("txDescInput")?.value?.trim();
      const date = document.getElementById("txDateInput")?.value;
      const catSelect = document.getElementById("txCategorySelect");
      const category = catSelect?.value;
      const categoryName = catSelect?.options[catSelect.selectedIndex]?.getAttribute("data-name") || category;
      const memberSelect = document.getElementById("txMemberSelect");
      const memberId = memberSelect?.value;
      const member = window.epokStore.getMembers().find(m => m.id === memberId);
      const paymentMethod = document.getElementById("txPaymentSelect")?.value;

      if (!amount || amount <= 0) {
        alert("Mohon masukkan nominal transaksi yang valid!");
        return;
      }

      if (!description) {
        alert("Mohon masukkan keterangan atau nama transaksi!");
        return;
      }

      // 2. Client-side Heuristic Duplicate Check
      if (!forceAllowDuplicate) {
        const existingTxs = window.epokStore.getTransactions();
        const isDuplicate = existingTxs.some(t => 
          Number(t.amount) === amount &&
          t.type === type &&
          t.date === date &&
          (t.description || "").trim().toLowerCase() === description.toLowerCase() &&
          t.memberId === memberId
        );

        if (isDuplicate) {
          const warnBox = document.getElementById("txDuplicateWarningBox");
          const warnMsg = document.getElementById("txDuplicateWarningMsg");
          if (warnBox && warnMsg) {
            const formattedAmt = window.epokStore.formatCurrency(amount);
            warnMsg.innerHTML = `Peringatan: Transaksi serupa senilai <strong>${formattedAmt}</strong> ("<em>${description}</em>") oleh <strong>${member ? member.name : 'anggota'}</strong> pada tanggal <strong>${date}</strong> sudah pernah dicatat. Jika ini bukan klik ganda, Anda dapat memilih "Tetap Simpan Transaksi Ini".`;
            warnBox.style.display = "block";
            if (window.lucide) lucide.createIcons();
            return;
          }
        }
      }

      // 3. Lock Button & Show Loading State
      this.isSubmittingTx = true;
      const submitBtn = document.getElementById("btnSubmitTx");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> <span id="btnSubmitTxText">Menyimpan ke Database...</span>`;
        if (window.lucide) lucide.createIcons();
      }

      try {
        await window.epokStore.addTransaction({
          type,
          amount,
          description,
          date,
          category,
          categoryName,
          memberId,
          memberName: member ? member.name : "Keluarga",
          paymentMethod,
          allowDuplicate: forceAllowDuplicate
        });

        if (type === "income") {
          window.soundFx.playCashRegister();
        } else {
          window.soundFx.playExpenseTone();
        }

        const warnBox = document.getElementById("txDuplicateWarningBox");
        if (warnBox) warnBox.style.display = "none";

        document.getElementById("transactionModal")?.classList.remove("show");
        this.renderCurrentView();
      } catch (err) {
        if (err.isDuplicate) {
          this.showToast({
            title: "Pencegahan Double Input",
            message: "Transaksi identik baru saja dicatat beberapa saat lalu. Sistem mencegah duplikasi saldo.",
            type: "alert"
          });
          const warnBox = document.getElementById("txDuplicateWarningBox");
          const warnMsg = document.getElementById("txDuplicateWarningMsg");
          if (warnBox && warnMsg) {
            warnMsg.innerHTML = `Pencegahan Server: Transaksi serupa baru saja disimpan dalam kurun waktu 30 detik. Jika Anda sengaja mencatat transaksi kembar, klik tombol <strong>"Tetap Simpan Transaksi Ini"</strong> di bawah.`;
            warnBox.style.display = "block";
            if (window.lucide) lucide.createIcons();
          }
        } else {
          alert("Gagal mencatat transaksi ke database: " + err.message);
        }
      } finally {
        this.isSubmittingTx = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="check"></i> <span id="btnSubmitTxText">Simpan Transaksi</span>`;
          if (window.lucide) lucide.createIcons();
        }
      }
    },

    // --- NOTIFICATION EVENTS & PANEL ---
    bindNotificationEvents() {
      window.addEventListener("epokkita-notification", (e) => {
        const notif = e.detail;
        this.showToast(notif);
        this.updateNotificationBadge();
        this.renderNotificationPanelList();
      });
    },

    showToast({ title, message, type = "income" }) {
      const container = document.getElementById("liveToastContainer");
      if (!container) return;

      const toast = document.createElement("div");
      toast.className = `toast-alert ${type}`;

      const iconMap = {
        income: "arrow-down-left",
        expense: "arrow-up-right",
        alert: "alert-circle"
      };

      const iconBgMap = {
        income: "rgba(16, 185, 129, 0.15)",
        expense: "rgba(244, 63, 94, 0.15)",
        alert: "rgba(245, 158, 11, 0.15)"
      };

      const iconColorMap = {
        income: "var(--primary-600)",
        expense: "var(--accent-rose)",
        alert: "var(--accent-amber)"
      };

      toast.innerHTML = `
        <div class="toast-icon" style="background-color: ${iconBgMap[type] || '#eee'}; color: ${iconColorMap[type] || '#333'};">
          <i data-lucide="${iconMap[type] || 'bell'}"></i>
        </div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">
          <i data-lucide="x"></i>
        </button>
      `;

      container.appendChild(toast);
      if (window.lucide) lucide.createIcons();

      setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 350);
      }, 5000);
    },

    bindNotificationPanel() {
      const notifBtn = document.getElementById("notificationBtn");
      const notifPanel = document.getElementById("notificationPanel");
      const clearBtn = document.getElementById("clearNotifsBtn");

      if (notifBtn && notifPanel) {
        notifBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          notifPanel.classList.toggle("show");
          if (notifPanel.classList.contains("show")) {
            window.epokStore.markAllNotificationsRead();
            this.updateNotificationBadge();
            this.renderNotificationPanelList();
          }
        });

        document.addEventListener("click", (e) => {
          if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
            notifPanel.classList.remove("show");
          }
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
          await window.epokStore.clearNotifications();
          this.renderNotificationPanelList();
          this.updateNotificationBadge();
        });
      }
    },

    updateNotificationBadge() {
      const notifs = window.epokStore.getNotifications();
      const unreadCount = notifs.filter(n => !n.read).length;
      const badge = document.getElementById("notifBadgeCount");
      if (badge) {
        if (unreadCount > 0) {
          badge.style.display = "block";
          badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
        } else {
          badge.style.display = "none";
        }
      }
    },

    renderNotificationPanelList() {
      const container = document.getElementById("notificationListContainer");
      if (!container) return;

      const notifs = window.epokStore.getNotifications();
      if (notifs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Tidak ada notifikasi baru di database.</p>`;
        return;
      }

      let html = "";
      notifs.forEach(n => {
        const iconName = n.type === "income" ? "arrow-down-left" : (n.type === "expense" ? "arrow-up-right" : "bell");
        html += `
          <div class="notif-item">
            <div class="notif-item-icon ${n.type}">
              <i data-lucide="${iconName}"></i>
            </div>
            <div class="notif-item-content">
              <div class="notif-item-title">${n.title}</div>
              <div class="notif-item-desc">${n.message}</div>
              <div class="notif-item-time">${window.epokStore.formatDate(n.createdAt)}</div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    }
  };

  window.epokApp = app;
  app.init();
});
