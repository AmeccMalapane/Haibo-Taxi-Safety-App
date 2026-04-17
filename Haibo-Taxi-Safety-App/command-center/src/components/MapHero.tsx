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

export function MapHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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
      cooperativeGestures: true,
      interactive: true,
    });
    mapRef.current = map;

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );

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
          "circle-opacity": 0.75,
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.4)",
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

      map.addLayer({
        id: "rank-pins",
        type: "circle",
        source: "ranks",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#E72369",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.9,
        },
      });

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

      map.on("click", "rank-pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const { name, type, address } = f.properties as Record<string, string>;

        const typeBadge = type === "rank"
          ? `<span style="background:#E72369;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase">Taxi Rank</span>`
          : `<span style="background:#E49E22;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase">${type}</span>`;

        new mapboxgl.Popup({
          closeButton: true,
          maxWidth: "260px",
          offset: 12,
        })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:${fonts.sans};padding:4px 0">
              <div style="margin-bottom:6px">${typeBadge}</div>
              <div style="font-weight:700;font-size:15px;margin-bottom:4px;line-height:1.3">${name}</div>
              ${address ? `<div style="font-size:12px;color:#666;margin-bottom:8px">${address}</div>` : ""}
              <a href="https://haibo.africa" target="_blank" rel="noopener"
                 style="display:inline-block;background:#E72369;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">
                View in Haibo! →
              </a>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "rank-pins", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "rank-pins", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "rank-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "rank-clusters", () => { map.getCanvas().style.cursor = ""; });

      // Slow cinematic drift so the map feels alive even when idle.
      let bearing = -8;
      const drift = () => {
        if (!mapRef.current) return;
        bearing += 0.02;
        mapRef.current.setBearing(bearing);
        requestAnimationFrame(drift);
      };
      drift();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [theme, ranks]);

  if (!TOKEN) return null;

  return (
    <>
      <style>{`
        .mapboxgl-popup-content {
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
          padding: 14px !important;
        }
        .mapboxgl-popup-close-button {
          font-size: 18px;
          padding: 4px 8px;
          color: #888;
        }
      `}</style>
      <div
        ref={containerRef}
        aria-hidden
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
