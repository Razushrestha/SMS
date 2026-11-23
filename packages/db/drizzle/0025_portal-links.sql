ALTER TABLE "users" ADD COLUMN "student_id" uuid;
ALTER TABLE "users" ADD CONSTRAINT "users_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "users_student_once" ON "users" USING btree ("student_id");
CREATE TABLE "parent_students" (
  "user_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  CONSTRAINT "parent_students_user_id_student_id_pk" PRIMARY KEY("user_id","student_id"),
  CONSTRAINT "parent_students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action
);
