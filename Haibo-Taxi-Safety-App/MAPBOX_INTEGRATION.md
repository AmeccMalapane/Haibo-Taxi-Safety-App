# Mapbox GL JS Integration — Haibo App

## Overview

The Haibo app's map system has been upgraded from `react-native-maps` (Google Maps) to **@rnmapbox/maps** (Mapbox GL JS), bringing a fully interactive transit mapping experience with cinematic animations, real-time rank status indicators, and fare calculators.

---

## Architecture

### Platform Resolution

The app uses React Native's platform-specific file resolution:

| File | Platform | Technology |
|------|----------|------------|
| `MapViewComponent.native.tsx` | iOS / Android | `@rnmapbox/maps` SDK |
| `MapViewComponent.web.tsx` | Web (Expo Web) | `mapbox-gl` JS library |
| `RouteMapView.tsx` | iOS / Android | `@rnmapbox/maps` SDK |
| `RouteMapView.web.tsx` | Web | `mapbox-gl` JS library |

### New Components

| Component | Purpose |
|-----------|---------|
| `RankDetailPanel` | Bottom sheet showing rank capacity, wait time, routes, and actions |
| `RouteDetailOverlay` | Floating card with fare, distance, and duration for a selected route |
| `TransitRouteLegend` | Horizontal scrollable route color chips at bottom of map |
| `MapControlButtons` | Floating action buttons: reset view, toggle routes, locate user |

### Data Files

| File | Contents |
|------|----------|
| `client/constants/mapbox.ts` | Access token, style URLs, default camera, zoom levels |
| `client/data/mapbox_transit_data.ts` | 8 Gauteng taxi ranks + 7 routes with real coordinates |

---

## Features

### Interactive Map
- **Mapbox GL JS** with dark/light theme switching
- **3D pitch and bearing** for cinematic camera angles
- **Compass** control positioned top-right
- **User location puck** with pulsing red ring

### Transit Ranks (8 Gauteng locations)
- **Pulsing circle markers** with status-based colors (busy=red, moderate=amber, quiet=green)
- **Name labels** with halo effect for readability
- **Tap interaction** triggers cinematic fly-to with random bearing
- **Rank Detail Panel** slides up showing:
  - Capacity bar with percentage and color coding
  - Wait time display
  - Route count
  - Connected routes with fare info
  - Navigate and View Routes action buttons

### Transit Routes (7 routes)
- **Animated dashed polylines** with route-specific colors
- **Tap interaction** shows RouteDetailOverlay with:
  - Origin → Destination with color-coded dots
  - Fare amount (e.g., R18)
  - Distance (e.g., 15 km)
  - Duration (e.g., 25 min)
- **Route Legend** at bottom with scrollable color chips

### Map Controls
- **Reset View** button (appears when something is selected)
- **Toggle Transit Routes** button (red when active)
- **Locate User** crosshair button

### Backward Compatibility
- `mapRef.current.animateToRegion()` still works for existing code
- `mapRef.current.flyTo()` and `mapRef.current.resetView()` added
- Long press to pin location still works
- Bottom sheet with search and location list preserved

---

## Transit Data

### Ranks
| ID | Name | Status | Wait | Capacity | Routes |
|----|------|--------|------|----------|--------|
| bree | Bree Taxi Rank | Busy | 5 min | 85% | 12 |
| bara | Bara Taxi Rank | Moderate | 12 min | 55% | 8 |
| alex | Alex Taxi Rank | Quiet | 3 min | 30% | 6 |
| sandton | Sandton Gautrain | Busy | 8 min | 72% | 15 |
| midrand | Midrand Rank | Moderate | 15 min | 45% | 5 |
| soweto | Soweto Hub | Busy | 6 min | 90% | 18 |
| pretoria | Pretoria Station | Moderate | 10 min | 60% | 14 |
| germiston | Germiston Rank | Quiet | 4 min | 35% | 7 |

### Routes
| Route | Fare | Distance | Duration | Color |
|-------|------|----------|----------|-------|
| Bree → Sandton | R18 | 15 km | 25 min | #E72369 |
| Bree → Alex | R15 | 12 km | 20 min | #28A745 |
| Soweto → Bree | R22 | 20 km | 35 min | #1976D2 |
| Bara → Soweto | R12 | 8 km | 15 min | #FFA000 |
| Sandton → Midrand | R20 | 18 km | 22 min | #9C27B0 |
| Midrand → Pretoria | R28 | 30 km | 35 min | #00BCD4 |
| Bree → Germiston | R16 | 14 km | 22 min | #FF5722 |

---

## Configuration

### Mapbox Access Token

The token is configured in `client/constants/mapbox.ts`. For production:

1. Set `EXPO_PUBLIC_MAPBOX_TOKEN` environment variable, or
2. Add to `app.json` under `extra.mapboxAccessToken`, or
3. The current public token works for development

### Expo Config Plugin

`app.json` includes the Mapbox config plugin:

```json
{
  "plugins": [
    ["@rnmapbox/maps", {
      "RNMapboxMapsImpl": "mapbox",
      "RNMapboxMapsDownloadToken": "YOUR_SECRET_TOKEN"
    }]
  ]
}
```

For iOS/Android native builds, you'll need a **secret download token** from your Mapbox account (different from the public access token).

---

## Building

### Development (Expo Go)
```bash
npx expo start
```
Note: Mapbox native SDK requires a development build. Expo Go will use the web fallback.

### Development Build (recommended)
```bash
npx expo prebuild
npx expo run:ios  # or run:android
```

### Production Build
```bash
eas build --platform ios
eas build --platform android
```

---

## Next Steps

1. **Connect to live API** — Replace static `RANKS` and `ROUTES` data with real-time API calls
2. **Add Mapbox secret download token** — Required for native iOS/Android builds
3. **Implement route directions** — Use Mapbox Directions API for actual road-following polylines
4. **Add offline maps** — Use Mapbox offline manager for areas with poor connectivity
5. **Real-time rank updates** — WebSocket or polling for live capacity/wait time data
