"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "@/lib/api";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/auth/me")
      .then((data) => {
        if (data.user.role !== "platform") {
          router.replace("/admin");
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  if (!user) {
    return <main className="grid min-h-screen place-items-center text-sm text-[var(--esk-muted)]">Loading platform…</main>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f4f7fb_0%,#eef2f7_45%,#f8fafc_100%)] text-[var(--esk-ink)]">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/platform" className="flex items-center gap-2 font-semibold tracking-tight">
              <i className="fa-light fa-building-shield text-[var(--esk-purple)]" />
              NEPATRONIX Platform
            </Link>
            <nav className="hidden items-center gap-2 text-sm sm:flex">
              <Link className={`rounded px-2 py-1 ${pathname === "/platform" ? "bg-black/5" : "hover:bg-black/5"}`} href="/platform">
                Schools
              </Link>
              <Link className={`rounded px-2 py-1 ${pathname === "/platform/schools/new" ? "bg-black/5" : "hover:bg-black/5"}`} href="/platform/schools/new">
                Create
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--esk-muted)]">{user.email}</span>
            <button className="esk-btn-ghost" type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
