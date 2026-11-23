export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const affectiveTraits = [
  "Attentiveness",
  "Honesty",
  "Neatness",
  "Perseverance",
  "Politeness",
  "Punctuality",
  "Reliability",
  "Self-control",
  "Cooperation",
];

export const psychomotorTraits = [
  "Content Writing",
  "Creativity",
  "Religious Norms",
  "Dancing",
  "Music",
  "Indoor Games",
  "Outdoor Games",
  "Exercise",
  "Confidence",
];

export function domainOf(trait: string) {
  if (affectiveTraits.includes(trait)) return "affective" as const;
  if (psychomotorTraits.includes(trait)) return "psychomotor" as const;
  return null;
}
