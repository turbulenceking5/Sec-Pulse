#!/usr/bin/env python3
"""Send the morning brief as a push notification via ntfy (https://ntfy.sh) and/or Web Push to the app.

Env vars (set at least one channel; both can be on):
  NTFY_TOPIC            ntfy topic name (GitHub Actions secret)
  WEBPUSH_SUBSCRIPTION  Web Push subscription JSON from the app's Settings (secret)
  VAPID_PRIVATE_KEY     private half of the app's VAPID key pair (secret; needs pywebpush)
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
import urllib.parse
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


class NotifyError(Exception):
    """A channel failed. `sent` says whether any other channel still delivered."""
    def __init__(self, sent, errors):
        super().__init__("; ".join(errors))
        self.sent = sent


WEBPUSH_MAX = 3800  # bytes of JSON payload; Web Push allows ~4 KB after encryption


def send_webpush(title, body, tag):
    """Web Push to the Home Screen app (tapping opens it). Needs WEBPUSH_SUBSCRIPTION (the JSON the
    app shows in Settings) and VAPID_PRIVATE_KEY. pywebpush is pip-installed by the brief/digest
    workflows only, and imported here so the rest of this module stays standard library."""
    from pywebpush import WebPushException, webpush
    key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not key:
        raise RuntimeError("VAPID_PRIVATE_KEY not set")
    sub = json.loads(os.environ["WEBPUSH_SUBSCRIPTION"])

    def payload(text):
        return json.dumps({"title": title, "body": text, "tag": tag, "url": "./#brief"}, ensure_ascii=False)
    while len(payload(body).encode("utf-8")) > WEBPUSH_MAX:
        body = body[:-200].rstrip() + "…"
    # VAPID "sub" must be mailto: or a bare https://host; the app's origin keeps any e-mail out of the repo.
    host = urllib.parse.urlsplit(os.environ.get("APP_URL", "")).hostname or "github.com"
    claims = {"sub": f"https://{host}"}
    try:
        webpush(sub, payload(body), vapid_private_key=key, vapid_claims=claims, ttl=12 * 3600, timeout=30)
    except WebPushException as e:
        if getattr(e.response, "status_code", None) in (404, 410):
            raise RuntimeError("subscription expired - in the app turn notifications on again (Settings) "
                               "and update the WEBPUSH_SUBSCRIPTION secret") from None
        raise


def notify(title, body, dry=False, tags="shield", priority="default", what="brief", tag="brief"):
    """Print (dry run), or send via ntfy (NTFY_TOPIC) and/or Web Push (WEBPUSH_SUBSCRIPTION).
    Neither configured = skip, exit 0. Returns True if any channel delivered; raises NotifyError
    (after trying both) if a configured channel failed."""
    if dry:
        print(title + "\n\n" + body)
        return False
    sent, errors = False, []
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if topic:
        server = os.environ.get("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
        headers = {"Title": title.encode("utf-8"), "Tags": tags, "Priority": priority}
        app_url = os.environ.get("APP_URL", "").strip()
        if app_url:
            headers["Click"] = app_url
        req = urllib.request.Request(f"{server}/{topic}", data=body.encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print(f"Sent {what} via ntfy: HTTP {r.status}", file=sys.stderr)
            sent = True
        except Exception as e:  # noqa: BLE001 - report it, still try Web Push
            errors.append(f"ntfy: {e}")
    if os.environ.get("WEBPUSH_SUBSCRIPTION", "").strip():
        try:
            send_webpush(title, body, tag)
            print(f"Sent {what} via Web Push", file=sys.stderr)
            sent = True
        except Exception as e:  # noqa: BLE001
            errors.append(f"Web Push: {e}")
    if not topic and not os.environ.get("WEBPUSH_SUBSCRIPTION", "").strip():
        print("NTFY_TOPIC and WEBPUSH_SUBSCRIPTION not set - skipping notification (see SETUP.md).", file=sys.stderr)
    if errors:
        raise NotifyError(sent, errors)
    return sent


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
    failed = None
    try:
        sent = notify(title, body, dry=dry)
    except NotifyError as e:
        sent, failed = e.sent, e
    if sent:
        with open(SENT_FILE, "w") as f:
            f.write(today.isoformat() + "\n")
    if failed:
        sys.exit(f"Notification failed: {failed}")


if __name__ == "__main__":
    main()
