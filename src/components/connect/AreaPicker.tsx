"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";
import clsx from "clsx";
import { coarsen } from "@/lib/network/geo";
import { Button } from "@/components/ui/Button";

export interface AreaPoint {
  lat: number;
  lng: number;
  label: string;
}

type LeafletModule = typeof import("leaflet");

const INDIA_CENTER: [number, number] = [20.59, 78.96];

/** Leaflet draws on a canvas/SVG layer, so it needs the theme accent as a real colour value. */
function accentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1e5b4f";
}

/**
 * Pick a target area on an OpenStreetMap map (free tiles, no API key).
 * Every point — tap, search result or "use my location" — is rounded to a
 * ~500 m grid before it's handed to the parent, so exact coordinates never
 * leave this component.
 */
export function AreaPicker({
  value,
  radiusKm,
  onChange,
}: {
  value: AreaPoint | null;
  radiusKm: number;
  onChange: (point: AreaPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const dotRef = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AreaPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: LeafletModule }).default ?? mod) as LeafletModule;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("click", (e) => {
        const point = coarsen(e.latlng.lat, e.latlng.lng);
        onChangeRef.current({ ...point, label: "Pinned area" });
      });
      mapRef.current = map;
      // Re-measure when the container changes size (rotation, sidebar, font zoom) — otherwise tiles render grey.
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
      setReady(true);
    }
    let resizeObserver: ResizeObserver | null = null;
    init();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    circleRef.current?.remove();
    dotRef.current?.remove();
    if (!value) return;
    const color = accentColor();
    const circle = L.circle([value.lat, value.lng], {
      radius: radiusKm * 1000,
      color,
      weight: 2,
      fillOpacity: 0.12,
    }).addTo(map);
    dotRef.current = L.circleMarker([value.lat, value.lng], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(map);
    circleRef.current = circle;
    // No animation: Leaflet's zoom-animation end timer isn't cancelled by map.remove(), so continuing
    // to the next step mid-animation threw "_leaflet_pos" errors. User pinch/zoom still animates.
    map.fitBounds(circle.getBounds(), { padding: [20, 20], animate: false });
  }, [ready, value, radiusKm]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (searching || query.trim().length < 3) return; // the disabled button doubles as the debounce
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Search failed");
        setResults([]);
      } else {
        setResults(data.results);
        setMessage(data.results.length === 0 ? "No places found — try a nearby landmark or tap the map." : null);
      }
    } catch {
      setMessage("Search is unavailable — tap the map instead.");
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setMessage("Location isn't available in this browser — search or tap the map instead.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point = coarsen(pos.coords.latitude, pos.coords.longitude);
        onChange({ ...point, label: "Near you" });
      },
      (err) => {
        setLocating(false);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied — search for a place or tap the map instead."
            : "Couldn't get your location — search for a place or tap the map instead."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          <span aria-hidden="true">📍</span> We only use your location to centre the map. It&apos;s rounded to about 500 m, and your
          exact position is never stored or shown to anyone.
        </p>
        <Button size="sm" className="shrink-0 self-start sm:self-auto" onClick={locateMe} loading={locating}>
          {locating ? "Finding you…" : "Use my location"}
        </Button>
      </div>

      <form onSubmit={search} role="search" className="flex gap-2">
        <label htmlFor="area-search" className="sr-only">
          Search for a place
        </label>
        <input
          id="area-search"
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place, e.g. Lodhi Garden"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
        />
        <Button type="submit" variant="secondary" className="shrink-0" disabled={query.trim().length < 3} loading={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {results.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setResults([]);
                }}
                className="break-anywhere flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-foreground hover:bg-surface-2"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="status" className="text-xs text-muted">
          {message}
        </p>
      )}

      <div
        ref={containerRef}
        role="application"
        aria-label="Map. Tap or click to pin the area you want to meet in. Drag to move, pinch or use the + and − buttons to zoom."
        className="isolate z-0 h-64 w-full overflow-hidden rounded-2xl border border-border sm:h-80"
      />
      <p className={clsx("break-anywhere text-sm", value ? "font-medium text-foreground" : "text-muted")} aria-live="polite">
        {value ? `✓ ${value.label} · ${radiusKm} km radius` : "Tap the map to pin the area you want to meet in."}
      </p>
    </div>
  );
}
