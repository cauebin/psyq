import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use DATABASE_PATH env var for production (Railway volumes), fallback to local for dev
const dbPath = process.env.DATABASE_PATH || 'database.sqlite';

// Ensure the directory exists if it's not the current directory
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('psychologist', 'patient', 'admin')),
    price_per_session REAL DEFAULT 0,
    previous_price REAL DEFAULT 0,
    price_effective_date TEXT,
    account_status TEXT DEFAULT 'active',
    session_duration INTEGER DEFAULT 50,
    interval_duration INTEGER DEFAULT 10,
    meet_link TEXT,
    psychologist_id INTEGER,
    phone TEXT,
    cpf TEXT,
    accepted INTEGER DEFAULT 0,
    crp TEXT,
    deleted INTEGER DEFAULT 0,
    work_on_holidays INTEGER DEFAULT 0,
    commission_percentage REAL DEFAULT 1.0,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    psychologist_id INTEGER,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    psychologist_id INTEGER,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid')),
    price REAL,
    FOREIGN KEY (patient_id) REFERENCES users(id),
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS patient_checkouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    psychologist_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'paid',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id),
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS therapist_checkouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    psychologist_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'PENDING',
    months_json TEXT,
    payment_date TEXT,
    charge_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );
`);

// Seed Lívia's account if it doesn't exist
import bcrypt from 'bcryptjs';

// Migrations: Ensure columns exist
try {
  // Check if we need to update the role constraint
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
  if (tableInfo && !tableInfo.sql.includes("'admin'")) {
    console.log('Migrating users table to support admin role...');
    db.exec('PRAGMA foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('psychologist', 'patient', 'admin')),
          price_per_session REAL DEFAULT 0,
          previous_price REAL DEFAULT 0,
          price_effective_date TEXT,
          account_status TEXT DEFAULT 'active',
          session_duration INTEGER DEFAULT 90,
          meet_link TEXT,
          psychologist_id INTEGER,
          phone TEXT,
          accepted INTEGER DEFAULT 0,
          crp TEXT,
          deleted INTEGER DEFAULT 0,
          work_on_holidays INTEGER DEFAULT 0,
          commission_percentage REAL DEFAULT 1.0,
          FOREIGN KEY (psychologist_id) REFERENCES users(id)
        )
      `);
      
      // Get existing columns to copy
      const columns = (db.pragma('table_info(users)') as any[]).map(c => c.name);
      const validColumns = columns.filter(c => [
        'id', 'name', 'email', 'password', 'role', 'price_per_session', 
        'previous_price', 'price_effective_date', 'account_status',
        'session_duration', 'meet_link', 'psychologist_id', 'phone', 
        'accepted', 'crp', 'deleted', 'work_on_holidays', 'commission_percentage'
      ].includes(c));
      
      const colsStr = validColumns.join(', ');
      db.exec(`INSERT INTO users_new (${colsStr}) SELECT ${colsStr} FROM users`);
      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
    })();
    db.exec('PRAGMA foreign_keys = ON');
    console.log('Migration complete.');
  }
} catch (e) {
  console.error('Migration error:', e);
}

try {
  db.exec("ALTER TABLE users ADD COLUMN cpf TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN price_per_session REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN session_duration INTEGER DEFAULT 50");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN interval_duration INTEGER DEFAULT 10");
} catch (e) {}
try {
  db.exec("UPDATE users SET session_duration = 50 WHERE session_duration IS NULL OR session_duration = 90");
  db.exec("UPDATE users SET interval_duration = 10 WHERE interval_duration IS NULL");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN meet_link TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN previous_price REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN price_effective_date TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'");
  db.exec("UPDATE users SET account_status = 'inactive' WHERE deleted = 1");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN commission_percentage REAL DEFAULT 1.0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN work_on_holidays INTEGER DEFAULT 0");
} catch (e) {}

// Migration for platform_payments: remove unique constraint
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='platform_payments'").get() as any;
  if (tableInfo && tableInfo.sql.includes("UNIQUE")) {
    console.log('Migrating platform_payments table to remove UNIQUE constraint...');
    db.exec('PRAGMA foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE platform_payments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          psychologist_id INTEGER NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          amount REAL NOT NULL,
          revenue REAL NOT NULL,
          commission_rate REAL NOT NULL,
          status TEXT DEFAULT 'paid',
          payment_date TEXT NOT NULL,
          FOREIGN KEY (psychologist_id) REFERENCES users(id)
        )
      `);
      db.exec(`INSERT INTO platform_payments_new SELECT id, psychologist_id, month, year, amount, revenue, commission_rate, status, payment_date FROM platform_payments`);
      db.exec(`DROP TABLE platform_payments`);
      db.exec(`ALTER TABLE platform_payments_new RENAME TO platform_payments`);
    })();
    db.exec('PRAGMA foreign_keys = ON');
    console.log('Migration complete.');
  }
} catch (e) {
  console.error('Platform payments migration error:', e);
}

// Platform payments table for therapists to pay PsyQ
db.exec(`
  CREATE TABLE IF NOT EXISTS platform_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    psychologist_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount REAL NOT NULL,
    revenue REAL NOT NULL,
    commission_rate REAL NOT NULL,
    status TEXT DEFAULT 'paid',
    payment_date TEXT NOT NULL,
    charge_id TEXT,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE platform_payments ADD COLUMN charge_id TEXT");
} catch (e) {}

// Subscriptions table for therapists
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('paid', 'pending', 'overdue')),
    amount REAL DEFAULT 39.00,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, month, year)
  );
`);
try {
  db.exec("ALTER TABLE users ADD COLUMN psychologist_id INTEGER REFERENCES users(id)");
} catch (e) {}

try {
  db.exec("ALTER TABLE appointments ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid'))");
} catch (e) {}
try {
  db.exec("ALTER TABLE appointments ADD COLUMN price REAL");
} catch (e) {}
try {
  db.exec("ALTER TABLE appointments ADD COLUMN psychologist_id INTEGER REFERENCES users(id)");
} catch (e) {}

try {
  db.exec("ALTER TABLE availability ADD COLUMN psychologist_id INTEGER REFERENCES users(id)");
} catch (e) {}

// Payment Transactions table for AbacatePay integration
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    psychologist_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );
`);

// Initialize new tables
db.exec(`
  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    start_time TEXT,
    end_time TEXT,
    is_all_day INTEGER DEFAULT 1,
    psychologist_id INTEGER,
    FOREIGN KEY (psychologist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE absences ADD COLUMN psychologist_id INTEGER REFERENCES users(id)");
} catch (e) {}


// Add new columns to absences if they don't exist
try {
  const columns = db.pragma('table_info(absences)') as any[];
  const hasStartTime = columns.some(c => c.name === 'start_time');
  if (!hasStartTime) {
    db.exec(`
      ALTER TABLE absences ADD COLUMN start_time TEXT;
      ALTER TABLE absences ADD COLUMN end_time TEXT;
      ALTER TABLE absences ADD COLUMN is_all_day INTEGER DEFAULT 1;
    `);
  }
} catch (e) {
  console.error('Error migrating absences table:', e);
}

// Seed Holidays for 2026 (Brazil + SP)
const holidays2026 = [
  { date: '2026-01-01', name: 'Confraternização Universal' },
  { date: '2026-01-25', name: 'Aniversário de São Paulo' },
  { date: '2026-02-16', name: 'Carnaval' },
  { date: '2026-02-17', name: 'Carnaval' },
  { date: '2026-04-03', name: 'Sexta-feira Santa' },
  { date: '2026-04-21', name: 'Tiradentes' },
  { date: '2026-05-01', name: 'Dia do Trabalho' },
  { date: '2026-06-04', name: 'Corpus Christi' },
  { date: '2026-07-09', name: 'Revolução Constitucionalista' },
  { date: '2026-09-07', name: 'Independência do Brasil' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', name: 'Finados' },
  { date: '2026-11-15', name: 'Proclamação da República' },
  { date: '2026-11-20', name: 'Dia da Consciência Negra' },
  { date: '2026-12-25', name: 'Natal' },
];

const insertHoliday = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
holidays2026.forEach(h => insertHoliday.run(h.date, h.name));

// Backfill price for existing appointments if null
db.exec(`
  UPDATE appointments 
  SET price = (SELECT price_per_session FROM users WHERE users.id = appointments.patient_id)
  WHERE price IS NULL
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN cnpj TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN pix_key_type TEXT DEFAULT 'email'");
} catch (e) {}

// Seed Admin account
const adminEmail = 'admin';
const checkAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!checkAdmin) {
  if (!initialAdminPassword) {
    console.error('CRITICAL: INITIAL_ADMIN_PASSWORD environment variable is not set! Admin account will not be accessible.');
  }
  const hashedPassword = bcrypt.hashSync(initialAdminPassword || 'change-me-immediately', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Administrador PsyQ',
    adminEmail,
    hashedPassword,
    'admin'
  );
  console.log('Admin account created.');
} else {
  // Ensure role is admin if it was previously something else
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(adminEmail);
  
  // Only update password if INITIAL_ADMIN_PASSWORD is provided to allow for resets via environment variable
  if (initialAdminPassword) {
    const hashedPassword = bcrypt.hashSync(initialAdminPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hashedPassword, adminEmail);
    console.log('Admin password updated from INITIAL_ADMIN_PASSWORD environment variable.');
  }
}

// Backfill therapist_checkouts from payment_transactions if empty
const checkoutCount = db.prepare('SELECT COUNT(*) as count FROM therapist_checkouts').get() as any;
if (checkoutCount.count === 0) {
  const transactions = db.prepare('SELECT * FROM payment_transactions').all() as any[];
  if (transactions.length > 0) {
    console.log(`Backfilling ${transactions.length} therapist checkouts...`);
    const insert = db.prepare(`
      INSERT INTO therapist_checkouts (psychologist_id, amount, status, months_json, charge_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
      for (const t of transactions) {
        insert.run(t.psychologist_id, t.amount / 100, t.status, t.metadata, t.id, t.created_at);
      }
    })();
  }
}

// Data correction for platform payments
try {
  db.exec("UPDATE platform_payments SET payment_date = '2026-02-25' WHERE payment_date = '2026-02-24'");
  db.exec("UPDATE platform_payments SET revenue = 390 WHERE amount = 11.70 AND revenue = 790");
} catch (e) {}

export default db;
