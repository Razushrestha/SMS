"use client";

import { useParams } from "next/navigation";
import { PortalLetter } from "@/components/portal-letter";

export default function AdmissionLetterPage() {
  const params = useParams<{ id: string }>();
  return <PortalLetter title="Admission letter" createPath="/learning/letters/admission" reprintPath={`/learning/letters/admission/${params.id}`} body={{ studentId: params.id }} />;
}
