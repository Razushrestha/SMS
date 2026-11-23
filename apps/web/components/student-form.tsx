"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { api } from "@/lib/api";
import { readPhoto } from "@/lib/photo";
import { religions } from "@/lib/school";

type ClassRow = { id: string; name: string };
type Family = { id: string; name: string };
type Student = Record<string, string | null> & { id?: string; registrationNo: string; classId: string; status?: string };

export function StudentForm({ student }: { student?: Student }) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [lastRegistration, setLastRegistration] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<ClassRow[]>("/classes"),
      api<Family[]>("/families"),
      api<{ lastRegistration: string | null }>("/students/meta"),
    ]).then(([classRows, familyRows, meta]) => {
      setClasses(classRows);
      setFamilies(familyRows);
      setLastRegistration(meta.lastRegistration);
    }).catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const file = form.querySelector<HTMLInputElement>("input[type=file]")?.files?.[0];
    const body = Object.fromEntries(new FormData(form).entries()) as Record<string, FormDataEntryValue | null>;
    if (body.removePhoto === "on") body.photoUrl = null;
    else if (file) body.photoUrl = await readPhoto(file);
    delete body.removePhoto;
    try {
      if (student?.id) {
        await api(`/students/${student.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/students", { method: "POST", body: JSON.stringify(body) });
      }
      router.push("/admin/students");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the student");
    }
  }

  return (
    <form className="esk-panel max-w-3xl" onSubmit={onSubmit}>
      <p className="mb-4 text-sm text-[var(--esk-muted)]">
        Last registration number: {lastRegistration ?? "None"}
      </p>
      {classes.length === 0 ? <p className="mb-4 text-sm text-[var(--esk-muted)]">Add a class before admitting a student.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student name">
          <input className={control} name="name" defaultValue={student?.name ?? ""} required />
        </Field>
        <Field label="Registration number">
          <input className={control} name="registrationNo" defaultValue={student?.registrationNo ?? ""} required readOnly={Boolean(student)} />
        </Field>
        <Field label="Admission date">
          <input className={control} name="admissionDate" type="date" defaultValue={student?.admissionDate ?? ""} required />
        </Field>
        <Field label="Class">
          <select className={control} name="classId" defaultValue={student?.classId ?? ""} required>
            <option value="" disabled>Select a class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Discount type">
          <select className={control} name="discountType" defaultValue={student?.discountType ?? "percent"}>
            <option value="percent">Percent of monthly fee</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </Field>
        <Field label="Discount percent">
          <input className={control} name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={student?.discountPercent ?? "0"} required />
        </Field>
        <Field label="Fixed discount">
          <input className={control} name="discountAmount" type="number" min="0" step="0.01" defaultValue={student?.discountAmount ?? "0"} />
        </Field>
        <Field label="Discount reason">
          <input className={control} name="discountReason" defaultValue={student?.discountReason ?? ""} />
        </Field>
        <Field label="Status">
          <select className={control} name="status" defaultValue={student?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Family">
          <select className={control} name="familyId" defaultValue={student?.familyId ?? ""}>
            <option value="">No family</option>
            {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
          </select>
        </Field>
        <Field label="Photo">
          <input className={control} type="file" accept="image/png,image/jpeg,image/gif,image/webp" />
        </Field>
        {student?.photoUrl ? <img alt="" className="h-16 w-16 rounded object-cover" src={student.photoUrl} /> : null}
        {student?.photoUrl ? <label className="mb-4 flex items-center gap-2 text-sm"><input name="removePhoto" type="checkbox" /> Remove photo</label> : null}
        <Field label="SMS phone">
          <input className={control} name="smsPhone" defaultValue={student?.smsPhone ?? ""} />
        </Field>
        <Field label="Date of birth">
          <input className={control} name="dateOfBirth" type="date" defaultValue={student?.dateOfBirth ?? ""} />
        </Field>
        <Field label="Gender">
          <select className={control} name="gender" defaultValue={student?.gender ?? ""}>
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Religion">
          <select className={control} name="religion" defaultValue={student?.religion ?? ""}>
            <option value="">Not set</option>
            {religions.map((religion) => <option key={religion}>{religion}</option>)}
          </select>
        </Field>
        <Field label="Address">
          <input className={control} name="address" defaultValue={student?.address ?? ""} />
        </Field>
        <Field label="Birth ID">
          <input className={control} name="birthId" defaultValue={student?.birthId ?? ""} />
        </Field>
        <Field label="Caste">
          <input className={control} name="caste" defaultValue={student?.caste ?? ""} />
        </Field>
        <Field label="Blood group">
          <input className={control} name="bloodGroup" defaultValue={student?.bloodGroup ?? ""} />
        </Field>
        <Field label="Identification mark">
          <input className={control} name="identificationMark" defaultValue={student?.identificationMark ?? ""} />
        </Field>
        <Field label="Previous school">
          <input className={control} name="previousSchool" defaultValue={student?.previousSchool ?? ""} />
        </Field>
        <Field label="Previous ID">
          <input className={control} name="previousId" defaultValue={student?.previousId ?? ""} />
        </Field>
        <Field label="Siblings">
          <input className={control} name="siblings" defaultValue={student?.siblings ?? ""} />
        </Field>
        <Field label="Orphan">
          <select className={control} name="orphan" defaultValue={student?.orphan ?? ""}>
            <option value="">Not set</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="OSC">
          <select className={control} name="osc" defaultValue={student?.osc ?? ""}>
            <option value="">Not set</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      <Field label="Note">
        <input className={control} name="note" defaultValue={student?.note ?? ""} />
      </Field>
      <h2 className="mb-3 mt-2 text-sm font-semibold">Father</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className={control} name="fatherName" defaultValue={student?.fatherName ?? ""} /></Field>
        <Field label="Mobile"><input className={control} name="fatherMobile" defaultValue={student?.fatherMobile ?? ""} /></Field>
        <Field label="National ID"><input className={control} name="fatherNationalId" defaultValue={student?.fatherNationalId ?? ""} /></Field>
        <Field label="Education"><input className={control} name="fatherEducation" defaultValue={student?.fatherEducation ?? ""} /></Field>
        <Field label="Occupation"><input className={control} name="fatherOccupation" defaultValue={student?.fatherOccupation ?? ""} /></Field>
        <Field label="Profession"><input className={control} name="fatherProfession" defaultValue={student?.fatherProfession ?? ""} /></Field>
        <Field label="Income"><input className={control} name="fatherIncome" defaultValue={student?.fatherIncome ?? ""} /></Field>
      </div>
      <h2 className="mb-3 text-sm font-semibold">Mother</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className={control} name="motherName" defaultValue={student?.motherName ?? ""} /></Field>
        <Field label="Mobile"><input className={control} name="motherMobile" defaultValue={student?.motherMobile ?? ""} /></Field>
        <Field label="National ID"><input className={control} name="motherNationalId" defaultValue={student?.motherNationalId ?? ""} /></Field>
        <Field label="Education"><input className={control} name="motherEducation" defaultValue={student?.motherEducation ?? ""} /></Field>
        <Field label="Occupation"><input className={control} name="motherOccupation" defaultValue={student?.motherOccupation ?? ""} /></Field>
        <Field label="Profession"><input className={control} name="motherProfession" defaultValue={student?.motherProfession ?? ""} /></Field>
        <Field label="Income"><input className={control} name="motherIncome" defaultValue={student?.motherIncome ?? ""} /></Field>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <button className="esk-btn-primary" type="submit" disabled={classes.length === 0}>
        <i className="fa-light fa-floppy-disk" /> Save student
      </button>
    </form>
  );
}
