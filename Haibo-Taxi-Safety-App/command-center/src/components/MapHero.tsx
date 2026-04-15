import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "../lib/theme";

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

// Six major SA taxi hubs — roughly centered on each metro's biggest rank so
// the pulse markers read as "live activity" rather than pinned dots.
const HUBS: Array<{ name: string; coords: [number, number] }> = [
  { name: "Johannesburg (Bree)", coords: [28.0436, -26.2056] },
  { name: "Cape Town (Deck)", coords: [18.4300, -33.9209] },
  { name: "Durban (Berea)", coords: [31.0218, -29.8579] },
  { name: "Pretoria (Bloed)", coords: [28.1890, -25.7430] },
  { name: "Port Elizabeth", coords: [25.6022, -33.9608] },
  { name: "Bloemfontein", coords: [26.2184, -29.1200] },
];

const SA_CENTER: [number, number] = [25.5, -29.0];

export function MapHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const { theme } = useTheme();

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
      HUBS.forEach((hub) => {
        const el = document.createElement("div");
        el.className = "hb-pulse-marker";
        el.setAttribute("aria-label", hub.name);
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(hub.coords)
          .addTo(map);
      });

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
  }, [theme]);

  if (!TOKEN) return null;

  return (
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
  );
}

export default MapHero;
