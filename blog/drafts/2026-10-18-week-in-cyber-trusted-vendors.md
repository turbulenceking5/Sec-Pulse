---
title: This Week in Cyber: Attackers Walk In Through Trusted Vendors (12-18 October 2026)
category: News
tags: cybersecurity, news, microsoft 365, connectwise, beyondtrust, supply chain, ransomware, data breach, bec, real estate, australia
---
This week's theme is **trust you've handed to someone else.** A backup service with standing access to Microsoft 365 was abused, a remote support product was exploited for two months before a fix, and an Australian retailer's customer records were stolen from a third-party system. Here's what happened and what I'd do about it.

## ConnectWise Cloud Backup: an app identity with the keys to every tenant

ConnectWise shut down customer access to its **Cloud Backup** service (formerly SkyKick) on 17 October after attackers got hold of the application's credentials and used them to sign in to customers' Microsoft 365 tenants ([BleepingComputer](https://www.bleepingcomputer.com/news/security/hackers-breach-microsoft-365-tenants-via-connectwise-supply-chain-attack/), [The Hacker News](https://thehackernews.com/2026/10/hackers-use-compromised-connectwise.html)). Huntress confirmed unauthorised sign-ins in at least 162 tenants, and 173 in later reporting.

Why it's nasty:

- **No user signs in, so MFA never applies.** The attacker authenticated as the app itself, and the app already had broad permissions: mail, OneDrive, SharePoint, Teams chats and directory data.
- **Revoking user sessions doesn't stop it.** Disabling the app blocks new tokens, but tokens already issued can live for up to 90 minutes.
- **There was follow-on activity.** In at least one tenant a related ConnectWise app gave itself Global Administrator and added new secrets to other apps. Microsoft calls it an active supply-chain attack.
- **How the attacker got the credential is still unknown**, and so is how much data was read.

If you're a customer of an MSP, ask whether they use this service. In Entra, check **service principal sign-ins** (not the default user sign-ins tab) for application ID `506e08f9-6e9a-4da4-942b-a099a03644ae`, look for new app secrets or certificates added since 13 October, and disable the app until ConnectWise confirms its credentials are reset. Huntress also recommends turning on Microsoft Graph activity logs.

## BeyondTrust Remote Support: exploited since August

BeyondTrust patched **CVE-2026-102764** (CVSS 9.3), an authentication bypass that lets an unauthenticated attacker perform file operations on Remote Support appliances. Mandiant and Google's threat intelligence group say a China-linked espionage group, **Armory Castle** (also tracked as UNC5221 and Warp Panda), has used it as a zero-day since **29 August** ([BleepingComputer](https://www.bleepingcomputer.com/news/security/beyondtrust-patches-zero-day-exploited-in-attacks-since-august/), [SecurityWeek](https://www.securityweek.com/chinese-apt-exploited-beyondtrust-vulnerability-as-zero-day/)). It's on the CISA KEV catalog.

After getting in, the attackers installed a web shell and a tunnelling tool, took root, harvested credentials, deleted logs and moved sideways using stolen admin accounts. All Remote Support versions up to 26.2.3 are affected. SaaS customers were patched on 8-9 October. **Self-hosted customers must patch themselves** unless auto-update is on. Mandiant's advice is to treat any internet-facing appliance on a vulnerable version as potentially compromised until reviewed, so patching alone isn't enough: rotate credentials the appliance held and check for the log gaps.

## Napoleon Perdis: stolen from a third party's system

Australian cosmetics brand Napoleon Perdis told customers that about **339,000 records** were taken from a system run by its third-party provider, Retail Express ([ABC News](https://www.abc.net.au/news/2026-10-17/napoleon-perdis-cyber-attack-cosmetics-company-300000/107279426)). The company says it was told in June, and the provider later confirmed the intruder had access from **November 2025 to June 2026**. The data covers customers from before June 2025 and includes names, dates of birth, emails, phone numbers, postal addresses and purchase histories. The company says no card details, bank details or passwords were involved, and it has notified the OAIC.

A hacker using the alias "2019" claimed this data in June ([Cyber Daily](https://www.cyberdaily.au/security/13718-exclusive-napoleon-perdis-allegedly-breached-following-threat-actor-claims)), though the sources I found don't confirm it's the same incident. Either way, the useful point is the gap: months passed between the intrusion and customers being told. If you hold customer data, ask your suppliers how fast they must tell you about a breach, and what they keep after a customer relationship ends.

## Ransomware gangs are targeting people, not just systems

IT Brief Australia reports on a Semperis study of ransomware victims, saying **41%** of attacks involved psychological intimidation or physical threats ([IT Brief Australia](https://itbrief.com.au/story/ransomware-gangs-threaten-australian-executives-families)). Of the Australian organisations that reported threats, attackers followed through in **53%** of cases, with hostile packages to homes or offices and intimidation of family. The same coverage says **98%** of successful attacks targeted identity systems such as Active Directory and Entra ID. I haven't seen Semperis's own report, so treat the figures as reported, not independently checked.

The practical lessons: identity is the thing to protect and be able to recover, and an incident response plan should cover staff wellbeing and safety, not only restoring servers.

## Real estate fraud keeps climbing

For anyone in property: the FBI's 2025 figures show **12,368 real estate fraud complaints and over $275 million in losses**, up from 9,359 complaints and over $173 million in 2024 ([NAR](https://www.nar.realtor/news/real-estate-news/online-real-estate-fraud-climbed-to-275m-in-2025-fbi-says)). Business email compromise, where a buyer or agent is tricked into sending money to a fraudster's account, is tracked as a separate category, so closing-fund theft is likely under-counted here. The defence is boring and effective: confirm bank details by phone on a number you already hold, never from the email asking for payment.

## The Australian angle

Two of this week's stories are Australian, and the other three hit Australian organisations just as easily. Both Napoleon Perdis and the Semperis findings point to the same obligations: the **Notifiable Data Breaches** scheme still applies when the breach is at your supplier, and under the **Cyber Security Act 2024** some organisations must report a ransomware payment within 72 hours. It's worth knowing your own position before an incident.

## Key takeaways

- **Audit the access you've given vendors.** List every app and service principal with tenant-wide permissions in Microsoft 365, and remove the ones you can't justify.
- **App identities bypass MFA.** Monitor service principal sign-ins and credential changes, not just user logins.
- **Patching an exploited edge product isn't the finish line.** If it was exposed while vulnerable, rotate its credentials and hunt for what followed.
- **Ask suppliers about breach notification** before you need the answer.
- **Verify payment changes out-of-band.** Fraud losses in real estate are still rising.
