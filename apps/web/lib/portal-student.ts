"use client";

import { useEffect, useState } from "react";
import { api, type PortalStudent, type SessionUser } from "@/lib/api";

export function usePortalStudent() {
  const [role, setRole] = useState<string | null>(null);
  const [me, setMe] = useState<PortalStudent | null>(null);
  const [children, setChildren] = useState<PortalStudent[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ user: SessionUser }>("/auth/me")
      .then(async (session) => {
        if (!alive) return;
        setRole(session.user.role);
        if (session.user.role !== "student" && session.user.role !== "parent") {
          setReady(true);
          return;
        }
        if (session.user.role === "parent") {
          const rows = await api<PortalStudent[]>("/students/children");
          if (!alive) return;
          setChildren(rows);
          setMe(rows[0] ?? null);
          setReady(true);
          return;
        }
        const row = await api<PortalStudent>("/students/me");
        if (!alive) return;
        setMe(row);
        setChildren([row]);
        setReady(true);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return {
    role,
    me,
    children,
    setMe,
    error,
    ready,
    isStudent: role === "student",
    isParent: role === "parent",
    isPortal: role === "student" || role === "parent",
  };
}
