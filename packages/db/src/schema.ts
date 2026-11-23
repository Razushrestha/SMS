import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "admin",
  "principal",
  "teacher",
  "accountant",
  "store_manager",
  "employee",
  "student",
  "parent",
  "platform",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantPlans = pgTable("tenant_plans", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull().default("Core"),
  status: subscriptionStatus("status").notNull().default("trial"),
  expiresOn: date("expires_on"),
  notes: text("notes"),
  readerQuota: integer("reader_quota").notNull().default(5),
  cardQuota: integer("card_quota").notNull().default(100),
  vehicleQuota: integer("vehicle_quota").notNull().default(5),
  assistantTokenQuota: integer("assistant_token_quota").notNull().default(20000),
  assistantTokensUsed: integer("assistant_tokens_used").notNull().default(0),
  assistantPeriod: text("assistant_period").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const institutes = pgTable("institutes", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetLine: text("target_line").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  address: text("address").notNull(),
  country: text("country").notNull(),
  logoUrl: text("logo_url"),
  timezone: text("timezone").notNull().default("Asia/Kathmandu"),
  dateFormat: text("date_format").notNull().default("d MMMM, yyyy"),
  currency: text("currency").notNull().default("USD"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("admin"),
    emailVerified: boolean("email_verified").notNull().default(false),
    verificationTokenHash: text("verification_token_hash"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    dashboardView: text("dashboard_view").notNull().default("classic"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_student_once").on(table.studentId)],
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffRole = pgEnum("staff_role", [
  "principal",
  "management_staff",
  "teacher",
  "accountant",
  "store_manager",
  "other",
]);

export const personStatus = pgEnum("person_status", ["active", "inactive"]);

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  joiningDate: date("joining_date").notNull(),
  staffRole: staffRole("staff_role").notNull(),
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).notNull(),
  fatherOrHusband: text("father_or_husband"),
  nationalId: text("national_id"),
  education: text("education"),
  gender: text("gender"),
  religion: text("religion"),
  bloodGroup: text("blood_group"),
  experience: text("experience"),
  email: text("email"),
  dateOfBirth: date("date_of_birth"),
  address: text("address"),
  photoUrl: text("photo_url"),
  showOnWebsite: boolean("show_on_website").notNull().default(false),
  status: personStatus("status").notNull().default("active"),
  portalUsername: text("portal_username"),
  portalPasswordHash: text("portal_password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("employees_portal_username").on(table.tenantId, table.portalUsername)]);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("classes_tenant_name").on(table.tenantId, table.name)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    totalMarks: integer("total_marks").notNull(),
  },
  (table) => [uniqueIndex("subjects_class_name").on(table.classId, table.name)],
);

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    registrationNo: text("registration_no").notNull(),
    name: text("name").notNull(),
    admissionDate: date("admission_date").notNull(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "set null" }),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    discountReason: text("discount_reason").notNull().default(""),
    status: personStatus("status").notNull().default("active"),
    smsPhone: text("sms_phone"),
    photoUrl: text("photo_url"),
    dateOfBirth: date("date_of_birth"),
    gender: text("gender"),
    identificationMark: text("identification_mark"),
    bloodGroup: text("blood_group"),
    disease: text("disease"),
    birthId: text("birth_id"),
    caste: text("caste"),
    previousSchool: text("previous_school"),
    previousId: text("previous_id"),
    note: text("note"),
    orphan: text("orphan"),
    osc: text("osc"),
    religion: text("religion"),
    siblings: text("siblings"),
    address: text("address"),
    portalUsername: text("portal_username"),
    portalPasswordHash: text("portal_password_hash"),
    fatherName: text("father_name"),
    fatherEducation: text("father_education"),
    fatherNationalId: text("father_national_id"),
    fatherMobile: text("father_mobile"),
    fatherOccupation: text("father_occupation"),
    fatherProfession: text("father_profession"),
    fatherIncome: text("father_income"),
    motherName: text("mother_name"),
    motherEducation: text("mother_education"),
    motherNationalId: text("mother_national_id"),
    motherMobile: text("mother_mobile"),
    motherOccupation: text("mother_occupation"),
    motherProfession: text("mother_profession"),
    motherIncome: text("mother_income"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("students_tenant_reg").on(table.tenantId, table.registrationNo),
    uniqueIndex("students_portal_username").on(table.tenantId, table.portalUsername),
  ],
);

export const parentStudents = pgTable(
  "parent_students",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.studentId] })],
);

export const accountType = pgEnum("account_type", ["income", "expense"]);

export const entrySource = pgEnum("entry_source", ["manual", "fee", "salary"]);

export const accountHeads = pgTable("account_heads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const statementEntries = pgTable("statement_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  headId: uuid("head_id")
    .notNull()
    .references(() => accountHeads.id, { onDelete: "restrict" }),
  entryDate: date("entry_date").notNull(),
  description: text("description").notNull(),
  income: numeric("income", { precision: 12, scale: 2 }).notNull().default("0"),
  expense: numeric("expense", { precision: 12, scale: 2 }).notNull().default("0"),
  reference: text("reference").notNull().default("by Admin"),
  source: entrySource("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customReports = pgTable(
  "custom_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").notNull(),
    columns: jsonb("columns").$type<string[]>().notNull(),
    filter: text("filter").notNull().default("all"),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("custom_report_name").on(table.tenantId, table.name)],
);

export const feePayments = pgTable("fee_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  statementEntryId: uuid("statement_entry_id").references(() => statementEntries.id, { onDelete: "set null" }),
  feeMonth: text("fee_month").notNull(),
  paidOn: date("paid_on").notNull(),
  monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
  admission: numeric("admission", { precision: 12, scale: 2 }).notNull().default("0"),
  registration: numeric("registration", { precision: 12, scale: 2 }).notNull().default("0"),
  art: numeric("art", { precision: 12, scale: 2 }).notNull().default("0"),
  transport: numeric("transport", { precision: 12, scale: 2 }).notNull().default("0"),
  books: numeric("books", { precision: 12, scale: 2 }).notNull().default("0"),
  uniform: numeric("uniform", { precision: 12, scale: 2 }).notNull().default("0"),
  fine: numeric("fine", { precision: 12, scale: 2 }).notNull().default("0"),
  others: numeric("others", { precision: 12, scale: 2 }).notNull().default("0"),
  previousBalance: numeric("previous_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  deposit: numeric("deposit", { precision: 12, scale: 2 }).notNull(),
  due: numeric("due", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feeScope = pgEnum("fee_scope", ["everyone", "class", "student"]);

export const feeParticulars = pgTable("fee_particulars", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  month: text("month"),
  scope: feeScope("scope").notNull(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  admission: numeric("admission", { precision: 12, scale: 2 }).notNull().default("0"),
  registration: numeric("registration", { precision: 12, scale: 2 }).notNull().default("0"),
  art: numeric("art", { precision: 12, scale: 2 }).notNull().default("0"),
  transport: numeric("transport", { precision: 12, scale: 2 }).notNull().default("0"),
  books: numeric("books", { precision: 12, scale: 2 }).notNull().default("0"),
  uniform: numeric("uniform", { precision: 12, scale: 2 }).notNull().default("0"),
  fine: numeric("fine", { precision: 12, scale: 2 }).notNull().default("0"),
  others: numeric("others", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  branchAddress: text("branch_address").notNull(),
  accountNumber: text("account_number").notNull(),
  instructions: text("instructions").notNull().default(""),
  logoData: text("logo_data").notNull(),
});

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    receiptNo: text("receipt_no").notNull(),
    feeMonth: text("fee_month").notNull(),
    dueDate: date("due_date").notNull(),
    lateFine: numeric("late_fine", { precision: 12, scale: 2 }).notNull().default("0"),
    monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
    admission: numeric("admission", { precision: 12, scale: 2 }).notNull().default("0"),
    registration: numeric("registration", { precision: 12, scale: 2 }).notNull().default("0"),
    art: numeric("art", { precision: 12, scale: 2 }).notNull().default("0"),
    transport: numeric("transport", { precision: 12, scale: 2 }).notNull().default("0"),
    books: numeric("books", { precision: 12, scale: 2 }).notNull().default("0"),
    uniform: numeric("uniform", { precision: 12, scale: 2 }).notNull().default("0"),
    fine: numeric("fine", { precision: 12, scale: 2 }).notNull().default("0"),
    others: numeric("others", { precision: 12, scale: 2 }).notNull().default("0"),
    previousBalance: numeric("previous_balance", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    bankName: text("bank_name").notNull(),
    bankBranch: text("bank_branch").notNull(),
    accountNumber: text("account_number").notNull(),
    instructions: text("instructions").notNull().default(""),
    issuedOn: date("issued_on").notNull(),
  },
  (table) => [
    uniqueIndex("fee_invoice_once").on(table.tenantId, table.studentId, table.feeMonth),
    uniqueIndex("fee_invoice_receipt").on(table.tenantId, table.receiptNo),
  ],
);

export const feeCarryForwards = pgTable(
  "fee_carry_forwards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    targetMonth: text("target_month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [uniqueIndex("fee_carry_once").on(table.tenantId, table.studentId, table.targetMonth)],
);

export const salaryPayments = pgTable(
  "salary_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    statementEntryId: uuid("statement_entry_id").references(() => statementEntries.id, { onDelete: "set null" }),
    salaryMonth: text("salary_month").notNull(),
    paidOn: date("paid_on").notNull(),
    fixedSalary: numeric("fixed_salary", { precision: 12, scale: 2 }).notNull(),
    bonus: numeric("bonus", { precision: 12, scale: 2 }).notNull().default("0"),
    deduction: numeric("deduction", { precision: 12, scale: 2 }).notNull().default("0"),
    net: numeric("net", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("salary_employee_month").on(table.tenantId, table.employeeId, table.salaryMonth)],
);

export const attendanceStatus = pgEnum("attendance_status", ["present", "leave", "absent"]);

export const attendanceSource = pgEnum("attendance_source", ["manual", "rfid"]);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    attendanceDate: date("attendance_date").notNull(),
    status: attendanceStatus("status").notNull(),
    source: attendanceSource("source").notNull().default("manual"),
    markedTime: text("marked_time").notNull().default("-"),
    outTime: text("out_time"),
    editedManually: boolean("edited_manually").notNull().default(false),
    editedByName: text("edited_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_student_day").on(table.tenantId, table.studentId, table.attendanceDate),
    uniqueIndex("attendance_employee_day").on(table.tenantId, table.employeeId, table.attendanceDate),
  ],
);

export const readerLocation = pgEnum("reader_location", ["campus", "gate", "building", "room", "bus"]);
export const readerDirection = pgEnum("reader_direction", ["in", "out", "both"]);
export const readerStatus = pgEnum("reader_status", ["active", "disabled"]);
export const cardStatus = pgEnum("card_status", ["active", "lost", "blocked", "spare"]);

export const rfidSettings = pgTable("rfid_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  dayStart: text("day_start").notNull().default("09:00"),
  cutoffMinutes: integer("cutoff_minutes").notNull().default(15),
  notifyParents: boolean("notify_parents").notNull().default(false),
});

export const rfidReaders = pgTable(
  "rfid_readers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serial: text("serial").notNull(),
    secretHash: text("secret_hash").notNull(),
    location: readerLocation("location").notNull(),
    direction: readerDirection("direction").notNull(),
    status: readerStatus("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("reader_serial_once").on(table.serial)],
);

export const rfidCards = pgTable(
  "rfid_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uid: text("uid").notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    status: cardStatus("status").notNull().default("spare"),
    issuedOn: date("issued_on"),
    returnedOn: date("returned_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("card_uid_once").on(table.tenantId, table.uid)],
);

export const rfidTaps = pgTable("rfid_taps", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  readerId: uuid("reader_id")
    .notNull()
    .references(() => rfidReaders.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").references(() => rfidCards.id, { onDelete: "set null" }),
  uid: text("uid").notNull(),
  tappedAt: timestamp("tapped_at", { withTimezone: true }).notNull(),
  direction: text("direction").notNull(),
  result: text("result").notNull(),
  personName: text("person_name"),
});

export const gradingSettings = pgTable("grading_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  weakBelow: numeric("weak_below", { precision: 5, scale: 2 }).notNull().default("60"),
  strongFrom: numeric("strong_from", { precision: 5, scale: 2 }).notNull().default("80"),
  overallFailAt: numeric("overall_fail_at", { precision: 5, scale: 2 }).notNull().default("32"),
  subjectFailAt: numeric("subject_fail_at", { precision: 5, scale: 2 }).notNull().default("32"),
  failSubjectCount: integer("fail_subject_count").notNull().default(1),
  bands: jsonb("bands").$type<Array<{ grade: string; lower: number; upper: number; pass: boolean }>>(),
});

export const homework = pgTable("homework", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  homeworkDate: date("homework_date").notNull(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  setByEmployeeId: uuid("set_by_employee_id").references(() => employees.id, { onDelete: "set null" }),
  detail: text("detail").notNull(),
  attachmentName: text("attachment_name"),
  attachmentData: text("attachment_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examSubjects = pgTable(
  "exam_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    totalMarks: integer("total_marks"),
    examDate: date("exam_date"),
    startsAt: text("starts_at"),
  },
  (table) => [uniqueIndex("exam_subject_once").on(table.examId, table.subjectId)],
);

export const examMarks = pgTable(
  "exam_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    obtained: numeric("obtained", { precision: 7, scale: 2 }).notNull(),
  },
  (table) => [uniqueIndex("exam_mark_once").on(table.examId, table.studentId, table.subjectId)],
);

export const classTests = pgTable(
  "class_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    testDate: date("test_date").notNull(),
    totalMarks: numeric("total_marks", { precision: 7, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("class_test_once").on(table.tenantId, table.classId, table.subjectId, table.testDate)],
);

export const classTestMarks = pgTable(
  "class_test_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => classTests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    obtained: numeric("obtained", { precision: 7, scale: 2 }).notNull(),
  },
  (table) => [uniqueIndex("class_test_mark_once").on(table.testId, table.studentId)],
);

export const certificateTemplates = pgTable(
  "certificate_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    conduct: text("conduct").notNull(),
    duesNote: text("dues_note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("certificate_template_name").on(table.tenantId, table.name)],
);

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  template: text("template").notNull().default("leave"),
  recipientType: text("recipient_type").notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  certificateDate: date("certificate_date").notNull(),
  conduct: text("conduct").notNull(),
  duesNote: text("dues_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatAudience = pgEnum("chat_audience", [
  "all_students",
  "all_employees",
  "all_teachers",
  "class",
  "student",
  "employee",
]);

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  audience: chatAudience("audience").notNull(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  senderName: text("sender_name").notNull(),
  body: text("body").notNull().default(""),
  attachmentName: text("attachment_name"),
  attachmentData: text("attachment_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatReads = pgTable(
  "chat_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chat_read_once").on(table.userId, table.chatId)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    meetingCode: text("meeting_code").notNull(),
    audience: chatAudience("audience").notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    duration: text("duration").notNull(),
    message: text("message").notNull().default(""),
    scheduled: boolean("scheduled").notNull().default(false),
    meetingDate: date("meeting_date"),
    startTime: text("start_time"),
    active: boolean("active").notNull().default(true),
    noticeMessageId: uuid("notice_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("meeting_code_once").on(table.tenantId, table.meetingCode)],
);

export const smsAccounts = pgTable("sms_accounts", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(100),
  pairingTokenHash: text("pairing_token_hash"),
  pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  handsetName: text("handset_name"),
});

export const smsTemplates = pgTable("sms_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  body: text("body").notNull(),
});

export const smsOptOuts = pgTable(
  "sms_opt_outs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
  },
  (table) => [uniqueIndex("sms_opt_out_once").on(table.tenantId, table.phone)],
);

export const periods = pgTable("periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
});

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("room_name_once").on(table.tenantId, table.name)],
);

export const timetableSlots = pgTable(
  "timetable_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    weekday: text("weekday").notNull(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("timetable_room_once").on(table.tenantId, table.weekday, table.periodId, table.roomId),
    uniqueIndex("timetable_class_once").on(table.tenantId, table.weekday, table.periodId, table.classId),
    uniqueIndex("timetable_teacher_once").on(table.tenantId, table.weekday, table.periodId, table.teacherId),
  ],
);

export const behaviourDomain = pgEnum("behaviour_domain", ["affective", "psychomotor"]);

export const behaviourRatings = pgTable(
  "behaviour_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    domain: behaviourDomain("domain").notNull(),
    trait: text("trait").notNull(),
    rating: integer("rating").notNull(),
  },
  (table) => [uniqueIndex("behaviour_trait_once").on(table.tenantId, table.studentId, table.trait)],
);

export const observations = pgTable("observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  observedOn: date("observed_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const productTaxes = pgTable("product_taxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "restrict" }),
  taxId: uuid("tax_id").references(() => productTaxes.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
});

export const storeOrders = pgTable("store_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  statementEntryId: uuid("statement_entry_id").references(() => statementEntries.id, { onDelete: "set null" }),
  soldOn: date("sold_on").notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeOrderLines = pgTable("store_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => storeOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export const smsMessages = pgTable("sms_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehicleType = pgEnum("vehicle_type", ["bus", "van", "other"]);
export const vehicleStatus = pgEnum("vehicle_status", ["active", "inactive"]);
export const tripStatus = pgEnum("trip_status", ["scheduled", "running", "completed", "cancelled"]);

export const gpsSettings = pgTable("gps_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  speedLimitKmh: integer("speed_limit_kmh").notNull().default(50),
  corridorMetres: integer("corridor_metres").notNull().default(150),
  retentionDays: integer("retention_days").notNull().default(90),
  notifySms: boolean("notify_sms").notNull().default(false),
});

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    plate: text("plate").notNull(),
    type: vehicleType("type").notNull(),
    capacity: integer("capacity").notNull(),
    trackerId: text("tracker_id"),
    driverId: uuid("driver_id").references(() => employees.id, { onDelete: "set null" }),
    status: vehicleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vehicle_plate_once").on(table.tenantId, table.plate), uniqueIndex("vehicle_tracker_once").on(table.trackerId)],
);

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  driverId: uuid("driver_id").references(() => employees.id, { onDelete: "set null" }),
});

export const routeStops = pgTable("route_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMetres: integer("radius_metres").notNull().default(80),
  sortOrder: integer("sort_order").notNull(),
});

export const routeAssignments = pgTable(
  "route_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    stopId: uuid("stop_id")
      .notNull()
      .references(() => routeStops.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("route_student_once").on(table.tenantId, table.studentId)],
);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  driverId: uuid("driver_id").references(() => employees.id, { onDelete: "set null" }),
  tripDate: date("trip_date").notNull(),
  plannedStart: text("planned_start").notNull(),
  status: tripStatus("status").notNull().default("scheduled"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const locationPoints = pgTable("location_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speed: doublePrecision("speed"),
  heading: integer("heading"),
  accuracy: integer("accuracy"),
  deviceTime: timestamp("device_time", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gpsAlerts = pgTable("gps_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
  tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolPreferences = pgTable("school_preferences", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  direction: text("direction").notNull().default("ltr"),
  sidebar: text("sidebar").notNull().default("dark"),
  header: text("header").notNull().default("dark"),
  activeColor: text("active_color").notNull().default("teal"),
  language: text("language").notNull().default("English"),
  studentRules: text("student_rules").notNull().default(""),
  employeeRules: text("employee_rules").notNull().default(""),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportLoginTokens = pgTable("support_login_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
