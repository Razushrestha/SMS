import { eq } from "drizzle-orm";
import { parentStudents, students, type Database } from "@nepatronix/db";
import type { AuthUser } from "./current-user.decorator";

export async function linkedStudentIds(db: Database, user: AuthUser) {
  if (user.role === "student" && user.studentId) return new Set([user.studentId]);
  if (user.role === "parent") {
    const links = await db.select({ studentId: parentStudents.studentId }).from(parentStudents).where(eq(parentStudents.userId, user.id));
    if (links.length) return new Set(links.map((row) => row.studentId));
  }
  if (user.role !== "student" && user.role !== "parent") return new Set<string>();
  const name = user.name.trim().toLowerCase();
  if (!name) return new Set<string>();
  const rows = await db
    .select({ id: students.id, name: students.name, fatherName: students.fatherName, motherName: students.motherName })
    .from(students)
    .where(eq(students.tenantId, user.tenantId));
  return new Set(
    rows
      .filter((person) =>
        user.role === "student"
          ? person.name.trim().toLowerCase() === name
          : (person.fatherName ?? "").trim().toLowerCase() === name || (person.motherName ?? "").trim().toLowerCase() === name,
      )
      .map((person) => person.id),
  );
}
