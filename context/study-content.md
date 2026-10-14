# Study content (`data/cysa.json`)

All CySA+ lessons, quiz questions and flashcards live in one hand-written JSON file. The app reads it at startup, and `send_brief.py` reads it for the "CySA+ focus" line.

## Current coverage

| Domain | Exam weight | Lessons | Questions | Cards | PBQs |
|---|---|---|---|---|---|
| 1 Security Operations | 33% | 1.1–1.10 (10) | 30 | 43 | 5 |
| 2 Vulnerability Management | 30% | 2.1–2.7 (7, incl. 2.6 AU bonus) | 21 | 42 | 3 |
| 3 Incident Response & Management | 20% | 3.1–3.5 (5, incl. 3.4 AU bonus) | 15 | 26 | 4 |
| 4 Reporting & Communication | 17% | 4.1–4.5 (5) | 15 | 20 | 3 |
| **Total** | | **27** | **81** | **131** | **15** |

The card deck now roughly tracks the exam weights (33/32/20/15%). Cards c61–c93 cover tools and ports: Nmap flags (c61–c70, domain 2), common ports (c71–c81, domain 1) and Windows Security/System event IDs (c82–c93, domain 1). Cards c94–c107 are Domain 4 reporting terms (dwell time, KPI vs metric, MTTC/remediate, out-of-band comms, report structure, escalation matrix, vulnerability SLA/ageing/recurrence, risk exceptions, regulatory notification). Cards c108–c117 are Domain 2 vulnerability management (CVSS vectors/scope/metric groups, EPSS, prioritisation, ASM, scan false positives, CVE vs CWE). Cards c118–c131 are Domain 3 (containment, eradication, recovery, playbooks, IoC sweeps; c127–c131 are the `forensics` group).

**Tooling** lessons (1.9 triaging an EDR detection, 1.10 secure email gateway workflows, 2.7 reading a vulnerability scan report) cover the *categories* of tool the user works with, deliberately vendor-neutral (no product names, see [opsec.md](opsec.md)). Their titles start with "Tooling:".

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
  "cards": [{"id": "c01", "domain": 1, "group": "detection", "front": "term", "back": "definition"}],  // group: see Rules
  "pbqs": [  // performance-based questions, see below
    {"id": "p01", "domain": 1, "type": "select", "q": "task prompt", "exhibit": "multi-line\\nmonospace text", "options": ["four", "options", "exactly", "here"], "answer": 0, "explain": "why"},
    {"id": "p09", "domain": 3, "type": "order", "q": "task prompt", "items": ["4-6 steps", "in the", "CORRECT", "order"], "explain": "why"}  // optional "exhibit"
  ]
}
```

### PBQs (`pbqs`)

Performance-based practice: a realistic exhibit and a hands-on task, like the PBQs on the real exam.

- Common fields: `id` (`p01`, `p02`...), `domain` (1-4), `type`, `q` (the task), `explain` (why the answer is right and the tempting wrong ones aren't).
- `type: "select"`: `exhibit` (string; use `\n` for new lines, shown monospace with spacing kept), `options` (exactly 4 strings), `answer` (index 0-3; the app shuffles options like quiz questions).
- `type: "order"`: `items` (4-6 strings, written in the **correct** order; the app shuffles them), optional `exhibit`.
- Exhibits must be realistic and internally consistent (timestamps, time zones, IPs, totals that add up). Use documentation ranges only: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 for external IPs, private 10.x for internal, and `example.com`/`example.net`/`example.org` (plus `examp1e.com`-style look-alikes) for domains.
- Keep exhibit lines short where you can (under ~90 characters); long lines scroll sideways on a phone.
- Order items must have one defensible correct order. If experts could reasonably argue the order, use a `select` instead.
- Progress is keyed `pbq:<id>` in `sp_qhist`, so PBQ IDs are permanent too.

## Rules

- **IDs are permanent.** Lesson `id`s key `sp_lessons`, card `id`s key `sp_cards`, PBQ IDs key `pbq:<id>` in `sp_qhist`, and question IDs are `<lesson id>#<index>`. Renaming or reordering resets the user's progress for that item. Add new items with new IDs; fix typos in place.
- **Order matters in two places:**
  - The lesson of the day is `lessons[ordinal % len]`. Adding a lesson shifts which lesson appears on which day. That's harmless, just expected.
  - New flashcards are introduced in array order (8/day). Append new cards at the end so they arrive after the existing deck.
- **Exactly 4 options per question.** The app assumes it, and so does the CySA+ format.
- **Don't worry about answer position.** Options are shuffled on every render, so `answer` can always be 0 if that's easier to write.
- **Every card needs a `group`, and every group needs at least 4 cards.** The other 3 multiple-choice answers are drawn from the card's group, so a group should hold cards whose backs look alike (same shape and topic). Current groups: `models` (frameworks and lists), `tooling` (SIEM/SOAR, Zero Trust, SASE, CASB, UEBA), `email-identity`, `detection`, `vuln-mgmt`, `appsec`, `ir`, `forensics` (evidence acquisition and integrity), `reporting`, `nmap`, `port`, `event-id`. Reuse one where it fits; a new group needs 4+ cards.
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
| CVSS v3.1 metric groups (Base/Temporal/Environmental; v4.0 renames Temporal to Threat) and example vector scores | cards c108–c111, PBQ p06 | Oct 2026 |
| NIST SP 800-61 Rev. 2 four-phase lifecycle used by CS0-003 (Rev. 3, 2025, maps to CSF 2.0) | card c43, PBQ p10 | Oct 2026 |
| Order of volatility (RFC 3227) | card c44, PBQ p09 | Oct 2026 |

Update the "Last checked" column when you re-verify.

## Writing style
- Australian English spelling (prioritise, organisation, behaviour, analyse).
- Short sentences. Each key point should make sense on its own.
- Questions should be scenario-based where possible ("An analyst sees…, what is this most likely?"), like the real exam. Avoid pure definition recall in questions; that's what flashcards are for.
- Wrong options should be plausible: real terms from the same topic, not obviously silly.
