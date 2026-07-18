import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { keysRouter } from "./keys";
import { notificationsRouter } from "./notifications";
import { settingsRouter } from "./settings";
import { loginHistoryRouter } from "./loginHistory";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/keys", keysRouter);
router.use("/notifications", notificationsRouter);
router.use("/settings", settingsRouter);
router.use("/login-history", loginHistoryRouter);

export default router;
