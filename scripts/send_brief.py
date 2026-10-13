#!/usr/bin/env python3
"""Send the morning brief as a push notification via ntfy (https://ntfy.sh).

Env vars:
  NTFY_TOPIC   required - your private topic name (set as a GitHub Actions secret)
  NTFY_SERVER  optional - defaults to https://ntfy.sh
  APP_URL      optional - opened when you tap the notification

Run with --dry-run to print the message instead of sending it.
"""
import datetime as dt
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOW = dt.datetime.now(dt.timezone.utc)
BRISBANE = dt.timezone(dt.timedelta(hours=10))  # Queensland has no daylight saving


def rank(item):
    pub = dt.datetime.fromisoformat(item["published"].replace("Z", "+00:00"))
    age_h = max(0.0, (NOW - pub).total_seconds() / 3600)
    return item["score"] - age_h / 12  # same formula as index.html


def main():
    dry = "--dry-run" in sys.argv
    with open(os.path.join(ROOT, "data", "news.json")) as f:
        news = json.load(f)
    with open(os.path.join(ROOT, "data", "cysa.json")) as f:
        cysa = json.load(f)

    recent = [i for i in news["items"]
              if (NOW - dt.datetime.fromisoformat(i["published"].replace("Z", "+00:00"))).total_seconds() < 30 * 3600]
    top = sorted(recent, key=rank, reverse=True)[:5]
    kev_count = sum(1 for i in recent if "KEV" in i["tags"])
    au_count = sum(1 for i in recent if i["region"] == "AU")

    today = NOW.astimezone(BRISBANE).date()
    lessons = cysa["lessons"]
    lesson = lessons[today.toordinal() % len(lessons)]

    lines = []
    for i in top:
        flag = "🇦🇺 " if i["region"] == "AU" else ""
        # fetch_news.py folds other outlets' reports of the same story into `also`,
        # so the top 5 are 5 different stories; show how widely each was covered.
        more = f" +{len(i['also'])}" if i.get("also") else ""
        lines.append(f"• {flag}{i['title']} ({i['source']}{more})")
    if not lines:
        lines.append("• Quiet night - no new high-relevance items.")
    lines.append("")
    lines.append(f"Last 30h: {len(recent)} items, {au_count} Australian, {kev_count} new CISA KEV entries.")
    lines.append(f"CySA+ focus: {lesson['id']} {lesson['title']}")
    body = "\n".join(lines)
    title = f"Sec-Pulse brief - {today.strftime('%a %d %b')}"

    if dry:
        print(title + "\n\n" + body)
        return

    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("NTFY_TOPIC not set - skipping notification (see README).", file=sys.stderr)
        return
    server = os.environ.get("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
    headers = {"Title": title.encode("utf-8"), "Tags": "shield", "Priority": "default"}
    app_url = os.environ.get("APP_URL", "").strip()
    if app_url:
        headers["Click"] = app_url
    req = urllib.request.Request(f"{server}/{topic}", data=body.encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"Sent brief: HTTP {r.status}", file=sys.stderr)


if __name__ == "__main__":
    main()
