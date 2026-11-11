#!/usr/bin/env python3
"""Gera as playlists .m3u do site a partir de data/canais.csv.

Uso:
  python tools/gerar_playlists.py            # gera os arquivos
  python tools/gerar_playlists.py --checar   # também testa se cada stream responde
"""
import csv, json, sys, urllib.request
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "canais.csv"
OUT = ROOT / "data" / "playlists"
NOMES = {  # nome amigável de cada playlist no seletor do site
    "publicos-br": "Canais públicos (Brasil)",
    "eventos": "Meus eventos ao vivo",
    "demo": "Streams de teste",
}

def esc(v):
    return (v or "").replace('"', "'").strip()

def checar(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            ok = r.status == 200 and b"#EXTM3U" in r.read(2048)
            return "OK" if ok else f"resposta inválida ({r.status})"
    except Exception as e:
        return f"FALHOU ({e.__class__.__name__})"

def main():
    testar = "--checar" in sys.argv
    grupos = OrderedDict()
    with CSV.open(encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            url, nome, pl = row["url"].strip(), row["nome"].strip(), row["playlist"].strip()
            if not (url and nome and pl):
                print(f"linha {i}: faltando playlist/nome/url — ignorada"); continue
            if url.startswith("http://"):
                print(f"aviso linha {i}: '{nome}' usa http:// e será bloqueado no github.io (HTTPS)")
            grupos.setdefault(pl, []).append(row)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.m3u"):
        old.unlink()
    indice = []
    for pl, rows in grupos.items():
        linhas = ["#EXTM3U"]
        for r in rows:
            linhas.append(f'#EXTINF:-1 tvg-id="{esc(r["tvg_id"])}" tvg-logo="{esc(r["logo"])}" '
                          f'group-title="{esc(r["grupo"]) or "Outros"}",{r["nome"].strip()}')
            linhas.append(r["url"].strip())
            if testar:
                print(f"  [{pl}] {r['nome']}: {checar(r['url'].strip())}")
        (OUT / f"{pl}.m3u").write_text("\n".join(linhas) + "\n", encoding="utf-8")
        indice.append({"id": pl, "nome": NOMES.get(pl, pl), "arquivo": f"data/playlists/{pl}.m3u", "canais": len(rows)})
        print(f"{pl}.m3u: {len(rows)} canais")
    (ROOT / "data" / "playlists.json").write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("data/playlists.json atualizado")

if __name__ == "__main__":
    main()
