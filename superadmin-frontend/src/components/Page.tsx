import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-4', className)}>
      <div className="eyebrow">{label}</div>
      <div className="num mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Composed empty state - never just a blank table. */
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A labelled settings row: text on the left, control on the right. */
export function SettingRow({ title, description, children, className }: {
  title: ReactNode; description?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-6 px-5 py-4', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
