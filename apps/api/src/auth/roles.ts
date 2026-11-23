export const loginRoles = ["admin", "principal", "teacher", "accountant", "store_manager", "employee", "student", "parent", "platform"] as const;

const schoolMenus = [
  "/admin",
  "/admin/settings/institute",
  "/admin/settings/school",
  "/admin/settings/account",
  "/admin/employees",
  "/admin/classes",
  "/admin/subjects",
  "/admin/students",
  "/admin/families",
  "/admin/accounts",
  "/admin/reports",
  "/admin/audit",
  "/admin/plan",
  "/admin/assistant",
  "/admin/fees",
  "/admin/salary",
  "/admin/attendance",
  "/admin/homework",
  "/admin/exams",
  "/admin/tests",
  "/admin/report-cards",
  "/admin/certificates",
  "/admin/messages",
  "/admin/live",
  "/admin/question-paper",
  "/admin/sms",
  "/admin/timetable",
  "/admin/behaviour",
  "/admin/store",
  "/admin/rfid",
  "/admin/gps",
  "/admin/gps/drive",
];

const learningMenus = ["/admin/homework", "/admin/exams", "/admin/tests", "/admin/report-cards", "/admin/certificates"];

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

const areas: Array<[string, string]> = [
  ["/employees", "/admin/employees"],
  ["/classes", "/admin/classes"],
  ["/subjects", "/admin/subjects"],
  ["/families", "/admin/families"],
  ["/students", "/admin/students"],
  ["/account-heads", "/admin/accounts"],
  ["/statement", "/admin/accounts"],
  ["/custom-reports", "/admin/reports"],
  ["/audit", "/admin/audit"],
  ["/plan", "/admin/plan"],
  ["/assistant", "/admin/assistant"],
  ["/fees", "/admin/fees"],
  ["/salary", "/admin/salary"],
  ["/attendance", "/admin/attendance"],
  ["/messages", "/admin/messages"],
  ["/meetings", "/admin/live"],
  ["/sms", "/admin/sms"],
  ["/timetable", "/admin/timetable"],
  ["/behaviour", "/admin/behaviour"],
  ["/store", "/admin/store"],
  ["/rfid", "/admin/rfid"],
  ["/gps/driver", "/admin/gps/drive"],
  ["/gps", "/admin/gps"],
  ["/institute", "/admin/settings/institute"],
  ["/users", "/admin/settings/roles"],
];

export function canCall(role: string, method: string, path: string) {
  const clean = path.replace(/^\/api/, "").split("?")[0];
  if (clean === "/auth/me" || clean === "/auth/logout" || clean === "/auth/verification" || clean === "/auth/verify") return true;
  if (role === "platform") {
    return clean === "/platform" || clean.startsWith("/platform/");
  }
  if (clean === "/auth/users" || clean.startsWith("/auth/users/")) return canOpen(role, "/admin/settings/roles");
  if (method === "GET" && (clean === "/institute" || clean === "/institute/preferences" || clean === "/summary")) return true;
  if (clean === "/dashboard") return true;
  if (clean === "/gps/locations") return role === "admin";
  if (clean === "/students/me" || clean === "/students/children") return role === "student" || role === "parent";
  if (clean === "/attendance/own") return role === "student" || role === "parent";
  if ((role === "student" || role === "parent") && (clean === "/attendance" || clean.startsWith("/attendance/"))) return false;
  if ((role === "student" || role === "parent") && method === "GET" && (clean === "/students" || clean === "/students/lookup" || clean === "/students/basic" || clean === "/students/meta" || clean === "/families" || clean === "/employees")) {
    return false;
  }
  if (role === "parent" && method === "GET" && (clean === "/classes" || clean === "/gps")) return false;
  if (role === "student" && method === "GET" && clean === "/classes") return false;
  if (method === "GET" && clean === "/fees/slip") {
    return canOpen(role, "/admin/fees") || canOpen(role, "/admin/fees/slips");
  }
  if (role === "parent" && method !== "GET" && (clean === "/messages" || clean.startsWith("/messages/") || clean === "/gps" || clean.startsWith("/gps/"))) {
    if (clean === "/messages" || /^\/messages\/[^/]+$/.test(clean) || /^\/messages\/[^/]+\/archive$/.test(clean)) {
      if (method === "POST" && clean === "/messages") return false;
      if (method === "POST" && /^\/messages\/[^/]+\/archive$/.test(clean)) return false;
      if (method === "DELETE" && /^\/messages\/[^/]+$/.test(clean)) return false;
    }
    if (clean === "/gps" || (clean.startsWith("/gps/") && !clean.startsWith("/gps/parent"))) return false;
  }
  if (method === "GET" && /^\/learning\/letters\/admission\/[^/]+$/.test(clean)) {
    return canOpen(role, "/admin/students/letter") || canOpen(role, "/admin/students");
  }
  if (clean === "/learning" || clean.startsWith("/learning/")) {
    if ((role === "student" || role === "parent") && method !== "GET") return false;
    return learningMenus.some((menu) => canOpen(role, menu));
  }
  if (role === "student" && method !== "GET" && (clean === "/meetings" || clean.startsWith("/meetings/") || clean === "/store" || clean.startsWith("/store/") || clean === "/timetable" || clean.startsWith("/timetable/"))) {
    return false;
  }
  if (role === "student") {
    if (method === "POST" && clean === "/messages") return false;
    if (method === "POST" && /^\/messages\/[^/]+\/archive$/.test(clean)) return false;
    if (method === "DELETE" && /^\/messages\/[^/]+$/.test(clean)) return false;
  }
  const area = areas.find(([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`));
  if (!area) return role === "admin";
  if ((clean.startsWith("/institute/preferences") || clean === "/institute/language") && method !== "GET") return canOpen(role, "/admin/settings/school");
  return canOpen(role, area[1]);
}
