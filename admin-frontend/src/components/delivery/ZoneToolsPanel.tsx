import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Loader2, MapPin, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { LatLng } from '@/lib/geo';

export interface ZoneCheckMiss {
  chargedAs: string;
  count: number;
  postcodes: string[];
  points: LatLng[];
}

export interface ZoneCheckResult {
  name: string;
  zoneIds: string[];
  found: boolean;
  areaSource: string | null;
  areaLabel: string | null;
  checked: number;
  correct: number;
  misses: ZoneCheckMiss[];
}

interface ZoneCheckReport {
  zones: ZoneCheckResult[];
  serviceProblem: boolean;
}

interface AutoDrawOutcome {
  drawn: string[];
  notFound: string[];
  kept: string[];
  serviceProblem: boolean;
}

interface Props {
  zones: { id: string; name: string; deliveryFee: number }[];
  money: (n: number) => string;
  /** Show a zone's wrongly charged postcodes on the map (null clears). */
  onShowMisses: (result: ZoneCheckResult | null) => void;
  shownName: string | null;
}

/** Colour for a zone's match score. */
const scoreClass = (pct: number) => (pct >= 95 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600');

/**
 * "Check zones" (does each drawn shape match where its named area really is?) and "Redraw
 * from names" (draw the shapes from those real areas). Both use OpenStreetMap / Ordnance
 * Survey area data looked up by the zone's name - slow the first time, cached after.
 */
export default function ZoneToolsPanel({ zones, money, onShowMisses, shownName }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [report, setReport] = useState<ZoneCheckReport | null>(null);
  const [redrawOpen, setRedrawOpen] = useState(false);
  const [redrawIds, setRedrawIds] = useState<Set<string>>(new Set());

  const check = useMutation({
    mutationFn: () => api.get<ZoneCheckReport>('/api/admin/delivery-zones/check'),
    onSuccess: (res) => setReport(res.data ?? null),
    onError: (e: Error) => toast({ title: "Couldn't check the zones", description: e.message, variant: 'destructive' }),
  });

  const redraw = useMutation({
    mutationFn: (keepIds: string[]) =>
      api.post<AutoDrawOutcome>('/api/admin/delivery-zones/auto-draw', { zoneIds: null, keepZoneIds: keepIds }),
    onSuccess: (res) => {
      const out = res.data;
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-zones'] });
      setRedrawOpen(false);
      onShowMisses(null);
      setReport(null);
      toast({
        title: `Redrew ${out?.drawn.length ?? 0} zones`,
        description: [
          out?.notFound.length ? `Couldn't find ${out.notFound.join(', ')} - left as they were.` : '',
          'Each redrawn zone keeps its old area: edit the zone and click "Restore previous area" to undo.',
        ].filter(Boolean).join(' '),
      });
      check.mutate(); // show the new scores straight away
    },
    onError: (e: Error) => toast({ title: "Couldn't redraw the zones", description: e.message, variant: 'destructive' }),
  });

  const openRedraw = () => {
    setRedrawIds(new Set(zones.map((z) => z.id)));
    setRedrawOpen(true);
  };
  const toggle = (id: string, on: boolean) =>
    setRedrawIds((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Check your zones</CardTitle>
        <CardDescription>
          Compares each zone with where that area really is (OpenStreetMap / Ordnance Survey) using its real postcodes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => check.mutate()} disabled={check.isPending || redraw.isPending}>
            {check.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
            {check.isPending ? 'Checking...' : 'Check zones'}
          </Button>
          <Button size="sm" variant="outline" onClick={openRedraw} disabled={check.isPending || redraw.isPending || zones.length === 0}>
            <Wand2 className="w-4 h-4 mr-2" />Redraw from names
          </Button>
        </div>
        {check.isPending && <p className="text-xs text-muted-foreground">The first check looks up every area name, which can take up to a minute.</p>}

        {report && (
          <div className="space-y-1.5">
            {report.serviceProblem && (
              <p className="text-xs text-amber-600">Some area or postcode lookups didn't answer - try again in a minute for a full result.</p>
            )}
            <div className="divide-y rounded-md border max-h-[45vh] overflow-y-auto">
              {report.zones.map((z) => {
                const pct = z.checked ? Math.round((100 * z.correct) / z.checked) : 0;
                const wrong = z.checked - z.correct;
                return (
                  <div key={z.name} className={`px-3 py-2 text-sm ${shownName === z.name ? 'bg-muted' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{z.name}</span>
                      {!z.found ? (
                        <span className="text-xs text-muted-foreground shrink-0">area not found</span>
                      ) : z.checked === 0 ? (
                        <span className="text-xs text-muted-foreground shrink-0">no postcodes to check</span>
                      ) : (
                        <span className={`font-semibold shrink-0 ${scoreClass(pct)}`}>{pct}% right</span>
                      )}
                    </div>
                    {z.found && z.checked > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {z.correct} of {z.checked} postcodes charged as {z.name}
                        {z.areaSource && <> · {z.areaSource}</>}
                      </p>
                    )}
                    {!z.found && (
                      <p className="text-xs text-muted-foreground">Can't be checked automatically - use the postcode dots on the map.</p>
                    )}
                    {wrong > 0 && (
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <p className="text-xs text-red-600">
                          Charged wrongly: {z.misses.map((m) => `${m.count} as ${m.chargedAs}`).join(', ')}
                        </p>
                        <Button
                          size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0"
                          onClick={() => onShowMisses(shownName === z.name ? null : z)}
                        >
                          <MapPin className="w-3 h-3 mr-1" />{shownName === z.name ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={redrawOpen} onOpenChange={(open) => !redraw.isPending && setRedrawOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redraw zones from their names</DialogTitle>
            <DialogDescription>
              Each ticked zone is redrawn from where that area really is. Unticked zones are left exactly as they are, and the
              new areas won't cover them. Every redrawn zone keeps its current area as a backup you can restore.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto divide-y rounded-md border">
            {zones.map((z) => (
              <label key={z.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                <Checkbox checked={redrawIds.has(z.id)} onCheckedChange={(v) => toggle(z.id, v === true)} />
                <span className="flex-1">{z.name}</span>
                <span className="text-muted-foreground">{money(z.deliveryFee)}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Names that can't be found are left as they are. This can take up to a minute.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedrawOpen(false)} disabled={redraw.isPending}>Cancel</Button>
            <Button
              onClick={() => redraw.mutate(zones.filter((z) => !redrawIds.has(z.id)).map((z) => z.id))}
              disabled={redraw.isPending || redrawIds.size === 0}
            >
              {redraw.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Redraw {redrawIds.size} zone{redrawIds.size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
