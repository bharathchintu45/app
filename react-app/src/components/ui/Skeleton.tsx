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
    <div className="w-full flex flex-col gap-4 sm:gap-6 animate-pulse mt-2 sm:mt-4 overflow-x-hidden min-w-0">
      {/* Premium Hero Banner Skeleton */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-900 p-4 md:p-8 shadow-2xl shadow-slate-900/40">
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16">
          <div className="space-y-5 w-full lg:max-w-lg">
            <Skeleton className="h-6 w-32 rounded-full bg-slate-800" />
            <Skeleton className="h-12 w-3/4 rounded-xl bg-slate-800" />
            <Skeleton className="h-12 w-1/2 rounded-xl bg-slate-800" />
            <div className="flex gap-4 mt-4">
              <Skeleton className="h-12 w-28 rounded-xl bg-slate-800" />
              <Skeleton className="h-12 w-28 rounded-xl bg-slate-800" />
            </div>
          </div>
          {/* MacroBalanceCard Skeleton */}
          <div className="w-full lg:w-[350px] shrink-0 h-48 rounded-[2.5rem] bg-slate-800/80 border border-slate-700/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start min-w-0 w-full">
        {/* Left Column: Planner Section */}
        <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6 md:gap-8 min-w-0 w-full">
          {/* Timeline Selector Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48 bg-slate-200/70" />
            </div>
            <div className="flex gap-2 sm:gap-3 overflow-hidden pb-4 pt-2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <Skeleton key={i} className="h-28 w-[4.5rem] sm:w-[5.5rem] flex-shrink-0 rounded-2xl md:rounded-[2rem] bg-slate-200/70" />
              ))}
            </div>
          </div>

          {/* Day View Card Skeleton */}
          <div className="border-none bg-white shadow-2xl shadow-slate-900/5 overflow-hidden rounded-2xl md:rounded-[2.5rem] p-0">
            <div className="bg-slate-50/50 px-4 py-4 md:px-8 md:py-6 border-b border-slate-100 flex items-center justify-between">
              <Skeleton className="h-8 w-40 sm:w-64 bg-slate-200/70" />
              <Skeleton className="h-10 w-24 sm:w-32 rounded-xl bg-slate-200/70" />
            </div>
            <div className="p-3 md:p-8 space-y-4 md:space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="rounded-[2.5rem] bg-white border border-slate-200 shadow-sm p-4 h-48 flex items-center gap-6">
                   <Skeleton className="w-32 h-32 rounded-2xl bg-slate-100 shrink-0" />
                   <div className="flex-1 space-y-3">
                     <Skeleton className="h-4 w-24 bg-slate-100" />
                     <Skeleton className="h-6 w-48 bg-slate-200/70" />
                     <Skeleton className="h-4 w-32 bg-slate-100" />
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Tracking & Status */}
        <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5 md:gap-8 min-w-0 w-full">
          {/* Subscription Details Skeleton */}
          <div className="border-none bg-white shadow-xl shadow-slate-900/5 overflow-hidden rounded-2xl md:rounded-[2.5rem]">
            <div className="bg-slate-950 px-6 py-6 md:px-8 md:py-6 space-y-3">
              <Skeleton className="h-4 w-24 bg-slate-800" />
              <Skeleton className="h-8 w-48 bg-slate-700" />
              <Skeleton className="h-4 w-32 bg-slate-800" />
            </div>
            <div className="px-6 py-6 md:px-8 md:py-6 space-y-5">
              <Skeleton className="h-10 w-full bg-slate-100 rounded-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 w-full bg-slate-100 rounded-2xl" />
                <Skeleton className="h-20 w-full bg-slate-100 rounded-2xl" />
              </div>
            </div>
          </div>
          
          {/* Next Delivery Card Skeleton */}
          <Skeleton className="h-40 w-full rounded-2xl md:rounded-[2.5rem] bg-slate-200/70" />
        </div>
      </div>
    </div>
  );
}
