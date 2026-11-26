const fromFounders = new URLSearchParams(location.search).get('z') === 'zakladatele';
const fallback = fromFounders ? '/zakladatele/#pod-povrch' : '/#ukazky';
for (const link of document.querySelectorAll('[data-example-return]')) {
  link.href = fallback;
  link.addEventListener('click', event => {
    let referrer;
    try { referrer = new URL(document.referrer); } catch { return; }
    if (referrer.origin === location.origin && ['/', '/home-v2', '/zakladatele', '/zakladatele/'].includes(referrer.pathname) && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  });
}
if (fromFounders) for (const link of document.querySelectorAll('.example-toolbar a:not([data-example-return])')) {
  const url = new URL(link.href); url.searchParams.set('z', 'zakladatele'); link.href = url.pathname + url.search;
}
