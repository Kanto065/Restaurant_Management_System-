import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { LatLng } from '@/lib/geo';

export interface MapZone {
  id: string;
  name: string;
  colour: string;
  isActive: boolean;
  boundary: LatLng[] | null;
  label: string; // e.g. "Hafod · £2.00"
}

export interface TestPin {
  lat: number;
  lng: number;
  label: string;
  ok: boolean;
}

export interface ZoneMapHandle {
  /** The corners of the shape being edited, or null when nothing is being edited. */
  editedBoundary: () => LatLng[] | null;
  focusZone: (id: string) => void;
}

interface Props {
  centre: LatLng;
  maxMiles: number;
  zones: MapZone[];
  selectedId: string | null;
  /** Zone whose corners are draggable right now. */
  editingId: string | null;
  /** True while the owner is drawing a brand-new shape (click corners, click the first to finish). */
  drawing: boolean;
  testPin: TestPin | null;
  onSelect: (id: string) => void;
  onDrawn: (boundary: LatLng[]) => void;
}

const METRES_PER_MILE = 1609.344;

function ringOf(layer: L.Polygon): LatLng[] {
  const rings = layer.getLatLngs() as L.LatLng[][];
  return (rings[0] ?? []).map((p) => [p.lat, p.lng] as LatLng);
}

const ZoneMap = forwardRef<ZoneMapHandle, Props>(function ZoneMap(
  { centre, maxMiles, zones, selectedId, editingId, drawing, testPin, onSelect, onDrawn },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsRef = useRef(new Map<string, L.Polygon>());
  const editLayerRef = useRef<L.Polygon | null>(null);
  const fittedToZonesRef = useRef(false);
  // Latest callbacks, so the map's own event handlers never go stale.
  const onDrawnRef = useRef(onDrawn);
  const onSelectRef = useRef(onSelect);
  onDrawnRef.current = onDrawn;
  onSelectRef.current = onSelect;

  useImperativeHandle(ref, () => ({
    editedBoundary: () => (editLayerRef.current ? ringOf(editLayerRef.current) : null),
    focusZone: (id) => {
      const polygon = polygonsRef.current.get(id);
      if (polygon && mapRef.current) mapRef.current.fitBounds(polygon.getBounds(), { padding: [60, 60], maxZoom: 16 });
    },
  }));

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, snapDistance: 15 });
    baseLayerRef.current = L.layerGroup().addTo(map);
    zoneLayerRef.current = L.layerGroup().addTo(map);
    pinLayerRef.current = L.layerGroup().addTo(map);

    map.on('pm:create', (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const boundary = ringOf(layer);
      map.removeLayer(layer); // the parent saves it, then it comes back as a normal zone
      if (boundary.length >= 3) onDrawnRef.current(boundary);
    });

    mapRef.current = map;
    // The map measures its box once; when the page layout settles or the window resizes
    // afterwards it would leave grey strips, so re-measure whenever the box changes.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(containerRef.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Restaurant pin and the delivery-limit ring; refit when either changes.
  useEffect(() => {
    const map = mapRef.current;
    const group = baseLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    L.circle(centre, {
      radius: maxMiles * METRES_PER_MILE,
      color: '#6b7280', weight: 2, dashArray: '6 8', fill: false, interactive: false,
    }).addTo(group);
    L.circleMarker(centre, { radius: 9, color: '#fff', weight: 3, fillColor: '#111827', fillOpacity: 1 })
      .bindTooltip('Your restaurant', { direction: 'top', offset: [0, -8] })
      .addTo(group);
    // Label on the top of the ring (1 degree of latitude is ~69 miles).
    L.marker([centre[0] + maxMiles / 69, centre[1]], {
      interactive: false,
      icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);width:max-content;font:600 11px system-ui;color:#374151;background:#fff;padding:1px 6px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.3)">No delivery beyond ${maxMiles} miles</div>` }),
    }).addTo(group);
    // Not ring.getBounds(): a circle can only measure itself once the map has a view, and on
    // first load it doesn't yet - that threw and blanked the whole admin app.
    map.fitBounds(L.latLng(centre).toBounds(maxMiles * METRES_PER_MILE * 2), { padding: [10, 10] });
  }, [centre[0], centre[1], maxMiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zone shapes.
  useEffect(() => {
    const map = mapRef.current;
    const group = zoneLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    polygonsRef.current.clear();
    editLayerRef.current = null;

    for (const zone of zones) {
      if (!zone.boundary || zone.boundary.length < 3) continue;
      const selected = zone.id === selectedId || zone.id === editingId;
      const polygon = L.polygon(zone.boundary, {
        color: zone.colour,
        weight: selected ? 4 : 2,
        opacity: zone.isActive ? 1 : 0.5,
        fillColor: zone.colour,
        fillOpacity: zone.isActive ? (selected ? 0.4 : 0.22) : 0.06,
        dashArray: zone.isActive ? undefined : '4 6',
      });
      polygon.bindTooltip(zone.isActive ? zone.label : `${zone.label} (switched off)`, {
        sticky: !selected, permanent: selected, direction: 'center', className: 'zone-label',
      });
      polygon.on('click', () => onSelectRef.current(zone.id));
      polygon.addTo(group);
      polygonsRef.current.set(zone.id, polygon);

      if (zone.id === editingId) {
        polygon.pm.enable({ allowSelfIntersection: false, snappable: true });
        polygon.bringToFront();
        editLayerRef.current = polygon;
      }
    }

    // First time there are areas to show, zoom to them - the whole 5-mile circle makes a
    // town's worth of zones too small to work with.
    if (!fittedToZonesRef.current && polygonsRef.current.size > 0) {
      const bounds = L.latLngBounds([]);
      polygonsRef.current.forEach((p) => bounds.extend(p.getBounds()));
      map.fitBounds(bounds, { padding: [20, 20] });
      fittedToZonesRef.current = true;
    }
  }, [zones, selectedId, editingId]);

  // Drawing a new shape.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawing) {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        allowSelfIntersection: false,
        templineStyle: { color: '#e8823c' },
        hintlineStyle: { color: '#e8823c', dashArray: '5 5' },
        pathOptions: { color: '#e8823c' },
      });
    } else {
      map.pm.disableDraw();
    }
  }, [drawing]);

  // "Test a postcode" pin.
  useEffect(() => {
    const map = mapRef.current;
    const group = pinLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!testPin) return;
    L.circleMarker([testPin.lat, testPin.lng], {
      radius: 10, color: '#fff', weight: 3, fillColor: testPin.ok ? '#16a34a' : '#dc2626', fillOpacity: 1,
    })
      .bindTooltip(testPin.label, { permanent: true, direction: 'top', offset: [0, -10] })
      .addTo(group);
    map.panTo([testPin.lat, testPin.lng]);
  }, [testPin]);

  return <div ref={containerRef} className="h-full w-full rounded-lg z-0" style={{ minHeight: 420 }} />;
});

export default ZoneMap;
