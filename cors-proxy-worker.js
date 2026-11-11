// Proxy HLS/MPEG-TS para Cloudflare Workers (plano gratuito).
// Resolve: (1) servidores sem CORS e (2) links http:// em site https (github.io).
//
// Como publicar:
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker → cole este arquivo → Deploy.
//   2. Em Settings → Variables, crie:
//        ALLOWED_ORIGIN = https://SEU_USUARIO.github.io
//        ALLOWED_HOSTS  = tvbrasil-stream.ebc.com.br,stream3.camara.gov.br,seu-servidor.com
//                         (use * para liberar qualquer host — não recomendado)
//   3. No site, abra ⚙ Proxy e cole a URL do worker (ex.: https://iptv-proxy.SEU.workers.dev).
//
// Use somente com streams que você tem direito de distribuir.

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const self = new URL(request.url);
    const target = self.searchParams.get('url');
    if (!target) return new Response('Parâmetro ?url= ausente', { status: 400, headers: cors });

    let t;
    try { t = new URL(target); } catch { return new Response('URL inválida', { status: 400, headers: cors }); }
    if (!/^https?:$/.test(t.protocol)) return new Response('Protocolo não permitido', { status: 400, headers: cors });
    if (!hostAllowed(t.hostname, env.ALLOWED_HOSTS)) {
      return new Response(`Host não liberado: ${t.hostname}`, { status: 403, headers: cors });
    }

    const headers = { 'User-Agent': 'Mozilla/5.0' };
    const range = request.headers.get('Range');
    if (range) headers.Range = range;
    const upstream = await fetch(t.toString(), { headers, redirect: 'follow' });

    const finalUrl = upstream.url || t.toString();
    const ctype = upstream.headers.get('content-type') || '';
    const out = new Headers(cors);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }

    if (isPlaylist(finalUrl, ctype)) {
      const body = rewritePlaylist(await upstream.text(), finalUrl, `${self.origin}${self.pathname}`);
      out.set('content-type', 'application/vnd.apple.mpegurl');
      out.delete('content-length');
      return new Response(body, { status: upstream.status, headers: out });
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

export function hostAllowed(host, list) {
  const allowed = (list || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.includes('*')) return true;
  host = host.toLowerCase();
  return allowed.some((a) => host === a || host.endsWith('.' + a));
}

export function isPlaylist(url, ctype) {
  return /mpegurl/i.test(ctype) || /\.m3u8?(\?|$)/i.test(new URL(url).pathname);
}

// Reescreve cada URL da playlist HLS para também passar pelo proxy.
export function rewritePlaylist(text, baseUrl, proxyBase) {
  const wrap = (u) => `${proxyBase}?url=${encodeURIComponent(new URL(u, baseUrl).toString())}`;
  return text.split(/\r?\n/).map((line) => {
    const l = line.trim();
    if (!l) return line;
    if (l.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`);
    return wrap(l);
  }).join('\n');
}
