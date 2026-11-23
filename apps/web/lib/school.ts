export const staffRoles = [
  { value: "principal", label: "Principal" },
  { value: "management_staff", label: "Management Staff" },
  { value: "teacher", label: "Teacher" },
  { value: "accountant", label: "Accountant" },
  { value: "store_manager", label: "Store Manager" },
  { value: "other", label: "Other" },
];

export function roleLabel(value: string) {
  return staffRoles.find((role) => role.value === value)?.label ?? value;
}

export const religions = ["Hinduism", "Buddhism", "Islam", "Christianity", "Kirat", "Sikhism", "Other"];
