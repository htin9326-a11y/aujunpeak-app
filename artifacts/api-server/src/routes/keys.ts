import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, keysTable, loginHistoryTable } from "@workspace/db";
import { randomUUID } from "crypto";

export const keysRouter = Router();

/** GET /api/keys/status?key=VALUE — kiểm tra trạng thái key, không tạo login history */
keysRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const { key: keyValue } = req.query as { key?: string };

    if (!keyValue?.trim()) {
      return res.status(400).json({ error: "key is required" });
    }

    const [key] = await db.select().from(keysTable).where(eq(keysTable.keyValue, keyValue.trim()));

    if (!key) {
      return res.status(404).json({ valid: false, reason: "not_found", error: "Key không tồn tại." });
    }

    if (key.isLocked) {
      return res.status(403).json({ valid: false, reason: "locked", error: "Key đã bị khóa. Liên hệ admin để được hỗ trợ." });
    }

    if (key.expiryDate) {
      const expiry = new Date(key.expiryDate);
      if (expiry < new Date()) {
        return res.status(410).json({ valid: false, reason: "expired", error: "Key đã hết hạn. Vui lòng gia hạn key." });
      }
    }

    return res.json({ valid: true, key: {
      ...key,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    }});
  } catch (err) {
    req.log.error({ err }, "Error checking key status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/keys/verify */
keysRouter.post("/verify", async (req: Request, res: Response) => {
  try {
    const { keyValue, deviceId, userAgent, ipAddress } = req.body as {
      keyValue: string;
      deviceId: string;
      userAgent?: string;
      ipAddress?: string;
    };

    if (!keyValue?.trim() || !deviceId?.trim()) {
      return res.status(400).json({ error: "keyValue and deviceId are required" });
    }

    const ip =
      ipAddress ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    const [key] = await db.select().from(keysTable).where(eq(keysTable.keyValue, keyValue.trim()));

    if (!key) {
      return res.status(404).json({ error: "Key không tồn tại. Kiểm tra lại key của bạn." });
    }

    if (key.isLocked) {
      return res.status(403).json({ error: "Key đã bị khóa. Liên hệ admin để được hỗ trợ." });
    }

    if (key.expiryDate) {
      const expiry = new Date(key.expiryDate);
      if (expiry < new Date()) {
        return res.status(410).json({ error: "Key đã hết hạn. Vui lòng gia hạn key." });
      }
    }

    const existingHistory = await db
      .select({ deviceId: loginHistoryTable.deviceId })
      .from(loginHistoryTable)
      .where(eq(loginHistoryTable.keyId, key.id));

    const uniqueDevices = new Set(existingHistory.map((h) => h.deviceId));
    const isNewDevice = !uniqueDevices.has(deviceId);

    if (isNewDevice && uniqueDevices.size >= key.maxDevices) {
      return res.status(429).json({
        error: `Key này chỉ cho phép ${key.maxDevices} thiết bị. Đã đạt giới hạn.`,
      });
    }

    await db.insert(loginHistoryTable).values({
      id: randomUUID(),
      keyId: key.id,
      keyValue: key.keyValue,
      deviceId,
      userAgent: userAgent || null,
      ipAddress: ip || null,
      action: "Login",
    });

    if (isNewDevice) {
      await db
        .update(keysTable)
        .set({ deviceCount: uniqueDevices.size + 1, updatedAt: new Date() })
        .where(eq(keysTable.id, key.id));
    }

    return res.json({
      key: {
        ...key,
        createdAt: key.createdAt.toISOString(),
        updatedAt: key.updatedAt.toISOString(),
      },
      isNewDevice,
    });
  } catch (err) {
    req.log.error({ err }, "Error verifying key");
    return res.status(500).json({ error: "Internal server error" });
  }
});
