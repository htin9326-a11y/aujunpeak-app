import { Router, Request, Response } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

export const notificationsRouter = Router();

/** GET /api/notifications?key=xxx */
notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const key = req.query["key"] as string | undefined;

    const notifications = key
      ? await db
          .select()
          .from(notificationsTable)
          .where(or(eq(notificationsTable.target, key), eq(notificationsTable.target, "all")))
          .orderBy(desc(notificationsTable.createdAt))
          .limit(50)
      : await db
          .select()
          .from(notificationsTable)
          .where(eq(notificationsTable.target, "all"))
          .orderBy(desc(notificationsTable.createdAt))
          .limit(50);

    return res.json(
      notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error getting notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});
