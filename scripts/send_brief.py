#!/usr/bin/env python3
"""Send the morning brief as a push notification via ntfy (https://ntfy.sh).

Env vars:
  NTFY_TOPIC   required - your private topic name (set as a GitHub Actions secret)
  NTFY_SERVER  optional - defaults to https://ntfy.sh
  APP_URL      optional - opened when you tap the notification

Run with --dry-run to print the message instead of sending it.
Run with --once to skip if today's brief was already sent: data/brief-sent.txt
holds the Brisbane date of the last successful send. The scheduled run and the
optional external trigger (see SETUP.md) both pass --once, so whichever runs
first sends and the other does nothing; a manual run always sends.

The helpers here (rank, published, load_data, lesson_for, qotd_for, headline, notify) are
also imported by fetch_news.py (rank) and send_digest.py, so importing this
module must stay free of side effects.
"""
import datetime as dt
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOW = dt.datetime.now(dt.timezone.utc)
BRISBANE = dt.timezone(dt.timedelta(hours=10))  # Queensland has no daylight saving
MAX_Q = 240  # question-of-the-day characters in the brief
SENT_FILE = os.path.join(ROOT, "data", "brief-sent.txt")


def published(item):
    return dt.datetime.fromisoformat(item["published"].replace("Z", "+00:00"))


def rank(item):
    age_h = max(0.0, (NOW - published(item)).total_seconds() / 3600)
    return item["score"] - age_h / 12  # same formula as index.html


def load_data():
    with open(os.path.join(ROOT, "data", "news.json")) as f:
        news = json.load(f)
    with open(os.path.join(ROOT, "data", "cysa.json")) as f:
        cysa = json.load(f)
    return news, cysa


def lesson_for(day, lessons):
    """Lesson of the day for a Brisbane date; index.html's ordinal() picks the same one."""
    return lessons[day.toordinal() % len(lessons)]


def qotd_for(day, lessons):
    """Question of the day; index.html's Brief shows ALL_Q()[(ordinal * 7) % n] from the same flattened list."""
    qs = [q for lesson in lessons for q in lesson["quiz"]]
    return qs[(day.toordinal() * 7) % len(qs)]


def headline(item, max_title=None):
    flag = "🇦🇺 " if item["region"] == "AU" else ""
    # fetch_news.py folds other outlets' reports of the same story into `also`,
    # so each item is a different story; show how widely each was covered.
    more = f" +{len(item['also'])}" if item.get("also") else ""
    title = item["title"]
    if max_title and len(title) > max_title:
        title = title[:max_title - 1].rstrip() + "…"
    return f"• {flag}{title} ({item['source']}{more})"


def notify(title, body, dry=False, tags="shield", priority="default", what="brief"):
    """Print (dry run) or POST the message to ntfy. No NTFY_TOPIC = skip, exit 0.
    Returns True only if the message was actually sent."""
    if dry:
        print(title + "\n\n" + body)
        return False
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("NTFY_TOPIC not set - skipping notification (see README).", file=sys.stderr)
        return False
    server = os.environ.get("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
    headers = {"Title": title.encode("utf-8"), "Tags": tags, "Priority": priority}
    app_url = os.environ.get("APP_URL", "").strip()
    if app_url:
        headers["Click"] = app_url
    req = urllib.request.Request(f"{server}/{topic}", data=body.encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"Sent {what}: HTTP {r.status}", file=sys.stderr)
    return True


def main():
    dry = "--dry-run" in sys.argv
    today = NOW.astimezone(BRISBANE).date()
    if "--once" in sys.argv and not dry:
        try:
            with open(SENT_FILE) as f:
                if f.read().strip() == today.isoformat():
                    print(f"Brief for {today} already sent - skipping.", file=sys.stderr)
                    return
        except FileNotFoundError:
            pass
    news, cysa = load_data()

    recent = [i for i in news["items"] if (NOW - published(i)).total_seconds() < 30 * 3600]
    top = sorted(recent, key=rank, reverse=True)[:5]
    kev_count = sum(1 for i in recent if "KEV" in i["tags"])
    au_count = sum(1 for i in recent if i["region"] == "AU")

    lesson = lesson_for(today, cysa["lessons"])

    lines = [headline(i) for i in top]
    if not lines:
        lines.append("• Quiet night - no new high-relevance items.")
    lines.append("")
    lines.append(f"Last 30h: {len(recent)} items, {au_count} Australian, {kev_count} new CISA KEV entries.")
    lines.append(f"CySA+ focus: {lesson['id']} {lesson['title']}")
    question = qotd_for(today, cysa["lessons"])["q"]
    if len(question) > MAX_Q:
        question = question[:MAX_Q - 1].rstrip() + "…"
    lines.append(f"❓ {question} (answer in the app)")
    body = "\n".join(lines)
    title = f"Sec-Pulse brief - {today.strftime('%a %d %b')}"
    if notify(title, body, dry=dry):
        with open(SENT_FILE, "w") as f:
            f.write(today.isoformat() + "\n")


if __name__ == "__main__":
    main()
