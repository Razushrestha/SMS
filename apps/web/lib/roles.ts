import { nav } from "@/lib/nav";

export const loginRoles = [
  { value: "admin", label: "Admin" },
  { value: "principal", label: "Principal" },
  { value: "teacher", label: "Teacher" },
  { value: "accountant", label: "Accountant" },
  { value: "store_manager", label: "Store Manager" },
  { value: "employee", label: "Employee" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "platform", label: "Platform" },
] as const;

const schoolMenus = [
  ...nav.flatMap((item) => (item.href ? [item.href] : (item.children ?? []).map((child) => child.href))),
].filter((href, index, list) => list.indexOf(href) === index && href !== "/admin/phases" && href !== "/admin/settings/roles");

export const menusByRole: Record<string, string[]> = {
  admin: ["*"],
  platform: ["/platform"],
  principal: schoolMenus,
  teacher: ["/admin", "/admin/assistant", "/admin/classes", "/admin/subjects", "/admin/students", "/admin/attendance", "/admin/homework", "/admin/exams", "/admin/tests", "/admin/report-cards", "/admin/certificates", "/admin/messages", "/admin/live", "/admin/question-paper", "/admin/timetable", "/admin/behaviour", "/admin/settings/account"],
  accountant: ["/admin", "/admin/assistant", "/admin/students", "/admin/families", "/admin/accounts", "/admin/fees", "/admin/salary", "/admin/sms", "/admin/reports", "/admin/audit", "/admin/settings/account"],
  store_manager: ["/admin", "/admin/assistant", "/admin/students", "/admin/store", "/admin/settings/account"],
  employee: ["/admin", "/admin/assistant", "/admin/attendance", "/admin/messages", "/admin/gps/drive", "/admin/settings/account"],
  student: ["/admin", "/admin/students/letter", "/admin/fees/slips", "/admin/timetable", "/admin/report-cards", "/admin/tests", "/admin/exams", "/admin/homework", "/admin/store", "/admin/messages", "/admin/live", "/admin/settings/account"],
  parent: ["/admin", "/admin/attendance", "/admin/fees/slips", "/admin/timetable", "/admin/report-cards", "/admin/tests", "/admin/exams", "/admin/homework", "/admin/messages", "/admin/gps", "/admin/settings/account"],
};

export function roleLabel(role: string) {
  return loginRoles.find((item) => item.value === role)?.label ?? role;
}

export function canOpen(role: string, path: string) {
  const clean = path.split("?")[0] || path;
  if (role === "platform") {
    return clean === "/platform" || clean.startsWith("/platform/");
  }
  if (role === "student") {
    if (clean === "/admin") return true;
    if (/^\/admin\/students\/[^/]+\/letter$/.test(clean)) return true;
    if (clean === "/admin/live" || clean.startsWith("/admin/live/")) return true;
    if (clean === "/admin/timetable" || clean.startsWith("/admin/timetable/")) return true;
    return (menusByRole.student ?? []).some((menu) => menu !== "/admin" && clean === menu);
  }
  if (role === "parent") {
    if (clean === "/admin") return true;
    if (clean === "/admin/gps" || clean.startsWith("/admin/gps/")) return true;
    if (clean === "/admin/timetable" || clean.startsWith("/admin/timetable/")) return true;
    return (menusByRole.parent ?? []).some((menu) => menu !== "/admin" && clean === menu);
  }
  const menus = menusByRole[role] ?? [];
  if (menus.includes("*")) return true;
  return menus.some((menu) => (menu === "/admin" ? clean === "/admin" : clean === menu || clean.startsWith(`${menu}/`)));
}

export function menusFor(role: string) {
  if ((menusByRole[role] ?? []).includes("*")) return nav.map((item) => item.label);
  return nav
    .filter((item) => (item.href ? canOpen(role, item.href) : (item.children ?? []).some((child) => canOpen(role, child.href))))
    .map((item) => item.label);
}
