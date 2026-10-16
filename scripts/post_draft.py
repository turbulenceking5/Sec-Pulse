#!/usr/bin/env python3
"""Send blog drafts in blog/drafts/*.md to WordPress.com as DRAFT posts (never published).

Each Markdown file starts with a front-matter block:

    ---
    title: What is EPSS?
    category: Learning
    tags: cybersecurity, vulnerability, epss
    ---
    Body in simple Markdown (## headings, paragraphs, - / 1. lists, **bold**, *italic*,
    `code`, [links](https://...), ``` code blocks, > quotes).

A file is sent once: blog/posted.json maps file name -> {id, url, date}. Editing a file
after it was sent does NOT update WordPress (you may already have edited the draft there);
rename it or remove its entry from posted.json to send it again as a new draft.

Env vars (GitHub Actions secrets): WP_CLIENT_ID, WP_CLIENT_SECRET, WP_USERNAME,
WP_APP_PASSWORD. Optional WP_SITE (default cybersecuritydoom.wordpress.com).
Run with --dry-run to print the converted HTML instead of sending.
Standard library only.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS = os.path.join(ROOT, "blog", "drafts")
POSTED = os.path.join(ROOT, "blog", "posted.json")
API = "https://public-api.wordpress.com"


def front_matter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        raise ValueError("missing --- front matter ---")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    if not meta.get("title"):
        raise ValueError("front matter needs a title")
    return meta, m.group(2)


def inline(s):
    """Escape, then apply `code`, **bold**, *italic* and [text](https://link)."""
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    return re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
                  lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', s)


def to_blocks(md):
    """Simple Markdown -> WordPress block-editor HTML (each block wrapped in <!-- wp:... --> comments)."""
    out, para, lines, i = [], [], md.splitlines(), 0

    def flush():
        if para:
            out.append(f'<!-- wp:paragraph -->\n<p>{inline(" ".join(para))}</p>\n<!-- /wp:paragraph -->')
            para.clear()
    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("```"):
            flush()
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            out.append('<!-- wp:code -->\n<pre class="wp-block-code"><code>'
                       + html.escape("\n".join(code), quote=False) + "</code></pre>\n<!-- /wp:code -->")
        elif m := re.match(r"^(#{2,4})\s+(.*)", line):
            flush()
            n = len(m.group(1))
            attrs = "" if n == 2 else f' {{"level":{n}}}'
            out.append(f'<!-- wp:heading{attrs} -->\n<h{n} class="wp-block-heading">{inline(m.group(2))}</h{n}>\n<!-- /wp:heading -->')
        elif re.match(r"^(\s*[-*]|\s*\d+\.)\s+", line):
            flush()
            ordered = bool(re.match(r"^\s*\d+\.", line))
            items = []
            while i < len(lines) and re.match(r"^(\s*[-*]|\s*\d+\.)\s+", lines[i]):
                items.append(re.sub(r"^(\s*[-*]|\s*\d+\.)\s+", "", lines[i].rstrip()))
                i += 1
            tag = "ol" if ordered else "ul"
            lis = "".join(f"<!-- wp:list-item -->\n<li>{inline(t)}</li>\n<!-- /wp:list-item -->\n" for t in items)
            attrs = ' {"ordered":true}' if ordered else ""
            out.append(f'<!-- wp:list{attrs} -->\n<{tag} class="wp-block-list">\n{lis}</{tag}>\n<!-- /wp:list -->')
            continue
        elif line.startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].startswith(">"):
                quote.append(lines[i].lstrip("> ").rstrip())
                i += 1
            out.append('<!-- wp:quote -->\n<blockquote class="wp-block-quote"><!-- wp:paragraph -->\n<p>'
                       + inline(" ".join(quote)) + "</p>\n<!-- /wp:paragraph --></blockquote>\n<!-- /wp:quote -->")
            continue
        elif not line.strip():
            flush()
        else:
            para.append(line.strip())
        i += 1
    flush()
    return "\n\n".join(out)


def post(url, data, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {e.code} from {urllib.parse.urlsplit(url).path}: {detail}") from None


def token():
    """Password grant for the app owner's own site; a fresh token every run, so nothing expires."""
    need = ["WP_CLIENT_ID", "WP_CLIENT_SECRET", "WP_USERNAME", "WP_APP_PASSWORD"]
    missing = [k for k in need if not os.environ.get(k, "").strip()]
    if missing:
        sys.exit(f"Missing secrets: {', '.join(missing)} (see context/blog.md)")
    r = post(f"{API}/oauth2/token", {
        "client_id": os.environ["WP_CLIENT_ID"].strip(), "client_secret": os.environ["WP_CLIENT_SECRET"].strip(),
        "grant_type": "password", "username": os.environ["WP_USERNAME"].strip(),
        # Application passwords are shown in groups ("abcd efgh ijkl mnop"); the spaces aren't part of it.
        "password": re.sub(r"\s+", "", os.environ["WP_APP_PASSWORD"])})
    return r["access_token"]


def main():
    dry = "--dry-run" in sys.argv
    posted = json.load(open(POSTED)) if os.path.exists(POSTED) else {}
    files = sorted(f for f in os.listdir(DRAFTS) if f.endswith(".md")) if os.path.isdir(DRAFTS) else []
    todo = [f for f in files if f not in posted]
    if not todo:
        print("No new drafts.")
        return
    site = os.environ.get("WP_SITE", "").strip() or "cybersecuritydoom.wordpress.com"
    tok = None if dry else token()
    for name in todo:
        meta, body = front_matter(open(os.path.join(DRAFTS, name), encoding="utf-8").read())
        content = to_blocks(body)
        if dry:
            print(f"===== {name}: {meta['title']} [{meta.get('category', '')}] tags: {meta.get('tags', '')}\n{content}\n")
            continue
        r = post(f"{API}/rest/v1.1/sites/{site}/posts/new", {
            "title": meta["title"], "content": content, "status": "draft",
            "categories": meta.get("category", ""), "tags": meta.get("tags", "")}, tok)
        posted[name] = {"id": r["ID"], "url": r.get("URL", ""), "date": dt.date.today().isoformat()}
        print(f"Draft created: {meta['title']} (post {r['ID']}) - review it in WordPress → Posts → Drafts")
        with open(POSTED, "w") as f:  # save after each one, so a later failure doesn't resend earlier drafts
            json.dump(posted, f, indent=2)
            f.write("\n")


if __name__ == "__main__":
    main()
