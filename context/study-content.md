# Study content (`data/cysa.json`)

All CySA+ lessons, quiz questions and flashcards live in one hand-written JSON file. The app reads it at startup, and `send_brief.py` reads it for the "CySA+ focus" line.

## Current coverage

| Domain | Exam weight | Lessons | Questions | Cards |
|---|---|---|---|---|
| 1 Security Operations | 33% | 1.1–1.8 (8) | 24 | 43 |
| 2 Vulnerability Management | 30% | 2.1–2.6 (6, incl. 2.6 AU bonus) | 18 | 32 |
| 3 Incident Response & Management | 20% | 3.1–3.5 (5, incl. 3.4 AU bonus) | 15 | 12 |
| 4 Reporting & Communication | 17% | 4.1–4.5 (5) | 15 | 6 |
| **Total** | | **24** | **72** | **93** |

Domain 4 now has 5 lessons (4.3 metrics/KPIs, 4.4 stakeholder communication and escalation, 4.5 writing an incident report) but is still light on flashcards; Domain 3 is the next thinnest (see [roadmap.md](roadmap.md)). Cards c61–c93 cover tools and ports: Nmap flags (c61–c70, domain 2), common ports (c71–c81, domain 1) and Windows Security/System event IDs (c82–c93, domain 1).

**AU bonus** lessons (2.6 Essential Eight, 3.4 BEC/payment redirection playbook, plus the Australian points in 4.2) are not CySA+ exam content. They're there for the user's actual job. Their titles start with "AU bonus:" and their exam tip explains how they map back to exam concepts.

## Schema

```jsonc
{
  "exam": {"name": "CompTIA CySA+", "code": "CS0-003", "note": "shown under the lesson list"},
  "domains": [{"id": 1, "name": "Security Operations", "weight": 33}],
  "lessons": [
    {
      "id": "1.5",                 // "<domain>.<n>", unique, used as the progress key
      "domain": 1,
      "title": "Email analysis: headers, SPF, DKIM, DMARC",
      "summary": "2–3 sentences: why this matters",
      "points": ["5–7 key facts, each one self-contained"],
      "examTip": "the one thing to remember in the exam",
      "onTheJob": "how this applies to an analyst in an Australian real-estate SOC",
      "quiz": [
        {
          "q": "question text",
          "options": ["exactly", "four", "options", "here"],
          "answer": 2,             // index into options; the app shuffles display order
          "explain": "why the answer is right (and ideally why the tempting wrong one isn't)"
        }
      ]
    }
  ],
  "cards": [{"id": "c01", "domain": 1, "group": "detection", "front": "term", "back": "definition"}]  // group: see Rules
}
```

## Rules

- **IDs are permanent.** Lesson `id`s key `sp_lessons`, card `id`s key `sp_cards`, and question IDs are `<lesson id>#<index>`. Renaming or reordering resets the user's progress for that item. Add new items with new IDs; fix typos in place.
- **Order matters in two places:**
  - The lesson of the day is `lessons[ordinal % len]`. Adding a lesson shifts which lesson appears on which day. That's harmless, just expected.
  - New flashcards are introduced in array order (8/day). Append new cards at the end so they arrive after the existing deck.
- **Exactly 4 options per question.** The app assumes it, and so does the CySA+ format.
- **Don't worry about answer position.** Options are shuffled on every render, so `answer` can always be 0 if that's easier to write.
- **Every card needs a `group`, and every group needs at least 4 cards.** The other 3 multiple-choice answers are drawn from the card's group, so a group should hold cards whose backs look alike (same shape and topic). Current groups: `models` (frameworks and lists), `tooling` (SIEM/SOAR, Zero Trust, SASE, CASB, UEBA), `email-identity`, `detection`, `vuln-mgmt`, `appsec`, `ir`, `reporting`, `nmap`, `port`, `event-id`. Reuse one where it fits; a new group needs 4+ cards.
- **Plain text only.** Everything is HTML-escaped on render: no markdown, no HTML tags. Use `\\` for a literal backslash in JSON (e.g. registry paths and regex).
- **Generic examples only.** The repo is public. Use `example.com`, `examp1e.com` style look-alikes, and generic org descriptions. Never use the employer's real domain, systems or incident details.
- **Validate after editing:**
  ```bash
  python3 -c "import json;d=json.load(open('data/cysa.json'));qs=[q for l in d['lessons'] for q in l['quiz']];assert all(len(q['options'])==4 and 0<=q['answer']<4 for q in qs);import collections;g=collections.Counter(c['group'] for c in d['cards']);assert min(g.values())>=4,g;print(len(d['lessons']),'lessons',len(qs),'questions',len(d['cards']),'cards')"
  ```

## Accuracy

This is exam prep, so wrong facts are worse than missing ones. When adding or editing:
- Base exam content on the official **CompTIA CySA+ CS0-003 exam objectives** PDF. If CompTIA releases a new version (CS0-004 or later), update `exam.code`, check domain names and weights, and revisit lessons.
- Facts most likely to go stale:

| Fact | Where | Last checked |
|---|---|---|
| CS0-003 domains and weights (33/30/20/17) | `domains` | Oct 2026 (initial build) |
| Pass mark 750 on a 100–900 scale | `index.html` quiz copy | Oct 2026 |
| NDB scheme: assess suspected breaches within 30 days; notify OAIC + individuals as soon as practicable | 4.2, card c58 | Oct 2026 |
| Cyber Security Act 2024: ransomware/extortion payment report to ASD within 72h, turnover > $3M | 4.2, card c59 | Oct 2026 |
| ACSC hotline 1300 CYBER1, ReportCyber at cyber.gov.au | 3.1, 3.4, card c53 | Oct 2026 |
| Essential Eight list and maturity level descriptions | 2.6, card c41 | Oct 2026 |
| Windows event ID meanings and 4624 logon types | cards c82–c93 | Oct 2026 |
| OWASP Top 10 (2021): broken access control #1 | 2.3 | Oct 2026 (OWASP may publish a newer list) |

Update the "Last checked" column when you re-verify.

## Writing style
- Australian English spelling (prioritise, organisation, behaviour, analyse).
- Short sentences. Each key point should make sense on its own.
- Questions should be scenario-based where possible ("An analyst sees…, what is this most likely?"), like the real exam. Avoid pure definition recall in questions; that's what flashcards are for.
- Wrong options should be plausible: real terms from the same topic, not obviously silly.
