import { useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle, CheckCircle2, Edit, Loader2, MapPin, PenLine, Plus, Search, Shapes, Trash2, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { pointInPolygon, polygonsOverlap, ZONE_COLOURS, type LatLng } from '@/lib/geo';
import ZoneMap, { type MapView, type MapZone, type PostcodeDot, type TestPin, type ZoneMapHandle } from '@/components/delivery/ZoneMap';

interface DeliveryZone {
  id: string;
  name: string;
  deliveryFee: number;
  minimumOrderAmount: number;
  isActive: boolean;
  boundary: LatLng[] | null;
  colour: string;
}

interface DeliverySettings {
  maxDeliveryMiles: number;
  outsideZoneDeliveryFee: number | null;
  outsideZoneMinimumOrder: number | null;
  restaurantPostcode: string;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
}

interface DeliveryTest {
  quote: {
    canDeliver: boolean;
    postcode: string | null;
    deliveryFee: number;
    minimumOrderAmount: number;
    zoneName: string | null;
    inZone: boolean;
    message: string | null;
  };
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
}

interface MapPostcode {
  postcode: string;
  latitude: number;
  longitude: number;
}

/** Postcode dots appear from this zoom in (about 3 km across) - further out there'd be thousands. */
const POSTCODE_ZOOM = 15;

function milesBetween(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

type ZonePayload = {
  name: string;
  deliveryFee: number;
  minimumOrderAmount: number;
  isActive: boolean;
  boundary: LatLng[] | null;
  colour: string;
};

type FormState = { name: string; deliveryFee: string; minimumOrderAmount: string; isActive: boolean; colour: string };

const toPayload = (z: DeliveryZone, overrides: Partial<ZonePayload> = {}): ZonePayload => ({
  name: z.name,
  deliveryFee: z.deliveryFee,
  minimumOrderAmount: z.minimumOrderAmount,
  isActive: z.isActive,
  boundary: z.boundary,
  colour: z.colour,
  ...overrides,
});

const DeliveryZones = () => {
  const { toast } = useToast();
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const mapRef = useRef<ZoneMapHandle>(null);
  const money = (n: number) => `${currency}${n.toFixed(2)}`;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [drawingForId, setDrawingForId] = useState<string | null>(null);
  const [dialogZone, setDialogZone] = useState<DeliveryZone | 'new' | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', deliveryFee: '', minimumOrderAmount: '15', isActive: true, colour: ZONE_COLOURS[0] });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testPostcode, setTestPostcode] = useState('');
  const [testResult, setTestResult] = useState<DeliveryTest | null>(null);
  const [settingsForm, setSettingsForm] = useState<{ miles: string; fee: string; min: string } | null>(null);
  const [view, setView] = useState<MapView | null>(null);

  const zonesQuery = useQuery({
    queryKey: ['admin', 'delivery-zones'],
    queryFn: () => api.get<DeliveryZone[]>('/api/admin/delivery-zones'),
  });
  const settingsQuery = useQuery({
    queryKey: ['admin', 'delivery-settings'],
    queryFn: () => api.get<DeliverySettings>('/api/admin/delivery-zones/settings'),
  });

  const zones = useMemo(() => zonesQuery.data?.data ?? [], [zonesQuery.data]);

  // Real postcodes in view (zoomed in only), so the owner can see what each shape covers.
  const showPostcodes = !!view && view.zoom >= POSTCODE_ZOOM;
  const viewKey = view ? [view.south, view.west, view.north, view.east].map((n) => n.toFixed(3)).join(',') : '';
  const postcodesQuery = useQuery({
    queryKey: ['admin', 'map-postcodes', viewKey],
    queryFn: () => api.get<MapPostcode[]>(
      `/api/admin/delivery-zones/postcodes?south=${view!.south}&west=${view!.west}&north=${view!.north}&east=${view!.east}`),
    enabled: showPostcodes,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const settings = settingsQuery.data?.data;
  const activeZones = zones.filter((z) => z.isActive);
  const highestFee = activeZones.length ? Math.max(...activeZones.map((z) => z.deliveryFee)) : null;
  const highestMin = activeZones.length ? Math.max(...activeZones.map((z) => z.minimumOrderAmount)) : null;
  const outsideFee = settings?.outsideZoneDeliveryFee ?? highestFee;
  const outsideMin = settings?.outsideZoneMinimumOrder ?? highestMin ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-zones'] });
    setTestResult(null); // prices/shapes changed - an old test answer could be wrong now
  };
  const onError = (error: Error) => toast({ title: 'Could not save', description: error.message, variant: 'destructive' });

  const createMutation = useMutation({
    mutationFn: (payload: ZonePayload) => api.post<DeliveryZone>('/api/admin/delivery-zones', payload),
    onSuccess: (res) => {
      invalidate();
      setDialogZone(null);
      const created = res.data;
      if (created) {
        setSelectedId(created.id);
        setDrawingForId(created.id); // straight on to drawing its shape
        toast({ title: 'Zone added', description: 'Now draw its area on the map.' });
      }
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ZonePayload }) => api.put<DeliveryZone>(`/api/admin/delivery-zones/${id}`, payload),
    onSuccess: () => invalidate(),
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/delivery-zones/${id}`),
    onSuccess: () => { toast({ title: 'Zone deleted' }); invalidate(); },
    onError,
    onSettled: () => setDeleteId(null),
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: { maxDeliveryMiles: number; outsideZoneDeliveryFee: number | null; outsideZoneMinimumOrder: number | null }) =>
      api.put<DeliverySettings>('/api/admin/delivery-zones/settings', payload),
    onSuccess: () => {
      toast({ title: 'Saved', description: 'Delivery limit and "anywhere else" price updated.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-settings'] });
      setSettingsForm(null);
      setTestResult(null);
    },
    onError,
  });

  const testMutation = useMutation({
    mutationFn: (where: string | { lat: number; lng: number }) => api.get<DeliveryTest>(
      typeof where === 'string'
        ? `/api/admin/delivery-zones/test?postcode=${encodeURIComponent(where)}`
        : `/api/admin/delivery-zones/test?lat=${where.lat}&lng=${where.lng}`),
    onSuccess: (res) => {
      setTestResult(res.data ?? null);
      if (res.data?.quote.postcode) setTestPostcode(res.data.quote.postcode);
    },
    onError,
  });

  // ---- warnings: what's wrong or surprising about the current setup ----
  const warnings = useMemo(() => {
    const list: { title: string; text: string }[] = [];
    if (settings && settings.restaurantLatitude === null) {
      list.push({
        title: "Your restaurant isn't on the map",
        text: `We couldn't find your postcode "${settings.restaurantPostcode}". Fix it in Restaurant Info - until then customers can't order delivery online.`,
      });
    }
    const undrawn = activeZones.filter((z) => !z.boundary);
    if (undrawn.length > 0) {
      list.push({
        title: `${undrawn.length} zone${undrawn.length === 1 ? ' has' : 's have'} no area drawn yet`,
        text: `${undrawn.map((z) => z.name).join(', ')}. No address matches ${undrawn.length === 1 ? 'it' : 'them'} until drawn - customers there pay the "anywhere else" price.`,
      });
    }
    const drawn = activeZones.filter((z) => z.boundary);
    const overlaps: string[] = [];
    for (let i = 0; i < drawn.length; i++) {
      for (let j = i + 1; j < drawn.length; j++) {
        if (polygonsOverlap(drawn[i].boundary!, drawn[j].boundary!)) {
          const cheaper = drawn[i].deliveryFee <= drawn[j].deliveryFee ? drawn[i] : drawn[j];
          overlaps.push(drawn[i].deliveryFee === drawn[j].deliveryFee
            ? `${drawn[i].name} and ${drawn[j].name}`
            : `${drawn[i].name} and ${drawn[j].name} (the overlap pays ${cheaper.name}'s ${money(cheaper.deliveryFee)})`);
        }
      }
    }
    if (overlaps.length > 0) {
      list.push({
        title: `${overlaps.length} overlapping area${overlaps.length === 1 ? '' : 's'}`,
        text: `${overlaps.join('; ')}. Where zones overlap, the customer pays the cheaper one.`,
      });
    }
    return list;
  }, [settings, activeZones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each postcode dot takes the colour of the zone that would price it - the same rules as
  // checkout (cheapest zone wins; grey = "anywhere else"; black = beyond the delivery limit).
  const restaurantPoint: LatLng | null = settings?.restaurantLatitude != null && settings?.restaurantLongitude != null
    ? [settings.restaurantLatitude, settings.restaurantLongitude] : null;
  const postcodeDots: PostcodeDot[] = !showPostcodes || !restaurantPoint ? [] : (postcodesQuery.data?.data ?? []).map((p) => {
    const point: LatLng = [p.latitude, p.longitude];
    if (milesBetween(restaurantPoint, point) > (settings?.maxDeliveryMiles ?? 5)) {
      return { postcode: p.postcode, lat: p.latitude, lng: p.longitude, colour: '#111827', label: `${p.postcode} · no delivery (too far)` };
    }
    const zone = activeZones
      .filter((z) => z.boundary && pointInPolygon(point, z.boundary))
      .sort((a, b) => a.deliveryFee - b.deliveryFee || a.minimumOrderAmount - b.minimumOrderAmount)[0];
    return zone
      ? { postcode: p.postcode, lat: p.latitude, lng: p.longitude, colour: zone.colour, label: `${p.postcode} · ${zone.name} ${money(zone.deliveryFee)}` }
      : { postcode: p.postcode, lat: p.latitude, lng: p.longitude, colour: '#9ca3af',
          label: `${p.postcode} · anywhere else ${outsideFee !== null ? money(outsideFee) : ''}` };
  });

  const mapZones: MapZone[] = zones.map((z) => ({
    id: z.id, name: z.name, colour: z.colour, isActive: z.isActive, boundary: z.boundary,
    label: `${z.name} · ${money(z.deliveryFee)}`,
  }));

  const testPin: TestPin | null = testResult && testResult.latitude !== null && testResult.longitude !== null
    ? {
        lat: testResult.latitude,
        lng: testResult.longitude!,
        ok: testResult.quote.canDeliver,
        label: testResult.quote.canDeliver
          ? `${testResult.quote.postcode}: ${testResult.quote.zoneName} · ${money(testResult.quote.deliveryFee)}`
          : `${testResult.quote.postcode}: no delivery`,
      }
    : null;

  // ---- actions ----
  const openNew = () => {
    setForm({
      name: '', deliveryFee: '', minimumOrderAmount: String(highestMin ?? 15), isActive: true,
      colour: ZONE_COLOURS[zones.length % ZONE_COLOURS.length],
    });
    setDialogZone('new');
  };

  const openEdit = (z: DeliveryZone) => {
    setForm({ name: z.name, deliveryFee: z.deliveryFee.toString(), minimumOrderAmount: z.minimumOrderAmount.toString(), isActive: z.isActive, colour: z.colour });
    setDialogZone(z);
  };

  const submitDialog = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(form.deliveryFee);
    if (!form.name.trim() || Number.isNaN(fee)) {
      toast({ title: 'Missing details', description: 'Give the zone a name and a delivery fee.', variant: 'destructive' });
      return;
    }
    const fields = {
      name: form.name.trim(), deliveryFee: fee, minimumOrderAmount: parseFloat(form.minimumOrderAmount) || 0,
      isActive: form.isActive, colour: form.colour,
    };
    if (dialogZone === 'new') {
      createMutation.mutate({ ...fields, boundary: null });
    } else if (dialogZone) {
      updateMutation.mutate(
        { id: dialogZone.id, payload: toPayload(dialogZone, fields) },
        { onSuccess: () => { setDialogZone(null); toast({ title: 'Zone updated' }); } },
      );
    }
  };

  const startDrawing = (id: string) => { setEditingShapeId(null); setSelectedId(id); setDrawingForId(id); };
  const startEditing = (id: string) => { setDrawingForId(null); setSelectedId(id); setEditingShapeId(id); mapRef.current?.focusZone(id); };
  const stopShapeWork = () => { setDrawingForId(null); setEditingShapeId(null); };

  const handleDrawn = (boundary: LatLng[]) => {
    const zone = zones.find((z) => z.id === drawingForId);
    setDrawingForId(null);
    if (!zone) return;
    updateMutation.mutate(
      { id: zone.id, payload: toPayload(zone, { boundary }) },
      { onSuccess: () => toast({ title: 'Area saved', description: `${zone.name}'s area is on the map. Use "Edit area" to fine-tune it.` }) },
    );
  };

  const saveEditedShape = () => {
    const zone = zones.find((z) => z.id === editingShapeId);
    const boundary = mapRef.current?.editedBoundary();
    if (!zone || !boundary) return;
    updateMutation.mutate(
      { id: zone.id, payload: toPayload(zone, { boundary }) },
      { onSuccess: () => { setEditingShapeId(null); toast({ title: 'Area saved' }); } },
    );
  };

  const removeShape = (zone: DeliveryZone) => {
    updateMutation.mutate(
      { id: zone.id, payload: toPayload(zone, { boundary: null }) },
      { onSuccess: () => { setDialogZone(null); stopShapeWork(); toast({ title: 'Area removed', description: `${zone.name} no longer matches any address.` }); } },
    );
  };

  const selectZone = (id: string) => {
    if (drawingForId || editingShapeId) return;
    setSelectedId(id);
    mapRef.current?.focusZone(id);
  };

  const runTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (testPostcode.trim()) testMutation.mutate(testPostcode.trim());
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    const miles = parseFloat(settingsForm.miles);
    if (Number.isNaN(miles) || miles <= 0) {
      toast({ title: 'Check the delivery limit', description: 'Enter the furthest distance you deliver, in miles.', variant: 'destructive' });
      return;
    }
    settingsMutation.mutate({
      maxDeliveryMiles: miles,
      outsideZoneDeliveryFee: settingsForm.fee.trim() === '' ? null : parseFloat(settingsForm.fee),
      outsideZoneMinimumOrder: settingsForm.min.trim() === '' ? null : parseFloat(settingsForm.min),
    });
  };

  if (zonesQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const drawingZone = zones.find((z) => z.id === drawingForId);
  const editingZone = zones.find((z) => z.id === editingShapeId);
  const hasLocation = settings?.restaurantLatitude != null && settings?.restaurantLongitude != null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Zones</h1>
          <p className="text-muted-foreground max-w-2xl">
            Draw each area you deliver to and give it a price. A customer pays the price of the area their postcode is in.
            Anywhere else within {settings?.maxDeliveryMiles ?? 5} miles pays {outsideFee !== null ? money(outsideFee) : 'the "anywhere else" price'}.
          </p>
        </div>
        <Button onClick={openNew} disabled={!!drawingForId || !!editingShapeId}>
          <Plus className="w-4 h-4 mr-2" />Add Zone
        </Button>
      </div>

      {warnings.map((w) => (
        <Alert key={w.title} className="border-amber-500/60">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>{w.title}</AlertTitle>
          <AlertDescription>{w.text}</AlertDescription>
        </Alert>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- map ---- */}
        <Card className="overflow-hidden">
          <div className="relative h-[70vh] min-h-[420px]">
            {hasLocation ? (
              <ZoneMap
                ref={mapRef}
                centre={[settings!.restaurantLatitude!, settings!.restaurantLongitude!]}
                maxMiles={settings!.maxDeliveryMiles}
                zones={mapZones}
                selectedId={selectedId}
                editingId={editingShapeId}
                drawing={!!drawingForId}
                testPin={testPin}
                postcodeDots={postcodeDots}
                onSelect={selectZone}
                onDrawn={handleDrawn}
                onViewChange={setView}
                onMapClick={(lat, lng) => testMutation.mutate({ lat, lng })}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <MapPin className="w-10 h-10 mb-3" />
                <p>The map appears once your restaurant's postcode can be found. Check it in Restaurant Info.</p>
              </div>
            )}

            {hasLocation && !drawingZone && !editingZone && (
              <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-background/90 border shadow px-2.5 py-1.5 text-xs flex items-center gap-2">
                {!showPostcodes ? (
                  <span>Zoom in to see postcodes. Click anywhere to check its price.</span>
                ) : postcodesQuery.isFetching ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Loading postcodes...</span>
                ) : postcodesQuery.isError ? (
                  <span className="text-destructive">Couldn't load postcodes just now.</span>
                ) : (
                  <span>
                    {postcodeDots.length} postcodes · dot colour = the zone that prices it
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400 align-middle mx-1" />anywhere else
                  </span>
                )}
              </div>
            )}

            {(drawingZone || editingZone) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] w-[min(92%,560px)] rounded-lg border bg-background/95 shadow-lg p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px] text-sm">
                  {drawingZone ? (
                    <>
                      <p className="font-medium">Drawing {drawingZone.name}</p>
                      <p className="text-muted-foreground">Click the map to place each corner. Click the first corner again to finish.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Editing {editingZone!.name}</p>
                      <p className="text-muted-foreground">Drag corners to move them. Drag a middle point to add a corner; right-click a corner to remove it.</p>
                    </>
                  )}
                </div>
                {editingZone && (
                  <Button size="sm" onClick={saveEditedShape} disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save area
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={stopShapeWork} disabled={isSaving}>Cancel</Button>
              </div>
            )}
          </div>
        </Card>

        {/* ---- side panel ---- */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Test a postcode</CardTitle>
              <CardDescription>See exactly what a customer there would pay - or click anywhere on the map.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={runTest} className="flex gap-2">
                <Input value={testPostcode} onChange={(e) => setTestPostcode(e.target.value.toUpperCase())} placeholder="e.g. SA1 2AB" />
                <Button type="submit" variant="secondary" disabled={testMutation.isPending || !testPostcode.trim()}>
                  {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>
              {testResult && (
                testResult.quote.canDeliver ? (
                  <div className="flex gap-2 text-sm rounded-md border border-green-600/40 bg-green-600/10 p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {testResult.quote.postcode} · {testResult.quote.inZone ? testResult.quote.zoneName : 'not in any zone'}
                      </p>
                      <p>{money(testResult.quote.deliveryFee)} delivery · {money(testResult.quote.minimumOrderAmount)} minimum order</p>
                      {testResult.distanceMiles !== null && (
                        <p className="text-muted-foreground">{testResult.distanceMiles.toFixed(1)} miles from you in a straight line</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 text-sm rounded-md border border-red-600/40 bg-red-600/10 p-3">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{testResult.quote.postcode ?? testPostcode}: no delivery</p>
                      <p>{testResult.quote.message}</p>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Zones ({zones.length})</CardTitle>
              <CardDescription>Click a zone to find it on the map.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {zones.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <Shapes className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4 text-sm">No zones yet. Add one, then draw its area on the map.</p>
                  <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Zone</Button>
                </div>
              ) : (
                <div className="divide-y max-h-[50vh] overflow-y-auto">
                  {zones.map((z) => (
                    <div
                      key={z.id}
                      onClick={() => selectZone(z.id)}
                      className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-muted/50 ${selectedId === z.id ? 'bg-muted' : ''}`}
                    >
                      <span className="w-3.5 h-3.5 rounded-sm shrink-0 border" style={{ background: z.colour, opacity: z.isActive ? 1 : 0.4 }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{z.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {money(z.deliveryFee)} delivery · {money(z.minimumOrderAmount)} min
                        </p>
                        <div className="flex gap-1 mt-0.5">
                          {!z.isActive && <Badge variant="outline" className="text-[10px] py-0">Switched off</Badge>}
                          {!z.boundary && <Badge variant="outline" className="text-[10px] py-0 border-amber-500 text-amber-600">No area drawn</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="icon" title={z.boundary ? 'Edit area' : 'Draw area'}
                          disabled={!hasLocation || !!drawingForId || !!editingShapeId}
                          onClick={() => (z.boundary ? startEditing(z.id) : startDrawing(z.id))}
                        >
                          {z.boundary ? <Shapes className="w-4 h-4" /> : <PenLine className="w-4 h-4 text-amber-600" />}
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit name and price" onClick={() => openEdit(z)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteId(z.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Anywhere else</CardTitle>
              <CardDescription>For addresses that aren't inside any zone, and how far you deliver at all.</CardDescription>
            </CardHeader>
            <CardContent>
              {settingsForm === null ? (
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Delivery fee:</span> {outsideFee !== null ? money(outsideFee) : 'not set'}
                    {settings?.outsideZoneDeliveryFee === null && highestFee !== null && <span className="text-muted-foreground"> (your highest zone fee)</span>}</p>
                  <p><span className="text-muted-foreground">Minimum order:</span> {money(outsideMin)}</p>
                  <p><span className="text-muted-foreground">No delivery beyond:</span> {settings?.maxDeliveryMiles} miles</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setSettingsForm({
                    miles: String(settings?.maxDeliveryMiles ?? 5),
                    fee: settings?.outsideZoneDeliveryFee?.toString() ?? '',
                    min: settings?.outsideZoneMinimumOrder?.toString() ?? '',
                  })}>Change</Button>
                </div>
              ) : (
                <form onSubmit={saveSettings} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="outsideFee">Delivery fee ({currency})</Label>
                      <Input id="outsideFee" type="number" step="0.01" min="0" value={settingsForm.fee}
                        placeholder={highestFee !== null ? highestFee.toFixed(2) : ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, fee: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="outsideMin">Minimum order ({currency})</Label>
                      <Input id="outsideMin" type="number" step="0.01" min="0" value={settingsForm.min}
                        placeholder={highestMin !== null ? highestMin.toFixed(2) : '0.00'}
                        onChange={(e) => setSettingsForm({ ...settingsForm, min: e.target.value })} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Leave blank to use your highest zone's price.</p>
                  <div className="space-y-1">
                    <Label htmlFor="maxMiles">No delivery beyond (miles)</Label>
                    <Input id="maxMiles" type="number" step="0.5" min="0.5" max="50" value={settingsForm.miles}
                      onChange={(e) => setSettingsForm({ ...settingsForm, miles: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Straight-line distance from your restaurant - the dashed circle on the map.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={settingsMutation.isPending}>
                      {settingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setSettingsForm(null)}>Cancel</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- add / edit zone details ---- */}
      <Dialog open={dialogZone !== null} onOpenChange={(open) => !open && setDialogZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogZone === 'new' ? 'Add Delivery Zone' : 'Edit Delivery Zone'}</DialogTitle>
            <DialogDescription>
              {dialogZone === 'new' ? "Name the area and set its price - you'll draw it on the map next." : 'Change the name, price or colour.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDialog} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Area name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Hafod" required disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Delivery fee ({currency}) *</Label>
                <Input id="deliveryFee" type="number" step="0.01" min="0" value={form.deliveryFee} onChange={(e) => setForm((f) => ({ ...f, deliveryFee: e.target.value }))} required disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimumOrderAmount">Minimum order ({currency})</Label>
                <Input id="minimumOrderAmount" type="number" step="0.01" min="0" value={form.minimumOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minimumOrderAmount: e.target.value }))} disabled={isSaving} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="colour">Map colour</Label>
                <input id="colour" type="color" value={form.colour} onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))} className="h-8 w-12 cursor-pointer rounded border bg-transparent" />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="isActive">Active</Label>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} disabled={isSaving} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {dialogZone !== 'new' && dialogZone?.boundary ? (
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => removeShape(dialogZone)} disabled={isSaving}>
                  Remove area
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogZone(null)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogZone === 'new' ? 'Add and draw area' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this zone?</AlertDialogTitle>
            <AlertDialogDescription>
              Addresses in its area will pay the "anywhere else" price instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeliveryZones;
