import { useState } from 'react';
import { Clock, Loader2, Minus, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultMinutesFor, useNow, useOrderTimes } from '@/hooks/useOrderTimes';
import { describeCountdown, formatClock, minutesUntil } from '@/lib/time';

const LABELS: Record<string, string> = { Delivery: 'Deliver by', Collection: 'Ready by', DineIn: 'Serve by' };

/**
 * The order list's "time" column: when the order is due (12-hour clock) and a live countdown,
 * coloured by urgency. Until the order is confirmed the clock hasn't started, so it shows the
 * planned minutes instead ("20 min, starts when confirmed"). Clicking opens a small editor with
 * quick +/- buttons and a preview of the resulting clock time.
 */
export default function OrderTimeCell({ orderType, estimatedReadyAt, estimatedMinutes, finished, onSet, pending }: {
  orderType: string;
  estimatedReadyAt: string | null;
  estimatedMinutes: number | null;
  finished: boolean;
  onSet: (minutesFromNow: number) => void;
  pending: boolean;
}) {
  const now = useNow();
  const times = useOrderTimes();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(0);

  const remaining = estimatedReadyAt ? minutesUntil(estimatedReadyAt, now) : null;
  const notStarted = !estimatedReadyAt && estimatedMinutes !== null;
  const tone = finished || remaining === null
    ? 'border-border bg-muted/40 text-muted-foreground'
    : remaining < 0
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      : remaining <= 5
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
        : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';

  function openEditor(next: boolean) {
    setOpen(next);
    if (next) {
      // Editing starts from the order's current time (as minutes from now), or the
      // restaurant's default for this order type when none is set yet.
      setMinutes(remaining !== null && remaining > 0 ? remaining : estimatedMinutes ?? defaultMinutesFor(orderType, times));
    }
  }

  const clamp = (m: number) => Math.max(0, Math.min(600, m));
  const preview = notStarted ? `${minutes} min after confirming` : formatClock(new Date(now + minutes * 60000));

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full rounded-md border px-2.5 py-1.5 text-left transition-colors hover:brightness-95 ${tone}`}
          title="Change the time"
        >
          <span className="block text-[10px] font-medium uppercase tracking-wide opacity-80">
            {LABELS[orderType] ?? 'Due'}
          </span>
          {estimatedReadyAt ? (
            <>
              <span className="block text-base font-semibold leading-tight">{formatClock(estimatedReadyAt)}</span>
              {!finished && remaining !== null && (
                <span className="block text-xs font-medium">{describeCountdown(remaining)}</span>
              )}
            </>
          ) : notStarted ? (
            <>
              <span className="block text-base font-semibold leading-tight">{estimatedMinutes} min</span>
              <span className="block text-xs font-medium">starts when confirmed</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-sm font-medium"><Clock className="h-3.5 w-3.5" />Set time</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{LABELS[orderType] ?? 'Due'}</p>
            <p className="text-xs text-muted-foreground">
              Default for {orderType === 'DineIn' ? 'dine-in' : orderType.toLowerCase()}: {defaultMinutesFor(orderType, times)} min
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-minutes" className="text-xs">{notStarted ? 'Minutes after the order is confirmed' : 'Minutes from now'}</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="5 minutes less"
                onClick={() => setMinutes((m) => clamp(m - 5))}><Minus className="h-4 w-4" /></Button>
              <Input id="order-minutes" type="number" min={0} max={600} value={minutes} className="h-9 text-center"
                onChange={(e) => setMinutes(clamp(parseInt(e.target.value || '0', 10)))} />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="5 minutes more"
                onClick={() => setMinutes((m) => clamp(m + 5))}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <Button key={m} type="button" size="sm" variant={minutes === m ? 'default' : 'secondary'} className="h-7 px-2 text-xs"
                  onClick={() => setMinutes(m)}>{m}m</Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">New time</span>
            <span className="font-semibold">{preview}</span>
          </div>
          <Button type="button" className="w-full" disabled={pending}
            onClick={() => { onSet(minutes); setOpen(false); }}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{notStarted ? `Set to ${minutes} min` : `Set to ${preview}`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
