/**
 * EPOKKITA - PostgreSQL Database Client & Auto-Migration
 */

const { Pool } = require("pg");
require("dotenv").config();

const isLocalDb = !process.env.DATABASE_URL || 
  process.env.DATABASE_URL.includes("localhost") || 
  process.env.DATABASE_URL.includes("127.0.0.1");

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalDb || process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false }
    }
  : {
      host: process.env.PGHOST || "localhost",
      port: parseInt(process.env.PGPORT || "5432", 10),
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "admin123",
      database: process.env.PGDATABASE || "epokkita_db",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log("Connected to PostgreSQL successfully. Initializing tables...");

    // 1. Table family_members
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        full_name VARCHAR(150),
        role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin' (Kepala Keluarga), 'co-admin' (Bendahara), 'member'
        role_title VARCHAR(100) NOT NULL,           -- e.g. 'Kepala Keluarga', 'Bendahara Keluarga', 'Anak Pertama (Kuliah)'
        avatar_class VARCHAR(50) DEFAULT 'avatar-ayah',
        color VARCHAR(30) DEFAULT '#059669',
        monthly_limit NUMERIC(15, 2) DEFAULT 2000000,
        pin VARCHAR(20) DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Table categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'income' or 'expense'
        icon VARCHAR(50) DEFAULT 'tag',
        badge VARCHAR(50) DEFAULT 'lainnya',
        budget NUMERIC(15, 2) DEFAULT 0
      );
    `);

    // 3. Table transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        date DATE NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'income' or 'expense'
        category VARCHAR(50) NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        description TEXT NOT NULL,
        member_id VARCHAR(64) REFERENCES family_members(id) ON DELETE SET NULL,
        member_name VARCHAR(100) NOT NULL,
        payment_method VARCHAR(100) DEFAULT 'Transfer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Table notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(30) DEFAULT 'info', -- 'income', 'expense', 'alert', 'info'
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Index for quick queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions (member_id);`);

    // Check if initial members exist; if not, seed initial family members
    const memberCountRes = await client.query("SELECT COUNT(*) FROM family_members");
    if (parseInt(memberCountRes.rows[0].count, 10) === 0) {
      console.log("Seeding default family members into PostgreSQL...");
      const membersSeed = [
        {
          id: "mem_ayah",
          name: "Ayah Budi",
          full_name: "Budi Santoso",
          role: "admin",
          role_title: "Kepala Keluarga",
          avatar_class: "avatar-ayah",
          color: "#0284c7",
          monthly_limit: 15000000,
          pin: "1234"
        },
        {
          id: "mem_ibu",
          name: "Ibu Siti",
          full_name: "Siti Rahmawati",
          role: "co-admin",
          role_title: "Bendahara Keluarga",
          avatar_class: "avatar-ibu",
          color: "#ec4899",
          monthly_limit: 12000000,
          pin: "1111"
        },
        {
          id: "mem_kakak",
          name: "Kakak Rian",
          full_name: "Rian Pratama",
          role: "member",
          role_title: "Anak Pertama (Kuliah)",
          avatar_class: "avatar-anak1",
          color: "#8b5cf6",
          monthly_limit: 3000000,
          pin: null
        },
        {
          id: "mem_adik",
          name: "Adik Nadia",
          full_name: "Nadia Putri",
          role: "member",
          role_title: "Anak Kedua (SMA)",
          avatar_class: "avatar-anak2",
          color: "#f59e0b",
          monthly_limit: 1500000,
          pin: null
        }
      ];

      for (const m of membersSeed) {
        await client.query(
          `INSERT INTO family_members (id, name, full_name, role, role_title, avatar_class, color, monthly_limit, pin)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [m.id, m.name, m.full_name, m.role, m.role_title, m.avatar_class, m.color, m.monthly_limit, m.pin]
        );
      }
    }

    // Check if categories exist; if not, seed
    const catCountRes = await client.query("SELECT COUNT(*) FROM categories");
    if (parseInt(catCountRes.rows[0].count, 10) === 0) {
      console.log("Seeding categories into PostgreSQL...");
      const categoriesSeed = [
        { id: "makanan", name: "Makanan & Minuman", type: "expense", icon: "utensils", badge: "makanan", budget: 4500000 },
        { id: "belanja", name: "Belanja Bulanan", type: "expense", icon: "shopping-bag", badge: "makanan", budget: 3500000 },
        { id: "utilitas", name: "Tagihan & Listrik", type: "expense", icon: "zap", badge: "utilitas", budget: 1800000 },
        { id: "transportasi", name: "Bensin & Transportasi", type: "expense", icon: "car", badge: "transportasi", budget: 2000000 },
        { id: "pendidikan", name: "Pendidikan & Les", type: "expense", icon: "book-open", badge: "pendidikan", budget: 3000000 },
        { id: "kesehatan", name: "Kesehatan & Obat", type: "expense", icon: "activity", badge: "kesehatan", budget: 1000000 },
        { id: "hiburan", name: "Hiburan & Rekreasi", type: "expense", icon: "film", badge: "hiburan", budget: 1500000 },
        { id: "lainnya", name: "Kebutuhan Lainnya", type: "expense", icon: "tag", badge: "lainnya", budget: 1200000 },
        { id: "gaji", name: "Gaji Pokok", type: "income", icon: "briefcase", badge: "gaji", budget: 0 },
        { id: "bisnis", name: "Bisnis Online / Usaha", type: "income", icon: "store", badge: "bisnis", budget: 0 },
        { id: "investasi", name: "Hasil Investasi & Tabungan", type: "income", icon: "trending-up", badge: "bisnis", budget: 0 },
        { id: "bonus", name: "Bonus & THR", type: "income", icon: "sparkles", badge: "gaji", budget: 0 },
        { id: "hadiah", name: "Hadiah / Lain-lain", type: "income", icon: "gift", badge: "lainnya", budget: 0 }
      ];

      for (const c of categoriesSeed) {
        await client.query(
          `INSERT INTO categories (id, name, type, icon, badge, budget)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [c.id, c.name, c.type, c.icon, c.badge, c.budget]
        );
      }
    }

    // Check if transactions exist; if not, seed realistic transactions
    const txCountRes = await client.query("SELECT COUNT(*) FROM transactions");
    if (parseInt(txCountRes.rows[0].count, 10) === 0) {
      console.log("Seeding initial transactions into PostgreSQL...");
      const seedTransactions = [
        // OKTOBER 2026
        { id: "tx_101", date: "2026-10-01", type: "income", category: "gaji", category_name: "Gaji Pokok", amount: 19500000, description: "Gaji Bulanan Kantor PT Berkah", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_102", date: "2026-10-02", type: "income", category: "bisnis", category_name: "Bisnis Online / Usaha", amount: 4800000, description: "Hasil Penjualan Kue & Snack Online", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Transfer" },
        { id: "tx_103", date: "2026-10-03", type: "expense", category: "belanja", category_name: "Belanja Bulanan", amount: 2850000, description: "Belanja Dapur & Kebutuhan Rumah Superindo", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Kartu Debit/Kredit" },
        { id: "tx_104", date: "2026-10-04", type: "expense", category: "utilitas", category_name: "Tagihan & Listrik", amount: 1250000, description: "Token Listrik PLN & Air PDAM Rumah", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_105", date: "2026-10-05", type: "expense", category: "utilitas", category_name: "Tagihan & Listrik", amount: 475000, description: "Tagihan Internet IndiHome 100Mbps", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_106", date: "2026-10-06", type: "expense", category: "pendidikan", category_name: "Pendidikan & Les", amount: 1500000, description: "Uang Kuliah Semester & Buku Kakak Rian", member_id: "mem_kakak", member_name: "Kakak Rian", payment_method: "Transfer" },
        { id: "tx_107", date: "2026-10-07", type: "expense", category: "transportasi", category_name: "Bensin & Transportasi", amount: 650000, description: "Isi Bensin Pertamax & Top-up e-Toll", member_id: "mem_ayah", member_name: "Ayah", payment_method: "Tunai (Cash)" },
        { id: "tx_108", date: "2026-10-09", type: "expense", category: "pendidikan", category_name: "Pendidikan & Les", amount: 750000, description: "Biaya Les Matematika & Bahasa Inggris", member_id: "mem_kakak", member_name: "Arsya", payment_method: "QRIS" },
        { id: "tx_109", date: "2026-10-10", type: "expense", category: "makanan", category_name: "Makanan & Minuman", amount: 480000, description: "Makan Siang Soto Ayam Sekeluarga", member_id: "mem_ayah", member_name: "Ayah", payment_method: "QRIS" },
        { id: "tx_110", date: "2026-10-12", type: "expense", category: "kesehatan", category_name: "Kesehatan & Obat", amount: 450000, description: "Vitamin Keluarga & Suplemen Herbal", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "E-Wallet" },
        { id: "tx_111", date: "2026-10-14", type: "expense", category: "hiburan", category_name: "Hiburan & Rekreasi", amount: 320000, description: "Tiket Nonton Bioskop & Cemilan Keluarga", member_id: "mem_kakak", member_name: "Kakak Rian", payment_method: "E-Wallet" },

        // SEPTEMBER 2026
        { id: "tx_091", date: "2026-09-01", type: "income", category: "gaji", category_name: "Gaji Pokok", amount: 19500000, description: "Gaji Kantor Bulan September", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_092", date: "2026-09-03", type: "income", category: "bisnis", category_name: "Bisnis Online / Usaha", amount: 4200000, description: "Order Katering Kantor & Arisan", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Transfer" },
        { id: "tx_093", date: "2026-09-05", type: "expense", category: "belanja", category_name: "Belanja Bulanan", amount: 3100000, description: "Belanja Bulanan & Stok Sembako", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Kartu Debit/Kredit" },
        { id: "tx_094", date: "2026-09-07", type: "expense", category: "utilitas", category_name: "Tagihan & Listrik", amount: 1650000, description: "Listrik, Air & Internet", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_095", date: "2026-09-12", type: "expense", category: "transportasi", category_name: "Bensin & Transportasi", amount: 1400000, description: "Servis Rem Mobil & Oli Rutin", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_096", date: "2026-09-18", type: "expense", category: "pendidikan", category_name: "Pendidikan & Les", amount: 2100000, description: "Biaya Praktikum Rian & Les Nadia", member_id: "mem_kakak", member_name: "Kakak Rian", payment_method: "Transfer" },

        // AGUSTUS 2026
        { id: "tx_081", date: "2026-08-01", type: "income", category: "gaji", category_name: "Gaji Pokok", amount: 19500000, description: "Gaji Kantor Bulan Agustus", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_082", date: "2026-08-05", type: "expense", category: "belanja", category_name: "Belanja Bulanan", amount: 3400000, description: "Kebutuhan Rumah Tangga Lengkap", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Kartu Debit/Kredit" },
        { id: "tx_083", date: "2026-08-10", type: "expense", category: "utilitas", category_name: "Tagihan & Listrik", amount: 1720000, description: "Listrik AC, Air & Paket Data", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_084", date: "2026-08-15", type: "expense", category: "hiburan", category_name: "Hiburan & Rekreasi", amount: 2200000, description: "Liburan Keluarga Akhir Pekan", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "QRIS" },
        { id: "tx_085", date: "2026-08-17", type: "income", category: "bonus", category_name: "Bonus & THR", amount: 3000000, description: "Bonus Insentif Proyek Kemerdekaan", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },

        // JULI 2026
        { id: "tx_071", date: "2026-07-01", type: "income", category: "gaji", category_name: "Gaji Pokok", amount: 19500000, description: "Gaji Kantor Bulan Juli", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Transfer" },
        { id: "tx_072", date: "2026-07-08", type: "expense", category: "pendidikan", category_name: "Pendidikan & Les", amount: 3800000, description: "Daftar Ulang Sekolah & Buku", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Transfer" },
        { id: "tx_073", date: "2026-07-15", type: "expense", category: "belanja", category_name: "Belanja Bulanan", amount: 2900000, description: "Belanja Supermarket Dapur", member_id: "mem_ibu", member_name: "Ibu Siti", payment_method: "Kartu Debit/Kredit" },
        { id: "tx_074", date: "2026-07-20", type: "expense", category: "utilitas", category_name: "Tagihan & Listrik", amount: 1600000, description: "Listrik, Air & Gas", member_id: "mem_ayah", member_name: "Ayah Budi", payment_method: "Tunai (Cash)" }
      ];

      for (const t of seedTransactions) {
        await client.query(
          `INSERT INTO transactions (id, date, type, category, category_name, amount, description, member_id, member_name, payment_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [t.id, t.date, t.type, t.category, t.category_name, t.amount, t.description, t.member_id, t.member_name, t.payment_method]
        );
      }
    }

    // Check notifications
    const notifCountRes = await client.query("SELECT COUNT(*) FROM notifications");
    if (parseInt(notifCountRes.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO notifications (id, title, message, type, is_read)
        VALUES 
          ('notif_init_1', 'Database PostgreSQL Terhubung', 'Sistem EPOKKITA sukses tersambung ke database PostgreSQL epokkita_db.', 'alert', false),
          ('notif_init_2', 'Gaji Pokok Ayah Terverifikasi', 'Ayah Budi mencatat Gaji Pokok Rp 19.500.000 (Tersimpan di DB)', 'income', false);
      `);
    }

    console.log("PostgreSQL database initialized successfully.");
  } catch (error) {
    console.error("Error during PostgreSQL initialization:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase
};
