import './globals.css';
if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost' && location.hostname !== '[::1]') {
  document.body.textContent = 'このアプリはローカル検証専用です。';
} else {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin) return Promise.reject(new Error('外部通信は無効です'));
    return nativeFetch(input, init);
  };
  const blockExternal = (event: Event) => {
    const anchor = event.composedPath().find(item => item instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (anchor && new URL(anchor.href, location.href).origin !== location.origin) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  document.addEventListener('click', blockExternal, true);
  document.addEventListener('auxclick', blockExternal, true);
  window.open = () => null;
  const target = document.getElementById('app')!;
  const {start} = await import('./main');
  const cleanup = start(target, () => document.getElementById('boot')?.remove());
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
}
