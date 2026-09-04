const BOOKING_OVERRIDE = String.raw`
<script>
(() => {
  document.addEventListener('click', async (event) => {
    const link = event.target instanceof Element ? event.target.closest('#qualifiedCta a') : null;
    if (!link) return;
    if (typeof state === 'undefined' || !state.leadId) return;
    const emailInput = document.getElementById('email');
    const email = emailInput && 'value' in emailInput ? String(emailInput.value || '').trim() : '';
    if (!email) return;

    event.preventDefault();
    const original = link.textContent || 'Réserver mon échange gratuit';
    link.textContent = 'Recherche des créneaux…';
    link.setAttribute('aria-disabled', 'true');
    link.style.pointerEvents = 'none';

    try {
      const response = await fetch('/api/prospect-booking-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leadId: state.leadId, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.bookingUrl) throw new Error(data.error || 'Créneaux indisponibles');
      window.location.assign(data.bookingUrl);
    } catch (error) {
      link.textContent = original;
      link.removeAttribute('aria-disabled');
      link.style.pointerEvents = '';
      const box = document.getElementById('qualifiedCta');
      if (box && !document.getElementById('bookingError')) {
        const message = document.createElement('div');
        message.id = 'bookingError';
        message.className = 'error';
        message.textContent = 'Les créneaux ne peuvent pas être chargés pour le moment. Votre demande est bien enregistrée ; vous pouvez réessayer dans quelques instants.';
        box.appendChild(message);
      }
    }
  }, true);
})();
</script>`;

export default async (req: Request) => {
  try {
    const sourceUrl = new URL('/photographie-patrimoniale.html', req.url);
    const response = await fetch(sourceUrl, { headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) return new Response('Page indisponible.', { status: 503 });
    const html = await response.text();
    const body = html.includes('</body>') ? html.replace('</body>', `${BOOKING_OVERRIDE}\n</body>`) : `${html}${BOOKING_OVERRIDE}`;
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
        'x-robots-tag': 'index, follow',
      },
    });
  } catch (error) {
    console.error('photographie-patrimoniale render failed', error);
    return new Response('Page momentanément indisponible.', { status: 503 });
  }
};

export const config = { path: '/photographie-patrimoniale' };
