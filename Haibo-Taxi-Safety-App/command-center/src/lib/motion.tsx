/**
 * GSAP-backed motion primitives for the marketing site.
 *
 * Why GSAP over CSS keyframes:
 *   - Scroll-triggered reveals with ScrollTrigger (cheaper than IntersectionObserver
 *     + manual class toggling, and composes with timeline sequencing).
 *   - Consistent spring/ease curves across the app without repeating
 *     `cubic-bezier(...)` strings in every component.
 *   - `useGSAP()` from @gsap/react handles cleanup on unmount automatically,
 *     so we don't leak ScrollTrigger instances when navigating between routes.
 *
 * Accessibility: every primitive respects `prefers-reduced-motion`. When the
 * user has reduced motion enabled, the component renders children in their
 * final state with no animation — no fade, no translate, no stagger delay.
 */

import React, { useRef, ReactNode, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register plugins once at module load. Safe to call multiple times — GSAP
// de-dupes internally. Do NOT call gsap.registerPlugin() inside a component
// body; it should happen before any useGSAP() runs.
gsap.registerPlugin(useGSAP, ScrollTrigger);

// ─── Reduced-motion hook ────────────────────────────────────────────────

/** Respects the user's OS-level "reduce motion" preference. Primitives
 *  below short-circuit animations when this returns true. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return reduced;
}

// ─── FadeInUp ──────────────────────────────────────────────────────────

interface FadeInUpProps {
  children: ReactNode;
  /** Delay in seconds before the animation starts. Used to stagger a stack
   *  of independent FadeInUps without a wrapper. */
  delay?: number;
  /** Total animation duration in seconds. */
  duration?: number;
  /** Distance in px the element travels upward from its final position. */
  distance?: number;
  /** Extra className on the outer wrapper. */
  className?: string;
  /** Inline style on the outer wrapper — stylers can override the fade
   *  start state if needed. */
  style?: React.CSSProperties;
}

/** Animates children into view: opacity 0 → 1, y +distance → 0. Use this
 *  for hero elements, CTAs, and any content that should "arrive" on mount. */
export function FadeInUp({
  children,
  delay = 0,
  duration = 0.7,
  distance = 24,
  className,
  style,
}: FadeInUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y: distance,
        duration,
        delay,
        ease: "power3.out",
      });
    },
    { scope: ref, dependencies: [reduced, delay, duration, distance] },
  );

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

// ─── StaggerIn ─────────────────────────────────────────────────────────

interface StaggerInProps {
  children: ReactNode;
  /** Per-child delay in seconds. */
  stagger?: number;
  /** Duration of each child's animation. */
  duration?: number;
  /** Distance (px) each child travels upward. */
  distance?: number;
  /** When true, animate on scroll into view instead of immediately on
   *  mount. Uses ScrollTrigger with a 15% viewport offset so the reveal
   *  fires before the card fully enters the viewport. */
  onScroll?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Wraps a container whose DIRECT CHILDREN should reveal in sequence.
 *  Each direct child gets a from-state (opacity 0, y distance) that
 *  resolves on mount or when scrolled into view. */
export function StaggerIn({
  children,
  stagger = 0.08,
  duration = 0.6,
  distance = 20,
  onScroll = false,
  className,
  style,
}: StaggerInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      const kids = Array.from(ref.current.children) as HTMLElement[];
      if (kids.length === 0) return;

      const tween = {
        opacity: 0,
        y: distance,
        duration,
        ease: "power3.out",
        stagger,
      };

      if (onScroll) {
        gsap.from(kids, {
          ...tween,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });
      } else {
        gsap.from(kids, tween);
      }
    },
    { scope: ref, dependencies: [reduced, stagger, duration, distance, onScroll] },
  );

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

// ─── RevealOnScroll ────────────────────────────────────────────────────

interface RevealOnScrollProps {
  children: ReactNode;
  /** How far from the bottom of the viewport the reveal triggers, as a
   *  percentage of viewport height. `85` means the reveal starts when the
   *  top of the element hits 85% down the viewport. */
  startPosition?: number;
  /** Fade+translate distance in px. */
  distance?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Single-element scroll reveal. Use for standalone sections (CTA bands,
 *  testimonial quotes, stat strips) where StaggerIn would be overkill. */
export function RevealOnScroll({
  children,
  startPosition = 85,
  distance = 32,
  duration = 0.8,
  className,
  style,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y: distance,
        duration,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: `top ${startPosition}%`,
          toggleActions: "play none none none",
        },
      });
    },
    { scope: ref, dependencies: [reduced, startPosition, distance, duration] },
  );

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
