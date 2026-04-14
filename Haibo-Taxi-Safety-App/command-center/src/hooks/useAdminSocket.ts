import { useEffect } from "react";
import { getSocket } from "../lib/socket";

type Handler = (payload: any) => void;

/**
 * Subscribe to Socket.IO events for the lifetime of a component.
 *
 * Pass a map of { eventName: handler }. The hook wires each handler on
 * mount, tears them down on unmount, and re-wires if the handler map
 * reference changes (so memoize the object if you don't want that).
 *
 * Example:
 *   useAdminSocket({
 *     "sos:alert": (a) => toast.error(`SOS from ${a.phone}`),
 *     "complaint:new": () => qc.invalidateQueries(["complaints"]),
 *   });
 */
export function useAdminSocket(handlers: Record<string, Handler>): void {
  useEffect(() => {
    let socket;
    try {
      socket = getSocket();
    } catch {
      // No token yet (e.g. user logged out mid-mount). Bail silently —
      // the ProtectedShell auth gate handles the redirect.
      return;
    }

    const entries = Object.entries(handlers);
    for (const [event, handler] of entries) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of entries) {
        socket.off(event, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers]);
}
