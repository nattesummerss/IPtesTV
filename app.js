// IPTV Live — player estático para GitHub Pages
const $ = (s) => document.querySelector(s);
const video = $('#video'), embed = $('#embed'), statusEl = $('#status');
let hls = null, channels = [], current = null;
const favs = new Set(JSON.parse(localStorage.getItem('iptv:favs') || '[]'));

// ---------- Parser M3U ----------
function parseM3U(text) {
  const out = [];
  let info = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attr = (k) => (line.match(new RegExp(k + '="([^"]*)"')) || [])[1] || '';
      info = { name: line.split(',').slice(1).join(',').trim() || 'Sem nome',
               logo: attr('tvg-logo'), group: attr('group-title') || 'Outros' };
    } else if (!line.startsWith('#')) {
      out.push({ ...(info || { name: line, logo: '', group: 'Outros' }), url: line, type: guessType(line) });
      info = null;
    }
  }
  return out;
}
const guessType = (url) => /\.mp4(\?|$)/i.test(url) ? 'mp4' : 'hls';

// ---------- Player ----------
function stop() {
  if (hls) { hls.destroy(); hls = null; }
  video.pause(); video.removeAttribute('src'); video.load();
  embed.src = 'about:blank'; embed.hidden = true; video.hidden = false;
}

function play(item, { live = false } = {}) {
  stop();
  current = item;
  $('#nowTitle').textContent = item.name || item.title;
  $('#liveBadge').hidden = !live;
  $('#favBtn').textContent = favs.has(item.url) ? '★' : '☆';
  setStatus('Carregando…');
  document.querySelectorAll('.channels li').forEach((li) => li.classList.toggle('active', li.dataset.url === item.url));

  if (item.type === 'youtube' || item.type === 'iframe') {
    video.hidden = true; embed.hidden = false;
    embed.src = item.type === 'youtube'
      ? `https://www.youtube.com/embed/${encodeURIComponent(item.url)}?autoplay=1&mute=1`
      : item.url;
    setStatus('');
    return;
  }
  if (item.type === 'hls' && window.Hls && Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 });
    hls.loadSource(item.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus(''); video.play().catch(() => {}); });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return;
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) { setStatus('Erro de rede — tentando novamente…'); hls.startLoad(); }
      else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); }
      else setStatus('Não foi possível reproduzir este stream (CORS, offline ou formato).');
    });
  } else {
    video.src = item.url; // Safari/iOS (HLS nativo) ou MP4
    video.onloadeddata = () => setStatus('');
    video.onerror = () => setStatus('Não foi possível reproduzir este stream.');
    video.play().catch(() => {});
  }
}
const setStatus = (t) => (statusEl.textContent = t);

// ---------- Lista de canais ----------
function renderChannels() {
  const q = $('#search').value.toLowerCase(), g = $('#group').value;
  const list = channels
    .filter((c) => (!g || c.group === g) && c.name.toLowerCase().includes(q))
    .sort((a, b) => favs.has(b.url) - favs.has(a.url));
  const ul = $('#channels');
  ul.replaceChildren(...list.map((c) => {
    const li = document.createElement('li');
    li.dataset.url = c.url;
    if (current && current.url === c.url) li.classList.add('active');
    const img = document.createElement('img');
    img.alt = ''; img.src = c.logo || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="17" font-size="14" text-anchor="middle" fill="#888">📺</text></svg>');
    const meta = document.createElement('div'); meta.className = 'meta';
    const name = document.createElement('div'); name.className = 'name';
    name.textContent = (favs.has(c.url) ? '★ ' : '') + c.name;
    const grp = document.createElement('small'); grp.textContent = c.group;
    meta.append(name, grp); li.append(img, meta);
    li.onclick = () => play(c);
    return li;
  }));
  if (!list.length) ul.innerHTML = '<li><small>Nenhum canal.</small></li>';
}

function setChannels(list) {
  channels = list;
  const groups = [...new Set(list.map((c) => c.group))].sort();
  $('#group').replaceChildren(new Option('Todos os grupos', ''), ...groups.map((g) => new Option(g, g)));
  renderChannels();
}

async function loadPlaylist(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    setChannels(parseM3U(await res.text()));
  } catch (e) {
    setStatus(`Falha ao carregar playlist (${e.message}). Verifique a URL e o CORS.`);
  }
}

// ---------- Eventos ao vivo ----------
let events = [];
function eventState(ev, now = Date.now()) {
  const s = Date.parse(ev.start), e = Date.parse(ev.end);
  return now < s ? 'soon' : now > e ? 'ended' : 'live';
}
function fmt(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(t / 86400);
  const h = String(Math.floor(t % 86400 / 3600)).padStart(2, '0'), m = String(Math.floor(t % 3600 / 60)).padStart(2, '0'), s = String(t % 60).padStart(2, '0');
  return (d ? d + 'd ' : '') + `${h}:${m}:${s}`;
}
function renderEvents() {
  const order = { live: 0, soon: 1, ended: 2 };
  const box = $('#events');
  box.replaceChildren(...events
    .map((ev) => ({ ev, st: eventState(ev) }))
    .sort((a, b) => order[a.st] - order[b.st] || Date.parse(a.ev.start) - Date.parse(b.ev.start))
    .map(({ ev, st }) => {
      const div = document.createElement('div');
      div.className = 'event ' + st;
      const label = { live: '● AO VIVO', soon: 'Começa em ' + fmt(Date.parse(ev.start) - Date.now()), ended: 'Encerrado' }[st];
      const badge = document.createElement('span'); badge.className = 'badge ' + st; badge.textContent = label;
      const title = document.createElement('strong'); title.textContent = ev.title;
      const desc = document.createElement('small'); desc.textContent = ev.description || '';
      const when = document.createElement('small'); when.textContent = new Date(ev.start).toLocaleString('pt-BR');
      div.append(badge, title, desc, when);
      div.onclick = () => st === 'soon'
        ? setStatus(`"${ev.title}" começa em ${fmt(Date.parse(ev.start) - Date.now())}`)
        : play({ name: ev.title, url: ev.url, type: ev.type || 'hls' }, { live: st === 'live' });
      return div;
    }));
}
async function loadEvents() {
  try { events = await (await fetch('data/events.json', { cache: 'no-store' })).json(); }
  catch { events = []; }
  renderEvents();
}

// ---------- UI ----------
$('#search').oninput = renderChannels;
$('#group').onchange = renderChannels;
$('#playlistForm').onsubmit = (e) => {
  e.preventDefault();
  const url = $('#playlistUrl').value.trim();
  if (url) { localStorage.setItem('iptv:playlist', url); loadPlaylist(url); }
};
$('#playlistFile').onchange = async (e) => {
  const f = e.target.files[0];
  if (f) setChannels(parseM3U(await f.text()));
};
$('#favBtn').onclick = () => {
  if (!current) return;
  favs.has(current.url) ? favs.delete(current.url) : favs.add(current.url);
  localStorage.setItem('iptv:favs', JSON.stringify([...favs]));
  $('#favBtn').textContent = favs.has(current.url) ? '★' : '☆';
  renderChannels();
};

// ---------- Playlists do site (data/playlists.json) ----------
async function loadPlaylistIndex() {
  let list = [];
  try { list = await (await fetch('data/playlists.json', { cache: 'no-store' })).json(); } catch {}
  const sel = $('#playlistSelect');
  sel.replaceChildren(...list.map((p) => new Option(`${p.nome} (${p.canais})`, p.arquivo)));
  sel.hidden = !list.length;
  return list;
}
$('#playlistSelect').onchange = (e) => {
  localStorage.setItem('iptv:playlist', e.target.value);
  $('#playlistUrl').value = '';
  loadPlaylist(e.target.value);
};

// ?play=URL abre um stream direto; ?playlist=URL carrega outra lista
const params = new URLSearchParams(location.search);
(async () => {
  const index = await loadPlaylistIndex();
  const saved = localStorage.getItem('iptv:playlist');
  const start = params.get('playlist') || saved || (index[0] && index[0].arquivo);
  if (!start) return;
  if (index.some((p) => p.arquivo === start)) $('#playlistSelect').value = start;
  else $('#playlistUrl').value = start;
  loadPlaylist(start);
})();
loadEvents();
setInterval(renderEvents, 1000);
setInterval(loadEvents, 60000);
if (params.get('play')) play({ name: 'Stream compartilhado', url: params.get('play'), type: params.get('type') || 'hls' }, { live: true });
