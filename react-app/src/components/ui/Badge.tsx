import React from "react";
import { cn } from "../../lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm",
        className
      )}
    >
      {children}
    </span>
  );
}
