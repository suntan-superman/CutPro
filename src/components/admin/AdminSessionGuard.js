"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADMIN_ACTIVITY_STORAGE_KEY,
  getAdminIdleState,
  formatIdleRemaining,
} from "@/lib/adminIdle";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "mousemove", "scroll", "touchstart", "focus"];
const ACTIVITY_WRITE_INTERVAL_MS = 10 * 1000;

export default function AdminSessionGuard() {
  const [lastActivity, setLastActivity] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const lastWrittenActivity = useRef(0);
  const logoutStarted = useRef(false);

  const logout = useCallback(async (reason = "manual") => {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    setIsLoggingOut(true);
    try {
      window.localStorage.removeItem(ADMIN_ACTIVITY_STORAGE_KEY);
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // The protected server layout still requires a valid session if the request
      // cannot complete, so navigation remains safe even during a network error.
    } finally {
      window.location.replace(reason === "timeout" ? "/admin/login?reason=timeout" : "/admin/login");
    }
  }, []);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWrittenActivity.current < ACTIVITY_WRITE_INTERVAL_MS) return;
    lastWrittenActivity.current = now;
    window.localStorage.setItem(ADMIN_ACTIVITY_STORAGE_KEY, String(now));
    setLastActivity(now);
    setShowWarning(false);
  }, []);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(ADMIN_ACTIVITY_STORAGE_KEY);
    if (storedValue === null) {
      // A browser session that predates this guard must re-authenticate rather
      // than receive a fresh idle window with no evidence of recent activity.
      logout("timeout");
      return undefined;
    }
    const stored = Number(storedValue);
    const state = getAdminIdleState(stored);
    if (state.expired) {
      logout("timeout");
      return undefined;
    }

    const initialActivity = stored;
    lastWrittenActivity.current = initialActivity;
    const initialization = window.setTimeout(() => setLastActivity(initialActivity), 0);
    const handleStorage = (event) => {
      if (event.key !== ADMIN_ACTIVITY_STORAGE_KEY) return;
      if (!event.newValue) {
        logout("manual");
        return;
      }
      const next = Number(event.newValue);
      if (!Number.isFinite(next)) return;
      lastWrittenActivity.current = next;
      setLastActivity(next);
      setShowWarning(false);
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearTimeout(initialization);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", handleStorage);
    };
  }, [logout, recordActivity]);

  useEffect(() => {
    if (!lastActivity) return undefined;
    const update = () => {
      const state = getAdminIdleState(lastActivity);
      setRemainingSeconds(state.remainingSeconds);
      setShowWarning(state.warning);
      if (state.expired) logout("timeout");
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [lastActivity, logout]);

  const staySignedIn = () => {
    lastWrittenActivity.current = Date.now();
    window.localStorage.setItem(ADMIN_ACTIVITY_STORAGE_KEY, String(lastWrittenActivity.current));
    setLastActivity(lastWrittenActivity.current);
    setShowWarning(false);
  };

  if (!showWarning || isLoggingOut) return null;

  return (
    <div className="admin-session-overlay" role="presentation">
      <section className="admin-session-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-session-title">
        <p className="eyebrow">Security reminder</p>
        <h2 id="admin-session-title">Still working in the owner portal?</h2>
        <p>
          You will be signed out in <strong>{formatIdleRemaining(remainingSeconds)}</strong> because there has been no activity.
          Save any changes you are editing, then stay signed in to continue.
        </p>
        <div className="admin-session-actions">
          <button type="button" className="button button-primary" onClick={staySignedIn}>Stay signed in</button>
          <button type="button" className="button button-outline" onClick={() => logout("manual")}>Sign out now</button>
        </div>
      </section>
    </div>
  );
}
