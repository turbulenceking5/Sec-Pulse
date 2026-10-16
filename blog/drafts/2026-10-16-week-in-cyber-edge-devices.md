---
title: This Week in Cyber: The Edge Is Still the Front Line (10-16 October 2026)
category: News
tags: cybersecurity, news, ivanti, palo alto networks, cisco, patch tuesday, citrix, flax typhoon, email security, real estate
---
If I had to sum up this week in one line, it would be: **attackers are going after the boxes that sit on the edge of the network.** We saw zero-days exploited in a VPN, a firewall and an email gateway, all within a few days. Microsoft also put out the biggest Patch Tuesday ever. Here's what happened and what I'd take away from it.

## Ivanti Connect Secure: three zero-days chained for root

Volexity found an attacker chaining **three zero-days** in Ivanti Connect Secure, the VPN appliance, to run commands as root without logging in. Exploitation started on **3 October**. Ivanti has fixed two of the flaws, an authentication bypass and a remote code execution bug tracked together as **CVE-2026-104935** (CVSS 8.6). The third, a privilege escalation, is still waiting on a fix "in the coming weeks".

What makes this one nasty:

- **No web shell was left behind.** The attacker stole stored credentials, including LDAP domain credentials, searched Active Directory for passwords and ran password spraying.
- **Ivanti's Integrity Checker Tool doesn't catch this chain**, according to Volexity. A clean scan is not proof of a clean box.
- **CISA added it to the KEV catalog** and told US federal agencies to fix it by 16 October.

If you run Connect Secure, upgrade to 25.1.3.0 or later, then **assume credential exposure**: rotate the service account and LDAP credentials the appliance holds, and hunt for password spraying against your directory. Volexity's IoCs are in [The Hacker News write-up](https://thehackernews.com/2026/10/attacker-chains-three-ivanti-connect.html).

## Palo Alto PAN-OS: management interface zero-day

Palo Alto Networks patched **CVE-2026-0322**, a code injection flaw in the PAN-OS **management interface** that lets an authenticated attacker run code as root on PA-Series and VM-Series firewalls and Panorama. Palo Alto says it has seen "very limited exploitation" and has published a few IoC IP addresses ([SecurityWeek](https://www.securityweek.com/palo-alto-networks-patches-pan-os-zero-day-exploited-for-remote-code-execution/)). It's on KEV with a 17 October due date.

The fact that it needs authentication is no comfort. The lesson from every firewall bug of the past few years is the same: **the management interface should never be reachable from the internet**, and only a small, known set of admin hosts should reach it from inside.

## Cisco Secure Email Gateway: one malicious attachment

Cisco fixed another exploited zero-day in Secure Email Gateway, **CVE-2026-76519**. It's a path traversal in the Advanced Malware Protection feature. An unauthenticated attacker just **sends an email with a crafted attachment** and can write files and run commands as root. Devices are vulnerable when File Reputation is enabled on a mail policy and Content Scanner Tools is older than 25.3.0.5525 ([BleepingComputer](https://www.bleepingcomputer.com/news/security/cisco-patches-actively-exploited-secure-email-gateway-zero-day/)).

This is at least the third exploited SEG flaw in a year. There's an irony in it: the tool built to inspect malicious attachments is what the malicious attachment attacks. Check your Content Scanner Tools version with `contentscannerstatus` and upgrade.

## Microsoft's record Patch Tuesday

October's Patch Tuesday fixed a record **1,411 vulnerabilities** (counts differ slightly between trackers), with **70 rated Critical** ([BleepingComputer](https://www.bleepingcomputer.com/news/microsoft/microsoft-october-2026-patch-tuesday-fixes-1-411-flaws-3-zero-days/)). Microsoft puts the jump down to using AI to find bugs in its own products.

The ones to prioritise:

- **CVE-2026-96951 (exploited):** a Windows Shell bug that bypasses **Mark of the Web**, the flag that triggers SmartScreen and Office Protected View on downloaded files. MotW bypasses are a favourite for phishing payloads. It's on KEV.
- **CVE-2026-108398 (publicly disclosed):** a .NET Framework flaw that can bypass **Windows Defender Application Control** (WDAC).
- **CVE-2026-92707 (publicly disclosed):** a denial-of-service bug in MessagePack-CSharp.

A release this big is a good reminder of why CVSS alone doesn't work for prioritising. You can't treat 70 Criticals as equally urgent, so start with what's on KEV and what has a high EPSS score.

## Citrix NetScaler: another critical, if you use SAML

Citrix patched **CVE-2026-107406** (CVSS 9.5), a memory overflow in NetScaler ADC and Gateway that can lead to remote code execution. It only applies when the appliance is set up as a **SAML identity provider or service provider**. To check, look for `authentication samlAction` or `authentication samlIdPProfile` in the config ([The Hacker News](https://thehackernews.com/2026/10/citrix-patches-critical-netscaler-flaw.html)). There's no sign of exploitation yet, but three other NetScaler flaws already are being exploited, so I wouldn't wait.

## Flax Typhoon: the FBI takes down the tooling

The FBI and US Department of Justice seized **seven domains** and disrupted tools used by **Flax Typhoon**, a China-linked group tied to the Beijing company Integrity Technology Group. Among them was MicroScan, a web scanner with over 1,300 penetration-testing scripts. A joint advisory (**AA26-281A**) from seven countries, **Australia** among them, describes Integrity Tech as a for-profit enabler of intrusions ([The Hacker News](https://thehackernews.com/2026/10/fbi-seizes-7-domains-disrupts-flax.html)). It's the same group behind the Raptor Train IoT botnet taken down in 2024.

## Close to home: dormant domains used to spoof a real estate team

This one hits close to home for anyone in property. HousingWire reported that a US real estate team owned about **400 domains**, and **79 of the unused ones** were being used to send spoofed email that impersonated the team ([HousingWire](https://www.housingwire.com/articles/criminals-used-79-dormant-domains-to-impersonate-a-top-real-estate-team/)). Nobody had to break into a mailbox. The domains had no email authentication, so anyone could send "from" them. After protections were added, unauthorised messages dropped from 235 to 43 over five weeks, and the rest were rejected instead of delivered.

In real estate, that kind of spoofing ends in fake invoices and **changed bank details for deposits and settlements**. The fix is cheap. For every domain that should **never** send email, publish:

- **SPF:** `v=spf1 -all` (no server is allowed to send)
- **DMARC:** `v=DMARC1; p=reject;` (receivers should reject anything that fails)
- **An empty DKIM record** if you like: `v=DKIM1; p=`

Then keep an inventory of every domain you own, including old brands, campaign sites and anything a past vendor registered for you.

## My takeaways

- **Edge devices are the main target.** VPNs, firewalls and email gateways are exposed to the internet, hold credentials and often can't run EDR. Patch them first and watch them closely.
- **Patching isn't the end of an edge compromise.** If the device was exploited before you patched, rotate the credentials it held and hunt for what happened next.
- **Prioritise with KEV and EPSS, not CVSS alone.** A 1,400-flaw month makes that obvious.
- **Lock down domains you don't use.** It costs minutes and shuts down a whole category of impersonation.
