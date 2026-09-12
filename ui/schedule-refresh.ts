// Only read the full schedule when its revision changes. The snapshot is checked
// after every await so a slow response cannot replace newer edits or a login.
export function createScheduleRefresh<T>(options: {
  snapshot: () => T | null;
  revision: () => number;
  fetch: typeof fetch;
  apply: (value: any) => void;
}) {
  let busy = false;
  let stopped = false;
  let retryAfter = 0;
  let failures = 0;
  let controller: AbortController | undefined;
  async function refresh() {
    if (stopped || busy || Date.now() < retryAfter) return;
    const snapshot = options.snapshot();
    if (snapshot === null) return;
    const revision = options.revision();
    const current = () => !stopped && options.snapshot() === snapshot && options.revision() === revision;
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10000);
    try {
      const check = await options.fetch('/api/schedule?revisionOnly=1', {signal: controller.signal});
      if (!check.ok) throw Error('Schedule check failed');
      const latest = await check.json();
      if (!Number.isInteger(latest.revision)) throw Error('Invalid revision');
      if (!current()) return;
      if (latest.revision !== revision) {
        const response = await options.fetch('/api/schedule', {signal: controller.signal});
        if (!response.ok) throw Error('Schedule read failed');
        const value = await response.json();
        if (current()) options.apply(value);
      }
      failures = 0;
      retryAfter = 0;
    } catch {
      // Keep the last successful display, and slow retries during outages.
      failures++;
      retryAfter = Date.now() + Math.min(60000, 15000 * 2 ** failures);
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }
  return {refresh, reconnect() {retryAfter = 0; return refresh();}, stop() {stopped = true; controller?.abort();}};
}
