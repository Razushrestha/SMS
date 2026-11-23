export type GradeBand = { grade: string; lower: number; upper: number; pass: boolean };

export const defaultBands: GradeBand[] = [
  { grade: "A+", lower: 80, upper: 100, pass: true },
  { grade: "A", lower: 70, upper: 79, pass: true },
  { grade: "B+", lower: 60, upper: 69, pass: true },
  { grade: "B", lower: 50, upper: 59, pass: true },
  { grade: "C", lower: 40, upper: 49, pass: true },
  { grade: "D", lower: 33, upper: 39, pass: true },
  { grade: "F", lower: 0, upper: 32, pass: false },
];

export function gradeFor(percent: number, bands: GradeBand[] = defaultBands) {
  const ordered = [...bands].sort((a, b) => b.lower - a.lower);
  return ordered.find((band) => percent >= band.lower && percent <= band.upper) ?? ordered.find((band) => percent >= band.lower) ?? ordered[ordered.length - 1];
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
