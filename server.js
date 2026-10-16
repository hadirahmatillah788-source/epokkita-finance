/**
 * EPOKKITA - Backend Server & PostgreSQL REST API
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { pool, initDatabase } = require("./db/db");
require("dotenv").config();

const PORT = process.env.PORT || 3030;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Helper untuk membaca request body JSON
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// Helper send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

// Format database member row to camelCase for frontend
function formatMemberRow(r) {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name || r.name,
    role: r.role,
    roleTitle: r.role_title,
    avatarClass: r.avatar_class,
    color: r.color,
    monthlyLimit: parseFloat(r.monthly_limit || 0),
    hasPin: !!r.pin,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

// Format database transaction row
function formatTxRow(r) {
  return {
    id: r.id,
    date: typeof r.date === "string" ? r.date : r.date.toISOString().slice(0, 10),
    type: r.type,
    category: r.category,
    categoryName: r.category_name,
    amount: parseFloat(r.amount),
    description: r.description,
    memberId: r.member_id,
    memberName: r.member_name,
    paymentMethod: r.payment_method,
    createdAt: r.created_at
  };
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------

    // 1. GET /api/status - Status Database PostgreSQL
    if (pathname === "/api/status" && method === "GET") {
      const client = await pool.connect();
      try {
        const memberCount = await client.query("SELECT COUNT(*) FROM family_members");
        const txCount = await client.query("SELECT COUNT(*) FROM transactions");
        return sendJSON(res, 200, {
          status: "connected",
          database: process.env.PGDATABASE || "epokkita_db",
          host: process.env.PGHOST || "localhost",
          tables: {
            members: parseInt(memberCount.rows[0].count, 10),
            transactions: parseInt(txCount.rows[0].count, 10)
          }
        });
      } finally {
        client.release();
      }
    }

    // 2. GET /api/members - Ambil semua anggota keluarga
    if (pathname === "/api/members" && method === "GET") {
      const result = await pool.query("SELECT * FROM family_members ORDER BY created_at ASC");
      return sendJSON(res, 200, result.rows.map(formatMemberRow));
    }

    // 3. POST /api/members - Tambah anggota keluarga baru
    if (pathname === "/api/members" && method === "POST") {
      const body = await getRequestBody(req);
      const { name, fullName, role = "member", roleTitle, monthlyLimit = 2000000, pin = null, requesterId } = body;

      // Check authority: Kepala Keluarga (admin) OR Bendahara (co-admin)
      const requester = await pool.query("SELECT role FROM family_members WHERE id = $1", [requesterId]);
      if (requester.rows.length === 0 || !["admin", "co-admin"].includes(requester.rows[0].role)) {
        return sendJSON(res, 403, { success: false, message: "Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang berwenang menambah anggota." });
      }

      const id = "mem_" + Date.now();
      const avatars = ["avatar-ayah", "avatar-ibu", "avatar-anak1", "avatar-anak2"];
      const currentCount = await pool.query("SELECT COUNT(*) FROM family_members");
      const avatarClass = avatars[parseInt(currentCount.rows[0].count, 10) % avatars.length];

      let defaultTitle = roleTitle;
      if (!defaultTitle) {
        if (role === "admin") defaultTitle = "Kepala Keluarga";
        else if (role === "co-admin") defaultTitle = "Bendahara Keluarga";
        else defaultTitle = "Anggota Keluarga";
      }

      const insertRes = await pool.query(
        `INSERT INTO family_members (id, name, full_name, role, role_title, avatar_class, color, monthly_limit, pin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [id, name, fullName || name, role, defaultTitle, avatarClass, "#059669", monthlyLimit, pin || null]
      );

      // Notifikasi otomatis ke database
      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), "Anggota Baru Ditambahkan", `${name} (${defaultTitle}) telah didaftarkan ke sistem oleh ${requester.rows[0].role === 'admin' ? 'Kepala Keluarga' : 'Bendahara'}.`, "info"]
      );

      return sendJSON(res, 201, { success: true, member: formatMemberRow(insertRes.rows[0]) });
    }

    // 4. PUT /api/members/:id - Edit nama, jabatan/peran, pagu anggaran anggota
    if (pathname.startsWith("/api/members/") && !pathname.endsWith("/pin") && !pathname.endsWith("/limit") && method === "PUT") {
      const memberId = pathname.replace("/api/members/", "");
      const body = await getRequestBody(req);
      const { name, fullName, role, roleTitle, monthlyLimit, requesterId } = body;

      // Check authority: Kepala Keluarga OR Bendahara
      const requester = await pool.query("SELECT role, name FROM family_members WHERE id = $1", [requesterId]);
      if (requester.rows.length === 0 || !["admin", "co-admin"].includes(requester.rows[0].role)) {
        return sendJSON(res, 403, { success: false, message: "Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang berwenang mengedit anggota." });
      }

      const existing = await pool.query("SELECT * FROM family_members WHERE id = $1", [memberId]);
      if (existing.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Anggota keluarga tidak ditemukan." });
      }

      const updated = await pool.query(
        `UPDATE family_members
         SET name = COALESCE($1, name),
             full_name = COALESCE($2, full_name),
             role = COALESCE($3, role),
             role_title = COALESCE($4, role_title),
             monthly_limit = COALESCE($5, monthly_limit),
             updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [name, fullName, role, roleTitle, monthlyLimit, memberId]
      );

      // Catat notifikasi perubahan ke database
      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), "Profil Anggota Diperbarui", `Data anggota ${updated.rows[0].name} (Jabatan: ${updated.rows[0].role_title}) diperbarui di database.`, "info"]
      );

      return sendJSON(res, 200, { success: true, member: formatMemberRow(updated.rows[0]) });
    }

    // 4b. PUT /api/members/:id/limit - Atur Pagu Batas Belanja Anggota Keluarga
    if (pathname.startsWith("/api/members/") && pathname.endsWith("/limit") && method === "PUT") {
      const memberId = pathname.replace("/api/members/", "").replace("/limit", "");
      const body = await getRequestBody(req);
      const { monthlyLimit, requesterId } = body;

      if (monthlyLimit === undefined || isNaN(monthlyLimit) || Number(monthlyLimit) < 0) {
        return sendJSON(res, 400, { success: false, message: "Nominal pagu batas belanja tidak valid." });
      }

      // Validasi kewenangan: Kepala Keluarga (admin) atau Bendahara (co-admin)
      if (requesterId) {
        const reqCheck = await pool.query("SELECT role, name FROM family_members WHERE id = $1", [requesterId]);
        if (reqCheck.rows.length === 0 || !["admin", "co-admin"].includes(reqCheck.rows[0].role)) {
          return sendJSON(res, 403, {
            success: false,
            message: "Hanya Kepala Keluarga dan Bendahara yang berwenang mengatur pagu anggota keluarga!"
          });
        }
      }

      const updateRes = await pool.query(
        "UPDATE family_members SET monthly_limit = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [Number(monthlyLimit), memberId]
      );

      if (updateRes.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Anggota keluarga tidak ditemukan." });
      }

      const updatedMember = updateRes.rows[0];
      const formattedLimit = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(monthlyLimit);

      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          "notif_" + Date.now(),
          "Pagu Anggota Diperbarui",
          `Pagu batas belanja untuk ${updatedMember.name} (${updatedMember.role_title}) diatur menjadi ${formattedLimit}/bulan.`,
          "info"
        ]
      );

      return sendJSON(res, 200, {
        success: true,
        member: formatMemberRow(updatedMember)
      });
    }

    // 5. PUT /api/members/:id/pin - Ubah PIN login Kepala Keluarga atau Bendahara
    if (pathname.startsWith("/api/members/") && pathname.endsWith("/pin") && method === "PUT") {
      const memberId = pathname.replace("/api/members/", "").replace("/pin", "");
      const body = await getRequestBody(req);
      const { currentPin, newPin, requesterId } = body;

      if (!newPin || newPin.length < 4) {
        return sendJSON(res, 400, { success: false, message: "PIN baru minimal terdiri dari 4 digit angka." });
      }

      const targetMember = await pool.query("SELECT * FROM family_members WHERE id = $1", [memberId]);
      if (targetMember.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Anggota tidak ditemukan." });
      }

      const member = targetMember.rows[0];

      // Verifikasi PIN lama jika target sudah punya PIN
      if (member.pin && member.pin !== currentPin) {
        // Cek apakah requester adalah admin/co-admin dengan override
        return sendJSON(res, 400, { success: false, message: "PIN lama yang Anda masukkan tidak sesuai!" });
      }

      await pool.query(
        "UPDATE family_members SET pin = $1, updated_at = NOW() WHERE id = $2",
        [newPin, memberId]
      );

      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), "PIN Login Berhasil Diubah", `PIN login untuk ${member.name} (${member.role_title}) telah diperbarui dengan aman di database.`, "alert"]
      );

      return sendJSON(res, 200, { success: true, message: "PIN login berhasil diperbarui di database!" });
    }

    // 6. DELETE /api/members/:id - Hapus data anggota keluarga
    if (pathname.startsWith("/api/members/") && method === "DELETE") {
      const memberId = pathname.replace("/api/members/", "");
      const requesterId = parsedUrl.searchParams.get("requesterId");

      // Check authority: Kepala Keluarga OR Bendahara
      const requester = await pool.query("SELECT role FROM family_members WHERE id = $1", [requesterId]);
      if (requester.rows.length === 0 || !["admin", "co-admin"].includes(requester.rows[0].role)) {
        return sendJSON(res, 403, { success: false, message: "Akses ditolak: Hanya Kepala Keluarga dan Bendahara yang berwenang menghapus anggota keluarga." });
      }

      const targetMember = await pool.query("SELECT name, role FROM family_members WHERE id = $1", [memberId]);
      if (targetMember.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Anggota tidak ditemukan." });
      }

      if (targetMember.rows[0].role === "admin") {
        return sendJSON(res, 400, { success: false, message: "Tidak dapat menghapus akun Kepala Keluarga utama!" });
      }

      const memberName = targetMember.rows[0].name;

      // Hapus anggota (transaksi terhubung akan set member_id = NULL agar data finansial tidak hilang)
      await pool.query("DELETE FROM family_members WHERE id = $1", [memberId]);

      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), "Anggota Dihapus", `Data anggota keluarga '${memberName}' telah dihapus dari sistem oleh administrator.`, "alert"]
      );

      return sendJSON(res, 200, { success: true, message: `Anggota '${memberName}' berhasil dihapus dari database.` });
    }

    // 7. GET /api/transactions - Ambil seluruh transaksi
    if (pathname === "/api/transactions" && method === "GET") {
      const result = await pool.query("SELECT * FROM transactions ORDER BY date DESC, created_at DESC");
      return sendJSON(res, 200, result.rows.map(formatTxRow));
    }

    // 8. POST /api/transactions - Simpan transaksi baru ke database PostgreSQL
    if (pathname === "/api/transactions" && method === "POST") {
      const body = await getRequestBody(req);
      const {
        date,
        type,
        category,
        categoryName,
        amount,
        description,
        memberId,
        memberName,
        paymentMethod
      } = body;

      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return sendJSON(res, 400, { success: false, message: "Nominal transaksi tidak valid." });
      }

      const id = "tx_" + Date.now();
      const txDate = date || new Date().toISOString().slice(0, 10);
      const catName = categoryName || category;

      // Proteksi Server-side Pencegahan Double Input (30 detik)
      if (!body.allowDuplicate) {
        const recentDup = await pool.query(
          `SELECT id FROM transactions 
           WHERE amount = $1 AND date = $2 AND type = $3 AND member_id = $4 AND LOWER(description) = LOWER($5) 
             AND created_at > NOW() - INTERVAL '30 seconds'`,
          [amount, txDate, type, memberId, description]
        );
        if (recentDup.rows.length > 0) {
          return sendJSON(res, 409, {
            success: false,
            isDuplicate: true,
            message: "Pencegahan Double Input: Transaksi identik baru saja dicatat beberapa saat lalu."
          });
        }
      }

      const insertRes = await pool.query(
        `INSERT INTO transactions (id, date, type, category, category_name, amount, description, member_id, member_name, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [id, txDate, type, category, catName, amount, description, memberId, memberName, paymentMethod]
      );

      // Buat notifikasi otomatis ke database
      const notifTitle = type === "income" ? "Pemasukan Baru Ditambahkan" : "Pengeluaran Baru Dicatat";
      const formattedAmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
      const notifMsg = `${memberName} mencatat ${description} (${formattedAmt}) via ${paymentMethod}`;

      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), notifTitle, notifMsg, type]
      );

      return sendJSON(res, 201, { success: true, transaction: formatTxRow(insertRes.rows[0]) });
    }

    // 9a. DELETE /api/transactions/all - Hapus seluruh data transaksi (Khusus Kepala Keluarga)
    if (pathname === "/api/transactions/all" && method === "DELETE") {
      const requesterId = parsedUrl.searchParams.get("requesterId");
      const requester = await pool.query("SELECT role, name FROM family_members WHERE id = $1", [requesterId]);
      if (requester.rows.length === 0 || requester.rows[0].role !== "admin") {
        return sendJSON(res, 403, { success: false, message: "Akses ditolak: Hanya Kepala Keluarga yang berwenang menghapus seluruh data transaksi." });
      }

      await pool.query("DELETE FROM transactions");
      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        ["notif_" + Date.now(), "Seluruh Transaksi Dihapus", `Kepala Keluarga (${requester.rows[0].name}) telah mereset seluruh data transaksi keluarga dari database.`, "alert"]
      );

      return sendJSON(res, 200, { success: true, message: "Seluruh data transaksi berhasil dihapus dari database PostgreSQL." });
    }

    // 9b. DELETE /api/transactions/:id - Hapus satu transaksi dari PostgreSQL
    if (pathname.startsWith("/api/transactions/") && method === "DELETE") {
      const txId = pathname.replace("/api/transactions/", "");
      const requesterId = parsedUrl.searchParams.get("requesterId");

      const targetTx = await pool.query("SELECT * FROM transactions WHERE id = $1", [txId]);
      if (targetTx.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Transaksi tidak ditemukan." });
      }

      const tx = targetTx.rows[0];

      // Verifikasi hak akses: Kepala Keluarga / Bendahara / pembuat transaksi
      if (requesterId) {
        const requester = await pool.query("SELECT role FROM family_members WHERE id = $1", [requesterId]);
        if (requester.rows.length > 0) {
          const role = requester.rows[0].role;
          if (!["admin", "co-admin"].includes(role) && tx.member_id !== requesterId) {
            return sendJSON(res, 403, { success: false, message: "Hanya Kepala Keluarga, Bendahara, atau pembuat transaksi yang dapat menghapus data ini." });
          }
        }
      }

      await pool.query("DELETE FROM transactions WHERE id = $1", [txId]);

      return sendJSON(res, 200, { success: true, message: "Transaksi berhasil dihapus dari database." });
    }

    // 10. GET /api/notifications - Ambil riwayat notifikasi dari DB
    if (pathname === "/api/notifications" && method === "GET") {
      const result = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
      return sendJSON(res, 200, result.rows.map(r => ({
        id: r.id,
        title: r.title,
        message: r.message,
        type: r.type,
        read: r.is_read,
        createdAt: r.created_at
      })));
    }

    // 11. PUT /api/notifications/read - Tandai notifikasi sudah dibaca
    if (pathname === "/api/notifications/read" && method === "PUT") {
      await pool.query("UPDATE notifications SET is_read = TRUE");
      return sendJSON(res, 200, { success: true });
    }

    // 12. DELETE /api/notifications - Bersihkan notifikasi
    if (pathname === "/api/notifications" && method === "DELETE") {
      await pool.query("DELETE FROM notifications");
      return sendJSON(res, 200, { success: true });
    }

    // 13. GET /api/categories - Kategori & Anggaran
    if (pathname === "/api/categories" && method === "GET") {
      const result = await pool.query("SELECT * FROM categories ORDER BY type, name ASC");
      return sendJSON(res, 200, result.rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        icon: r.icon,
        badge: r.badge,
        budget: parseFloat(r.budget || 0)
      })));
    }

    // 14. PUT /api/categories/:id/budget - Update pagu anggaran kategori belanja
    if (pathname.startsWith("/api/categories/") && method === "PUT") {
      const catId = pathname.replace("/api/categories/", "").replace("/budget", "");
      const body = await getRequestBody(req);
      const { budget, requesterId } = body;

      if (budget === undefined || isNaN(budget) || Number(budget) < 0) {
        return sendJSON(res, 400, { success: false, message: "Nominal pagu anggaran tidak valid." });
      }

      // Validasi kewenangan: Kepala Keluarga (admin) atau Bendahara (co-admin)
      if (requesterId) {
        const reqCheck = await pool.query("SELECT role, name FROM family_members WHERE id = $1", [requesterId]);
        if (reqCheck.rows.length === 0 || !["admin", "co-admin"].includes(reqCheck.rows[0].role)) {
          return sendJSON(res, 403, {
            success: false,
            message: "Hanya Kepala Keluarga dan Bendahara yang berwenang mengatur pagu anggaran!"
          });
        }
      }

      const updateRes = await pool.query(
        "UPDATE categories SET budget = $1 WHERE id = $2 RETURNING *",
        [Number(budget), catId]
      );

      if (updateRes.rows.length === 0) {
        return sendJSON(res, 404, { success: false, message: "Kategori tidak ditemukan." });
      }

      const updatedRow = updateRes.rows[0];
      const formattedBudget = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(budget);

      // Notifikasi otomatis ke database
      await pool.query(
        `INSERT INTO notifications (id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          "notif_" + Date.now(),
          "Pagu Anggaran Diperbarui",
          `Pagu anggaran untuk kategori '${updatedRow.name}' telah diatur menjadi ${formattedBudget}.`,
          "info"
        ]
      );

      return sendJSON(res, 200, {
        success: true,
        category: {
          id: updatedRow.id,
          name: updatedRow.name,
          type: updatedRow.type,
          icon: updatedRow.icon,
          badge: updatedRow.badge,
          budget: parseFloat(updatedRow.budget)
        }
      });
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let reqPath = decodeURI(pathname);
    if (reqPath === "/") reqPath = "/index.html";

    const safePath = path.normalize(path.join(BASE_DIR, reqPath));
    if (!safePath.startsWith(BASE_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*"
      });

      const stream = fs.createReadStream(safePath);
      stream.pipe(res);
    });

  } catch (error) {
    console.error("Internal Server Error on API:", error);
    sendJSON(res, 500, { success: false, error: error.message || "Internal Server Error" });
  }
});

// Jalankan auto-migrasi dan mulai listen
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`EPOKKITA Server running at http://localhost:${PORT}`);
    console.log(`PostgreSQL Database: epokkita_db on localhost:5432`);
  });
}).catch(err => {
  console.error("Failed to initialize database, starting server anyway...", err);
  server.listen(PORT, () => {
    console.log(`EPOKKITA Server running at http://localhost:${PORT} (DB offline mode)`);
  });
});
