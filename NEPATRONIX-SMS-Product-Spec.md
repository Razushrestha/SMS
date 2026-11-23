# NEPATRONIX SMS

Product specification for a school-management SaaS. The web admin below is a complete record of the free eSkooly institute dashboard that was walked screen by screen. RFID attendance and GPS tracking are new modules to add on top of that copy.

Observed product: eSkooly free school ERP, web admin at `/bb/`. Login roles: Admin, Employee, Student. A new institute starts empty, email unverified, currency `$`. Many menu items are locked on the free web and show “This option is available in Desktop Version only.” Roles & Permissions says “Desktop subscription only.” For a 100% product, those locked modules are still specified here and should exist in NEPATRONIX rather than staying locked.

This document records screens, fields, and rules. It is not a copy of eSkooly’s source code, branding, or printed footer contacts. Printed slips in the free product stamp eSkooly’s own footer. NEPATRONIX slips must use the tenant institute’s name, phone, website, and email.

---

## 1. How the admin behaves

- PHP-style multi-page admin. Sidebar groups collapse. A header search looks up students. Header also has fullscreen, app-store links, marketplace, and messages. The bell and cart icons are empty links.
- Institute menu: account, profile, logout.
- Google Translate widget is on the pages. Theme language is a separate setting.
- Setup order is enforced:
  1. At least one teacher before a class can be saved.
  2. A class before a student.
  3. Subjects before subject-based features (exam setup, homework subject list, marks).
  4. A bank before a fee invoice can be generated.
- Deleting a class permanently deletes its students and the related test and attendance rows.
- Registration numbers and employee records drive fees, salary, reports, and slips. Unknown student registration returns exactly “Student not found.” Unknown or inactive employee returns “Employee not found or inactive.”
- “Already added” warnings for a fee month or a salary month are hidden until a server check says the month exists. They are not real duplicates just because the text is in the page.
- Financial writes that do not disappear when the person is deleted:
  - Collecting a fee writes an income row on the account statement.
  - Paying a salary writes an expense row.
  - Adding income or expense writes a statement row.
  - Deleting the student or employee removes the person and the printable slip, and it does not remove the statement row.
  - Delete Statement permanently deletes every statement row. Reset Balance sets the net balance to zero and cannot be undone. Neither action deletes a single row.
- Generating a fee invoice creates a fee due (the student becomes a defaulter). Deleting the class, which deletes the student, removes that due.
- A second attendance save using the original insert action adds another row for the same day. It does not replace the first mark. After the first save, the form switches to an update action.
- Portal usernames and passwords are generated and shown on admission letters, job letters, login lists, and employee reports. NEPATRONIX must store them hashed, show them once, and never print a reusable password on a letter that can be reprinted later.

---

## 2. Dashboard

### Classic dashboard

Widgets:

- Students, employees, revenue, profit. Each has an all-time total and a this-month figure.
- Weather for the institute location.
- Verify-email banner when the account email is not verified.
- Fee status: estimation, collections, remainings.
- Income versus expense.
- Class strength.
- Absent students today.
- Present staff today.
- New admissions.
- Key progress percents.
- Calendar.
- Promotional cards for SMS and the desktop app.
- Switch to New Dashboard.

### New dashboard

- Greeting, verify-now, weather, date, and a switch back to Classic View.
- Today strip: students present (present/total), staff present, fees percent, new admissions.
- Quick actions: Add Student, Collect Fee, Mark Attendance, Send SMS (opens Messaging, not the SMS gateway), Add Exam, Homework.
- Stat cards link to the matching lists and to the account statement.
- Charts: 6-month income versus expense, fee collection, today’s progress, demographics, class strength, absent today, present staff, new admissions, birthdays.
- Demographics with zero students still rendered Boys 0 (0%) and Girls 0 (100%). A copy should render 0% and 0% when both counts are zero.

The account can be left on either dashboard. NEPATRONIX should remember the admin’s choice per user.

### Marketplace

- Desktop product link, shown with a 60% off offer.
- PRO and Try Demo, shown with 50% off.
- LMS, shown with 65% off.
- NEPATRONIX does not need these third-party offers. Replace the page with the tenant’s plan, add-ons (RFID, GPS, SMS), and upgrade.

---

## 3. AI assistant

- Screen name Adam. Voice wake is offered.
- A monthly token limit blocks further replies when it is reached. The walked account had already hit that limit.
- Suggested prompts on screen: a school report with charts, a message to all students, pending fees.
- NEPATRONIX: per-tenant monthly token quota, a clear “limit reached” state, and the same three starter prompts. The assistant may only read data the signed-in role is allowed to see.

---

## 4. General settings

### Institute profile

- Logo: JPG or PNG, max 500 KB.
- Name, target line, phone, website, address, country.
- Required: name, target line, phone, address, country.

### Fee particulars

Scope:

- All months, or one month.
- All students, one class, or one student.
- The most specific row wins: student, then class, then everyone.

Lines, amounts default to 0 except the fixed ones:

- MONTHLY TUITION FEE, fixed from the class monthly fee.
- ADMISSION FEE
- REGISTRATION FEE
- ART MATERIAL
- TRANSPORT
- BOOKS
- UNIFORM
- FINE
- OTHERS
- PREVIOUS BALANCE, fixed.
- DISCOUNT IN FEE, fixed from the student discount percent.

Reset to default exists.

### Bank accounts for invoices

Required before Generate Fees Invoice opens. With no bank, the invoice page is blocked.

- Logo required. JPG or PNG, max 500 KB.
- Bank name.
- Branch address.
- Account number.
- Instructions.

List columns: name, logo, account number, actions. Edit and delete. Delete asks for confirmation. After the last bank is deleted, invoices are blocked again.

### Rules and regulations

- One text for students.
- One text for employees.
- These texts are the source for the rules printed on admission and job letters.

### Marks grading

Default scale:

| Grade | Range | Result |
| --- | --- | --- |
| A+ | 80–100 | PASS |
| A | 70–79 | PASS |
| B+ | 60–69 | PASS |
| B | 50–59 | PASS |
| C | 40–49 | PASS |
| D | 33–39 | PASS |
| F | 0–32 | FAIL |

Fail rule, either condition:

- Overall percent at or below N, or
- Subject percent at or below N in at least X subjects.

Inputs are the seven grade rows (name, pass/fail, upper, lower) plus overall cutoff, subject cutoff, and the number of subjects.

### Theme and language

- LTR or RTL.
- Sidebar light or dark.
- Header: Dark, Red, Dark Green, Green, Blue, White.
- Active item color.
- Long language list, including English, Nepali, Urdu, Hindi, Arabic, through Xhosa.
- Save, and Reset to Default.

### Account settings

- Email, password, timezone, currency, currency symbol.
- Delete account warns that all institute data is removed.

---

## 5. Classes

Fields:

- Class name.
- Monthly tuition.
- Class teacher, required. The teacher list is employees.

The edit screen label says “with sections,” but there is no section field.

Delete warns that students of the class are removed permanently. Related test and attendance rows go with them.

Empty state until a teacher exists.

---

## 6. Subjects

- Class.
- Subject name.
- Total marks.
- Add another row, or remove the last row.

Exam setup, homework, and marks all refuse to continue with “No subjects assigned to this class yet” until this list has rows.

---

## 7. Students

### Admission, required

- Student name.
- Registration number. The form shows the last number used. A brand-new institute shows None. Duplicate registration shows “This Registration No. Already Exists!”
- Admission date.
- Class.
- Discount percent.

### Admission, optional

- Photo, max 100 KB.
- SMS phone.
- Date of birth.
- Gender: male or female.
- Identification mark, blood group, disease, birth ID or NIC, caste, previous school, previous id, note.
- Orphan: YES or NO.
- OSC: YES or NO.
- Religion, from a list.
- Family. The family list is empty on the free web because families are desktop-only.
- Siblings, address.
- Father and mother, each: name, education, national ID, mobile, occupation, profession, income.
- Add Parents looks up an existing father by national ID.
- Customize and Import Students are desktop-only. The import button has no destination on the free web.

### Edit, card, and delete

- Registration number is not editable.
- Class can be changed. Promote uses that same class change across the student’s records.
- Card actions: view, edit, delete.
- Delete is permanent for that student.

### Student report

- Identity fields.
- Attendance: today, yesterday, this month, overall. Unmarked days show NOT MARKED.
- Class tests per subject.
- Examination block shows “No Record Found” until marks exist.
- Fees block shows “No Record Found” until a payment exists.

### Other student tools

- Admission letter: printable, with a portal QR, the student rules, and the generated login. Do not keep reprinting the raw password.
- Student ID cards: name, ID, class, admission date. Styles: Default and 1–4. Print. Customize is locked.
- Print basic list columns: serial, registration number, name, father name, class, fee remaining, phone. Unpaid fee remaining is a dash.
- Manage login: editable username and password, Save Changes, Send SMS. NEPATRONIX should reset by a one-time link or a shown-once password, not a stored plain password.
- Promote: lists active students with registration number, name, current class, and target class. Saving updates the class on the student’s records.
- Student info report: totals, active, inactive, classes. Columns: serial, ID, name, father, class, discount, admission date, date of birth, age, gender, birth ID, religion, caste, status.
- Parents report is titled Student Contact Report: totals, how many fathers have a mobile, how many mothers have a mobile, classes. Columns for father and mother: name, national ID, education, mobile, occupation, profession, income.
- Manage Families and Active / Inactive are desktop-only in the original. Include both in NEPATRONIX. Active / Inactive must be a status, not a delete. Inactive students are excluded from fee collection and promotion.

---

## 8. Employees

### Required

- Name.
- Photo, max 100 KB.
- Phone.
- Joining date.
- Role: Principal, Management Staff, Teacher, Accountant, Store Manager, Other.
- Monthly salary.

### Optional

- Father or husband name.
- National ID, education, gender, religion, blood group, experience, email, date of birth, address.
- Checkbox: show this profile on the website.

### Report and actions

- Report shows role, salary, personal fields, portal username and password, attendance, and salary status. Until a salary is paid, the status is “SALARY NOT RECEIVED.”
- Actions: view, edit, delete.
- Job letter: printable, with a portal QR, the employee rules, and the generated login.
- Staff ID cards and Roles & Permissions are desktop-only in the original. Include both. Roles must actually limit menus. Suggested roles: Admin, Principal, Teacher, Accountant, Store Manager, Employee, Student, Parent.

---

## 9. Accounts

### Chart of accounts

- Head name.
- Head type: Income or Expense.
- List: head ID, name, type, actions.
- No edit. Delete asks for confirmation and removes that one head.
- Empty text: “No account heads found.”
- Search, and page size 5, 10, 25, or 50.
- A head is not required to post income or expense. NEPATRONIX should require a head so the statement can be grouped.

### Add income and add expense

Both forms are the same three required fields:

- Date.
- Description.
- Amount. Any number, including decimals.

Sample that was posted and then removed: 18 Nov 2026, “Sample Income” $10, and “Sample Expense” $4.

### Account statement

- Date range. Default is the first of the month through today.
- Overview: income, expense, net margin.
- Rings:
  - Income ring = income / (income + expense).
  - Expense ring = expense / (income + expense).
  - Margin ring = net / income. When income is 0, the margin ring is 0.
  - With $10 income and $4 expense, the rings were 71.4%, 28.6%, and 60%.
  - With only a $450 fee, the rings were 100% income, 0% expense, 100% margin.
  - With only a $1,050 salary, the rings were 0% income, 100% expense, 0% margin, and the balance went negative.
  - With nothing posted, every ring is 0%. Do not show a 100% slice when both sides are zero.
- Daily Income and Daily Expense: one point per day in the selected range.
- Ledger columns: Date, Description, Expense, Income, Net Balance, Reference.
- Net balance is a running balance in date order.
- Reference is hidden until “Show References” is on. Manual rows say “by Admin.”
- Totals line repeats expense, income, and net.
- Reset Balance: sets the net balance to zero. Cannot be undone. It was not used.
- Delete Statement: permanently deletes every statement row, not one row. It was used only to remove sample rows after confirming they were the whole ledger.

Statement descriptions written by other modules:

- Fee collection: “Fee Submission for {Mon YY} of Student ID:- {registration}” on the income side.
- Salary: “Employee Salary Payment ID:- {employee id}” on the expense side.

---

## 10. Fees

### Generate fee invoice

Blocked until a bank exists. Three forms:

1. Student invoice. Fee month, due date, fine after the due date, bank, student search. Copies: Bank, Student, Institute.
2. Class invoice. Same fields, plus a class.
3. Family invoice. Same fields, plus a family. The family list is empty until families exist.

Printed student slip:

- Institute, father, class, fee month, issue date, due date.
- Bank block: name, address, account, instructions.
- Lines: monthly fee from the class, then admission, registration, art, transport, books, uniform, fine, others, and previous balance.
- Discount line. 10% of a $500 fee is $50.
- Total = particulars minus discount. For the sample, $450.
- Payable after the due date = total plus the late fine. A late fine of $50 made the after-due figure $500. The Fine particular on the slip stayed $0. The late fine is not the same field as the Fine particular.
- Generating the invoice creates a fee due. Defaulters became 1. It is not a payment and it does not post to the account statement. Deleting the class removed the student and the defaulter.

### Collect fees

Three modes:

- Student wise. Search by student. Fee month.
- Family wise. Month and family.
- Scan paid invoice. Locked on the free web. NEPATRONIX should accept a receipt number or a QR instead of staying locked.

Student fee form lines and stored names:

| Name | Line |
| --- | --- |
| amt1 | Monthly fee, from class tuition |
| amt2 | Admission |
| amt3 | Registration |
| amt4 | Art material |
| amt5 | Transport |
| amt6 | Books |
| amt7 | Uniform |
| amt8 | Fine |
| amt9 | Others |
| amt10 | Previous balance |
| amt11 | Discount amount. 10% of 500 = 50 |
| amt12 | Total, read only |
| amt13 | Deposit, required |
| amt14 | Due, read only |

Rules:

- Total = (amt1 + … + amt10) − amt11.
- Due = total − deposit.
- Changing the month checks whether that month was already charged. If the answer is YES, a modal says the monthly fee will not be added again, amt1–amt9 and the discount are zeroed, and an “already added” state is shown.
- “Already Added!” labels stay hidden until that check returns YES.

Sample payment that was posted and then removed:

- Monthly fee $500, discount $50, total $450, deposit $450, due $0.
- November then had 0 defaulters.
- The account statement gained an income row of $450, reference “by Admin.”
- Deleting the student made the paid slip say “No Fees Record.”
- The statement row remained until Delete Statement.

### Fees paid slip

- Fee month, default the current month.
- Student search by name or registration number. The receipt is generated from the hidden registration that the search fills in.
- Unknown student, or a student with no payment for that month: a slip headed “Fee Submission Slip” with only “No Fees Record. No fee record found for the selected student and period.”

After a real payment, three layouts:

- Detailed. Registration, student, guardian, class, serial number, submission date, fee month, every particular, discount, total, deposit, due, then a history table (date, month, total, deposit, due). Signed Prepared By, Checked By, Accounts Department.
- Mini. Person, serial, date, month, and the three amounts only.
- Thermal. Date, registration, name, class, month, total, deposit, balance, print time, and “Thank you for payment!”

Date formats differ on purpose in the original: “18 November, 2026” on the detailed copy, `2026-11-18` on the mini copy, and `18/11/2026` on the thermal copy. NEPATRONIX should use one institute date format on all three.

### Defaulters

- Filter by month.
- Empty text for a month with nobody owing: no fee defaulters for that month.
- Row actions: See Details, Send Reminder, Carry Forward Balance.
- Carry Forward writes the remaining amount into the next invoice’s previous balance.

### Locked fee tools to include

- Fees Structure.
- Discount Type. The walked product only has a percent on the student. A copy should also allow a fixed amount and a named discount reason.
- Fees Report.
- Delete Fees. This must delete one fee row and reverse its statement income. The original free web cannot do that.

---

## 11. Salary

### Pay salary

Search by employee. Inactive or unknown: “Employee not found or inactive.”

Form:

- Salary month.
- Payment date.
- Fixed salary, filled from the employee’s monthly salary. It is a number field.
- Bonus. The field name in the original is `bouns`.
- Deduction. The field name in the original is `fine`.
- Net = fixed + bonus − deduction, and the net cannot go below 0.
- If that employee already has this month, the server answers YES and the form shows “Salary for this employee has already been added for the selected month.”

Sample that was posted and then removed: fixed $1,000, bonus $100, deduction $50, net $1,050, month November 2026, date 18 Nov 2026.

### Salary paid slip

Search by employee id, name, or role. Proceed does nothing until a person is chosen.

With no matching payment, the page still prints both layouts at $0.

With a payment:

- Top line: name, id, role, month, date received, bonus, deduction, net.
- Detailed: the same fields, then a history table (serial, month, date, bonus, deduction, net). Signed Prepared By: the software name, Checked By, Accounts Department.
- Thermal: date, id, name, role, month, bonus, deduction, net, print time, and “Salary payment confirmation!”
- The original detailed slip misspells the labels as “Bouns” and “Detuction.” The thermal copy spells Deduction correctly and still says Bouns. NEPATRONIX should spell both words correctly.

### Ledger

- The payment is an expense: “Employee Salary Payment ID:- {id}.”
- The sample turned the running balance to −$1,050.
- Deleting the employee makes a later slip say “No Salary Record.”
- The statement row remains until Delete Statement.

### Locked salary tools to include

- Salary Sheet.
- Salary Report.
- A per-payment delete that reverses the expense row.

---

## 12. Attendance, as it works today

### Students

- Choose a date and a class, then open the sheet.
- Each student: Present, Leave, or Absent. Present is checked by default.
- Saving requires the sheet’s own save action. Opening the sheet does not save.
- Success text: “Attendance saved successfully.”
- The open-sheet request supplies the date and class to the save.

### Employees

- Same three statuses.
- The sheet also keeps a hidden time field. A manual mark stored Time as a dash and Type as blank.
- First save inserts. Opening the sheet again switches the button to update.
- Posting the insert action a second time added a second On Leave row for the same person and the same day. A copy must update the existing row for that person and date.

### Reports

Student report columns: Date, Day, Student ID, Name, Class, Status.

Counts: Total, Present, On Leave, Absent.

Date presets: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month. Default range is the first of the month through today.

Employee report columns: Date, Day, Employee ID, Name, Type, Status, Time.

Class-wise report: one date, every class. A class whose only student is on leave shows 0% present.

Card scan, scanner setup, and scan info are locked on the free web. They are replaced by the RFID module in section 20.

Monthly student and staff attendance reports are desktop-only. Include them.

---

## 13. Homework

Add:

- Date.
- Set by: Admin or a teacher.
- Class.
- Subject. The subject list loads only after a class is chosen. It stays empty before that.
- Detail.
- Attachment: JPG, PNG, GIF, WEBP, or PDF, max 100 KB.

List filters: date, class, teacher. A saved row shows teacher, class, subject, and the assignment text. Update exists. Delete asks “Are you sure to Delete?”

---

## 14. Live class

Host form:

- Title.
- Meeting ID, typed by the host. Join uses that code.
- Audience: All Students, All Teachers, Specific Class, Specific Student, Specific Teacher.
- Specific class shows the class list. Specific student or teacher shows a search and makes that person required.
- Duration, free text, for example “1 hour 30 minutes.”
- Message, 260 characters.

Create now or schedule:

- Schedule off: the button says Create & Join and opens the room in a new tab.
- Schedule on: date and start time become required, the button says Schedule, and the meeting stays on the list.

List filters: All Meetings, Today, Tomorrow, Self Hosted, Invitations. Empty text: “No meetings found.”

Card: audience, title, date, time, duration, message, Active switch, Join, Delete. Inactive greys out Join. Delete asks for confirmation.

A scheduled meeting with a message also posts that message into Messaging, in the matching group chat. Deleting the meeting does not delete the chat message. The original inbox has no delete. NEPATRONIX should delete or archive the notice when the meeting is deleted.

---

## 15. Messaging

Inbox:

- Chats, New Chat, and a search that filters by the chat title.
- Newest first.
- A group badge on audience chats such as All Students.
- Before a chat is opened, the pane describes the chat as being for admins, teachers, students, and staff, and it claims end-to-end encryption. NEPATRONIX must not show that claim unless messages are actually end-to-end encrypted. Ordinary server-stored school chat is not end-to-end encrypted.
- Header badge asks for an unread count. Above zero, the badge is pink. Zero clears it and turns it green. Opening a chat hides that chat’s own count.

Thread:

- Title, messages with a relative time, “Type a message,” a file, and Send.
- Send does nothing when both text and file are empty. The button reads “Sending..” while it posts.
- The thread reloads every 10 seconds, and pauses while the box is focused or already has text.
- On a narrow screen, opening a chat hides the list until Back.

New chat:

- To: All Students, All Employees, Specific Class, Specific Student, or Specific Employee.
- Class list, or a required person search, same pattern as live class.
- Message required, cut off at 260 characters. The form first shows the stale text “244 Character” until typing starts. Show the real remaining count immediately.
- Attach a file shows the name and an X to remove it. The page does not check size or type. NEPATRONIX should allow the same types as homework and reject anything over 100 KB before upload.
- There is no delete. Add delete and archive.

---

## 16. SMS

### Free SMS gateway

- Start Setup shows a QR code.
- Steps: Install and permit, log in with the admin credentials, check connection.
- Test SMS: phone and message. It was not sent during the walkthrough.
- The dashboard also advertises the gateway.

### Locked SMS tools to include

- Branded SMS.
- SMS Templates.
- Delivery status, opt-out, and a per-tenant SMS balance. The original test modal has no balance.

Send SMS from the dashboard quick action opens Messaging, not this gateway. Keep those as two different actions: in-app chat, and phone SMS.

---

## 17. Exams

### Create

- Name, start date, end date.
- The first text box on the page is the header search, not the exam name. The exam name has its own field.
- Status becomes Published.
- Edit reopens the same form.

### Setup

Table: subject, class default, total marks for this exam. An empty marks cell keeps the subject default. Saving with no subjects shows “No subjects assigned to this class yet.”

### Marks

- Columns: registration number, student name, hidden father name, then one number column per subject.
- Min 0, max the subject total, any step.
- Delete all marks cannot be undone. Ask for confirmation, and delete one student or one subject without wiping the exam.

### Result card

- Choose an exam, or the shortcuts for the last 2, last 3, or last 4 exams.
- With marks, for example 85 out of 100 in Mathematics: header, 85%, grade A+, PASS, exam summary, subject table with subject status Pass and overall PASS, and the sentence “He/She Scored 85 out of 100… Grade A+… Overall status is PASS.”
- Signed Prepared By, Checked By, Controller of Examination.
- Print and PDF.
- With no marks, the heading still prints and the body says “NO EXAM DATA FOUND YET.” Do not print an empty certificate-style heading.

### Locked exam tools to include

- Result Sheet.
- Exam Schedule.
- Date Sheet.
- Blank Award List.

---

## 18. Class tests

Save a test:

- Class, subject, date, total marks.
- Each student: obtained marks.
- Reopening the same class, subject, and date updates or deletes that test instead of inserting a second one.

Result columns: registration number, name, subject, date, total, obtained, percent.

Views:

- Class wise. An empty class says “No test results found for this class.”
- Class and subject.
- Student and subject.
- Date range. Class and subject are optional.
- Performance: registration, name, strong subjects, weak subjects, average percent.

A sample of 16 out of 20 was 80.00% and was listed as strong in that subject, with no weak subject, and a subject strong-percentage of 100. The cutoff that splits strong from weak is decided on the server and was not visible in the page. NEPATRONIX should make the cutoff a grading setting, default 60% weak and 80% strong.

---

## 19. Report card

Search by student registration.

Header: registration, name, class, date of birth, gender, admission date.

Blocks:

- Attendance percent.
- Overall score, grade, position.
- Cognitive exams: per subject, max marks, and rows for obtained, total, percent, grade, status, plus an overall row.
- Class comparison: class strength, average, max, min, this student’s position.
- Class tests per subject.
- Affective domain, all 0 on the free web because entry is desktop-only: Attentiveness, Honesty, Neatness, Perseverance, Politeness, Punctuality, Reliability, Self-control, Cooperation.
- Psychomotor domain, same limitation: Content Writing, Creativity, Religious Norms, Dancing, Music, Indoor Games, Outdoor Games, Exercise, Confidence.
- Comments. A sample with an 85% exam and four zero sections (attendance, tests, affective, psychomotor) produced an overall rating of 17% and 0.9 out of 5. That is the exam percent averaged with the empty sections. Do not average in sections that were never marked. Show them as “not rated.”

Print and PDF.

---

## 20. Certificates

- Template. The walked leave certificate is one template.
- Recipient type must be the lowercase value `student` or `staff`. The capitalized word “Student” saved the recipient as N/A.
- Student or staff picker.
- Achievement or reason, free text.
- Certificate date. On the leave certificate this date is the leave date.
- Generate.

Leave certificate text uses: student name, father, admission number, class, date of birth, admission date, certificate date, the typed reason, conduct “excellent,” a line that dues are cleared, and Authorized Signature.

Saved row: type, recipient type, recipient, date, print, delete.

Certificate Templates are desktop-only. Include a template editor. Do not hard-code “excellent” or “dues cleared.” Those must be fields.

---

## 21. Desktop-only modules to build anyway

These menu items open nothing on the free web. A 100% product includes them.

### Timetable

- Weekdays.
- Periods.
- Class rooms.
- Create a timetable.
- Generate for a class.
- Generate for a teacher.
- A slot is weekday + period + room + class + subject + teacher. A teacher, a room, and a class cannot be double-booked.

### Behaviour and skills

- Rate behaviours.
- Rate skills.
- Observations.
- Affective domain rating report.
- Psychomotor domain rating report.
- These ratings are what the report card’s affective and psychomotor blocks should read. The names are the lists in section 19.

### Online store and POS

- Store analytics.
- Product categories.
- Product tax.
- Products.
- New order.
- All orders.
- A sale can post to income on the account statement under a Store Income head.

### Reports that are locked

- Students monthly attendance.
- Staff monthly attendance.
- Fee collection report.
- Student progress report.
- Accounts report.
- Customised reports. A custom report is a saved set of columns, filters, and a date range, with print and export.

### People tools that are locked

- Fees structure and discount types.
- Manage families. A family has a name, a primary contact, and many students. Family invoices and family fee collection use it.
- Active / inactive students.
- Staff ID cards.
- Roles and permissions.

---

## 22. RFID attendance

This replaces the locked card-scan screens and writes the same attendance records the manual sheet uses. One person, one date, one status. A tap updates that row. It never inserts a second row.

### Devices

Each reader belongs to one institute.

- Device name, for example “Main gate in.”
- Device serial or MAC.
- Shared secret or API key, shown once.
- Location: campus, gate, building, room, or bus door.
- Direction: In, Out, or Both.
- Status: active, disabled, offline.
- Last seen time.

A reader that has not called in for 10 minutes is shown offline. Taps queued on the reader still upload when it reconnects, with the original tap time, not the upload time.

### Cards

- Card UID, unique inside the institute.
- Assigned to a student or an employee.
- Status: active, lost, blocked, spare.
- Issued date and returned date.

A UID cannot be active on two people. Reissuing a lost card blocks the old UID first.

### Tap rules

1. Unknown UID: store an unmatched tap and show it in an exceptions list. Do not mark anyone present.
2. Blocked or lost card: store the tap, do not mark present, and alert the admin.
3. First In tap of the day, before the cutoff, marks Present and stores the in-time.
4. A later In tap the same day only refreshes the last-seen time. It does not create a second attendance row.
5. An Out tap stores the out-time. Status stays Present.
6. No In tap by the cutoff time marks Absent. The cutoff is an institute setting, default 15 minutes after the period or shift start.
7. A manual Leave for that date wins over taps. Taps are still stored, and the status stays Leave.
8. A manual edit after taps is kept and flagged “edited by {user}.” A later tap must not silently overwrite an edited row.
9. Debounce: ignore a second tap from the same card on the same reader within 30 seconds.

Student and employee reports gain Type = RFID and Time = the in-time. Manual rows keep Type = Manual.

### Screens

- Readers: list, add, disable, last seen, today’s tap count.
- Cards: assign, replace, block, unassigned spares.
- Live tap feed: time, person, photo, class or role, reader, direction. Unmatched UIDs are highlighted.
- Exceptions: unknown, blocked, duplicate, and edited rows.
- The existing student and employee attendance reports, class-wise percent, and the monthly reports read these rows.
- Optional SMS or in-app message to the parent on the first In and on Out. Off by default. Uses the SMS balance.

### Parent and student view

A parent sees only their own children. A student sees only their own row: today’s status, in-time, out-time, and the month calendar. They cannot see other students or the raw UID of another card.

---

## 23. GPS tracking

A separate SaaS module for buses and, optionally, staff who are out of campus. It is tenant-scoped. A parent sees only the bus their child is assigned to, and only during that bus’s active trip.

### Records

Vehicle:

- Name, plate number, type (bus, van, other).
- Capacity.
- Tracker device id, or the driver’s phone as the tracker.
- Status.

Route:

- Name.
- Ordered stops. Each stop has a name, latitude, longitude, and a radius in metres, default 80.
- Assigned vehicle and driver.
- Students assigned to a stop.

Trip:

- Route, vehicle, driver, date, planned start.
- Status: scheduled, running, completed, cancelled.
- Actual start and end.

Location point, sent at least every 15 seconds while a trip is running, and every 2 minutes while the vehicle is idle and ignition is on:

- Vehicle, trip, latitude, longitude.
- Speed, heading.
- Device time and server time.
- Accuracy in metres. Ignore points with accuracy worse than 100 metres.

### Map screens

- Live map for the institute: vehicles, last update age, speed, current stop, next stop. A vehicle with no point for 3 minutes is marked stale.
- Trip playback: a time slider over the stored points.
- Route editor: draw or reorder stops on the map.
- Parent view: one bus, the child’s stop, and an ETA. No other students’ names.

### Alerts

- Speeding: over an institute limit, default 50 km/h, for more than 15 seconds.
- Off route: farther than the route corridor, default 150 metres, for more than 60 seconds.
- Stop arrival and departure, using the stop radius.
- Trip not started 10 minutes after the planned time.
- SOS from the driver app.
- Tracker offline during a running trip.

Alerts go to the transport admin in the dashboard and, if enabled, as SMS. Parents receive arrival at their child’s stop only, not every alert.

### Driver app

- Start and end the assigned trip.
- Send location while the trip is running.
- SOS.
- See the stop list and the student counts. Not student phone numbers.

### Privacy and retention

- Location history is kept for 90 days, then deleted or aggregated to trip summaries. This is a tenant setting.
- Location is collected only for a registered vehicle or an employee who has started a tracked duty. No always-on personal tracking.
- Export and delete are available to the institute admin from the account tools.

### How it posts into the rest of the product

- A student on a bus is not automatically marked present at school. Campus RFID still marks school attendance.
- Optional bus-door RFID: an In tap on the bus reader records “boarded,” and the school gate reader still records school Present. These are two different devices and two different events.
- GPS does not create fee or salary rows.

---

## 24. SaaS rules

Every institute is a tenant. Every row above belongs to exactly one tenant. A user in one institute cannot read another institute’s students, cards, vehicles, or locations.

Plans:

- Core: the school admin in this document, including the modules the free web locks.
- RFID add-on: a device quota and a card quota.
- GPS add-on: a vehicle quota and a point-retention setting.
- SMS add-on: a message balance.

An unverified email shows the same banner the dashboard shows now, and it does not block data entry. Deleting the account deletes the tenant’s students, staff, fees, attendance, RFID events, and GPS points.

Audit, at minimum: who collected a fee, who paid a salary, who edited an attendance row, who assigned a card, and who exported a location history.

---

## 25. Build order

1. Tenant, admin login, institute profile, theme, grading, rules.
2. Employees, classes, subjects, students, families, active or inactive.
3. Chart of accounts, income, expense, statement, including per-row reverse.
4. Fee particulars, banks, invoices, collection, slips, defaulters, delete-one-fee.
5. Salary payment, slips, delete-one-salary.
6. Manual attendance that updates one row per person per day.
7. Homework, exams, class tests, report card, certificates.
8. Messaging, SMS, live class.
9. Timetable, behaviour ratings, store.
10. RFID devices, cards, taps, and the attendance reports reading those taps.
11. Vehicles, routes, trips, live map, playback, and parent ETA.

Do not go live with fee or salary collection until a single payment can be reversed without using Delete Statement.
