export type NavChild = { label: string; href: string };
export type NavItem = {
  label: string;
  href?: string;
  icon: string;
  children?: NavChild[];
};

export const nav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "fa-light fa-house" },
  { label: "AI Assistant", href: "/admin/assistant", icon: "fa-light fa-sparkles" },
  {
    label: "General Settings",
    icon: "fa-light fa-gear",
    children: [
      { label: "Institute Profile", href: "/admin/settings/institute" },
      { label: "Theme & Language", href: "/admin/settings/school" },
      { label: "Account Settings", href: "/admin/settings/account" },
      { label: "Roles & Permissions", href: "/admin/settings/roles" },
      { label: "Build phases", href: "/admin/phases" },
      { label: "Plan", href: "/admin/plan" },
    ],
  },
  {
    label: "Classes",
    icon: "fa-light fa-pencil-ruler",
    children: [
      { label: "All Classes", href: "/admin/classes" },
      { label: "New Class", href: "/admin/classes" },
    ],
  },
  {
    label: "Subjects",
    icon: "fa-light fa-book",
    children: [
      { label: "Classes With Subjects", href: "/admin/subjects" },
      { label: "Assign Subjects", href: "/admin/subjects" },
    ],
  },
  {
    label: "Students",
    icon: "fa-light fa-user",
    children: [
      { label: "All Students", href: "/admin/students" },
      { label: "Add New", href: "/admin/students/new" },
      { label: "Manage Families", href: "/admin/families" },
      { label: "Active / Inactive", href: "/admin/students/status" },
      { label: "Admission Letter", href: "/admin/students/letter" },
      { label: "Student ID Cards", href: "/admin/students/cards" },
      { label: "Print Basic List", href: "/admin/students/list" },
      { label: "Manage Login", href: "/admin/students/login" },
      { label: "Promote Students", href: "/admin/students/promote" },
      { label: "Students info report", href: "/admin/students/report" },
      { label: "Parents info report", href: "/admin/students/contacts" },
    ],
  },
  {
    label: "Employees",
    icon: "fa-light fa-briefcase",
    children: [
      { label: "All Employees", href: "/admin/employees" },
      { label: "Staff ID Cards", href: "/admin/employees/cards" },
      { label: "Staff report", href: "/admin/employees/report" },
      { label: "Roles & Permissions", href: "/admin/settings/roles" },
    ],
  },
  {
    label: "Accounts",
    icon: "fa-light fa-wallet",
    children: [
      { label: "Chart Of Account", href: "/admin/accounts" },
      { label: "Account Statement", href: "/admin/accounts/statement" },
      { label: "Accounts Report", href: "/admin/accounts/report" },
      { label: "Customised Reports", href: "/admin/reports" },
      { label: "Audit", href: "/admin/audit" },
    ],
  },
  {
    label: "Fees",
    icon: "fa-light fa-money-bill",
    children: [
      { label: "Generate Fees Invoice", href: "/admin/fees/invoices" },
      { label: "Collect Fees", href: "/admin/fees" },
      { label: "Fees Paid Slip", href: "/admin/fees/slips" },
      { label: "Fees Defaulters", href: "/admin/fees/defaulters" },
      { label: "Fees Report", href: "/admin/fees/report" },
      { label: "Delete Fees", href: "/admin/fees/delete" },
      { label: "Fees Structure", href: "/admin/fees/structure" },
    ],
  },
  {
    label: "Salary",
    icon: "fa-light fa-credit-card",
    children: [
      { label: "Pay Salary", href: "/admin/salary" },
      { label: "Salary Paid Slip", href: "/admin/salary/slips" },
      { label: "Salary Sheet", href: "/admin/salary/sheet" },
      { label: "Salary Report", href: "/admin/salary/report" },
    ],
  },
  {
    label: "Attendance",
    icon: "fa-light fa-hand",
    children: [
      { label: "Students Attendance", href: "/admin/attendance" },
      { label: "Employees Attendance", href: "/admin/attendance/employees" },
      { label: "Class wise Report", href: "/admin/attendance/reports/classes" },
      { label: "Students Attendance Report", href: "/admin/attendance/reports" },
      { label: "Employees Attendance Report", href: "/admin/attendance/reports/employees" },
    ],
  },
  {
    label: "Timetable",
    icon: "fa-light fa-calendar",
    children: [
      { label: "Weekdays", href: "/admin/timetable/weekdays" },
      { label: "Time Periods", href: "/admin/timetable/periods" },
      { label: "Class Rooms", href: "/admin/timetable/rooms" },
      { label: "Create Timetable", href: "/admin/timetable" },
      { label: "Generate For Class", href: "/admin/timetable/class" },
      { label: "Generate For Teacher", href: "/admin/timetable/teacher" },
    ],
  },
  { label: "Homework", href: "/admin/homework", icon: "fa-light fa-book-open" },
  {
    label: "Behaviour & Skills",
    icon: "fa-light fa-eye",
    children: [{ label: "Rate Behaviours", href: "/admin/behaviour" }],
  },
  {
    label: "Online Store & POS",
    icon: "fa-light fa-cart-shopping",
    children: [{ label: "Products", href: "/admin/store" }],
  },
  { label: "Messaging", href: "/admin/messages", icon: "fa-light fa-comment" },
  {
    label: "SMS Services",
    icon: "fa-light fa-envelope",
    children: [
      { label: "Free SMS Gateway", href: "/admin/sms" },
      { label: "Branded SMS", href: "/admin/sms" },
      { label: "SMS Templates", href: "/admin/sms" },
    ],
  },
  { label: "Live Class", href: "/admin/live", icon: "fa-light fa-video" },
  { label: "Question Paper", href: "/admin/question-paper", icon: "fa-light fa-file-lines" },
  {
    label: "Exams",
    icon: "fa-light fa-pen-to-square",
    children: [
      { label: "Create New Exam", href: "/admin/exams" },
      { label: "Result Card", href: "/admin/report-cards" },
      { label: "Student Progress Report", href: "/admin/report-cards/progress" },
    ],
  },
  {
    label: "Class Tests",
    icon: "fa-light fa-file-lines",
    children: [
      { label: "Manage Test Marks", href: "/admin/tests" },
      { label: "Test Result", href: "/admin/tests" },
    ],
  },
  {
    label: "Reports",
    icon: "fa-light fa-file-lines",
    children: [
      { label: "Students report Card", href: "/admin/report-cards" },
      { label: "Customised Reports", href: "/admin/reports" },
      { label: "Accounts Report", href: "/admin/accounts/report" },
    ],
  },
  {
    label: "Certificates",
    icon: "fa-light fa-medal",
    children: [
      { label: "Generate Certificate", href: "/admin/certificates" },
      { label: "Certificate Templates", href: "/admin/certificates/templates" },
    ],
  },
  {
    label: "Devices",
    icon: "fa-light fa-microchip",
    children: [
      { label: "RFID", href: "/admin/rfid" },
      { label: "GPS tracking", href: "/admin/gps" },
      { label: "Driver", href: "/admin/gps/drive" },
    ],
  },
];

/** Flat student portal menu — matches eSkooly StudentPortal labels/order (typo Recipt kept). */
export const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "fa-light fa-grip" },
  { label: "Admission Letter", href: "/admin/students/letter", icon: "fa-light fa-id-badge" },
  { label: "Paid Fee Recipt", href: "/admin/fees/slips", icon: "fa-light fa-receipt" },
  { label: "My Timetable", href: "/admin/timetable", icon: "fa-light fa-calendar" },
  { label: "My Report Card", href: "/admin/report-cards", icon: "fa-light fa-chart-bar" },
  { label: "Test Results", href: "/admin/tests", icon: "fa-light fa-chart-pie" },
  { label: "Exam Result", href: "/admin/exams", icon: "fa-light fa-pen" },
  { label: "Home Assignments", href: "/admin/homework", icon: "fa-light fa-book" },
  { label: "Online Store", href: "/admin/store", icon: "fa-light fa-cart-shopping" },
  { label: "Messaging", href: "/admin/messages", icon: "fa-light fa-comment" },
  { label: "Live Class", href: "/admin/live", icon: "fa-light fa-video" },
];

/** Parent portal menu — children progress, fees, bus, messages. */
export const parentNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "fa-light fa-grip" },
  { label: "Attendance", href: "/admin/attendance", icon: "fa-light fa-hand" },
  { label: "Paid Fee Recipt", href: "/admin/fees/slips", icon: "fa-light fa-receipt" },
  { label: "Timetable", href: "/admin/timetable", icon: "fa-light fa-calendar" },
  { label: "Report Card", href: "/admin/report-cards", icon: "fa-light fa-chart-bar" },
  { label: "Test Results", href: "/admin/tests", icon: "fa-light fa-chart-pie" },
  { label: "Exam Result", href: "/admin/exams", icon: "fa-light fa-pen" },
  { label: "Homework", href: "/admin/homework", icon: "fa-light fa-book" },
  { label: "Messaging", href: "/admin/messages", icon: "fa-light fa-comment" },
  { label: "Bus Tracking", href: "/admin/gps", icon: "fa-light fa-bus" },
];

export function hrefPath(href: string) {
  return href.split("?")[0] || href;
}

export function navPaths(item: NavItem) {
  if (item.href) return [hrefPath(item.href)];
  return (item.children ?? []).map((child) => hrefPath(child.href));
}
