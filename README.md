# 📡 IPTV Live

Página estática (GitHub Pages) para assistir canais IPTV (playlists M3U/HLS) e eventos ao vivo com agenda.

## Recursos
- Player HLS (hls.js) com reconexão automática; HLS nativo no Safari/iOS; MP4.
- Várias playlists M3U do repositório (`data/playlists/`), por URL ou por upload de arquivo.
- Busca, filtro por grupo e favoritos (salvos no navegador).
- Agenda de eventos (`data/events.json`) com status **AO VIVO / Começa em… / Encerrado** e contagem regressiva.
- Eventos podem ser `hls`, `mp4`, `youtube` (ID do vídeo) ou `iframe` (Twitch, Owncast etc.).
- Links diretos: `?play=URL_DO_STREAM` ou `?playlist=URL_DA_M3U`.

## Playlists
As playlists são geradas a partir de **`data/canais.csv`**, que pode ser editada no Excel ou direto no GitHub:

| coluna | o que é |
|---|---|
| `playlist` | id da playlist (vira `data/playlists/<id>.m3u`) |
| `nome` | nome do canal |
| `grupo` | categoria mostrada no filtro |
| `logo` | URL de imagem (opcional) |
| `url` | link HLS `.m3u8` (use **https**) |
| `tvg_id` | id para guia de programação (opcional) |

Depois de editar:
```bash
python tools/gerar_playlists.py            # gera .m3u e data/playlists.json
python tools/gerar_playlists.py --checar   # também testa se os streams respondem
git add data && git commit -m "Atualiza playlists" && git push
```
O site mostra um seletor com todas as playlists. Para dar nome amigável a uma nova playlist, adicione-a em `NOMES` no script.

Playlists incluídas:
- **publicos-br**: canais públicos com stream oficial do próprio canal (EBC, Câmara, Cultura, Rede Minas, Fiocruz).
- **eventos**: modelo para os seus streams (troque `SEU-DOMINIO`).
- **demo**: streams de teste para validar o player.

## Publicar no GitHub
1. Crie um repositório (ex.: `iptv-live`) e envie estes arquivos:
   ```bash
   git init && git add . && git commit -m "IPTV Live"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/iptv-live.git
   git push -u origin main
   ```
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. Aguarde o workflow terminar. A página fica em `https://SEU_USUARIO.github.io/iptv-live/`.

## Transmitir e retransmitir eventos ao vivo
O GitHub Pages só hospeda a página; ele **não recebe nem distribui vídeo**. Para transmitir, você precisa de um servidor de mídia:

| Opção | Quando usar |
|---|---|
| **MediaMTX numa VPS** (`docs/docker-compose.yml`) | Controle total, custo baixo, gera HLS para a página |
| **YouTube Live / Twitch** | Grátis, escala sozinho; use `type: "youtube"` ou `"iframe"` no evento |
| **Cloudflare Stream / Mux / AWS IVS** | Pago, escala alta, entrega HLS via CDN |

### Fluxo com MediaMTX
1. Na VPS: copie `docs/` e rode `docker compose up -d`. Troque a senha em `mediamtx.yml`.
2. No **OBS**: Servidor `rtmp://SEU-IP:1935/live`, chave `meucanal?user=publicador&pass=SUA_SENHA`.
3. Na página: o stream fica em `http://SEU-IP:8888/live/meucanal/index.m3u8`.
4. Adicione essa URL em `data/events.json` ou `data/playlist.m3u` e faça push.

> **HTTPS obrigatório:** o github.io usa HTTPS, então o navegador bloqueia streams `http://`. Coloque um domínio com HTTPS na frente do MediaMTX (ex.: Caddy ou Cloudflare Tunnel).

### Retransmitir para várias plataformas
Descomente o bloco `runOnReady` em `mediamtx.yml` para enviar o mesmo sinal ao YouTube/Twitch enquanto ele também aparece na sua página.

## Adicionar um evento
```json
{
  "title": "Final do campeonato",
  "description": "Transmissão oficial",
  "start": "2026-12-01T20:00:00-03:00",
  "end": "2026-12-01T22:00:00-03:00",
  "type": "hls",
  "url": "https://stream.seudominio.com/live/meucanal/index.m3u8"
}
```

## Aviso legal
Só transmita ou retransmita conteúdo próprio ou que você tem licença para distribuir. Retransmitir canais pagos ou eventos esportivos sem autorização viola direitos autorais e os Termos do GitHub, e o repositório pode ser removido.
