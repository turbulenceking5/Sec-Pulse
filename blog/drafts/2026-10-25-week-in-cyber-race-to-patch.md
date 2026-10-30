---
title: This Week in Cyber: The Race to Patch (19-25 October 2026)
category: News
tags: cybersecurity, news, php, php2shell, patching, ransomware, palo alto networks, fortinet, safepay, real estate, australia
---
This week's theme is **speed**. AI tools are finding serious bugs in software we all depend on, and attackers are racing to use them, sometimes before the patch even exists. Australian government websites went offline over a PHP flaw, ransomware gangs kept cashing in on an old VPN bug, and Fortinet shipped a big batch of fixes for flaws found by AI. Here's what happened and what I'd do about it.

## PHP2Shell takes Australian government sites offline

Two critical flaws in PHP, the language behind a huge share of the web, were patched on 21 October: **CVE-2026-109618** and **CVE-2026-109619**, nicknamed "PHP2Shell" ([BleepingComputer](https://www.bleepingcomputer.com/news/security/php-ships-emergency-patches-for-critical-php2shell-flaws/)). Both allow **unauthenticated remote code execution** and are rated 9.2 under CVSS v4.0 ([iTWire](https://itwire.com/business-it-news/security/php2shell-the-14-year-old-bugs-that-pulled-cyber-gov-au-and-government-sites-worldwide-offline)). Researchers from Calif, OpenAI and Wiz found them, with OpenAI's models credited for part of the discovery.

Every PHP setup that serves web requests is affected (PHP-FPM, Apache mod_php, php-cgi and others), and the PHP team says the risk is highest for mod_php. The fixed versions are **8.5.12, 8.4.27, 8.3.36 and 8.2.35**. PHP 8.1 and older no longer get official updates.

Closer to home, cyber.gov.au and other federal websites went offline on the night of 21 October while teams worked to reduce the risk ([ABC News](https://www.abc.net.au/news/2026-10-22/php-vulnerabilities-cyber-asd/107294812)). Industry Minister Tim Ayres said no breaches of Australian government websites had been detected ([SBS](https://www.sbs.com.au/news/article/php-vulnerability-internet-websites-shutdown-cybersecurity-online-security/sm2gedcoc)).

Amazon says the first exploitation attempts hit its honeypots on **17 October, four days before the patches** ([BleepingComputer](https://www.bleepingcomputer.com/news/security/amazon-says-php2shell-exploitation-began-4-days-before-patches/)). At the time of writing there were no confirmed compromises, and early public exploits didn't work, but mass scanning is well under way.

**What to do:** find every server running PHP, including the ones vendors run for you (CMS hosting, plugins, appliances), and patch or ask your provider for confirmation. The workarounds are only partial, so don't rely on them.

## Ransomware gangs are still using an old VPN bug to skip MFA

Palo Alto Networks says ransomware groups **Qilin and INC** are still exploiting **CVE-2026-0257** (CVSS 7.8), an authentication bypass in PAN-OS and Prisma Access that lets attackers set up VPN connections without proper authorisation ([The Hacker News](https://thehackernews.com/2026/10/qilin-and-inc-ransomware-groups-exploit.html)). It was patched in **May**.

Once inside, they use remote management tools, move around with RDP and SMB, and steal credentials. In one case they jumped from the VPN gateway to vCenter and dumped credentials from a domain controller's virtual disk, which sidesteps the EDR inside the VM. They also went after Veeam backup servers.

**What to do:** patch, then hunt. If a gateway was unpatched for months, assume someone may already have a session and check for unexpected VPN logins, new RMM tools and access to your hypervisor and backups.

## SafePay: 600+ victims and an Australian presence

CISA, the FBI and international partners published an advisory on **SafePay** ransomware (AA26-293A) ([BleepingComputer](https://www.bleepingcomputer.com/news/security/cisa-and-fbi-safepay-ransomware-has-hit-over-600-critical-infrastructure-organizations/)). The group has hit **at least 600 organisations** since August 2024, including victims in Australia. Unusually, it doesn't use affiliates.

They get in through exposed or brute-forced credentials, VPN access, phishing and known flaws in edge devices. Before encrypting, they steal data (double extortion), delete shadow copies and reset NAS devices holding backups.

**What to do:** MFA on every remote access path, edge devices patched against the KEV list, and at least one backup copy that an attacker with admin rights can't delete.

## Fortinet ships AI-found fixes, with details to come

On 22 October Fortinet released updates for **FortiOS, FortiManager and FortiAnalyzer**, a day after FortiMail and FortiAuthenticator, fixing critical and high-severity flaws found with frontier AI models ([Cyber Kendra](https://www.cyberkendra.com/2026/10/fortinet-frontier-ai-fortios-patches.html)). The ACSC urged customers to apply the updates as a priority ([ACSC](https://www.cyber.gov.au/alert/critical-vulnerabilities-in-fortinet-products)).

There are **no CVE numbers yet**. Fortinet will publish full details on **10 November**. No exploitation had been reported at the time of writing, but once details are public, attackers will reverse-engineer the patches quickly.

**What to do:** patch internet-facing FortiGates now, before 10 November. If you can't, restrict admin access to trusted IPs and enforce MFA for every administrator.

## For property people: the too-good earnest money offer

HousingWire reports a Kentucky broker's experience with a full-price, all-cash buyer offering a **5% earnest money deposit**, against her usual 1% ([HousingWire](https://www.housingwire.com/articles/earnest-money-scam-warning/)). Proof of funds arrived days late as a screenshot, and the deposit never came. A former Secret Service agent thinks the aim was to get money "refunded" by cheque. The red flags are an offer that's too good, a reluctance to verify, and a buyer who doesn't ask normal questions. The fix is old-fashioned: verify identities and funds directly with the bank or lender.

## The Australian angle

PHP2Shell is a reminder that "our vendor runs it" isn't an answer. Many Australian organisations run PHP indirectly through their website, CMS or customer portals. Know who hosts what, and how fast they'll tell you they've patched.

## Key takeaways

- **Patch speed is now the main defence.** AI is shortening the time from bug to exploit, sometimes to before the patch.
- **Patching isn't the end.** For anything exposed while vulnerable (VPNs, firewalls, web servers), hunt for what may have got in.
- **Protect your backups** from admin-level attackers.
- **MFA on every remote access path**, and keep watching those logins.
- **In property, verify money and identities out-of-band.** Scams change shape, but verification still works.
