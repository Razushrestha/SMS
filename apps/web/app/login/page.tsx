"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Role = "admin" | "employee" | "student";

const roles: Array<{ id: Role; label: string; icon: string; hint: string }> = [
  { id: "admin", label: "Admin", icon: "fa-light fa-user-tie", hint: "Admin email" },
  { id: "employee", label: "Employee", icon: "fa-light fa-users", hint: "Employee username" },
  { id: "student", label: "Student", icon: "fa-light fa-graduation-cap", hint: "Student username" },
];

const promoCopy: Record<Role, { title: string; body: string }> = {
  admin: {
    title: "Continue Managing!",
    body: "Pick up right where you left off. Sign in to NEPATRONIX SMS for your school dashboard, fees, attendance, and staff portal.",
  },
  employee: {
    title: "Staff Portal Access",
    body: "Use the username your administrator created for you. Check attendance, salary status, and school updates from your employee portal.",
  },
  student: {
    title: "Student Portal Access",
    body: "Sign in with your student username to view attendance, fees, homework, and exams assigned by your school.",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nepatronix-login-role");
      if (saved === "admin" || saved === "employee" || saved === "student") setRole(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("email") ?? "").trim();
    if ((role === "employee" || role === "student") && identifier.includes("@")) {
      setError(`Use your ${role} username, not an email address.`);
      setPending(false);
      return;
    }
    if (role === "admin" && !identifier.includes("@")) {
      setError("Admin login needs an email address.");
      setPending(false);
      return;
    }
    try {
      const session = await api<{ user: { role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: identifier,
          password: form.get("password"),
        }),
      });
      if (remember) {
        try {
          localStorage.setItem("nepatronix-login-role", role);
        } catch {
          /* ignore */
        }
      }
      router.push(session.user.role === "platform" ? "/platform" : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  const hint = roles.find((item) => item.id === role)?.hint ?? "Username";
  const promo = promoCopy[role];

  return (
    <main className="esk-login">
      <div className="esk-login-shell">
        <section className="esk-login-panel">
          <Link href="/" className="esk-login-brand">
            <i className="fa-light fa-graduation-cap" />
            <span>NEPATRONIX SMS</span>
          </Link>
          <p className="esk-login-lead">
            Please enter your credentials to access your school dashboard.
            <br />
            <span>
              <strong>Welcome</strong> Back!
            </span>
          </p>
          {role === "admin" ? (
            <p className="mb-3 text-xs text-[var(--esk-muted)]">
              NEPATRONIX platform operators sign in here with their platform email and open the subscriptions console automatically.
            </p>
          ) : null}

          <h4 className="esk-login-youre">You&apos;re</h4>
          <div className="esk-login-roles" role="radiogroup" aria-label="Login as">
            {roles.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`esk-login-role ${role === item.id ? "active" : ""}`}
                onClick={() => {
                  setRole(item.id);
                  setForgotOpen(false);
                  setError("");
                }}
                aria-pressed={role === item.id}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {forgotOpen ? (
            <div className="esk-login-forgot-box">
              <h4>Forgot Password</h4>
              <p>
                {role === "admin"
                  ? "School admin recovery is handled by NEPATRONIX Platform. Ask your operator for a password reset or support login link."
                  : "Students and employees should contact their administrator for login details."}
              </p>
              <button type="button" className="esk-login-text-btn" onClick={() => setForgotOpen(false)}>
                Back to login
              </button>
            </div>
          ) : (
            <form className="esk-login-form" onSubmit={onSubmit} key={role}>
              <label className="esk-login-field">
                <i className="fa-light fa-user" />
                <input name="email" type="text" placeholder={`${hint}*`} required autoComplete="username" />
              </label>
              <label className="esk-login-field">
                <i className="fa-light fa-lock" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your Password*"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="esk-login-eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <i className={`fa-light ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </label>

              <div className="esk-login-row">
                <label className="esk-login-remember">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span className="esk-login-switch" aria-hidden />
                  Remember Me
                </label>
              </div>

              {error ? <p className="esk-login-error">{error}</p> : null}

              <button className="esk-login-submit" type="submit" disabled={pending}>
                <i className="fa-light fa-lock" />
                {pending ? "Logging in…" : "Login"}
              </button>
            </form>
          )}

          {!forgotOpen ? (
            <button type="button" className="esk-login-forgot" onClick={() => setForgotOpen(true)}>
              Forgot your <strong>password?</strong>
            </button>
          ) : null}
        </section>

        <aside className="esk-login-promo">
          <div className="esk-login-promo-top">
            <span>Don&apos;t have an account?</span>
            <Link href="/register" className="esk-login-signup">
              <i className="fa-light fa-lock" /> Sign Up
            </Link>
          </div>
          <div className="esk-login-promo-copy">
            <h3>{promo.title}</h3>
            <p>{promo.body}</p>
          </div>
          <div className="esk-login-art" aria-hidden>
            <div className="esk-login-art-orb" />
            <div className="esk-login-art-card">
              <i
                className={`fa-light ${
                  role === "student" ? "fa-graduation-cap" : role === "employee" ? "fa-users" : "fa-shield-check"
                }`}
              />
              <span>
                {role === "student"
                  ? "Student portal access"
                  : role === "employee"
                    ? "Staff portal access"
                    : "Secure school access"}
              </span>
            </div>
            <div className="esk-login-art-lock">
              <i className="fa-light fa-lock" />
            </div>
            <div className="esk-login-art-cap">
              <i className="fa-light fa-graduation-cap" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
