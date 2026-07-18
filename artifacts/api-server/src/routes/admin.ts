import { Router, Request, Response } from "express";
import { eq, desc, count } from "drizzle-orm";
import {
  db,
  keysTable,
  loginHistoryTable,
  notificationsTable,
  appSettingsTable,
} from "@workspace/db";
import { randomUUID } from "crypto";
import { createHmac } from "crypto";
import cookieParser from "cookie-parser";

export const adminRouter = Router();
adminRouter.use(cookieParser());

const ADMIN_TOKEN_COOKIE = "ap_admin_token";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env["SESSION_SECRET"] || "aujunpeak-admin-secret-fallback";
}

function getAdminCreds(): { username: string; password: string } {
  return {
    username: process.env["ADMIN_USERNAME"] || "admin",
    password: process.env["ADMIN_PASSWORD"] || "admin123",
  };
}

function signToken(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeToken(): string {
  const ts = Date.now();
  const rand = randomUUID();
  const payload = `${ts}:${rand}`;
  const sig = signToken(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 3) return false;
    const ts = parseInt(parts[0]);
    if (isNaN(ts) || Date.now() - ts > TOKEN_TTL_MS) return false;
    const payload = parts.slice(0, 2).join(":");
    const sig = parts[2];
    const expected = signToken(payload);
    return sig === expected;
  } catch {
    return false;
  }
}

function requireAdminAuth(req: Request, res: Response, next: Function) {
  const token = req.cookies?.[ADMIN_TOKEN_COOKIE];
  if (token && verifyToken(token)) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

function generateKey(type: string): string {
  const prefix = type === "vip" ? "VIP" : type === "custom" ? "CUSTOM" : "FREE";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) suffix += "-";
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

/** POST /admin/api/login */
adminRouter.post("/api/login", (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  const creds = getAdminCreds();
  if (username !== creds.username || password !== creds.password) {
    return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
  }
  const token = makeToken();
  res.cookie(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: TOKEN_TTL_MS,
    secure: process.env["NODE_ENV"] === "production",
  });
  return res.json({ ok: true });
});

/** POST /admin/api/logout */
adminRouter.post("/api/logout", (_req: Request, res: Response) => {
  res.clearCookie(ADMIN_TOKEN_COOKIE);
  return res.json({ ok: true });
});

/** GET /admin/api/check */
adminRouter.get("/api/check", (req: Request, res: Response) => {
  const token = req.cookies?.[ADMIN_TOKEN_COOKIE];
  return res.json({ authenticated: !!(token && verifyToken(token)) });
});

/** GET /admin/api/stats */
adminRouter.get("/api/stats", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const [totalKeys] = await db.select({ c: count() }).from(keysTable);
    const [vipKeys] = await db.select({ c: count() }).from(keysTable).where(eq(keysTable.type, "vip"));
    const [freeKeys] = await db.select({ c: count() }).from(keysTable).where(eq(keysTable.type, "free"));
    const [customKeys] = await db.select({ c: count() }).from(keysTable).where(eq(keysTable.type, "custom"));
    const [lockedKeys] = await db.select({ c: count() }).from(keysTable).where(eq(keysTable.isLocked, true));
    const [totalLogins] = await db.select({ c: count() }).from(loginHistoryTable);
    const [totalNotifs] = await db.select({ c: count() }).from(notificationsTable);
    return res.json({
      totalKeys: totalKeys.c,
      vipKeys: vipKeys.c,
      freeKeys: freeKeys.c,
      customKeys: customKeys.c,
      lockedKeys: lockedKeys.c,
      totalLogins: totalLogins.c,
      totalNotifs: totalNotifs.c,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /admin/api/keys */
adminRouter.get("/api/keys", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const search = (req.query["search"] as string | undefined)?.trim().toLowerCase();
    const type = req.query["type"] as string | undefined;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 100, 500);
    const offset = parseInt(req.query["offset"] as string) || 0;

    let keys = await db.select().from(keysTable).orderBy(desc(keysTable.createdAt)).limit(limit).offset(offset);

    if (search) {
      keys = keys.filter(k =>
        k.keyValue.toLowerCase().includes(search) ||
        (k.notes || "").toLowerCase().includes(search)
      );
    }
    if (type && type !== "all") {
      keys = keys.filter(k => k.type === type);
    }

    return res.json(keys.map((k) => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    })));
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /admin/api/keys — create key (supports custom keyValue) */
adminRouter.post("/api/keys", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { type = "free", maxDevices = 1, expiryDate, notes, customKeyValue } = req.body as {
      type?: string;
      maxDevices?: number;
      expiryDate?: string;
      notes?: string;
      customKeyValue?: string;
    };
    const keyValue = customKeyValue?.trim() || generateKey(type);
    // check duplicate
    const [existing] = await db.select({ id: keysTable.id }).from(keysTable).where(eq(keysTable.keyValue, keyValue));
    if (existing) return res.status(409).json({ error: "Key value này đã tồn tại, vui lòng chọn key khác." });
    const [key] = await db.insert(keysTable).values({
      id: randomUUID(), keyValue, type, maxDevices: Number(maxDevices),
      expiryDate: expiryDate || null, notes: notes || null,
    }).returning();
    return res.status(201).json({ ...key, createdAt: key.createdAt.toISOString(), updatedAt: key.updatedAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT /admin/api/keys/:id — edit key */
adminRouter.put("/api/keys/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, maxDevices, expiryDate, notes, keyValue, isLocked } = req.body as {
      type?: string;
      maxDevices?: number;
      expiryDate?: string | null;
      notes?: string | null;
      keyValue?: string;
      isLocked?: boolean;
    };

    // If changing keyValue, check for duplicates
    if (keyValue?.trim()) {
      const [existing] = await db.select({ id: keysTable.id }).from(keysTable).where(eq(keysTable.keyValue, keyValue.trim()));
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: "Key value này đã được dùng bởi key khác." });
      }
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (type !== undefined) updateData["type"] = type;
    if (maxDevices !== undefined) updateData["maxDevices"] = Number(maxDevices);
    if (expiryDate !== undefined) updateData["expiryDate"] = expiryDate || null;
    if (notes !== undefined) updateData["notes"] = notes || null;
    if (keyValue?.trim()) updateData["keyValue"] = keyValue.trim();
    if (isLocked !== undefined) updateData["isLocked"] = isLocked;

    const [updated] = await db.update(keysTable).set(updateData).where(eq(keysTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Key không tồn tại" });
    return res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /admin/api/keys/all — xóa tất cả keys */
adminRouter.delete("/api/keys/all", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    await db.delete(loginHistoryTable);
    const deleted = await db.delete(keysTable).returning({ id: keysTable.id });
    return res.json({ success: true, deletedCount: deleted.length });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /admin/api/keys/:id — xóa key */
adminRouter.delete("/api/keys/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(loginHistoryTable).where(eq(loginHistoryTable.keyId, id));
    await db.delete(keysTable).where(eq(keysTable.id, id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /admin/api/keys/:id/lock */
adminRouter.post("/api/keys/:id/lock", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [updated] = await db.update(keysTable).set({ isLocked: true, updatedAt: new Date() }).where(eq(keysTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Key không tồn tại" });
    return res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /admin/api/keys/:id/unlock */
adminRouter.post("/api/keys/:id/unlock", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [updated] = await db.update(keysTable).set({ isLocked: false, updatedAt: new Date() }).where(eq(keysTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Key không tồn tại" });
    return res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /admin/api/notifications */
adminRouter.get("/api/notifications", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const notifs = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(100);
    return res.json(notifs.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })));
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /admin/api/notifications */
adminRouter.post("/api/notifications", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { target, title, body } = req.body as { target: string; title: string; body: string };
    if (!target || !title || !body) return res.status(400).json({ error: "target, title, body are required" });
    const [notif] = await db.insert(notificationsTable).values({ id: randomUUID(), target, title, body, read: false }).returning();
    return res.status(201).json({ ...notif, createdAt: notif.createdAt.toISOString() });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /admin/api/notifications/:id */
adminRouter.delete("/api/notifications/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /admin/api/notifications — xóa tất cả thông báo */
adminRouter.delete("/api/notifications", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    await db.delete(notificationsTable);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /admin/api/settings/free-key-link */
adminRouter.get("/api/settings/free-key-link", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const [setting] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "free_key_link"));
    return res.json({ link: setting?.value || "" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT /admin/api/settings/free-key-link */
adminRouter.put("/api/settings/free-key-link", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { link } = req.body as { link: string };
    if (!link) return res.status(400).json({ error: "link is required" });
    await db.insert(appSettingsTable).values({ key: "free_key_link", value: link, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: link, updatedAt: new Date() } });
    return res.json({ link });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /admin/api/login-history */
adminRouter.get("/api/login-history", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const keyValue = req.query["key"] as string | undefined;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
    const history = keyValue
      ? await db.select().from(loginHistoryTable).where(eq(loginHistoryTable.keyValue, keyValue)).orderBy(desc(loginHistoryTable.createdAt)).limit(limit)
      : await db.select().from(loginHistoryTable).orderBy(desc(loginHistoryTable.createdAt)).limit(limit);
    return res.json(history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })));
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});
