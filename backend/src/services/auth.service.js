import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../drizzle/schema.js';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function findUserByUsername(username) {
  return db.query.users.findFirst({ where: eq(users.username, username) });
}

export async function findUserByEmail(email) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function findUserById(id) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function createUser({ username, email, name, password, role = 'user' }) {
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    username,
    email,
    name: name || username,
    passwordHash,
    role,
  }).returning();
  return sanitizeUser(user);
}

export async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;
  if (!username || !password) {
    console.log('[bootstrap] ADMIN_USERNAME/ADMIN_PASSWORD no configurados, saltando bootstrap admin');
    return;
  }

  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      if (existing.role !== 'admin') {
        await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
        console.log(`[bootstrap] Usuario '${username}' promovido a admin`);
      } else {
        console.log(`[bootstrap] Admin '${username}' ya existe`);
      }
      return;
    }

    await createUser({
      username,
      email: email || `${username}@admin.local`,
      name: username,
      password,
      role: 'admin',
    });
    console.log(`[bootstrap] Admin '${username}' creado exitosamente`);
  } catch (err) {
    console.error('[bootstrap] Error:', err.message);
  }
}
