"use client";

import { useParams } from "next/navigation";
import { PortalLetter } from "@/components/portal-letter";

export default function JobLetterPage() {
  const params = useParams<{ id: string }>();
  return <PortalLetter title="Job letter" createPath="/learning/letters/job" reprintPath={`/learning/letters/job/${params.id}`} body={{ employeeId: params.id }} />;
}
