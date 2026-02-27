import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './src/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { addWeeks, format, parseISO, getYear } from 'date-fns';
import path from 'path';
import dns from 'dns';
import { promisify } from 'util';
import { sendWelcomeEmail, sendPasswordResetEmail } from './server/email.js';
import { validateCPF, validateEmail } from './src/utils/validation.js';
import { createPixCharge, simulatePixPayment } from './server/abacatepay.js';

const resolveMx = promisify(dns.resolveMx);
const dnsLookup = promisify(dns.lookup);

async function isEmailDomainValid(email: string): Promise<boolean> {
  if (!validateEmail(email)) return false;
  
  const domain = email.split('@')[1];
  try {
    // Try MX records first
    const mxAddresses = await resolveMx(domain);
    if (mxAddresses && mxAddresses.length > 0) return true;
  } catch (e) {
    // If MX fails, try A record as fallback
    try {
      const address = await dnsLookup(domain);
      return !!address;
    } catch (e2) {
      return false;
    }
  }
  return false;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(express.json());

// Authentication Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Add new columns if they don't exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
} catch (e) { /* ignore if exists */ }

try {
  db.prepare("ALTER TABLE users ADD COLUMN accepted INTEGER DEFAULT 0").run();
} catch (e) { /* ignore if exists */ }

try {
  db.prepare("ALTER TABLE users ADD COLUMN crp TEXT").run();
} catch (e) { /* ignore if exists */ }

try {
  db.prepare("ALTER TABLE users ADD COLUMN deleted INTEGER DEFAULT 0").run();
} catch (e) { /* ignore if exists */ }

// Backfill accepted status for existing users
// ...

// Public: List Psychologists
app.get('/api/psychologists', (req, res) => {
  const psychologists = db.prepare("SELECT id, name FROM users WHERE role = 'psychologist' AND deleted = 0").all();
  res.json(psychologists);
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, psychologist_id, phone, cpf } = req.body;
  
  if (!(await isEmailDomainValid(email))) {
    return res.status(400).json({ error: 'O domínio do e-mail parece ser inválido ou não existe.' });
  }

  if (!validateCPF(cpf)) {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  if (!phone) {
    return res.status(400).json({ error: 'Celular é obrigatório' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const meetLink = role === 'patient' ? `https://meet.google.com/${Math.random().toString(36).substring(2, 12)}` : null;
    const accepted = role === 'psychologist' ? 1 : 0; // Patients need acceptance
    
    const stmt = db.prepare('INSERT INTO users (name, email, password, role, meet_link, psychologist_id, phone, cpf, accepted, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)');
    const info = stmt.run(name, email, hashedPassword, role, meetLink, psychologist_id || null, phone || null, cpf || null, accepted);
    
    // Send welcome email
    sendWelcomeEmail(email, name, role).catch(console.error);
    
    res.json({ id: info.lastInsertRowid, message: 'User created' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.deleted) {
    return res.status(403).json({ error: 'This account has been deactivated.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, psychologist_id: user.psychologist_id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      psychologist_id: user.psychologist_id,
      accepted: user.accepted,
      crp: user.crp,
      cpf: user.cpf
    } 
  });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user: any = db.prepare('SELECT id, name FROM users WHERE email = ? AND deleted = 0').get(email);

  if (!user) {
    return res.json({ message: 'Se o email estiver cadastrado, você receberá uma nova senha.' });
  }

  const tempPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = bcrypt.hashSync(tempPassword, 10);

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

  // Send password reset email
  sendPasswordResetEmail(email, user.name, tempPassword).catch(console.error);

  res.json({ message: 'Se o email estiver cadastrado, você receberá uma nova senha.' });
});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  const user: any = db.prepare('SELECT id, name, email, role, price_per_session, meet_link, psychologist_id, phone, accepted, crp, cpf FROM users WHERE id = ?').get(req.user.id);
  
  if (user.role === 'patient' && user.psychologist_id) {
    const psychologist = db.prepare('SELECT name FROM users WHERE id = ?').get(user.psychologist_id) as any;
    if (psychologist) {
      user.psychologist_name = psychologist.name;
    }
  }
  
  res.json(user);
});

// Patients (Psychologist only)
app.post('/api/patients/select-psychologist', authenticate, (req: any, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can select a psychologist' });
  
  const { psychologist_id } = req.body;
  if (!psychologist_id) return res.status(400).json({ error: 'Psychologist ID is required' });

  // Verify psychologist exists
  const psychologist = db.prepare("SELECT id, name, meet_link FROM users WHERE id = ? AND role = 'psychologist'").get(psychologist_id) as any;
  if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });

  // Update user
  db.prepare('UPDATE users SET psychologist_id = ?, accepted = 0 WHERE id = ?').run(psychologist_id, req.user.id);
  
  // Return updated user info
  const updatedUser = db.prepare('SELECT id, name, email, role, price_per_session, meet_link, psychologist_id, phone, accepted FROM users WHERE id = ?').get(req.user.id) as any;
  updatedUser.psychologist_name = psychologist.name;
  
  res.json({ message: 'Psychologist selected', user: updatedUser });
});

// Update Profile (Self)
app.put('/api/patients/me', authenticate, (req: any, res) => {
  const { name, phone, password, psychologist_id, crp, cpf } = req.body;
  
  if (cpf !== undefined && !validateCPF(cpf)) {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  if (name !== undefined) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  }

  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
  }
  
  if (phone !== undefined) {
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
  }

  if (cpf !== undefined) {
    db.prepare('UPDATE users SET cpf = ? WHERE id = ?').run(cpf, req.user.id);
  }

  if (crp !== undefined && req.user.role === 'psychologist') {
    db.prepare('UPDATE users SET crp = ? WHERE id = ?').run(crp, req.user.id);
  }

  // If changing psychologist, reset accepted status
  if (psychologist_id && psychologist_id !== req.user.psychologist_id && req.user.role === 'patient') {
     db.prepare('UPDATE users SET psychologist_id = ?, accepted = 0 WHERE id = ?').run(psychologist_id, req.user.id);
  }

  res.json({ message: 'Profile updated' });
});

app.delete('/api/patients/me', authenticate, (req: any, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can delete their account' });

  const userId = req.user.id;
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as any;
  const today = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();

  // Soft delete user and rename email to free it up
  const newEmail = `deleted_${timestamp}_${user.email}`;
  db.prepare('UPDATE users SET deleted = 1, email = ? WHERE id = ?').run(newEmail, userId);

  // Cancel future appointments
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE patient_id = ? AND date >= ?").run(userId, today);

  res.json({ message: 'Account deleted and future appointments cancelled.' });
});

app.get('/api/patients/pending', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const patients = db.prepare("SELECT id, name, email, phone, cpf FROM users WHERE role = 'patient' AND psychologist_id = ? AND accepted = 0 AND deleted = 0").all(req.user.id);
  res.json(patients);
});

app.post('/api/patients/:id/accept', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  
  // Verify patient belongs to psychologist
  const patient: any = db.prepare('SELECT psychologist_id FROM users WHERE id = ?').get(req.params.id);
  if (!patient || patient.psychologist_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const today = new Date().toISOString().split('T')[0];

  // Accept patient
  db.prepare('UPDATE users SET accepted = 1, price_per_session = 0, meet_link = NULL WHERE id = ?').run(req.params.id);

  // Cancel future appointments (they belonged to the previous therapist context or were pending)
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE patient_id = ? AND date >= ?").run(req.params.id, today);

  res.json({ message: 'Patient accepted. Future appointments cancelled and profile reset for new therapist.' });
});

app.get('/api/patients', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const patients = db.prepare("SELECT id, name, email, price_per_session, meet_link, phone, cpf FROM users WHERE role = 'patient' AND psychologist_id = ? AND accepted = 1 AND deleted = 0").all(req.user.id);
  res.json(patients);
});

app.put('/api/patients/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  
  // Verify patient belongs to psychologist
  const patient: any = db.prepare('SELECT psychologist_id FROM users WHERE id = ?').get(req.params.id);
  if (!patient || patient.psychologist_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { price_per_session, meet_link, effective_date } = req.body;
  
  if (price_per_session !== undefined) {
    if (!effective_date) return res.status(400).json({ error: 'Effective date is required when changing price' });
    
    // Get current price before updating
    const currentUser = db.prepare('SELECT price_per_session FROM users WHERE id = ?').get(req.params.id) as any;
    const oldPrice = currentUser?.price_per_session || 0;

    // Update past appointments that have NULL price to use the OLD price
    // This "locks in" the history before we change the user's default price
    db.prepare("UPDATE appointments SET price = ? WHERE patient_id = ? AND date < ? AND price IS NULL").run(oldPrice, req.params.id, effective_date);

    // Update user's default price and history
    db.prepare('UPDATE users SET price_per_session = ?, previous_price = ?, price_effective_date = ? WHERE id = ?')
      .run(price_per_session, oldPrice, effective_date, req.params.id);
    
    // Update future appointments to use the NEW price
    db.prepare("UPDATE appointments SET price = ? WHERE patient_id = ? AND date >= ? AND status != 'cancelled'").run(price_per_session, req.params.id, effective_date);
  }
  
  if (meet_link !== undefined) {
    db.prepare('UPDATE users SET meet_link = ? WHERE id = ?').run(meet_link, req.params.id);
  }
  
  res.json({ message: 'Patient updated' });
});

// Settings
app.get('/api/settings', authenticate, (req: any, res) => {
  const targetId = req.user.role === 'psychologist' ? req.user.id : req.user.psychologist_id;
  if (!targetId) return res.json({ session_duration: 60, work_on_holidays: 0 });
  
  const settings = db.prepare('SELECT session_duration, work_on_holidays FROM users WHERE id = ?').get(targetId);
  res.json(settings || { session_duration: 60, work_on_holidays: 0 });
});

app.put('/api/settings', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const { session_duration, work_on_holidays } = req.body;
  
  if (session_duration !== undefined) {
    db.prepare('UPDATE users SET session_duration = ? WHERE id = ?').run(session_duration, req.user.id);
  }
  
  if (work_on_holidays !== undefined) {
    db.prepare('UPDATE users SET work_on_holidays = ? WHERE id = ?').run(work_on_holidays ? 1 : 0, req.user.id);
  }
  
  res.json({ message: 'Settings updated' });
});

// Holidays & Absences
app.get('/api/holidays', authenticate, (req: any, res) => {
  const holidays = db.prepare('SELECT * FROM holidays').all();
  res.json(holidays);
});

app.get('/api/absences', authenticate, (req: any, res) => {
  const targetId = req.user.role === 'psychologist' ? req.user.id : req.user.psychologist_id;
  const absences = db.prepare('SELECT * FROM absences WHERE psychologist_id = ?').all(targetId);
  res.json(absences);
});

app.post('/api/absences', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const { start_date, end_date, reason, start_time, end_time, is_all_day } = req.body;
  const isAllDayInt = is_all_day ? 1 : 0;
  db.prepare('INSERT INTO absences (start_date, end_date, reason, start_time, end_time, is_all_day, psychologist_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(start_date, end_date, reason, start_time || null, end_time || null, isAllDayInt, req.user.id);
  res.json({ message: 'Absence added' });
});

app.delete('/api/absences/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM absences WHERE id = ? AND psychologist_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Absence removed' });
});

// Availability
app.get('/api/patient/psychologist-schedule', authenticate, (req: any, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Forbidden' });
  
  // Get patient's psychologist
  const patient = db.prepare('SELECT psychologist_id FROM users WHERE id = ?').get(req.user.id) as any;
  if (!patient || !patient.psychologist_id) return res.json([]);

  // Get all busy slots (appointments) for this psychologist
  const busySlots = db.prepare(`
    SELECT date, start_time 
    FROM appointments 
    WHERE psychologist_id = ? AND status != 'cancelled'
  `).all(patient.psychologist_id);

  res.json(busySlots);
});

app.get('/api/availability', authenticate, (req: any, res) => {
  const targetId = req.user.role === 'psychologist' ? req.user.id : req.user.psychologist_id;
  const availability = db.prepare('SELECT * FROM availability WHERE psychologist_id = ?').all(targetId);
  res.json(availability);
});

app.post('/api/availability', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const { day_of_week, start_time, end_time } = req.body;
  
  db.prepare('INSERT INTO availability (day_of_week, start_time, end_time, psychologist_id) VALUES (?, ?, ?, ?)').run(day_of_week, start_time, end_time, req.user.id);
  res.json({ message: 'Availability added' });
});

app.delete('/api/availability/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM availability WHERE id = ? AND psychologist_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Availability removed' });
});

// Appointments
app.get('/api/appointments', authenticate, (req: any, res) => {
  let appointments;
  if (req.user.role === 'psychologist') {
    appointments = db.prepare(`
      SELECT a.*, u.name as patient_name, u.meet_link, u.price_per_session
      FROM appointments a 
      JOIN users u ON a.patient_id = u.id
      WHERE a.psychologist_id = ?
    `).all(req.user.id);
  } else {
    appointments = db.prepare(`
      SELECT a.*, u.meet_link, u.price_per_session
      FROM appointments a 
      JOIN users u ON a.patient_id = u.id 
      WHERE patient_id = ?
    `).all(req.user.id);
  }
  res.json(appointments);
});

app.post('/api/appointments', authenticate, (req: any, res) => {
  console.log('[POST /api/appointments] Body:', req.body);
  const { date, start_time, end_time, is_recurring } = req.body;
  const patient_id = req.user.id;
  
  try {
    // Validate inputs
    if (!date || !start_time || !end_time) {
      throw new Error('Missing required fields');
    }

    // Get patient's psychologist and price info
    const patient = db.prepare('SELECT psychologist_id, price_per_session, previous_price, price_effective_date FROM users WHERE id = ?').get(patient_id) as any;
    if (!patient || !patient.psychologist_id) return res.status(400).json({ error: 'Patient not linked to a psychologist' });
    const psychologist_id = patient.psychologist_id;
    
    // Determine the correct price based on the appointment date
    let price = patient.price_per_session;
    if (patient.price_effective_date && date < patient.price_effective_date) {
      price = patient.previous_price || 0;
    }

    // Rule: Prevent booking in the past
    let isPast = false;
    if (req.body.client_date && req.body.client_time) {
      if (date < req.body.client_date) {
        isPast = true;
      } else if (date === req.body.client_date && start_time < req.body.client_time) {
        isPast = true;
      }
    } else {
      const now = new Date();
      const appointmentDateTime = parseISO(`${date}T${start_time}`);
      if (appointmentDateTime < now) {
        isPast = true;
      }
    }

    if (isPast) {
      return res.status(400).json({ error: 'Cannot book appointments in the past' });
    }

    // Check if slot is available (for this psychologist)
    const existing = db.prepare("SELECT * FROM appointments WHERE psychologist_id = ? AND date = ? AND start_time = ? AND status != 'cancelled'").get(psychologist_id, date, start_time);
    if (existing) return res.status(400).json({ error: 'Time slot already booked' });

    const insert = db.prepare('INSERT INTO appointments (patient_id, psychologist_id, date, start_time, end_time, is_recurring, price) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    insert.run(patient_id, psychologist_id, date, start_time, end_time, is_recurring ? 1 : 0, price);
    
    if (is_recurring) {
      const { frequency } = req.body; // 'weekly' or 'biweekly'
      const intervalWeeks = frequency === 'biweekly' ? 2 : 1;
      const currentYear = getYear(parseISO(date));
      
      let nextDate = addWeeks(parseISO(date), intervalWeeks);
      
      // Create appointments for the rest of the year
      while (getYear(nextDate) === currentYear) {
        const nextDateStr = format(nextDate, 'yyyy-MM-dd');
        
        // Check availability for future dates (simplified)
        const futureExisting = db.prepare("SELECT * FROM appointments WHERE psychologist_id = ? AND date = ? AND start_time = ? AND status != 'cancelled'").get(psychologist_id, nextDateStr, start_time);
        if (!futureExisting) {
          insert.run(patient_id, psychologist_id, nextDateStr, start_time, end_time, 1, price);
        }
        
        nextDate = addWeeks(nextDate, intervalWeeks);
      }
    }
    
    // Simulate sending email
    console.log(`[EMAIL MOCK] Sending invite to Psychologist ID ${psychologist_id} and Patient ID ${patient_id} for ${date} at ${start_time}`);
    
    res.json({ message: 'Appointment booked' });
  } catch (err: any) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

app.delete('/api/appointments/:id', authenticate, (req: any, res) => {
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as any;
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  const clientDate = req.query.client_date || format(new Date(), 'yyyy-MM-dd');
  
  // Rule: Past appointments can only be deleted by psychologist
  if (appointment.date < clientDate && req.user.role !== 'psychologist') {
    return res.status(403).json({ error: 'Only the psychologist can delete past appointments' });
  }

  // Rule: Today's appointments cannot be deleted by patient
  if (appointment.date === clientDate && req.user.role !== 'psychologist') {
    return res.status(403).json({ error: 'Patients cannot delete appointments for the current day' });
  }

  // Rule: Future appointments can be deleted by both (but patient must own it)
  if (req.user.role === 'patient' && appointment.patient_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Rule: Psychologist can only delete their own appointments
  if (req.user.role === 'psychologist' && appointment.psychologist_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Appointment deleted' });
});

app.put('/api/appointments/:id/payment', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  
  // Verify appointment belongs to psychologist
  const appointment: any = db.prepare('SELECT psychologist_id FROM appointments WHERE id = ?').get(req.params.id);
  if (!appointment || appointment.psychologist_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { status } = req.body; // 'paid' or 'pending'
  db.prepare('UPDATE appointments SET payment_status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Payment status updated' });
});

app.put('/api/reports/pay', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const { patient_id, month, year } = req.body;
  const likeDate = `${year}-${month}-%`;
  
  db.prepare(`
    UPDATE appointments 
    SET payment_status = 'paid' 
    WHERE patient_id = ? AND date LIKE ? AND status = 'scheduled' AND payment_status = 'pending'
  `).run(patient_id, likeDate);
  
  res.json({ message: 'Marked as paid' });
});

// Reports
app.get('/api/reports', authenticate, (req: any, res) => {
  const { month, year } = req.query; // e.g., month=02, year=2026
  const likeDate = `${year}-${month}-%`;
  
  if (req.user.role === 'psychologist') {
    const report = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.price_per_session, 
        COUNT(CASE WHEN a.status = 'scheduled' THEN 1 END) as session_count, 
        SUM(CASE WHEN a.status = 'scheduled' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_due,
        SUM(CASE WHEN a.payment_status = 'paid' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_paid,
        SUM(CASE WHEN a.payment_status = 'pending' AND a.status = 'scheduled' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_pending
      FROM appointments a
      JOIN users u ON a.patient_id = u.id
      WHERE a.psychologist_id = ? AND a.date LIKE ?
      GROUP BY u.id
    `).all(req.user.id, likeDate);
    res.json(report);
  } else {
    const report = db.prepare(`
      SELECT 
        u.price_per_session, 
        COUNT(CASE WHEN a.status = 'scheduled' THEN 1 END) as session_count, 
        SUM(CASE WHEN a.status = 'scheduled' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_due,
        SUM(CASE WHEN a.payment_status = 'paid' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_paid,
        SUM(CASE WHEN a.payment_status = 'pending' AND a.status = 'scheduled' THEN COALESCE(a.price, u.price_per_session) ELSE 0 END) as total_pending
      FROM users u
      LEFT JOIN appointments a ON u.id = a.patient_id AND a.date LIKE ?
      WHERE u.id = ?
      GROUP BY u.id
    `).get(likeDate, req.user.id);
    res.json(report || { session_count: 0, total_due: 0, total_paid: 0, total_pending: 0 });
  }
});

// Checkout Routes for Patients
app.get('/api/checkout/unpaid', authenticate, (req: any, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Forbidden' });

  const unpaidSessions = db.prepare(`
    SELECT 
      strftime('%m', date) as month,
      strftime('%Y', date) as year,
      COUNT(*) as session_count,
      SUM(COALESCE(price, 0)) as total_value
    FROM appointments
    WHERE patient_id = ? AND payment_status = 'pending' AND status = 'scheduled'
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `).all(req.user.id);

  res.json(unpaidSessions);
});

app.post('/api/checkout/pay', authenticate, (req: any, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Forbidden' });
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'Month and Year are required' });

  const likeDate = `${year}-${month.toString().padStart(2, '0')}-%`;
  
  db.prepare(`
    UPDATE appointments 
    SET payment_status = 'paid' 
    WHERE patient_id = ? AND date LIKE ? AND status = 'scheduled' AND payment_status = 'pending'
  `).run(req.user.id, likeDate);
  
  res.json({ message: 'Payment successful' });
});

// Therapist Platform Checkout Routes
app.get('/api/therapist/platform-checkout/unpaid', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });

  // Get psychologist's current commission rate
  const psychologist = db.prepare('SELECT commission_percentage FROM users WHERE id = ?').get(req.user.id) as any;
  const commissionRate = psychologist?.commission_percentage || 1.0;

  // Get all months where there are paid sessions
  const revenueByMonth = db.prepare(`
    SELECT 
      CAST(strftime('%m', date) AS INTEGER) as month,
      CAST(strftime('%Y', date) AS INTEGER) as year,
      SUM(price) as total_revenue
    FROM appointments
    WHERE psychologist_id = ? AND payment_status = 'paid' AND status = 'scheduled'
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `).all(req.user.id) as any[];

  // Get total already paid for each month
  const paidByMonth = db.prepare(`
    SELECT month, year, SUM(amount) as total_paid
    FROM platform_payments
    WHERE psychologist_id = ?
    GROUP BY year, month
  `).all(req.user.id) as any[];

  // Calculate unpaid amounts
  const unpaidMonths = revenueByMonth.map(rev => {
    const paid = paidByMonth.find(p => p.month === rev.month && p.year === rev.year);
    const totalPaid = paid?.total_paid || 0;
    const totalCommissionDue = (rev.total_revenue * commissionRate) / 100.0;
    const remainingAmount = totalCommissionDue - totalPaid;

    return {
      month: rev.month.toString().padStart(2, '0'),
      year: rev.year.toString(),
      total_revenue: rev.total_revenue,
      remaining_revenue: remainingAmount / (commissionRate / 100.0),
      total_commission_due: totalCommissionDue,
      total_paid: totalPaid,
      remaining_amount: Math.max(0, remainingAmount)
    };
  }).filter(m => m.remaining_amount > 0.01); // Filter out months that are fully paid (with small epsilon)

  // Get payment history
  const history = db.prepare(`
    SELECT * FROM platform_payments 
    WHERE psychologist_id = ? 
    ORDER BY payment_date DESC, id DESC
  `).all(req.user.id);

  res.json({
    unpaidMonths,
    commission_rate: commissionRate,
    history
  });
});

app.post('/api/therapist/platform-checkout/pay', authenticate, (req: any, res) => {
  if (req.user.role !== 'psychologist') return res.status(403).json({ error: 'Forbidden' });
  const { month, year, amount, revenue, commission_rate } = req.body;

  if (!month || !year || amount === undefined) return res.status(400).json({ error: 'Missing payment details' });

  const now = new Date();
  const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  try {
    db.prepare(`
      INSERT INTO platform_payments (psychologist_id, month, year, amount, revenue, commission_rate, payment_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, parseInt(month), parseInt(year), amount, revenue, commission_rate, today);
    
    res.json({ message: 'Platform payment successful' });
  } catch (err: any) {
    console.error('Error recording platform payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Admin Routes ---

app.get('/api/admin/users', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare("SELECT id, name, email, role, password, deleted, commission_percentage, cpf FROM users").all();
  res.json(users);
});

app.put('/api/admin/users/:id/commission', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { commission_percentage } = req.body;
  
  const targetUser: any = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role !== 'psychologist') return res.status(400).json({ error: 'Commission only applies to psychologists' });

  db.prepare('UPDATE users SET commission_percentage = ? WHERE id = ?').run(commission_percentage, req.params.id);
  res.json({ message: 'Commission updated' });
});

app.put('/api/admin/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { email, password } = req.body;
  const targetUser: any = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
  
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role === 'admin') return res.status(403).json({ error: 'Cannot modify admin' });

  if (email) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.params.id);
  }
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
  }
  res.json({ message: 'User updated' });
});

app.delete('/api/admin/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const targetUser: any = db.prepare('SELECT role, email FROM users WHERE id = ?').get(req.params.id);
  
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' });

  const timestamp = Date.now();
  const newEmail = `deleted_${timestamp}_${targetUser.email}`;
  db.prepare('UPDATE users SET deleted = 1, email = ? WHERE id = ?').run(newEmail, req.params.id);
  
  // Cancel future appointments
  const today = new Date().toISOString().split('T')[0];
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE (patient_id = ? OR psychologist_id = ?) AND date >= ?").run(req.params.id, req.params.id, today);

  res.json({ message: 'User deleted' });
});

app.patch('/api/admin/users/:id/status', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { deleted } = req.body;
  const targetUser: any = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
  
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role === 'admin') return res.status(403).json({ error: 'Cannot modify admin' });

  db.prepare('UPDATE users SET deleted = ? WHERE id = ?').run(deleted ? 1 : 0, req.params.id);
  
  // If deactivating, cancel future appointments
  if (deleted) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE (patient_id = ? OR psychologist_id = ?) AND date >= ?").run(req.params.id, req.params.id, today);
  }

  res.json({ message: `User ${deleted ? 'deactivated' : 'activated'}` });
});

app.get('/api/admin/reports/billing', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { month, year, paymentStatus } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'Month and Year are required' });

  const datePrefix = `${year}-${month.toString().padStart(2, '0')}`;
  
  let paymentFilter = "";
  const params: any[] = [`${datePrefix}%`];

  if (paymentStatus === 'paid') {
    paymentFilter = "AND a.payment_status = 'paid'";
  } else if (paymentStatus === 'pending') {
    paymentFilter = "AND a.payment_status = 'pending'";
  } else {
    // 'both' or default
    paymentFilter = "AND a.payment_status IN ('paid', 'pending')";
  }

  // Report 1: Billing by Patient/Therapist
  const billingData = db.prepare(`
    SELECT 
      p.name as patient_name,
      t.name as psychologist_name,
      COUNT(a.id) as session_count,
      a.price as unit_price,
      SUM(a.price) as total_value
    FROM appointments a
    JOIN users p ON a.patient_id = p.id
    JOIN users t ON a.psychologist_id = t.id
    WHERE a.date LIKE ? ${paymentFilter} AND a.status != 'cancelled'
    GROUP BY p.id, t.id, a.price
  `).all(...params);

  // Report 2: Billing by Therapist
  const therapistData = db.prepare(`
    SELECT 
      t.name as psychologist_name,
      COUNT(a.id) as session_count,
      AVG(a.price) as avg_price,
      SUM(a.price) as total_value
    FROM appointments a
    JOIN users t ON a.psychologist_id = t.id
    WHERE a.date LIKE ? ${paymentFilter} AND a.status != 'cancelled'
    GROUP BY t.id
  `).all(...params);

  res.json({ billingData, therapistData });
});

app.get('/api/admin/reports/commissions', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { month, year, status } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'Month and Year are required' });

  const monthInt = parseInt(month as string);
  const yearInt = parseInt(year as string);
  const datePrefix = `${year}-${month.toString().padStart(2, '0')}%`;

  // Get all psychologists who had appointments in this period OR are not deleted
  const psychologists = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.commission_percentage 
    FROM users u
    LEFT JOIN appointments a ON u.id = a.psychologist_id AND a.date LIKE ?
    WHERE u.role = 'psychologist' AND (u.deleted = 0 OR a.id IS NOT NULL)
  `).all(datePrefix) as any[];

  const commissionReport: any[] = [];

  psychologists.forEach(p => {
    // Calculate total revenue from PAID sessions for this month
    const revenueData = db.prepare(`
      SELECT SUM(price) as total_revenue
      FROM appointments
      WHERE psychologist_id = ? AND date LIKE ? AND payment_status = 'paid' AND status != 'cancelled'
    `).get(p.id, datePrefix) as any;

    const totalCurrentRevenue = revenueData?.total_revenue || 0;
    const totalCommissionDue = (totalCurrentRevenue * (p.commission_percentage || 1.0)) / 100;

    // Get all platform payments for this month
    const payments = db.prepare(`
      SELECT id, payment_date, amount, revenue
      FROM platform_payments
      WHERE psychologist_id = ? AND month = ? AND year = ?
    `).all(p.id, monthInt, yearInt) as any[];

    const totalPaidAmount = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaidRevenue = payments.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

    // Add an entry for each individual payment
    payments.forEach(pay => {
      commissionReport.push({
        psychologist_id: p.id,
        psychologist_name: p.name,
        commission_percentage: p.commission_percentage || 1.0,
        total_revenue: pay.revenue || 0,
        commission_amount: pay.amount,
        status: 'paid',
        payment_date: pay.payment_date,
        paid_amount: pay.amount
      });
    });

    // If there's a pending balance, add a "Pending" entry
    const pendingCommission = totalCommissionDue - totalPaidAmount;
    const pendingRevenue = totalCurrentRevenue - totalPaidRevenue;

    if (pendingCommission > 0.01) {
      commissionReport.push({
        psychologist_id: p.id,
        psychologist_name: p.name,
        commission_percentage: p.commission_percentage || 1.0,
        total_revenue: Math.max(0, pendingRevenue),
        commission_amount: pendingCommission,
        status: 'pending',
        payment_date: null,
        paid_amount: 0
      });
    }
  });

  // Filter by status if requested
  let filteredReport = commissionReport;
  if (status === 'paid') {
    filteredReport = commissionReport.filter(r => r.status === 'paid');
  } else if (status === 'pending') {
    filteredReport = commissionReport.filter(r => r.status === 'pending');
  }

  res.json(filteredReport);
});

// --- AbacatePay Integration ---

// Create Checkout Session (PIX)
app.post('/api/checkout/create', authenticate, async (req: any, res) => {
  const { months } = req.body; // Array of { month, year, amount, revenue }
  const userId = req.user.id;

  if (!months || !Array.isArray(months) || months.length === 0) {
    return res.status(400).json({ error: 'No months selected' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalAmount = months.reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const amountInCents = Math.round(totalAmount * 100);
    const description = `Comissão PsyQ - ${months.length} mês(es)`;

    // Create PIX Charge
    const charge = await createPixCharge(amountInCents, description, {
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf
    });

    // Save Transaction
    db.prepare(`
      INSERT INTO payment_transactions (id, psychologist_id, amount, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      charge.id,
      userId,
      amountInCents,
      'PENDING',
      JSON.stringify(months)
    );

    res.json(charge);
  } catch (error: any) {
    console.error('Checkout Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check Transaction Status
app.get('/api/checkout/status/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const transaction = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id) as any;
  
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json({ status: transaction.status });
});

// Simulate Payment (Dev/Test only)
app.post('/api/checkout/simulate/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await simulatePixPayment(id);
    res.json(result);
  } catch (error: any) {
    console.error('Simulation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook for AbacatePay
app.post('/api/webhooks/abacatepay', express.json(), (req, res) => {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  const receivedSecret = req.headers['x-abacatepay-secret'];

  if (secret && receivedSecret !== secret) {
    console.warn('Invalid AbacatePay Webhook Secret received');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body;
  console.log('AbacatePay Webhook:', JSON.stringify(event, null, 2));

  // Payload structure depends on AbacatePay. Assuming { data: { id, status, ... } } or similar.
  // Based on docs, it might be the same object as create response.
  // Let's assume event.data contains the charge info.
  
  const charge = event.data || event; // Fallback
  const chargeId = charge.id;
  const status = charge.status;

  if (!chargeId || !status) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const transaction = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(chargeId) as any;

  if (transaction) {
    // Update transaction status
    db.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?').run(status, chargeId);

    if (status === 'PAID' && transaction.status !== 'PAID') {
      // Process Payment
      const months = JSON.parse(transaction.metadata);
      const psychologistId = transaction.psychologist_id;
      const paymentDate = new Date().toISOString().split('T')[0];

      const insertPayment = db.prepare(`
        INSERT INTO platform_payments (psychologist_id, month, year, amount, revenue, commission_rate, status, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const m of months) {
          // Check if already paid to avoid duplicates
          const existing = db.prepare('SELECT id FROM platform_payments WHERE psychologist_id = ? AND month = ? AND year = ?').get(psychologistId, m.month, m.year);
          if (!existing) {
             // Get current commission rate from user or use the one from request (stored in metadata?)
             // We'll use the one from the time of checkout request if possible, but we didn't store it in metadata explicitly.
             // Let's fetch user again or assume 1.0 if not found.
             // Better: store commission_rate in metadata. But for now, fetch user.
             const user = db.prepare('SELECT commission_percentage FROM users WHERE id = ?').get(psychologistId) as any;
             const rate = user?.commission_percentage || 1.0;

             insertPayment.run(
               psychologistId,
               m.month,
               m.year,
               m.amount,
               m.revenue,
               rate,
               'paid',
               paymentDate
             );
          }
        }
      })();
      console.log(`Payment processed for transaction ${chargeId}`);
    }
  }

  res.json({ received: true });
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
