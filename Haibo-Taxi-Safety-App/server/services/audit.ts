import { db } from "../db";
import { adminAuditLog } from "../../shared/schema";
import { AuthRequest } from "../middleware/auth";

/**
 * Append an entry to admin_audit_log. Meant to be called from every admin
 * route that performs a destructive or state-changing operation. Failures
 * are logged but not thrown — the audit log is best-effort and should not
 * block the business action it's recording.
 *
 * Usage:
 *   await recordAdminAction(req, "withdrawal.approve", "withdrawal_request", id);
 *   await recordAdminAction(req, "moderation.update", resource, id, { patch });
 */
export async function recordAdminAction(
  req: AuthRequest,
  action: string,
  resource: string,
  resourceId: string | null,
  meta?: Record<string, any>
): Promise<void> {
  try {
    const user = req.user;
    if (!user?.userId) return; // should never happen on admin routes but bail safely

    // Prefer X-Forwarded-For (behind Azure app service / reverse proxies),
    // fall back to the direct socket address.
    const ipAddress =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    await db.insert(adminAuditLog).values({
      adminUserId: user.userId,
      adminPhone: user.phone || null,
      action,
      resource,
      resourceId,
      meta: meta || null,
      ipAddress,
    });
  } catch (err) {
    // Never let audit failures break the actual admin flow — just log.
    console.error("[Audit] Failed to record admin action:", err);
  }
}
