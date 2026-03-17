import React from "react";
import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

// ─── Base ────────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

// ─── Generic Variants ────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-10 w-full mt-4" />
    </div>
  );
}

export function SkeletonTextLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

// ─── Order Card (used in OrderHistory & OrderTrackingPage) ───────────────────
export function SkeletonOrderCard() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <div className="flex flex-col md:flex-row">
        <div className="p-5 flex-1 space-y-4">
          {/* Badge + ID */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Title + date */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-48" />
          </div>
          {/* Item rows */}
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
        {/* Right action column */}
        <div className="w-full md:w-32 bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100 p-4 flex md:flex-col items-center justify-center gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Kitchen Order Card (used in KitchenPage) ─────────────────────────────────
export function SkeletonKitchenCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Menu Item Card (used in AdminPage Menu tab and LandingPage) ──────────────
export function SkeletonMenuCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Table Row (used in AdminPage Staff & Orders tabs) ───────────────────────
export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-20 rounded-xl" />
    </div>
  );
}

// ─── Order Tracking Card (timeline style) ─────────────────────────────────────
export function SkeletonTrackingCard() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      {/* Timeline steps */}
      <div className="flex items-center justify-between gap-2 py-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      {/* Items list */}
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Total */}
      <div className="flex justify-between pt-2 border-t border-slate-100">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}
// ─── Dashboard Skeleton (Hero + Planner Layout) ──────────────────────────────
export function SkeletonDashboard() {
  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6 md:gap-8 animate-pulse mt-2 sm:mt-4 overflow-x-hidden">
      {/* Hero Banner Skeleton */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-200/50 p-6 md:p-12 border border-slate-200">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-4 w-full lg:max-w-lg">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-12 w-3/4 rounded-xl" />
            <Skeleton className="h-12 w-1/2 rounded-xl" />
            <div className="flex gap-4 mt-4">
              <Skeleton className="h-12 w-28 rounded-xl" />
              <Skeleton className="h-12 w-28 rounded-xl" />
            </div>
          </div>
          <div className="w-full sm:w-[300px] h-48 rounded-[2.5rem] bg-slate-300/30 border border-slate-300/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Planner */}
        <div className="lg:col-span-8 space-y-8">
          {/* Timeline Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-3 overflow-hidden pb-2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <Skeleton key={i} className="h-28 w-20 flex-shrink-0 rounded-3xl" />
              ))}
            </div>
          </div>

          {/* Day View Skeleton */}
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col gap-4 p-6 rounded-2xl border border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-2xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Status */}
        <div className="lg:col-span-4 space-y-8">
          <Skeleton className="h-80 w-full rounded-[2.5rem]" />
          <Skeleton className="h-96 w-full rounded-[2.5rem]" />
          <Skeleton className="h-40 w-full rounded-[2.5rem]" />
        </div>
      </div>
    </div>
  );
}
