#!/usr/bin/env python3
"""Generate projects/index.html from every project.yml under projects/.

Stdlib only. Reads the flat YAML subset used by templates/project.yml
(scalars, [inline lists], and `tools:` as a list of {inline maps} or
`- key: value` blocks). Run from anywhere:

    python3 projects/tools/build_index.py
"""
from __future__ import annotations
import html, re, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "index.html"
SKIP_DIRS = {"templates", "tools", "decisions"}


# ---------- tiny YAML reader (enough for project.yml) ----------
def _scalar(s: str):
    s = s.split(" #", 1)[0].strip() if not s.strip().startswith(("'", '"')) else s.strip()
    if s in ("~", "", "null"):
        return None
    if s.startswith("[") and s.endswith("]"):
        inner = s[1:-1].strip()
        return [_scalar(x) for x in re.split(r",\s*", inner)] if inner else []
    if s.startswith("{") and s.endswith("}"):
        d = {}
        for part in re.split(r",\s*(?=[\w-]+\s*:)", s[1:-1]):
            if ":" in part:
                k, v = part.split(":", 1)
                d[k.strip()] = _scalar(v)
        return d
    if (s[0] == s[-1]) and s[0] in "'\"" and len(s) >= 2:
        return s[1:-1]
    if s.lower() in ("true", "false"):
        return s.lower() == "true"
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        return s


def read_yaml(path: Path) -> dict:
    data, key, items, cur = {}, None, None, None
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        if indent == 0:
            if key and items is not None:
                data[key] = items
            k, _, v = line.partition(":")
            key, items, cur = k.strip(), None, None
            if v.strip() == "":
                items = []
            else:
                data[key] = _scalar(v)
        elif line.startswith("- "):
            body = line[2:].strip()
            if body.startswith("{"):
                cur = _scalar(body)
            else:
                k, _, v = body.partition(":")
                cur = {k.strip(): _scalar(v)}
            items.append(cur)
        elif cur is not None and ":" in line:
            k, _, v = line.partition(":")
            cur[k.strip()] = _scalar(v)
    if key and items is not None:
        data[key] = items
    return data


# ---------- collect ----------
def collect() -> list[dict]:
    out = []
    for yml in sorted(ROOT.rglob("project.yml")):
        rel = yml.parent.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS:
            continue
        p = read_yaml(yml)
        p["_dir"] = rel.as_posix()
        p.setdefault("status", "idea")
        p.setdefault("tools", [])
        p.setdefault("tags", [])
        out.append(p)
    return out


# ---------- render ----------
CSS = """
:root{--bg:#0f1115;--card:#171a21;--line:#262b36;--fg:#e6e8ee;--mut:#8b93a7;--acc:#7aa2f7;--ok:#9ece6a;--warn:#e0af68;--bad:#f7768e}
@media (prefers-color-scheme:light){:root{--bg:#f6f7f9;--card:#fff;--line:#e3e6ec;--fg:#1b1f27;--mut:#5c667a;--acc:#2f5fd0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:28px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 32px}
h2{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:40px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:10px}
.card h3{margin:0;font-size:18px}.card h3 a{color:var(--fg);text-decoration:none}.card h3 a:hover{color:var(--acc)}
.meta{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--mut)}
.pill{border:1px solid var(--line);border-radius:999px;padding:1px 8px}
.pill.active{color:var(--ok);border-color:var(--ok)}.pill.done{color:var(--acc);border-color:var(--acc)}
.pill.idea{color:var(--warn);border-color:var(--warn)}.pill.abandoned{color:var(--bad);border-color:var(--bad)}
.sum{margin:0;color:var(--fg)}.tools{font-size:13px;color:var(--mut)}
.score{font-size:13px;color:var(--mut)}.score b{color:var(--fg);letter-spacing:2px}
.links{margin-top:auto;display:flex;gap:14px;font-size:14px}.links a{color:var(--acc);text-decoration:none}.links a:hover{text-decoration:underline}
.open{display:inline-block;background:var(--acc);color:#fff!important;padding:6px 12px;border-radius:8px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}th{color:var(--mut);font-weight:500}
td a{color:var(--acc);text-decoration:none}
footer{margin-top:48px;color:var(--mut);font-size:13px}footer a{color:var(--acc)}
"""


def esc(x) -> str:
    return html.escape("" if x is None else str(x))


def stars(n) -> str:
    if n is None:
        return '<span class="score">not yet evaluated</span>'
    n = int(round(float(n)))
    return f'<span class="score">usefulness <b>{"★"*n}{"☆"*(5-n)}</b> {n}/5</span>'


def tools_line(p) -> str:
    seen = []
    for t in p.get("tools") or []:
        if isinstance(t, dict):
            s = " / ".join(x for x in (t.get("tool"), t.get("model")) if x)
        else:
            s = str(t)
        if s and s not in seen:
            seen.append(s)
    return esc(", ".join(seen)) if seen else "<em>tools not recorded</em>"


def card(p) -> str:
    d = p["_dir"]
    entry = p.get("entry")
    links = []
    if entry:
        links.append(f'<a class="open" href="{esc(d)}/{esc(entry)}">Open</a>')
    links.append(f'<a href="{esc(d)}/prompts.md">prompts</a>')
    links.append(f'<a href="{esc(d)}/DECISIONS.md">decisions</a>')
    links.append(f'<a href="{esc(d)}/EVALUATION.md">evaluation</a>')
    links.append(f'<a href="{esc(d)}/">folder</a>')
    meta = [f'<span class="pill {esc(p["status"])}">{esc(p["status"])}</span>']
    if p.get("version"):
        meta.append(f'<span class="pill">{esc(p["version"])}</span>')
    if p.get("group"):
        meta.append(f'<span class="pill">{esc(p["group"])}</span>')
    if p.get("spec_kit"):
        meta.append('<span class="pill">spec kit</span>')
    if p.get("updated"):
        meta.append(f'<span>updated {esc(p["updated"])}</span>')
    tags = " ".join(f"#{esc(t)}" for t in (p.get("tags") or []))
    title = esc(p.get("name") or p.get("slug") or d)
    head = f'<a href="{esc(d)}/{esc(entry)}">{title}</a>' if entry else title
    return f"""<article class="card">
  <h3>{head}</h3>
  <div class="meta">{''.join(meta)}</div>
  <p class="sum">{esc(p.get("summary"))}</p>
  <div class="tools">{tools_line(p)}</div>
  {stars(p.get("usefulness"))}
  <div class="tools">{tags}</div>
  <div class="links">{''.join(links)}</div>
</article>"""


def row(p) -> str:
    d = p["_dir"]
    return (f'<tr><td><a href="{esc(d)}/">{esc(p.get("name") or d)}</a></td>'
            f'<td><span class="pill {esc(p["status"])}">{esc(p["status"])}</span></td>'
            f'<td>{esc(p.get("version") or "—")}</td><td>{esc(p.get("summary"))}</td>'
            f'<td>{tools_line(p)}</td></tr>')


def build() -> str:
    ps = collect()
    showcase = [p for p in ps if p["status"] in ("done", "active") and p.get("entry")]
    rest = [p for p in ps if p not in showcase]
    showcase.sort(key=lambda p: (p["status"] != "done", -(float(p.get("usefulness") or 0)), p.get("name") or ""))
    rest.sort(key=lambda p: (p["status"], p.get("name") or ""))
    parts = [f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vibe-coded projects</title><style>{CSS}</style></head><body><main>
<h1>Vibe-coded projects</h1>
<p class="sub">{len(ps)} project{"s" if len(ps)!=1 else ""} · generated {date.today().isoformat()} by <code>tools/build_index.py</code> · conventions in <a href="README.md">README.md</a></p>"""]
    parts.append("<h2>Final projects</h2>")
    parts.append('<div class="grid">' + "".join(card(p) for p in showcase) + "</div>"
                 if showcase else '<p class="sub">Nothing runnable yet — set <code>entry</code> and <code>status: active|done</code> in a project.yml.</p>')
    if rest:
        parts.append("<h2>Also in the repo</h2><table><tr><th>Project</th><th>Status</th><th>Version</th><th>Summary</th><th>Tools</th></tr>"
                     + "".join(row(p) for p in rest) + "</table>")
    parts.append('<footer>Framework decisions: <a href="decisions/DECISIONS.md">decisions/DECISIONS.md</a>. '
                 "Do not edit this file by hand.</footer></main></body></html>\n")
    return "\n".join(parts)


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    n = len(collect())
    print(f"wrote {OUT.relative_to(ROOT.parent)} ({n} project{'s' if n != 1 else ''})")
    sys.exit(0)
