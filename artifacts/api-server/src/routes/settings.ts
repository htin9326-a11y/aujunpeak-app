import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";

export const settingsRouter = Router();

const FREE_KEY_LINK_KEY = "free_key_link";

/** GET /api/settings/free-key-link */
settingsRouter.get("/free-key-link", async (req: Request, res: Response) => {
  try {
    const [setting] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, FREE_KEY_LINK_KEY));
    return res.json({ link: setting?.value || "" });
  } catch (err) {
    req.log.error({ err }, "Error getting free key link");
    return res.status(500).json({ error: "Internal server error" });
  }
});
