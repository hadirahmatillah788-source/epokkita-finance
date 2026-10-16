/**
 * EPOKKITA - Initial Seed Data
 * Data awal simulasi keuangan keluarga yang realistis
 */

const INITIAL_MEMBERS = [
  {
    id: "mem_ayah",
    name: "Ayah Budi",
    fullName: "Budi Santoso",
    role: "admin", // Kepala Keluarga
    roleTitle: "Kepala Keluarga",
    avatarClass: "avatar-ayah",
    icon: "user-check",
    color: "#0284c7",
    monthlyLimit: 15000000,
    pin: "1234"
  },
  {
    id: "mem_ibu",
    name: "Ibu Siti",
    fullName: "Siti Rahmawati",
    role: "co-admin", // Bendahara Keluarga
    roleTitle: "Bendahara Keluarga",
    avatarClass: "avatar-ibu",
    icon: "heart-handshake",
    color: "#ec4899",
    monthlyLimit: 12000000,
    pin: "1111"
  },
  {
    id: "mem_kakak",
    name: "Kakak Rian",
    fullName: "Rian Pratama",
    role: "member",
    roleTitle: "Anak Pertama (Kuliah)",
    avatarClass: "avatar-anak1",
    icon: "graduation-cap",
    color: "#8b5cf6",
    monthlyLimit: 3000000,
    pin: ""
  },
  {
    id: "mem_adik",
    name: "Adik Nadia",
    fullName: "Nadia Putri",
    role: "member",
    roleTitle: "Anak Kedua (SMA)",
    avatarClass: "avatar-anak2",
    icon: "smile",
    color: "#f59e0b",
    monthlyLimit: 1500000,
    pin: ""
  }
];

const INITIAL_CATEGORIES = {
  expense: [
    { id: "makanan", name: "Makanan & Minuman", icon: "utensils", badge: "makanan", budget: 4500000 },
    { id: "belanja", name: "Belanja Bulanan", icon: "shopping-bag", badge: "makanan", budget: 3500000 },
    { id: "utilitas", name: "Tagihan & Listrik", icon: "zap", badge: "utilitas", budget: 1800000 },
    { id: "transportasi", name: "Bensin & Transportasi", icon: "car", badge: "transportasi", budget: 2000000 },
    { id: "pendidikan", name: "Pendidikan & Les", icon: "book-open", badge: "pendidikan", budget: 3000000 },
    { id: "kesehatan", name: "Kesehatan & Obat", icon: "activity", badge: "kesehatan", budget: 1000000 },
    { id: "hiburan", name: "Hiburan & Rekreasi", icon: "film", badge: "hiburan", budget: 1500000 },
    { id: "lainnya", name: "Kebutuhan Lainnya", icon: "tag", badge: "lainnya", budget: 1200000 }
  ],
  income: [
    { id: "gaji", name: "Gaji Pokok", icon: "briefcase", badge: "gaji" },
    { id: "bisnis", name: "Bisnis Online / Usaha", icon: "store", badge: "bisnis" },
    { id: "investasi", name: "Hasil Investasi & Tabungan", icon: "trending-up", badge: "bisnis" },
    { id: "bonus", name: "Bonus & THR", icon: "sparkles", badge: "gaji" },
    { id: "hadiah", name: "Hadiah / Lain-lain", icon: "gift", badge: "lainnya" }
  ]
};

const PAYMENT_METHODS = [
  "Transfer",
  "QRIS",
  "Tunai (Cash)",
  "E-Wallet",
  "Kartu Debit/Kredit"
];

// Helper to generate seed transactions with realistic dates in current/recent months
function generateInitialTransactions() {
  const currentYear = 2026;
  return [
    // OKTOBER 2026 (Bulan Berjalan)
    {
      id: "tx_101",
      date: "2026-10-01",
      type: "income",
      category: "gaji",
      categoryName: "Gaji Pokok",
      amount: 19500000,
      description: "Gaji Bulanan Kantor PT Berkah",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-10-01T08:00:00Z"
    },
    {
      id: "tx_102",
      date: "2026-10-02",
      type: "income",
      category: "bisnis",
      categoryName: "Bisnis Online / Usaha",
      amount: 4800000,
      description: "Hasil Penjualan Kue & Snack Online",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Transfer Bank Mandiri",
      createdAt: "2026-10-02T10:15:00Z"
    },
    {
      id: "tx_103",
      date: "2026-10-03",
      type: "expense",
      category: "belanja",
      categoryName: "Belanja Bulanan",
      amount: 2850000,
      description: "Belanja Dapur & Kebutuhan Rumah Superindo",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Kartu Debit / Kredit",
      createdAt: "2026-10-03T11:30:00Z"
    },
    {
      id: "tx_104",
      date: "2026-10-04",
      type: "expense",
      category: "utilitas",
      categoryName: "Tagihan & Listrik",
      amount: 1250000,
      description: "Token Listrik PLN & Air PDAM Rumah",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-10-04T09:00:00Z"
    },
    {
      id: "tx_105",
      date: "2026-10-05",
      type: "expense",
      category: "utilitas",
      categoryName: "Tagihan & Listrik",
      amount: 475000,
      description: "Tagihan Internet IndiHome 100Mbps",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-10-05T14:20:00Z"
    },
    {
      id: "tx_106",
      date: "2026-10-06",
      type: "expense",
      category: "pendidikan",
      categoryName: "Pendidikan & Les",
      amount: 1500000,
      description: "Uang Kuliah Semester & Buku Kakak Rian",
      memberId: "mem_kakak",
      memberName: "Kakak Rian",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-10-06T13:00:00Z"
    },
    {
      id: "tx_107",
      date: "2026-10-07",
      type: "expense",
      category: "transportasi",
      categoryName: "Bensin & Transportasi",
      amount: 650000,
      description: "Isi Bensin Pertamax & Top-up e-Toll",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Uang Tunai (Cash)",
      createdAt: "2026-10-07T17:40:00Z"
    },
    {
      id: "tx_108",
      date: "2026-10-09",
      type: "expense",
      category: "pendidikan",
      categoryName: "Pendidikan & Les",
      amount: 750000,
      description: "Biaya Les Matematika & Bahasa Inggris Nadia",
      memberId: "mem_adik",
      memberName: "Adik Nadia",
      paymentMethod: "GoPay / OVO / Dana",
      createdAt: "2026-10-09T15:10:00Z"
    },
    {
      id: "tx_109",
      date: "2026-10-10",
      type: "expense",
      category: "makanan",
      categoryName: "Makanan & Minuman",
      amount: 480000,
      description: "Makan Siang Keluarga Akhir Pekan",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "GoPay / OVO / Dana",
      createdAt: "2026-10-10T12:45:00Z"
    },
    {
      id: "tx_110",
      date: "2026-10-12",
      type: "expense",
      category: "kesehatan",
      categoryName: "Kesehatan & Obat",
      amount: 450000,
      description: "Vitamin Keluarga & Suplemen Herbal",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "GoPay / OVO / Dana",
      createdAt: "2026-10-12T16:00:00Z"
    },
    {
      id: "tx_111",
      date: "2026-10-14",
      type: "expense",
      category: "hiburan",
      categoryName: "Hiburan & Rekreasi",
      amount: 320000,
      description: "Tiket Nonton Bioskop & Cemilan Keluarga",
      memberId: "mem_kakak",
      memberName: "Kakak Rian",
      paymentMethod: "GoPay / OVO / Dana",
      createdAt: "2026-10-14T19:30:00Z"
    },

    // SEPTEMBER 2026
    {
      id: "tx_091",
      date: "2026-09-01",
      type: "income",
      category: "gaji",
      categoryName: "Gaji Pokok",
      amount: 19500000,
      description: "Gaji Kantor Bulan September",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-09-01T08:00:00Z"
    },
    {
      id: "tx_092",
      date: "2026-09-03",
      type: "income",
      category: "bisnis",
      categoryName: "Bisnis Online / Usaha",
      amount: 4200000,
      description: "Order Katering Kantor & Arisan",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Transfer Bank Mandiri",
      createdAt: "2026-09-03T11:00:00Z"
    },
    {
      id: "tx_093",
      date: "2026-09-05",
      type: "expense",
      category: "belanja",
      categoryName: "Belanja Bulanan",
      amount: 3100000,
      description: "Belanja Bulanan & Stok Sembako",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Kartu Debit / Kredit",
      createdAt: "2026-09-05T10:00:00Z"
    },
    {
      id: "tx_094",
      date: "2026-09-07",
      type: "expense",
      category: "utilitas",
      categoryName: "Tagihan & Listrik",
      amount: 1650000,
      description: "Listrik, Air & Internet",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-09-07T09:00:00Z"
    },
    {
      id: "tx_095",
      date: "2026-09-12",
      type: "expense",
      category: "transportasi",
      categoryName: "Bensin & Transportasi",
      amount: 1400000,
      description: "Servis Rem Mobil & Oli Rutin",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-09-12T14:00:00Z"
    },
    {
      id: "tx_096",
      date: "2026-09-18",
      type: "expense",
      category: "pendidikan",
      categoryName: "Pendidikan & Les",
      amount: 2100000,
      description: "Biaya Praktikum Rian & Les Nadia",
      memberId: "mem_kakak",
      memberName: "Kakak Rian",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-09-18T16:00:00Z"
    },
    {
      id: "tx_097",
      date: "2026-09-22",
      type: "expense",
      category: "makanan",
      categoryName: "Makanan & Minuman",
      amount: 1250000,
      description: "Makan Restoran Ulang Tahun Nadia",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Kartu Debit / Kredit",
      createdAt: "2026-09-22T19:00:00Z"
    },

    // AGUSTUS 2026
    {
      id: "tx_081",
      date: "2026-08-01",
      type: "income",
      category: "gaji",
      categoryName: "Gaji Pokok",
      amount: 19500000,
      description: "Gaji Kantor Bulan Agustus",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-08-01T08:00:00Z"
    },
    {
      id: "tx_082",
      date: "2026-08-05",
      type: "expense",
      category: "belanja",
      categoryName: "Belanja Bulanan",
      amount: 3400000,
      description: "Kebutuhan Rumah Tangga Lengkap",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Kartu Debit / Kredit",
      createdAt: "2026-08-05T10:00:00Z"
    },
    {
      id: "tx_083",
      date: "2026-08-10",
      type: "expense",
      category: "utilitas",
      categoryName: "Tagihan & Listrik",
      amount: 1720000,
      description: "Listrik AC, Air & Paket Data",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-08-10T11:00:00Z"
    },
    {
      id: "tx_084",
      date: "2026-08-15",
      type: "expense",
      category: "hiburan",
      categoryName: "Hiburan & Rekreasi",
      amount: 2200000,
      description: "Liburan Keluarga Akhir Pekan ke Puncak",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-08-15T15:00:00Z"
    },
    {
      id: "tx_085",
      date: "2026-08-17",
      type: "income",
      category: "bonus",
      categoryName: "Bonus & THR",
      amount: 3000000,
      description: "Bonus Insentif Proyek Kemerdekaan",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-08-17T12:00:00Z"
    },

    // JULI 2026
    {
      id: "tx_071",
      date: "2026-07-01",
      type: "income",
      category: "gaji",
      categoryName: "Gaji Pokok",
      amount: 19500000,
      description: "Gaji Kantor Bulan Juli",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-07-01T08:00:00Z"
    },
    {
      id: "tx_072",
      date: "2026-07-08",
      type: "expense",
      category: "pendidikan",
      categoryName: "Pendidikan & Les",
      amount: 3800000,
      description: "Daftar Ulang Sekolah & Buku Tahun Ajaran Baru",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Transfer Bank Mandiri",
      createdAt: "2026-07-08T09:00:00Z"
    },
    {
      id: "tx_073",
      date: "2026-07-15",
      type: "expense",
      category: "belanja",
      categoryName: "Belanja Bulanan",
      amount: 2900000,
      description: "Belanja Supermarket Dapur",
      memberId: "mem_ibu",
      memberName: "Ibu Siti",
      paymentMethod: "Kartu Debit / Kredit",
      createdAt: "2026-07-15T11:00:00Z"
    },
    {
      id: "tx_074",
      date: "2026-07-20",
      type: "expense",
      category: "utilitas",
      categoryName: "Tagihan & Listrik",
      amount: 1600000,
      description: "Listrik, Air & Gas",
      memberId: "mem_ayah",
      memberName: "Ayah Budi",
      paymentMethod: "Transfer Bank BCA",
      createdAt: "2026-07-20T10:00:00Z"
    }
  ];
}
