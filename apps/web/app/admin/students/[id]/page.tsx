"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageChrome } from "@/components/page-chrome";
import { StudentForm } from "@/components/student-form";
import { api } from "@/lib/api";

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const [student, setStudent] = useState<Record<string, string | null> & { registrationNo: string; classId: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Record<string, string | null> & { registrationNo: string; classId: string }>(`/students/${params.id}`)
      .then(setStudent)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  if (error) {
    return (
      <PageChrome icon="fa-light fa-user" crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Edit Student" }]}>
        <p className="text-sm text-red-600">{error}</p>
      </PageChrome>
    );
  }

  if (!student) {
    return (
      <PageChrome icon="fa-light fa-user" crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Edit Student" }]}>
        <p className="text-sm text-[var(--esk-muted)]">Loading student…</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-user"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: student.name || "Edit Student" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">All students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">The registration number cannot be changed.</p>
      <StudentForm student={{ ...student, id: params.id }} />
    </PageChrome>
  );
}
