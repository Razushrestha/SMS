import Link from "next/link";

const links = [
  { href: "/admin/attendance", label: "Students" },
  { href: "/admin/attendance/employees", label: "Employees" },
  { href: "/admin/attendance/reports", label: "Student report" },
  { href: "/admin/attendance/reports/employees", label: "Employee report" },
  { href: "/admin/attendance/reports/classes", label: "Class-wise" },
];

export function AttendanceNav({ limited = false }: { limited?: boolean }) {
  if (limited) return null;
  return (
    <nav className="mb-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="esk-btn-ghost">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
