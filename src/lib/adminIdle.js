export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_IDLE_WARNING_MS = 5 * 60 * 1000;
export const ADMIN_ACTIVITY_STORAGE_KEY = "cutpro.admin.lastActivity";

export function getAdminIdleState(lastActivity, now = Date.now()) {
  const activity = Number(lastActivity);
  if (!Number.isFinite(activity) || activity <= 0) {
    return { expired: true, warning: false, remainingMs: 0, remainingSeconds: 0 };
  }

  const remainingMs = ADMIN_IDLE_TIMEOUT_MS - Math.max(0, now - activity);
  return {
    expired: remainingMs <= 0,
    warning: remainingMs > 0 && remainingMs <= ADMIN_IDLE_WARNING_MS,
    remainingMs: Math.max(0, remainingMs),
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
  };
}

export function formatIdleRemaining(remainingSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(remainingSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
