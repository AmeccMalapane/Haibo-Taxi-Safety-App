import { useMemo } from "react";
import { ImageSourcePropType } from "react-native";

// Seed pool of South African minibus taxi photos. Bundled locally so
// every hero is network-independent and renders instantly on cold
// start. Keep new additions in the same taxi-NN.jpg naming scheme and
// add a `require` entry below — Metro resolves `require()` at bundle
// time so dynamic keys don't work.
const POOL: ImageSourcePropType[] = [
  require("@/../assets/images/heroes/taxi-01.jpg"),
  require("@/../assets/images/heroes/taxi-02.jpg"),
  require("@/../assets/images/heroes/taxi-03.jpg"),
];

/**
 * Picks a deterministic taxi-hero photo for the given key. Same key
 * returns the same image across re-renders so the hero doesn't
 * re-shuffle on every state change, but different keys get different
 * photos so two rank cards on the same screen don't show the same
 * van.
 *
 * Pass `undefined` for a random pick (rotates per mount) — used by
 * the fares / onboarding heroes where there's only one image slot.
 */
export function useTaxiHero(key?: string | number): ImageSourcePropType {
  return useMemo(() => {
    if (key === undefined || key === null) {
      return POOL[Math.floor(Math.random() * POOL.length)];
    }
    const str = String(key);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return POOL[h % POOL.length];
  }, [key]);
}

export const TAXI_HERO_POOL = POOL;
