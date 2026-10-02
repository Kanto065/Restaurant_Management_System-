import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "text-muted-foreground ring-1 ring-inset ring-border",
        success: "bg-success-soft text-success",
        accent: "bg-accent-soft text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Small coloured dot + label, for live/suspended style states. */
function StatusDot({ tone, children }: { tone: "success" | "destructive" | "muted" | "accent"; children: React.ReactNode }) {
  const dot = { success: "bg-success", destructive: "bg-destructive", muted: "bg-muted-foreground/50", accent: "bg-accent" }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}

export { Badge, StatusDot, badgeVariants };
