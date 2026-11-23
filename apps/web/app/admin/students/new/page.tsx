import Link from "next/link";
import { PageChrome } from "@/components/page-chrome";
import { StudentForm } from "@/components/student-form";

export default function NewStudentPage() {
  return (
    <PageChrome
      icon="fa-light fa-user-plus"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Admit Student" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">All students</Link>}
    >
      <StudentForm />
    </PageChrome>
  );
}
