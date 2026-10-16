/**
 * EPOKKITA - State Management & PostgreSQL API Integration
 * Terhubung langsung ke REST API PostgreSQL di backend dengan fallback offline
 */

const STORAGE_KEYS = {
  ACTIVE_USER: "epokkita_active_user_v1",
  THEME: "epokkita_theme_v1",
  AUTH_TOKEN: "epokkita_auth_token_v1",
  MEMBERS_CACHE: "epokkita_members_cache",
  TX_CACHE: "epokkita_tx_cache",
  NOTIF_CACHE: "epokkita_notif_cache"
};

class Store {
  constructor() {
    this.members = [];
    this.transactions = [];
    this.notifications = [];
    this.categories = [];
    this.isOnline = true;
    this.dbStatus = { connected: false, database: "epokkita_db" };
  }

  // --- TOKEN & AUTHENTICATION MANAGEMENT ---
  getAuthToken() {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || 
           sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || 
           null;
  }

  setAuthToken(token, remember = true) {
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }

  clearAuthToken() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
  }

  isAuthenticated() {
    return !!this.getAuthToken();
  }

  async authFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        console.warn("Sesi telah habis atau belum login, mengarahkan ke Layar Kunci Keluarga...");
        this.clearAuthToken();
        window.dispatchEvent(new CustomEvent("epokkita-auth-required"));
      }
      return res;
    } catch (err) {
      console.warn("authFetch network error:", err);
      throw err;
    }
  }

  // Ambil daftar profil publik untuk tampilan Layar Kunci Login
  async fetchAuthProfiles() {
    try {
      const res = await fetch("/api/auth/profiles");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Gagal mengambil profil login publik", e);
    }
    return [];
  }

  // Login dengan PIN anggota keluarga
  async login(memberId, pin, remember = true) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, pin })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "PIN yang Anda masukkan salah!");
    }

    this.setAuthToken(data.token, remember);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(data.user));

    // Sinkronkan seluruh data aplikasi setelah otentikasi berhasil
    await this.initAsync();
    window.dispatchEvent(new CustomEvent("epokkita-auth-success", { detail: data.user }));
    return data;
  }

  // Logout / Kunci Dashboard
  async logout() {
    try {
      await this.authFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout request failed", e);
    }
    this.clearAuthToken();
    window.dispatchEvent(new CustomEvent("epokkita-auth-required"));
  }

  // Inisialisasi awal sinkronisasi data dari PostgreSQL
  async initAsync() {
    try {
      // 1. Cek status koneksi DB publik
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        this.dbStatus = await statusRes.json();
        this.isOnline = true;
      }
    } catch (e) {
      console.warn("API status check failed, using cache fallback", e);
      this.isOnline = false;
    }

    // 2. Proteksi Keamanan: Jika belum login, munculkan Layar Kunci Keluarga
    if (!this.isAuthenticated()) {
      window.dispatchEvent(new CustomEvent("epokkita-auth-required"));
      return;
    }

    try {
      // Verifikasi token aktif ke server
      const verifyRes = await this.authFetch("/api/auth/verify");
      if (!verifyRes || !verifyRes.ok) {
        this.clearAuthToken();
        window.dispatchEvent(new CustomEvent("epokkita-auth-required"));
        return;
      }
    } catch {
      // Jika offline, izinkan fallback cache
    }

    // 3. Fetch data parallel dari PostgreSQL dengan token otentikasi
    await Promise.all([
      this.fetchMembers(),
      this.fetchTransactions(),
      this.fetchNotifications(),
      this.fetchCategories()
    ]);

    // 4. Pastikan active user terset
    const savedActiveUser = this.getActiveUser();
    if (!savedActiveUser || !this.members.some(m => m.id === savedActiveUser.id)) {
      if (this.members.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(this.members[0]));
      }
    }

    window.dispatchEvent(new CustomEvent("epokkita-data-ready"));
  }

  // --- MEMBER & AUTH ---
  async fetchMembers() {
    try {
      const res = await this.authFetch("/api/members");
      if (res.ok) {
        this.members = await res.json();
        localStorage.setItem(STORAGE_KEYS.MEMBERS_CACHE, JSON.stringify(this.members));
        return this.members;
      }
    } catch (e) {
      console.warn("Failed to fetch members from PostgreSQL, using cache", e);
    }
    // Fallback cache
    try {
      this.members = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS_CACHE)) || INITIAL_MEMBERS;
    } catch {
      this.members = INITIAL_MEMBERS;
    }
    return this.members;
  }

  getMembers() {
    return this.members.length ? this.members : INITIAL_MEMBERS;
  }

  getActiveUser() {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_USER));
      if (cached && this.members.length) {
        const found = this.members.find(m => m.id === cached.id);
        if (found) return found;
      }
      return cached || (this.members.length ? this.members[0] : INITIAL_MEMBERS[0]);
    } catch {
      return this.members.length ? this.members[0] : INITIAL_MEMBERS[0];
    }
  }

  // Cek apakah user aktif adalah Kepala Keluarga (admin) ATAU Bendahara (co-admin)
  isPrivilegedAdmin() {
    const user = this.getActiveUser();
    return user && (user.role === "admin" || user.role === "co-admin");
  }

  async setActiveUser(memberId, enteredPin = "") {
    const target = this.members.find(m => m.id === memberId);
    if (!target) return { success: false, message: "Anggota tidak ditemukan" };

    // Validasi PIN jika user memiliki PIN (Kepala Keluarga atau Bendahara)
    if (target.hasPin && target.pin) {
      if (enteredPin !== target.pin) {
        return { success: false, message: "PIN yang Anda masukkan salah!" };
      }
    }

    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(target));
    return { success: true, user: target };
  }

  // Tambah anggota baru ke PostgreSQL
  async addMember(name, fullName, role = "member", roleTitle = "", monthlyLimit = 2000000, pin = null, avatarClass = "") {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fullName: fullName || name,
          role,
          roleTitle,
          monthlyLimit,
          pin,
          avatarClass,
          requesterId: active.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menambah anggota");
      }

      await this.fetchMembers();
      await this.fetchNotifications();
      return data;
    } catch (err) {
      console.error("addMember error:", err);
      throw err;
    }
  }

  // Edit profil anggota (nama, jabatan anak, limit) di PostgreSQL
  async updateMember(memberId, updateData) {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch(`/api/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateData,
          requesterId: active.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui anggota di database");
      }

      await this.fetchMembers();
      await this.fetchNotifications();

      // Update active user jika yang diubah adalah user yang sedang aktif
      if (active.id === memberId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(data.member));
      }

      return data;
    } catch (err) {
      console.error("updateMember error:", err);
      throw err;
    }
  }

  // Ubah PIN login Kepala Keluarga / Bendahara di PostgreSQL
  async updatePin(memberId, currentPin, newPin) {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch(`/api/members/${memberId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin,
          newPin,
          requesterId: active.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui PIN di database");
      }

      await this.fetchMembers();
      await this.fetchNotifications();
      return data;
    } catch (err) {
      console.error("updatePin error:", err);
      throw err;
    }
  }

  // Hapus anggota keluarga dari PostgreSQL
  async deleteMember(memberId) {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch(`/api/members/${memberId}?requesterId=${active.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menghapus anggota dari database");
      }

      await this.fetchMembers();
      await this.fetchNotifications();

      // Jika yang dihapus adalah active user, switch ke akun pertama (Kepala Keluarga)
      if (active.id === memberId) {
        const remaining = this.getMembers();
        if (remaining.length) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(remaining[0]));
        }
      }

      return data;
    } catch (err) {
      console.error("deleteMember error:", err);
      throw err;
    }
  }

  // --- TRANSACTIONS ---
  async fetchTransactions() {
    try {
      const res = await this.authFetch("/api/transactions");
      if (res.ok) {
        this.transactions = await res.json();
        localStorage.setItem(STORAGE_KEYS.TX_CACHE, JSON.stringify(this.transactions));
        return this.transactions;
      }
    } catch (e) {
      console.warn("Failed to fetch transactions from PostgreSQL, using cache", e);
    }
    // Fallback cache
    try {
      this.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TX_CACHE)) || [];
    } catch {
      this.transactions = [];
    }
    return this.transactions;
  }

  getTransactions() {
    return this.transactions;
  }

  // Simpan transaksi baru ke database PostgreSQL
  async addTransaction(txData) {
    const activeUser = this.getActiveUser();
    const payload = {
      date: txData.date || new Date().toISOString().slice(0, 10),
      type: txData.type,
      category: txData.category,
      categoryName: txData.categoryName || txData.category,
      amount: Math.abs(Number(txData.amount)),
      description: txData.description || "Transaksi Baru",
      memberId: txData.memberId || activeUser.id,
      memberName: txData.memberName || activeUser.name,
      paymentMethod: txData.paymentMethod || "Transfer",
      allowDuplicate: !!txData.allowDuplicate
    };

    try {
      const res = await this.authFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const error = new Error(data.message || "Gagal menyimpan transaksi ke PostgreSQL");
        error.isDuplicate = !!data.isDuplicate || res.status === 409;
        error.status = res.status;
        throw error;
      }

      // Re-fetch dari database agar state selalu konsisten
      await this.fetchTransactions();
      await this.fetchNotifications();

      // Dispatch event notifikasi
      window.dispatchEvent(new CustomEvent("epokkita-notification", {
        detail: {
          title: payload.type === "income" ? "Pemasukan Baru Ditambahkan" : "Pengeluaran Baru Dicatat",
          message: `${payload.memberName} mencatat ${payload.description} (${this.formatCurrency(payload.amount)})`,
          type: payload.type
        }
      }));

      // Cek alert batas bulanan
      if (payload.type === "expense") {
        this.checkMemberLimitAlert(payload.memberId, payload.memberName);
      }

      return data.transaction;
    } catch (err) {
      console.error("addTransaction error:", err);
      throw err;
    }
  }

  // Hapus transaksi dari PostgreSQL
  async deleteTransaction(txId) {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch(`/api/transactions/${txId}?requesterId=${active.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menghapus transaksi");
      }

      await this.fetchTransactions();
      return data;
    } catch (err) {
      console.error("deleteTransaction error:", err);
      throw err;
    }
  }

  // Hapus seluruh data transaksi (Fitur khusus Kepala Keluarga)
  async deleteAllTransactions() {
    const active = this.getActiveUser();
    try {
      const res = await this.authFetch(`/api/transactions/all?requesterId=${active.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menghapus seluruh transaksi");
      }

      await this.fetchTransactions();
      await this.fetchNotifications();
      return data;
    } catch (err) {
      console.error("deleteAllTransactions error:", err);
      throw err;
    }
  }

  checkMemberLimitAlert(memberId, memberName) {
    const member = this.getMembers().find(m => m.id === memberId);
    if (!member || !member.monthlyLimit) return;

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const memberExpenses = this.getTransactions()
      .filter(t => t.type === "expense" && t.memberId === memberId && t.date.startsWith(currentMonthKey))
      .reduce((sum, t) => sum + t.amount, 0);

    if (memberExpenses > member.monthlyLimit) {
      window.dispatchEvent(new CustomEvent("epokkita-notification", {
        detail: {
          title: `⚠️ Peringatan Kuota: ${memberName}`,
          message: `Total belanja bulan ini (${this.formatCurrency(memberExpenses)}) telah melebihi pagu bulanan (${this.formatCurrency(member.monthlyLimit)})!`,
          type: "alert"
        }
      }));
    }
  }

  // --- NOTIFICATIONS ---
  async fetchNotifications() {
    try {
      const res = await this.authFetch("/api/notifications");
      if (res.ok) {
        this.notifications = await res.json();
        localStorage.setItem(STORAGE_KEYS.NOTIF_CACHE, JSON.stringify(this.notifications));
        return this.notifications;
      }
    } catch (e) {
      console.warn("Failed to fetch notifications from DB", e);
    }
    try {
      this.notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIF_CACHE)) || [];
    } catch {
      this.notifications = [];
    }
    return this.notifications;
  }

  getNotifications() {
    return this.notifications;
  }

  async markAllNotificationsRead() {
    try {
      await this.authFetch("/api/notifications/read", { method: "PUT" });
      this.notifications = this.notifications.map(n => ({ ...n, read: true }));
      localStorage.setItem(STORAGE_KEYS.NOTIF_CACHE, JSON.stringify(this.notifications));
    } catch (e) {
      console.warn("Failed to mark notifications read", e);
    }
  }

  async clearNotifications() {
    try {
      await this.authFetch("/api/notifications", { method: "DELETE" });
      this.notifications = [];
      localStorage.setItem(STORAGE_KEYS.NOTIF_CACHE, JSON.stringify([]));
    } catch (e) {
      console.warn("Failed to clear notifications", e);
    }
  }

  // --- CATEGORIES & BUDGET ---
  async fetchCategories() {
    try {
      const res = await this.authFetch("/api/categories");
      if (res.ok) {
        this.categories = await res.json();
        return this.categories;
      }
    } catch (e) {
      console.warn("Failed to fetch categories from DB", e);
    }
    return [];
  }

  getCategories() {
    if (this.categories && this.categories.length > 0) {
      return this.categories;
    }
    return [...INITIAL_CATEGORIES.income, ...INITIAL_CATEGORIES.expense];
  }

  getExpenseCategories() {
    if (this.categories && this.categories.length > 0) {
      const expenses = this.categories.filter(c => c.type === "expense");
      if (expenses.length > 0) return expenses;
    }
    return INITIAL_CATEGORIES.expense;
  }

  async updateCategoryBudget(categoryId, newBudget) {
    const activeUser = this.getActiveUser();
    const res = await this.authFetch(`/api/categories/${categoryId}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget: Number(newBudget),
        requesterId: activeUser.id
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Gagal memperbarui pagu anggaran kategori");
    }

    await this.fetchCategories();
    await this.fetchNotifications();
    return data;
  }

  async updateMemberLimit(memberId, newLimit) {
    const activeUser = this.getActiveUser();
    const res = await this.authFetch(`/api/members/${memberId}/limit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyLimit: Number(newLimit),
        requesterId: activeUser.id
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Gagal memperbarui pagu batas belanja anggota");
    }

    await this.fetchMembers();
    await this.fetchNotifications();
    return data;
  }

  // --- FINANCIAL CALCULATIONS & AGGREGATIONS ---
  calculateTotals() {
    const txs = this.getTransactions();
    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(t => {
      if (t.type === "income") totalIncome += t.amount;
      if (t.type === "expense") totalExpense += t.amount;
    });

    const netBalance = totalIncome - totalExpense;

    const now = new Date();
    const latestDate = txs.length ? txs[0].date : now.toISOString().slice(0, 10);
    const activeMonthPrefix = latestDate.slice(0, 7);

    let currentMonthIncome = 0;
    let currentMonthExpense = 0;

    const [y, m] = activeMonthPrefix.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    let prevMonthIncome = 0;
    let prevMonthExpense = 0;

    txs.forEach(t => {
      if (t.date.startsWith(activeMonthPrefix)) {
        if (t.type === "income") currentMonthIncome += t.amount;
        if (t.type === "expense") currentMonthExpense += t.amount;
      } else if (t.date.startsWith(prevMonthPrefix)) {
        if (t.type === "income") prevMonthIncome += t.amount;
        if (t.type === "expense") prevMonthExpense += t.amount;
      }
    });

    let expenseTrendPct = 0;
    if (prevMonthExpense > 0) {
      expenseTrendPct = ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100;
    }

    let incomeTrendPct = 0;
    if (prevMonthIncome > 0) {
      incomeTrendPct = ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100;
    }

    // Dynamic category budget sum from PostgreSQL database
    const expenseCategories = this.getExpenseCategories();
    const totalCategoryBudget = expenseCategories.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
    const budgetLeft = Math.max(0, totalCategoryBudget - currentMonthExpense);
    const budgetUsedPct = totalCategoryBudget > 0 ? Math.min(100, Math.round((currentMonthExpense / totalCategoryBudget) * 100)) : 0;

    return {
      netBalance,
      totalIncome,
      totalExpense,
      currentMonthIncome,
      currentMonthExpense,
      prevMonthExpense,
      prevMonthIncome,
      expenseTrendPct,
      incomeTrendPct,
      activeMonthPrefix,
      totalCategoryBudget,
      budgetLeft,
      budgetUsedPct
    };
  }

  getMonthlyComparisonData() {
    const txs = this.getTransactions();
    const monthMap = {};

    txs.forEach(t => {
      const monthKey = t.date.slice(0, 7);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { income: 0, expense: 0, count: 0 };
      }
      if (t.type === "income") monthMap[monthKey].income += t.amount;
      if (t.type === "expense") monthMap[monthKey].expense += t.amount;
      monthMap[monthKey].count += 1;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    sortedMonths.forEach(mKey => {
      const [year, month] = mKey.split("-");
      labels.push(`${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`);
      incomeData.push(monthMap[mKey].income);
      expenseData.push(monthMap[mKey].expense);
    });

    return {
      keys: sortedMonths,
      labels,
      incomeData,
      expenseData,
      rawMap: monthMap
    };
  }

  getCategoryExpenseDistribution(monthPrefix = null) {
    const txs = this.getTransactions();
    const targetMonth = monthPrefix || this.calculateTotals().activeMonthPrefix;
    const catMap = {};

    txs.filter(t => t.type === "expense" && (!targetMonth || t.date.startsWith(targetMonth))).forEach(t => {
      const cat = t.categoryName || "Lainnya";
      catMap[cat] = (catMap[cat] || 0) + t.amount;
    });

    return catMap;
  }

  getMemberSpendingBreakdown(monthPrefix = null) {
    const txs = this.getTransactions();
    const targetMonth = monthPrefix || this.calculateTotals().activeMonthPrefix;
    const memberMap = {};

    this.getMembers().forEach(m => {
      memberMap[m.id] = {
        member: m,
        totalExpense: 0,
        totalIncome: 0,
        count: 0
      };
    });

    txs.filter(t => !targetMonth || t.date.startsWith(targetMonth)).forEach(t => {
      if (!memberMap[t.memberId]) {
        memberMap[t.memberId] = {
          member: { name: t.memberName, id: t.memberId, role: "member", color: "#64748b" },
          totalExpense: 0,
          totalIncome: 0,
          count: 0
        };
      }
      if (t.type === "expense") memberMap[t.memberId].totalExpense += t.amount;
      if (t.type === "income") memberMap[t.memberId].totalIncome += t.amount;
      memberMap[t.memberId].count += 1;
    });

    return Object.values(memberMap);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }
}

window.epokStore = new Store();
