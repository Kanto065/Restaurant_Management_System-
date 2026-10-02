import { cn } from '@/lib/utils';

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn('grid h-7 w-7 place-items-center rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground', className)}>
      P
    </span>
  );
}
