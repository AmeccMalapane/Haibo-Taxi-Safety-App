import { useEffect } from "react";

/**
 * Per-route page meta: title, meta description, and Open Graph / Twitter
 * card tags. Restores whatever was in the head before the component mounted
 * so admin shell pages don't inherit stale public-site tags after nav.
 *
 * Caveat: setting OG tags via useEffect means the values only appear AFTER
 * React hydrates. JS-running crawlers (X/Twitter) pick them up correctly;
 * non-JS crawlers (Facebook, WhatsApp, LinkedIn, Slack) read the static
 * HTML response and see whatever index.html shipped with. That's why
 * index.html also has solid default OG tags — each public route then
 * overrides them client-side for share previews that do execute JS.
 *
 * A proper fix for share previews is static prerendering of public routes
 * (vite-plugin-ssr / react-snap) — left as a follow-up.
 */
export function usePageMeta({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const changes: Array<() => void> = [];

    function setMeta(selector: string, attr: "name" | "property", key: string, value: string) {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      const created = !el;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      const previous = el.getAttribute("content");
      el.setAttribute("content", value);
      changes.push(() => {
        if (created) {
          el!.remove();
        } else if (previous !== null) {
          el!.setAttribute("content", previous);
        }
      });
    }

    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
      setMeta('meta[property="og:description"]', "property", "og:description", description);
      setMeta(
        'meta[name="twitter:description"]',
        "name",
        "twitter:description",
        description
      );
    }
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta(
      'meta[property="og:url"]',
      "property",
      "og:url",
      window.location.href
    );

    return () => {
      document.title = previousTitle;
      // Unwind in reverse so nested restorations compose correctly.
      for (let i = changes.length - 1; i >= 0; i--) changes[i]();
    };
  }, [title, description]);
}
