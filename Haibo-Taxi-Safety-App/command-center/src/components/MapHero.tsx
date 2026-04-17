import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "../lib/theme";
import { colors, fonts } from "../lib/brand";

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const API_BASE =
  import.meta.env.VITE_API_URL || "https://haibo-api-prod.azurewebsites.net";

const SA_CENTER: [number, number] = [25.5, -29.0];

interface RankRow {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  verificationStatus?: string;
}

function toGeoJSON(ranks: RankRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: ranks
      .filter((r) => r.latitude && r.longitude)
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
        properties: { id: r.id, name: r.name, type: r.type, address: r.address || "" },
      })),
  };
}

// Max number of pulsing markers allowed on screen at once. When more
// unclustered pins are visible, we render them without the pulse ring
// to avoid DOM bloat. Pulse is a visual anchor — it only needs to land
// on a few pins at a time to feel alive.
const PULSE_CAP = 12;

// Build the marker DOM for a rank. `pulse` controls whether the pulse
// ring is rendered — we cap the total count to PULSE_CAP so the page
// stays performant even with 500 ranks loaded.
function buildMarkerEl(type: string, pulse: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `hb-pin hb-pin--${type}`;
  el.innerHTML =
    (pulse ? '<div class="hb-pin__ring"></div>' : "") +
    '<div class="hb-pin__dot"><div class="hb-pin__inner"></div></div>';
  return el;
}

export function MapHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const { theme } = useTheme();
  const [ranks, setRanks] = useState<RankRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/locations?limit=500&status=verified`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.data)) setRanks(d.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:
        theme === "dark"
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/light-v11",
      center: SA_CENTER,
      zoom: 4.3,
      pitch: 28,
      bearing: -8,
      attributionControl: false,
      // Disabled so desktop scroll-to-zoom works without ctrl/cmd held.
      // The hero wants to feel responsive, not "please hold ctrl to interact".
      cooperativeGestures: false,
      interactive: true,
    });
    mapRef.current = map;

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    // Track markers + current popup so cleanup can dispose everything. Using
    // refs (not state) because we don't want a re-render to tear down the map.
    const markers = markersRef.current;

    const openPopupForFeature = (f: mapboxgl.MapboxGeoJSONFeature) => {
      const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const { name, type, address } = f.properties as Record<string, string>;

      const typeBadge =
        type === "rank"
          ? `<span class="hb-badge hb-badge--rank">Taxi Rank</span>`
          : type === "formal_stop"
            ? `<span class="hb-badge hb-badge--stop">Formal Stop</span>`
            : type === "landmark"
              ? `<span class="hb-badge hb-badge--landmark">Landmark</span>`
              : `<span class="hb-badge hb-badge--other">${type || "Location"}</span>`;

      // Close any existing popup so two pins don't leave two popups open.
      popupRef.current?.remove();

      const popup = new mapboxgl.Popup({
        closeButton: true,
        maxWidth: "280px",
        offset: 22,
        className: "hb-popup",
      })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:${fonts.sans};padding:2px 0">
            <div style="margin-bottom:8px">${typeBadge}</div>
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;line-height:1.3;color:#1a1a1a">${name}</div>
            ${address ? `<div style="font-size:12px;color:#666;margin-bottom:10px">${address}</div>` : ""}
            <a href="https://haibo.africa" target="_blank" rel="noopener" class="hb-popup__cta">
              View in Haibo! →
            </a>
          </div>
        `)
        .addTo(map);

      popupRef.current = popup;
    };

    map.on("load", () => {
      const geojson = toGeoJSON(ranks);

      map.addSource("ranks", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });

      map.addLayer({
        id: "rank-clusters",
        type: "circle",
        source: "ranks",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#E72369",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 28, 50, 36],
          "circle-stroke-width": 3,
          "circle-stroke-color": "rgba(255,255,255,0.5)",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "ranks",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#FFFFFF" },
      });

      // Invisible layer acts as the query target for rendered-features.
      // queryRenderedFeatures auto-filters to what's in-viewport, so we
      // only reconcile markers that are actually on screen. The circle
      // paint has opacity 0 — the visible pin is the HTML marker below.
      map.addLayer({
        id: "rank-pins-hidden",
        type: "circle",
        source: "ranks",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-opacity": 0,
        },
      });

      // Reconcile HTML markers against the current set of visible
      // unclustered points. Runs on every pan/zoom end and whenever the
      // cluster source finishes loading new data. Cheap because it only
      // diffs against markers we've already created.
      const updateMarkers = () => {
        if (!mapRef.current) return;
        // Full-viewport bbox as the geometry arg keeps us inside the typed
        // overload. Passing undefined/nothing is valid at runtime but the
        // mapbox-gl types in this version don't model that overload.
        const c = map.getContainer();
        const viewport: [[number, number], [number, number]] = [
          [0, 0],
          [c.clientWidth, c.clientHeight],
        ];
        const features = map.queryRenderedFeatures(viewport, {
          layers: ["rank-pins-hidden"],
        });
        const seen = new Set<string>();
        let pulseBudget = PULSE_CAP;

        features.forEach((f) => {
          const id = (f.properties?.id as string) || "";
          if (!id || seen.has(id)) return;
          seen.add(id);

          if (markers.has(id)) return;

          const type = (f.properties?.type as string) || "rank";
          const pulse = pulseBudget-- > 0;
          const el = buildMarkerEl(type, pulse);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openPopupForFeature(f);
          });

          const coords = (f.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat(coords)
            .addTo(map);
          markers.set(id, marker);
        });

        // Dispose markers that have left the viewport.
        for (const [id, marker] of markers) {
          if (!seen.has(id)) {
            marker.remove();
            markers.delete(id);
          }
        }
      };

      map.on("moveend", updateMarkers);
      map.on("sourcedata", (e) => {
        if (e.sourceId === "ranks" && e.isSourceLoaded) updateMarkers();
      });
      updateMarkers();

      // Cluster click → zoom into the cluster
      map.on("click", "rank-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["rank-clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const src = map.getSource("ranks") as mapboxgl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: zoom + 1 });
        });
      });

      map.on("mouseenter", "rank-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "rank-clusters", () => { map.getCanvas().style.cursor = ""; });

      // Slow cinematic drift so the map feels alive even when idle.
      // Halts when the user interacts so we don't fight their gesture.
      let bearing = -8;
      let driftActive = true;
      const drift = () => {
        if (!mapRef.current || !driftActive) return;
        bearing += 0.02;
        mapRef.current.setBearing(bearing);
        requestAnimationFrame(drift);
      };
      const pauseDrift = () => { driftActive = false; };
      map.on("dragstart", pauseDrift);
      map.on("zoomstart", pauseDrift);
      map.on("rotatestart", pauseDrift);
      drift();
    });

    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [theme, ranks]);

  if (!TOKEN) return null;

  return (
    <>
      <style>{`
        /* ─── Marker styling ──────────────────────────────────────────
           Ranks get the full brand moment (rose pin + pulse ring).
           Formal stops get a square amber pin; landmarks get a rotated
           purple diamond. All share the same base dot size + shadow so
           the map reads as a cohesive set at every zoom level. */
        .hb-pin {
          position: relative;
          width: 28px;
          height: 28px;
          cursor: pointer;
          pointer-events: auto;
        }
        .hb-pin__dot {
          position: absolute;
          inset: 7px;
          background: #E72369;
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(231,35,105,0.15);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .hb-pin:hover .hb-pin__dot {
          transform: scale(1.2);
        }
        .hb-pin__inner {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
        }
        .hb-pin__ring {
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: #E72369;
          opacity: 0.4;
          z-index: 1;
          animation: hb-pin-pulse 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        @keyframes hb-pin-pulse {
          0%   { transform: scale(0.6); opacity: 0.55; }
          80%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        /* Formal stop — amber square. Looks different enough at a glance
           that a commuter can distinguish "rank" vs "stop" without a legend. */
        .hb-pin--formal_stop .hb-pin__dot {
          border-radius: 6px;
          background: #E49E22;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(228,158,34,0.18);
        }
        .hb-pin--formal_stop .hb-pin__ring {
          background: #E49E22;
          border-radius: 6px;
        }

        /* Landmark — purple diamond (rotated square). */
        .hb-pin--landmark .hb-pin__dot {
          border-radius: 3px;
          background: #7B1FA2;
          transform: rotate(45deg);
          box-shadow: 0 3px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(123,31,162,0.18);
        }
        .hb-pin--landmark:hover .hb-pin__dot {
          transform: rotate(45deg) scale(1.2);
        }
        .hb-pin--landmark .hb-pin__ring {
          background: #7B1FA2;
        }
        .hb-pin--landmark .hb-pin__inner {
          transform: rotate(-45deg);
        }

        /* Informal stop — teal circle (same shape as rank but different hue
           to read as "community-verified" vs "official"). */
        .hb-pin--informal_stop .hb-pin__dot {
          background: #0D9488;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(13,148,136,0.18);
        }
        .hb-pin--informal_stop .hb-pin__ring {
          background: #0D9488;
        }

        /* ─── Popup styling ───────────────────────────────────────── */
        .mapboxgl-popup-content {
          border-radius: 14px !important;
          box-shadow: 0 12px 32px rgba(0,0,0,0.22) !important;
          padding: 14px !important;
          border: 1px solid rgba(231,35,105,0.1);
        }
        .mapboxgl-popup-close-button {
          font-size: 20px;
          padding: 6px 10px;
          color: #888;
        }
        .mapboxgl-popup-tip {
          border-top-color: #FFFFFF !important;
        }
        .hb-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 10px;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: #FFFFFF;
        }
        .hb-badge--rank { background: #E72369; }
        .hb-badge--stop { background: #E49E22; }
        .hb-badge--landmark { background: #7B1FA2; }
        .hb-badge--other { background: #616366; }
        .hb-popup__cta {
          display: inline-block;
          background: linear-gradient(135deg, #E72369 0%, #D42281 100%);
          color: #fff;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 4px 10px rgba(231,35,105,0.3);
          transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
        }
        .hb-popup__cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(231,35,105,0.4);
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </>
  );
}

export default MapHero;
