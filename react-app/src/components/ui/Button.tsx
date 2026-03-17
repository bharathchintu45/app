import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children?: React.ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-black shadow-sm shadow-slate-900/10",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border-2 border-slate-200 bg-transparent text-slate-900 hover:bg-slate-50 hover:text-black hover:border-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };

  const sizes = {
    sm: "h-9 px-3 text-xs",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-8 text-base",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : null}
      {children}
    </motion.button>
  );
}
