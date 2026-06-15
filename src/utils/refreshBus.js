import { useEffect } from 'react';

/**
 * Lightweight event bus for triggering data refreshes across pages.
 * Usage:
 *   emit:    refreshBus.emit('classes')
 *   listen:  useRefreshListener('classes', fetchClasses)
 */

const listeners = {};

export const refreshBus = {
  emit(channel = 'global') {
    (listeners[channel] || []).forEach(cb => cb());
    (listeners['global'] || []).forEach(cb => cb());
  },
  on(channel, cb) {
    if (!listeners[channel]) listeners[channel] = [];
    listeners[channel].push(cb);
    return () => {
      listeners[channel] = listeners[channel].filter(fn => fn !== cb);
    };
  },
};

/** React hook: calls `callback` whenever `channel` (or 'global') is emitted. */
export function useRefreshListener(channel, callback) {
  useEffect(() => {
    const unsub = refreshBus.on(channel, callback);
    return unsub;
  }, [channel, callback]);
}
