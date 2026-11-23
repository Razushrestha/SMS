"use client";

import type { PortalStudent } from "@/lib/api";

export function ChildPicker({
  options,
  selected,
  onSelect,
}: {
  options: PortalStudent[];
  selected: PortalStudent | null;
  onSelect: (child: PortalStudent) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((child) => (
        <button
          key={child.id}
          type="button"
          className={selected?.id === child.id ? "esk-btn-primary" : "esk-btn-ghost"}
          onClick={() => onSelect(child)}
        >
          {child.name}
          <span className="ml-1 text-xs opacity-70">· {child.className}</span>
        </button>
      ))}
    </div>
  );
}
