"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "@/lib/api";
import { hrefPath, nav, navPaths, parentNav, studentNav, type NavItem } from "@/lib/nav";
import { canOpen, roleLabel } from "@/lib/roles";
import { contactNepatronixMailto } from "@/lib/support";

type Preferences = { direction: string; sidebar: string; header: string; activeColor: string; language: string };
type FeeReminder = { estimated: string; symbol: string; message: string };

const staffPortalRoles = new Set(["principal", "teacher", "accountant", "store_manager", "employee"]);
const studentPortalRoles = new Set(["student"]);
const parentPortalRoles = new Set(["parent"]);
const staffHiddenMenus = new Set(["AI Assistant", "Online Store & POS", "SMS Services", "Devices", "Homework"]);

function visibleNav(role: string) {
  if (studentPortalRoles.has(role)) {
    return studentNav.filter((item) => !item.href || canOpen(role, item.href));
  }
  if (parentPortalRoles.has(role)) {
    return parentNav.filter((item) => !item.href || canOpen(role, item.href));
  }
  const items = nav
    .map((item) => {
      if (item.href) return canOpen(role, item.href) ? item : null;
      const children = (item.children ?? []).filter((child) => canOpen(role, child.href));
      return children.length ? { ...item, children } : null;
    })
    .filter(Boolean) as NavItem[];
  if (staffPortalRoles.has(role)) {
    return items.filter((item) => !staffHiddenMenus.has(item.label) && item.label !== "General Settings");
  }
  return items;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [theme, setTheme] = useState<Preferences>({ direction: "ltr", sidebar: "dark", header: "dark", activeColor: "teal", language: "English" });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; name: string; registrationNo: string; className: string }> | null>(null);
  const [instituteOpen, setInstituteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [feeReminder, setFeeReminder] = useState<FeeReminder | null>(null);
  const [emptyNote, setEmptyNote] = useState("");

  useEffect(() => {
    api<{ user: SessionUser }>("/auth/me")
      .then((data) => {
        if (data.user.role === "platform") {
          router.replace("/platform");
          return;
        }
        setUser(data.user);
        if (data.user.subscription?.blocked && pathname !== "/admin/plan") {
          router.replace("/admin/plan");
        }
        if (data.user.role === "student" || data.user.role === "parent") {
          api<{
            studentPortal?: { fees?: { paidThisMonth?: boolean; monthly?: string }; feeReminder?: FeeReminder | null };
            parentPortal?: { feeReminder?: FeeReminder | null };
            symbol?: string;
          }>("/dashboard")
            .then((dash) => {
              if (dash.parentPortal?.feeReminder) {
                setFeeReminder(dash.parentPortal.feeReminder);
                return;
              }
              if (dash.studentPortal?.feeReminder) {
                setFeeReminder(dash.studentPortal.feeReminder);
                return;
              }
              if (dash.studentPortal?.fees && !dash.studentPortal.fees.paidThisMonth) {
                const symbol = dash.symbol ?? "$";
                const estimated = dash.studentPortal.fees.monthly ?? "0";
                setFeeReminder({
                  estimated,
                  symbol,
                  message: `This Month Fee is Not Paid Yet. Your estimated fee of This Month is ${symbol} ${Number(estimated).toLocaleString("en-US", { maximumFractionDigits: 0 })}. Please Pay your fee before due date.`,
                });
              } else {
                setFeeReminder(null);
              }
            })
            .catch(() => undefined);
        }
      })
      .catch(() => router.replace("/login"));
    function loadTheme() {
      api<Preferences>("/institute/preferences").then(setTheme).catch(() => undefined);
    }
    loadTheme();
    api<{ institute: { logoUrl: string | null } }>("/institute")
      .then((data) => {
        setLogoUrl(data.institute.logoUrl);
        setLogoBroken(false);
      })
      .catch(() => undefined);
    window.addEventListener("school-preferences", loadTheme);
    return () => window.removeEventListener("school-preferences", loadTheme);
  }, [router, pathname]);

  useEffect(() => {
    if (!user || !canOpen(user.role, "/admin/students")) return;
    const text = query.trim();
    if (!text) {
      setHits(null);
      return;
    }
    const handle = window.setTimeout(() => {
      api<Array<{ id: string; name: string; registrationNo: string; className: string }>>(`/students/lookup?q=${encodeURIComponent(text)}`)
        .then(setHits)
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, user]);

  useEffect(() => {
    setSidebarOpen(false);
    setInstituteOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function fullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  if (!user) {
    return <main className="grid min-h-screen place-items-center text-sm text-[var(--esk-muted)]">Loading your institute…</main>;
  }

  const items = visibleNav(user.role).filter((item) => {
    const text = menuQuery.trim().toLowerCase();
    if (!text) return true;
    if (item.label.toLowerCase().includes(text)) return true;
    return (item.children ?? []).some((child) => child.label.toLowerCase().includes(text));
  });
  const isStudent = studentPortalRoles.has(user.role);
  const isParent = parentPortalRoles.has(user.role);
  const staffPortal = staffPortalRoles.has(user.role) || isStudent || isParent;
  const canSearch = canOpen(user.role, "/admin/students") && !isStudent && !isParent;

  function isOpen(item: NavItem) {
    if (openMenus.includes(item.label)) return true;
    return navPaths(item).some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  return (
    <div className={`esk-shell${staffPortal ? " staff-portal" : ""}`} dir={theme.direction === "rtl" ? "rtl" : "ltr"}>
      <header className="esk-header">
        <div className="esk-header-left">
          <button className="esk-header-btn" type="button" aria-label="Menu" onClick={() => setSidebarOpen((open) => !open)}>
            <i className="fa-duotone fa-solid fa-bars" />
          </button>
          <Link href="/admin" className="esk-header-brand">
            {logoUrl && !logoUrl.startsWith("data:") && !logoBroken ? (
              <img src={logoUrl} alt="" className="esk-header-logo" onError={() => setLogoBroken(true)} />
            ) : (
              <i className="fa-light fa-graduation-cap esk-header-logo-icon" />
            )}
            <span>NEPATRONIX SMS</span>
          </Link>
          {canSearch ? (
            <div className="relative">
              <input
                className="esk-header-search"
                name="studentSearch"
                value={query}
                placeholder="Search Student"
                onChange={(event) => setQuery(event.target.value)}
              />
              {hits ? (
                <div className="esk-dropdown left-0 right-auto w-72">
                  {hits.length ? hits.map((hit) => (
                    <button key={hit.id} type="button" onClick={() => router.push(`/admin/students/${hit.id}`)}>
                      {hit.name} · {hit.registrationNo} · {hit.className}
                    </button>
                  )) : <p className="px-2 py-1 text-sm text-[var(--esk-muted)]">Student not found.</p>}
                </div>
              ) : null}
            </div>
          ) : null}
          <button className="esk-header-btn" type="button" aria-label="Fullscreen" onClick={fullscreen}>
            <i className="fa-duotone fa-solid fa-expand" />
          </button>
        </div>
        <div className="esk-header-spacer" />
        <div className="esk-header-right">
          {!staffPortal && canOpen(user.role, "/admin/settings/school") ? (
            <select
              className="esk-lang"
              name="language"
              value={theme.language}
              onChange={(event) => {
                const language = event.target.value;
                setTheme((current) => ({ ...current, language }));
                api("/institute/language", { method: "PATCH", body: JSON.stringify({ language }) }).catch(() => undefined);
              }}
            >
              {["English", "Nepali", "Hindi", "Urdu", "Arabic", "Bengali", "Chinese", "French", "Spanish", "Xhosa"].map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
          ) : null}
          {staffPortal ? null : (
            <button className="esk-header-btn" type="button" aria-label="Store" onClick={() => setEmptyNote("Nothing here.")}>
              <i className="fa-duotone fa-solid fa-bag-shopping" />
            </button>
          )}
          {canOpen(user.role, "/admin/messages") ? (
            <Link className="esk-header-btn" href="/admin/messages" aria-label="Messages">
              <i className="fa-duotone fa-solid fa-messages" />
            </Link>
          ) : null}
          {isStudent || isParent ? (
            <div className="relative">
              <button
                className="esk-header-btn relative"
                type="button"
                aria-label="Notifications"
                onClick={() => setNotifOpen((open) => !open)}
              >
                <i className="fa-duotone fa-solid fa-bell" />
                {feeReminder ? <span className="esk-notif-dot">{1}</span> : null}
              </button>
              {notifOpen ? (
                <div className="esk-dropdown right-0 left-auto w-80">
                  {feeReminder ? (
                    <div className="px-3 py-2 text-left text-sm">
                      <strong className="block text-[11px] uppercase tracking-wide text-[#ff5a79]">FEE REMINDER</strong>
                      <p className="mt-1 text-[13px] leading-snug text-[var(--esk-navy)]">{feeReminder.message}</p>
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-sm text-[var(--esk-muted)]">No notifications.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {staffPortal ? null : (
            <>
              <button className="esk-header-btn relative" type="button" aria-label="Notifications" onClick={() => setEmptyNote("Nothing here.")}>
                <i className="fa-duotone fa-solid fa-bell" />
              </button>
              <button className="esk-header-btn" type="button" aria-label="Cart" onClick={() => setEmptyNote("Nothing here.")}>
                <i className="fa-duotone fa-solid fa-cart-shopping" />
              </button>
            </>
          )}
          <div className="relative">
            <button className="esk-institute" type="button" onClick={() => setInstituteOpen((open) => !open)}>
              {staffPortal ? (
                <span className="esk-user-avatar-fallback"><i className="fa-light fa-user" /></span>
              ) : (
                <i className="fa-light fa-building-columns" />
              )}
              <span>{staffPortal ? user.name : user.instituteName}</span>
              <i className={`fa-${staffPortal ? "duotone fa-solid fa-angle-down" : "light fa-chevron-down"} text-[10px]`} />
            </button>
            {instituteOpen ? (
              <div className="esk-dropdown">
                {staffPortal ? null : <p className="px-2 py-1 text-xs text-[var(--esk-muted)]">{roleLabel(user.role)} · {user.name}</p>}
                {canOpen(user.role, "/admin/settings/account") ? <Link href="/admin/settings/account"><i className="fa-duotone fa-solid fa-gear mr-2" />Account Settings</Link> : null}
                {staffPortal ? null : canOpen(user.role, "/admin/settings/institute") ? <Link href="/admin/settings/institute"><i className="fa-light fa-building-columns mr-2" />Profile</Link> : null}
                <button type="button" onClick={() => void logout()}><i className="fa-duotone fa-solid fa-lock mr-2" />Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="esk-body">
        <aside className={`esk-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="esk-sidebar-inner">
            <div className="esk-menu-label">menu</div>
            <div className="esk-menu-search">
              <input value={menuQuery} placeholder="Search menu..." onChange={(event) => setMenuQuery(event.target.value)} />
            </div>
            <nav>
              {items.map((item) => {
                const active = item.href ? pathname === item.href : navPaths(item).some((path) => pathname === path || pathname.startsWith(`${path}/`));
                if (item.href) {
                  return (
                    <Link key={item.label} href={item.href} className={`esk-nav-link ${active ? "active" : ""}`}>
                      <span className="esk-nav-icon"><i className={item.icon} /></span>
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                const open = isOpen(item);
                return (
                  <div key={item.label}>
                    <button
                      className={`esk-nav-item ${active ? "active" : ""}`}
                      type="button"
                      onClick={() => setOpenMenus((current) => (current.includes(item.label) ? current.filter((name) => name !== item.label) : [...current, item.label]))}
                    >
                      <span className="esk-nav-icon"><i className={item.icon} /></span>
                      <span>{item.label}</span>
                      <span className="esk-nav-caret"><i className={open ? "fa-light fa-minus" : "fa-light fa-plus"} /></span>
                    </button>
                    {open ? (
                      <ul className="esk-subnav">
                        {item.children?.map((child) => (
                          <li key={`${item.label}-${child.label}-${child.href}`}>
                            <Link href={child.href} className={pathname === hrefPath(child.href) ? "active" : ""}>
                              <i className="fa-light fa-angle-right" />
                              <span>{child.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </nav>
            {staffPortal ? (
              <div className="esk-sidebar-foot">
                {canOpen(user.role, "/admin/settings/account") ? (
                  <Link href="/admin/settings/account" className={`esk-nav-link ${pathname === "/admin/settings/account" ? "active" : ""}`}>
                    <span className="esk-nav-icon"><i className="fa-light fa-gear" /></span>
                    <span>Account Settings</span>
                  </Link>
                ) : null}
                <button className="esk-nav-item" type="button" onClick={() => void logout()}>
                  <span className="esk-nav-icon"><i className="fa-light fa-lock" /></span>
                  <span>Log out</span>
                </button>
              </div>
            ) : null}
          </div>
        </aside>
        <div className="esk-main">
          {user.supportSession ? (
            <div className="mx-5 mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
              Support session — you are signed in as {user.email} via a NEPATRONIX platform support link. Log out when finished.
            </div>
          ) : null}
          {user.subscription?.message && user.subscription.health !== "ok" ? (
            <div
              className={`mx-5 mt-3 rounded-lg border px-3 py-2 text-sm ${
                user.subscription.blocked
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : user.subscription.health === "past_due" || user.subscription.health === "expiring"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-sky-200 bg-sky-50 text-sky-950"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>{user.subscription.message}</p>
                <div className="flex flex-wrap gap-3">
                  {canOpen(user.role, "/admin/plan") ? (
                    <Link className="underline" href="/admin/plan">
                      View plan
                    </Link>
                  ) : null}
                  <a
                    className="underline"
                    href={contactNepatronixMailto({
                      schoolName: user.instituteName,
                      planHealth: user.subscription.health,
                      topic: user.subscription.blocked ? "Restore access" : "Subscription help",
                    })}
                  >
                    Contact NEPATRONIX
                  </a>
                </div>
              </div>
            </div>
          ) : null}
          {emptyNote ? <p className="px-5 pt-3 text-sm text-[var(--esk-muted)]">{emptyNote}</p> : null}
          <div className="esk-content">
            {user.subscription?.blocked && pathname !== "/admin/plan" ? (
              <p className="text-sm text-[var(--esk-muted)]">Subscription locked. Open Plan for details.</p>
            ) : canOpen(user.role, pathname) ? (
              children
            ) : (
              <p className="text-sm text-[var(--esk-muted)]">This role cannot open that page.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
