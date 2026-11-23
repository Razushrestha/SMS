"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";

function SupportLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This support link is missing a token.");
      return;
    }
    api<{ user: { role: string } }>("/auth/support-login", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((session) => {
        router.replace(session.user.role === "platform" ? "/platform" : "/admin");
      })
      .catch((err: Error) => setError(err.message));
  }, [token, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#f4f7fb_0%,#eef2f7_45%,#f8fafc_100%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <Link href="/login" className="text-sm text-[var(--esk-muted)] hover:underline">
          ← Sign in
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Support login</h1>
        {error ? (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--esk-muted)]">Opening the school admin session…</p>
        )}
      </div>
    </main>
  );
}

export default function SupportLoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm text-[var(--esk-muted)]">Loading…</main>}>
      <SupportLoginInner />
    </Suspense>
  );
}
