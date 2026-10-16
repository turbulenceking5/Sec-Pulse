#!/usr/bin/env python3
"""Send the Sunday-evening weekly digest as a push notification via ntfy.

Top 10 stories of the past 7 days from data/news.json, a few weekly stats and a
CySA+ study nudge. Same env vars and ntfy conventions as send_brief.py, whose
helpers it reuses (see context/morning-brief.md#weekly-digest):
  NTFY_TOPIC   required - your private topic name (set as a GitHub Actions secret)
  NTFY_SERVER  optional - defaults to https://ntfy.sh
  APP_URL      optional - opened when you tap the notification

Run with --dry-run to print the message instead of sending it.
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from send_brief import BRISBANE, NOW, headline, lesson_for, load_data, notify, published  # noqa: E402

WINDOW_DAYS = 7
TOP_N = 10
MAX_TITLE = 140      # chars per headline, so ten long titles can't blow the size limit
MAX_BODY = 3900      # bytes; ntfy turns bodies over 4,096 bytes into attachments


def weekly_key(item):
    """Rank for a week window. rank() decays 2 points/day, which over 7 days would
    just pick the newest stories, so use the raw relevance score instead. Ties go
    to the story more outlets covered (len(also)), then the newer one."""
    return (item["score"], len(item.get("also", [])), published(item))


def build(news, cysa):
    week = [i for i in news["items"] if (NOW - published(i)).total_seconds() < WINDOW_DAYS * 86400]
    top = sorted(week, key=weekly_key, reverse=True)[:TOP_N]
    kev = sum(1 for i in week if "KEV" in i["tags"])
    au = sum(1 for i in week if i["region"] == "AU")
    epss = max((i for i in week if "epss" in i), key=lambda i: i["epss"], default=None)

    today = NOW.astimezone(BRISBANE).date()
    lessons = cysa["lessons"]
    seen, this_week = set(), []
    for d in range(WINDOW_DAYS - 1, -1, -1):  # Monday..Sunday when run on a Sunday
        lesson = lesson_for(today - dt.timedelta(days=d), lessons)
        if lesson["id"] not in seen:
            seen.add(lesson["id"])
            this_week.append(lesson)
    next_up = lesson_for(today + dt.timedelta(days=1), lessons)

    stories = [headline(i, MAX_TITLE) for i in top] or ["• Quiet week - no items collected."]
    tail = ["", f"This week: {len(week)} stories, {au} Australian, {kev} new CISA KEV entries."]
    if epss:
        t = epss["title"] if len(epss["title"]) <= 90 else epss["title"][:89].rstrip() + "…"
        tail.append(f"Highest EPSS: {epss['epss'] * 100:.1f}% - {t}")
    tail += ["", "CySA+ lessons this week (quiz yourself in the app):"]
    tail += [f"  {l['id']} {l['title']}" for l in this_week]
    tail.append(f"Tomorrow: {next_up['id']} {next_up['title']}")

    # Drop the lowest-ranked stories (never the stats) until the body fits.
    while len("\n".join(stories + tail).encode("utf-8")) > MAX_BODY and len(stories) > 1:
        stories.pop()
    body = "\n".join(stories + tail)
    title = f"Sec-Pulse weekly - week to {today.strftime('%a %d %b')}"
    return title, body


def main():
    news, cysa = load_data()
    title, body = build(news, cysa)
    notify(title, body, dry="--dry-run" in sys.argv, tags="shield,calendar", what="weekly digest", tag="digest")


if __name__ == "__main__":
    main()
