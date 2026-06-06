import { eq, desc, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  brands,
  audits,
  auditCompetitors,
  type InsertBrand,
  type InsertAudit,
  type InsertAuditCompetitor,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export async function upsertBrand(data: InsertBrand) {
  const db = await getDb();
  if (!db) return null;
  await db
    .insert(brands)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        name: data.name,
        metaPageId: data.metaPageId,
        tiktokHandle: data.tiktokHandle,
        industry: data.industry,
        logoUrl: data.logoUrl,
      },
    });
  const result = await db.select().from(brands).where(eq(brands.slug, data.slug)).limit(1);
  return result[0] ?? null;
}

export async function getBrandBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function searchBrands(query: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(brands)
    .where(or(like(brands.name, `%${query}%`), like(brands.slug, `%${query}%`)))
    .limit(10);
}

// ─── Audits ───────────────────────────────────────────────────────────────────

export async function createAudit(data: InsertAudit) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(audits).values(data);
  const result = await db
    .select()
    .from(audits)
    .where(eq(audits.shareId, data.shareId!))
    .limit(1);
  return result[0] ?? null;
}

export async function updateAudit(id: number, data: Partial<InsertAudit>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(audits).set(data).where(eq(audits.id, id));
  const result = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAuditById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAuditByShareId(shareId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(audits).where(eq(audits.shareId, shareId)).limit(1);
  return result[0] ?? null;
}

export async function listRecentAudits(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(eq(audits.status, "complete"))
    .orderBy(desc(audits.createdAt))
    .limit(limit);
}

// ─── Audit Competitors ────────────────────────────────────────────────────────

export async function createAuditCompetitors(data: InsertAuditCompetitor[]) {
  const db = await getDb();
  if (!db) return [];
  if (data.length === 0) return [];
  await db.insert(auditCompetitors).values(data);
  return db
    .select()
    .from(auditCompetitors)
    .where(eq(auditCompetitors.auditId, data[0].auditId));
}

export async function getCompetitorsByAuditId(auditId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditCompetitors)
    .where(eq(auditCompetitors.auditId, auditId));
}

// ─── Account Access ───────────────────────────────────────────────────────────

import { accountAccess, type InsertAccountAccess } from "../drizzle/schema";

export async function createAccountAccess(data: InsertAccountAccess) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(accountAccess).values(data);
  const result = await db
    .select()
    .from(accountAccess)
    .where(eq(accountAccess.brandId, data.brandId))
    .orderBy(desc(accountAccess.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getAccountAccessByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(accountAccess)
    .where(eq(accountAccess.brandId, brandId))
    .orderBy(desc(accountAccess.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function updateAccountAccess(id: number, data: Partial<InsertAccountAccess>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(accountAccess).set(data).where(eq(accountAccess.id, id));
  const result = await db
    .select()
    .from(accountAccess)
    .where(eq(accountAccess.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function listAccountAccess() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accountAccess).orderBy(desc(accountAccess.createdAt));
}
