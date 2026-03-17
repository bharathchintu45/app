import { cn } from "../../lib/utils";

export function LuxuryLabel({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200/50 bg-white/50 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-slate-900" />
      {text}
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: any;
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 sm:gap-4", className)}>
      <div className="flex flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 p-2 sm:p-3 text-slate-900 shadow-inner">
        <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 md:text-2xl truncate">{title}</h2>
        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 truncate">{subtitle}</p>
      </div>
    </div>
  );
}
