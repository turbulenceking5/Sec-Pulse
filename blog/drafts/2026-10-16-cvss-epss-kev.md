---
title: CVSS, EPSS and KEV: Deciding What to Patch First
category: Learning
tags: cybersecurity, vulnerability management, cvss, epss, kev, patching, security
---
Every week hundreds of new vulnerabilities (CVEs) are published. No team can patch them all at once, so the real skill in vulnerability management is deciding what to fix **first**. Three scores help with that: CVSS, EPSS and the CISA KEV catalog. They answer different questions, and using them together is much better than relying on any one of them.

## What is CVSS?

The **Common Vulnerability Scoring System** rates how *severe* a vulnerability is, from 0.0 to 10.0. It looks at things like:

- **Attack vector:** can it be exploited over the network, or does the attacker need local or physical access?
- **Complexity and privileges:** does the attacker need to be logged in, or need special conditions to line up?
- **User interaction:** does someone have to click something?
- **Impact:** what happens to confidentiality, integrity and availability if it's exploited?

Scores map to bands: Low (0.1-3.9), Medium (4.0-6.9), High (7.0-8.9) and Critical (9.0-10.0).

The catch: CVSS tells you how bad it *could* be, not how likely it is to happen. Plenty of 9.8s are never exploited in the wild, and some 7.5s are exploited within days.

## What is EPSS?

The **Exploit Prediction Scoring System**, run by FIRST, estimates the *probability* that a vulnerability will be exploited in the wild in the next 30 days. It's a number between 0 and 1 (often shown as a percentage), and it's recalculated every day from real-world signals such as published exploit code and observed attack activity.

Most CVEs have a very low EPSS score. A small number sit near the top, and those are the ones attackers are actually going after.

## What is KEV?

The **Known Exploited Vulnerabilities** catalog from CISA (the US cyber agency) lists vulnerabilities with confirmed exploitation in the wild. It isn't a prediction: if a CVE is on KEV, someone is already using it. Each entry also has a remediation due date for US federal agencies, which is a handy yardstick for urgency.

## Putting them together

Here's a simple way to triage:

1. **On KEV?** Treat it as urgent, especially if the affected system faces the internet.
2. **High EPSS (say 10% or more)?** Exploitation is likely soon. Schedule it ahead of the routine patch cycle.
3. **High CVSS but low EPSS and not on KEV?** Still important, but it can usually go in the normal patch window.
4. **Then add your own context:** is the system internet-facing? Does it hold sensitive data? Is there a compensating control, like the service being blocked at the firewall?

For example, picture two vulnerabilities on the same day. One is CVSS 9.8 with an EPSS of 0.3% and no known exploitation. The other is CVSS 7.5, sits on KEV and has an EPSS of 94%. The second one gets patched first, even though its CVSS score is lower.

## The Australian angle

The ACSC's Essential Eight puts patching front and centre. For internet-facing services it sets a 48-hour target when the vendor rates a vulnerability as critical or a working exploit exists. KEV and EPSS are a quick way to spot exactly those "working exploit exists" cases.

## Key takeaway

CVSS tells you how bad a vulnerability **could** be, EPSS tells you how **likely** it is to be exploited, and KEV tells you it's **already happening**. Use all three, add your own asset context, and you'll spend your patching effort where it actually reduces risk.
