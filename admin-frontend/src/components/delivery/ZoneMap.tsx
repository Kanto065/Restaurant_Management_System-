import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { LatLng, Rings } from '@/lib/geo';

export interface MapZone {
  id: string;
  name: string;
  colour: string;
  isActive: boolean;
  boundary: Rings | null;
  label: string; // e.g. "Hafod · £2.00"
}

export interface TestPin {
  lat: number;
  lng: number;
  label: string;
  ok: boolean;
}

/** A real postcode shown as a dot, coloured by the zone that would price it. */
export interface PostcodeDot {
  postcode: string;
  lat: number;
  lng: number;
  colour: string;
  label: string; // e.g. "SA1 2DZ · Hafod £2.00"
}

export interface MapView {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
}

export interface ZoneMapHandle {
  /** The rings of the shape being edited, or null when nothing is being edited. */
  editedBoundary: () => Rings | null;
  /** Zoom to fit a set of points (e.g. the postcodes a zone check flagged). */
  focusPoints: (points: LatLng[]) => void;
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
  postcodeDots: PostcodeDot[];
  /** Postcodes to point out whatever the zoom - e.g. ones a zone check found charged wrongly. */
  highlightDots: PostcodeDot[];
  onSelect: (id: string) => void;
  onDrawn: (boundary: LatLng[]) => void;
  /** After every pan/zoom - the page fetches postcodes for the visible area. */
  onViewChange: (view: MapView) => void;
  /** A click on the map (not while drawing or editing) - "what would this spot pay?". */
  onMapClick: (lat: number, lng: number) => void;
}

/** Postcode labels are written out (not just on hover) from this zoom in... */
const LABEL_ZOOM = 17;
/** ...for at most this many postcodes in view. Every written label is a page element that has
 *  to be positioned; hundreds at once froze the page. */
const MAX_LABELS = 150;

const METRES_PER_MILE = 1609.344;

/** Every ring of a polygon layer (outer rings, holes, and the parts of a multi-part shape). */
function ringsOf(layer: L.Polygon): Rings {
  const out: Rings = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node) || node.length === 0) return;
    if (node[0] instanceof L.LatLng) out.push((node as L.LatLng[]).map((p) => [p.lat, p.lng] as LatLng));
    else node.forEach(walk);
  };
  walk(layer.getLatLngs());
  return out.filter((ring) => ring.length >= 3);
}

const ZoneMap = forwardRef<ZoneMapHandle, Props>(function ZoneMap(
  { centre, maxMiles, zones, selectedId, editingId, drawing, testPin, postcodeDots, highlightDots, onSelect, onDrawn, onViewChange, onMapClick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const dotLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerRef = useRef<L.LayerGroup | null>(null);
  const dotRendererRef = useRef<L.Canvas | null>(null);
  const [zoom, setZoom] = useState(0);
  const polygonsRef = useRef(new Map<string, L.Polygon>());
  const editLayerRef = useRef<L.Polygon | null>(null);
  const fittedToZonesRef = useRef(false);
  // Latest callbacks, so the map's own event handlers never go stale.
  const onDrawnRef = useRef(onDrawn);
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  const onMapClickRef = useRef(onMapClick);
  const busyRef = useRef(false); // drawing or editing - map clicks belong to that
  onDrawnRef.current = onDrawn;
  onSelectRef.current = onSelect;
  onViewChangeRef.current = onViewChange;
  onMapClickRef.current = onMapClick;
  busyRef.current = drawing || editingId !== null;

  useImperativeHandle(ref, () => ({
    editedBoundary: () => (editLayerRef.current ? ringsOf(editLayerRef.current) : null),
    focusPoints: (points) => {
      if (points.length > 0 && mapRef.current) mapRef.current.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16 });
    },
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
    // Own pane above the zone shapes (which are redrawn often) so dots stay on top.
    map.createPane('postcodes').style.zIndex = '450';
    // One canvas for all the dots instead of an SVG element each - far lighter with hundreds.
    dotRendererRef.current = L.canvas({ pane: 'postcodes', padding: 0.2 });
    dotLayerRef.current = L.layerGroup().addTo(map);
    highlightLayerRef.current = L.layerGroup().addTo(map);

    map.on('moveend', () => {
      const b = map.getBounds();
      setZoom(map.getZoom());
      onViewChangeRef.current({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom: map.getZoom() });
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!busyRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    map.on('pm:create', (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const rings = ringsOf(layer);
      map.removeLayer(layer); // the parent saves it, then it comes back as a normal zone
      if (rings.length > 0) onDrawnRef.current(rings[0]);
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
      if (!zone.boundary || zone.boundary.length === 0) continue;
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

  // Postcode dots.
  useEffect(() => {
    const map = mapRef.current;
    const group = dotLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const bounds = map.getBounds();
    const inView = postcodeDots.filter((d) => bounds.contains([d.lat, d.lng]));
    const labelled = zoom >= LABEL_ZOOM && inView.length <= MAX_LABELS;
    for (const dot of inView) {
      L.circleMarker([dot.lat, dot.lng], {
        renderer: dotRendererRef.current ?? undefined,
        radius: labelled ? 5 : 4, color: '#fff', weight: 1.5, fillColor: dot.colour, fillOpacity: 1,
      })
        .bindTooltip(labelled ? dot.postcode : dot.label, {
          permanent: labelled, direction: labelled ? 'right' : 'top', offset: labelled ? [4, 0] : [0, -4],
          className: labelled ? 'postcode-label' : '',
        })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (!busyRef.current) onMapClickRef.current(dot.lat, dot.lng);
        })
        .addTo(group);
    }
  }, [postcodeDots, zoom]);

  // Highlighted postcodes (zone check results): big red-ringed dots, shown at any zoom.
  useEffect(() => {
    const group = highlightLayerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const dot of highlightDots) {
      L.circleMarker([dot.lat, dot.lng], {
        renderer: dotRendererRef.current ?? undefined,
        radius: 7, color: '#dc2626', weight: 3, fillColor: dot.colour, fillOpacity: 1,
      })
        .bindTooltip(dot.label, { direction: 'top', offset: [0, -6] })
        .addTo(group);
    }
  }, [highlightDots]);

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
