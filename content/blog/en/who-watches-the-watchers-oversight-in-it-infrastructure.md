---
title: "Who watches the watchers? Oversight in IT infrastructure"
description: "Anything that can protect a system can also blind it. One question, asked until the answers run out, gives four layers of oversight and an anchor."
date: "2026-11-11"
updated: "2026-11-13"
tags: ["Sikkerhet", "SOC"]
translationOf: "hvem-vokter-vokterne-i-it-infrastruktur"
---

Anything with the power to protect a system also has the power to blind it. An administrator who can repair the servers can also delete their logs. The software that is meant to detect intruders can be switched off, and an autonomous agent that runs the infrastructure can hide what it did. Put a second guard over the first and you have only moved the problem one step up.

The rest of this article follows one question, asked again until it stops giving a new answer. What is left then is four layers of oversight and a place where the chain ends.

## One question

The question is this: **who can silence this control, and who would notice?**

It can be put to anything that is meant to watch something else: a log, a monitoring system, an approval rule, an administrator account. The answer always points to another guard, and then you ask the same question about that one. That turns ‘are we secure enough?’, which nobody can answer, into a series of questions that do have answers.

Two things keep the series from going on for ever. Each new link has to close a way of failing that the link before it left open; otherwise it is just more of the same. And a link that shares passwords, hardware or a network path with the thing it watches does not count as a new link, because one fault takes out both. Engineers call this independent failure domains.

## One break-in, question by question

Suppose an administrator's laptop is compromised on a Tuesday evening, so that the intruder can reach everything the administrator can.

In a flat setup the administrator holds permanent keys to both the servers and the monitoring system, for convenience. The intruder logs in, pauses the alerts, runs their payload, deletes the local logs and wipes the backups. On Wednesday morning every dashboard is still green.

Put the question to each of those steps in turn.

### Who can erase the record?

The intruder can, because the logs sit on the machine they describe. A log like that is only a diary: anyone with full rights on the machine can rewrite it after the fact. And ‘the machine’ is any source of records, including a cloud account's control plane, an identity provider or a code repository.

So the record has to leave its source the moment it is written, across a boundary that works one way only, and be sealed where it lands. The source can add new lines, but it cannot read back, alter or delete what has already crossed. If the machine is taken over five seconds later, everything delivered before then is out of reach. The backups belong behind the same kind of boundary, in an environment the stolen laptop cannot reach.

The same question applies to whatever writes the record. A program that was tampered with before it was deployed logs dutifully under a trusted name, and an agent can tell its own story about why it acted. Only what crossed the boundary counts as evidence, captured where the one being watched cannot edit it: requests, tool calls, arguments and approvals.

This is layer 1, the record.

### Who notices when the record stops?

The logs are safe now, but only the ones already sent. The intruder has no need to erase old records if new ones can be kept from being made. A careful attacker does not clear the log, because that shows. They change the audit rules so that certain actions are ignored, or kill the process that sends the logs away. The quietest one changes nothing and simply uses a valid credential.

So someone on the other side of the boundary has to watch for three things: signs that auditing has been touched, a source that goes quiet, and a valid identity acting out of pattern. Silence can only be detected when it breaks a rhythm, so every source sends a regular beat through the same channel as its records, and the observer alerts when a beat is missing. In the same way, behaviour out of pattern needs a pattern: a baseline of what each identity normally does.

The question exposes two weaknesses in this link. A beat proves that a source is alive, not that it is honest, since a deeply compromised host can keep beating while it hides what it does. So check it against witnesses it does not control: the network, the cloud control plane or hypervisor, the identity provider. When two witnesses disagree, believe the one the host cannot touch. And an alert that lands with the person it is about can be closed by that same person, so it has to go to someone else.

This is layer 2, the observer.

### Who notices when the observer is gone?

The intruder paused the alerts. Could anyone have noticed? The observer is a system itself, with a collector, a monitoring engine and a notification path, and an alarm system that never rings tells you nothing. Everything may be fine, or it may have crashed, filled its disk or been shut out by a firewall three days ago.

The fix is to turn the signal round, as in a dead man's switch. Instead of waiting for a message that something is wrong, an independent service outside your infrastructure waits for a steady pulse that says the observer is alive and able to speak. When the pulse stops arriving for a few minutes, the receiver raises the alarm. For the pulse to prove anything, it has to travel the whole chain: triggered inside the monitoring engine, passed through the notification router and delivered outside. A pulse from a separate timer script tells you no more than that the script works. The alarm also has to reach a person by a path that does not depend on the infrastructure it is about: its own credentials, its own network, and not the company email, which may be down.

This is layer 3, the alarm. The pulse shows that the alarm path is alive, but not that the rules are intact: an intruder who reaches the observer would rather mute one alert than kill the whole thing, and the pulse keeps coming. That leaves one question.

### Who can change all of this?

Someone has to administer the collector, the alerting and the access rules, and often it is not a person but a service account, an automated job or an agent. If one account can change every layer at once, the layers collapse into a single point of failure. The same happens when a service account that nobody owns holds permanent credentials with too wide a scope.

Three limits keep the highest rights in check:

- Borrowed time. Nobody holds permanent full access. High rights are borrowed for a declared task, with a limited scope and an expiry, and the loan is written to the record before the session starts. Service accounts and agents borrow in the same way, and each of them has a named human owner.
- Two pairs of eyes. Whoever proposes a change to critical infrastructure, to the way it is deployed or to the alert rules cannot be the one who approves it. A change to the approval rules themselves triggers an alert at layer 2.
- A noisy spare key (a break-glass account). The emergency account for when the normal login systems are down cannot depend on them. It is therefore the one standing exception, and it raises an alarm over an independent channel the moment it is used.

This is layer 4, the keys. It does not watch the layer before it, as layers 2 and 3 do. It decides who may change the other three.

With the four layers in place, the same stolen laptop meets a boundary at every step. It holds no permanent keys, and a request for high rights at an odd hour reaches a second person as a question. If the intruder kills the log sender, everything sent up to that point is already stored on the other side, and the collector alerts on the silence. If they silence the observer, the pulse stops and the outside receiver pages the team. A single muted alert needs a second person and leaves a line in the sealed record. And the emergency account raises its alarm at sign-in, before the first command is run.

The breach still happens, but it cannot cover its tracks. The aim is not invulnerability but a breach that is visible, costly and short.

## When do you stop asking?

You could go on: who watches the pulse receiver, and who watches that? But an endless tower of guards watching guards cannot be built, and it is not needed. There are four broad ways to defeat oversight: destroy or forge the evidence, blind or slip past whoever reads it, silence the alarm or take the keys. The four layers close one each. A fifth guard adds nothing unless it closes a fifth way to fail.

So at the end of the chain sits something you choose to trust: an outside pulse receiver, a person outside daily operations who reads the record, or storage that refuses overwriting and deletion for a set period, even from its own administrators. That is the anchor. Every layer moves trust and none removes it, and the anchor is where it comes to rest. Nobody watches it, because a guard over the last guard would only move the question once more. You duplicate it instead: two pulse receivers at different providers, so that one outage or one captured account cannot blind you, and evidence in two separate environments, so that one lost copy is not the end. What you need to know is where the anchor sits, and that no single failure can reach it.

In a small environment, where one person runs both the servers and the security, you cannot split the roles between people. You can still split them across boundaries: send the logs where your everyday account cannot delete them, send the pulse to a receiver outside your own infrastructure, and agree a fixed time when another person, an outsider if need be, reads the summary. The first two work whether or not anyone is looking. The agreement is only a mitigation, because with a weekly review the detection window is a week.

## The same question at web scale

The question is not new, and it works far beyond one company's servers. Certificate authorities are guards: they vouch that a website is who it says it is. Who notices when one of them issues a certificate it should not have? After a breach at one authority in 2011, the answer became Certificate Transparency. In practice, every publicly trusted certificate is now published in open logs that can only be added to and that anyone can check. Anyone can run a monitor that looks for certificates they did not expect, and browsers such as Chrome and Safari refuse a certificate that does not carry the logs' signed promise to include it.

And who watches the logs? No new guard. The browsers ask for promises from several logs run by different operators, which is the same duplication of the anchor. The logs do not stop an authority from issuing a bad certificate. They make sure it cannot hide.

## What the question does not catch

The question finds holes in the construction. It does not find the wear in the people and routines that keep it going, and four things fail even with every layer in place.

Approvals get rubber-stamped. A second person is a guard only as long as they read what they are approving, and tired approvers do not read. An attacker can also wait for a genuine request and take over the session once it is approved. Keep the volume low, show the approver what, where and why, and watch the approvals themselves: an approver who says yes to everything within two seconds is a finding. Two people can also agree to look the other way. The rule turns misuse into a conspiracy, which is harder but not impossible.

Expiry lags. A credential that should have expired still works if revocation is broken and nobody is watching, and machine credentials are the usual culprit. Test revocation on a schedule, and alert when a credential outlives its expiry date.

Baselines can be trained. An identity that drifts in small steps becomes normal, and a detector tuned too tightly drowns people in false alarms until they stop reading. Keep a short list of things that are never normal for an identity, whatever its history, and keep the alerts few enough that a person still reads each one.

Complexity is a risk in itself. Every control is one more part that can fail and one more thing somebody has to run. Prefer few, simple parts, and remove a control you cannot test.

## An answer is a claim until it is tested

‘The collector alerts when a source goes quiet’ is a claim about your setup. It becomes evidence only once you have stopped the log stream on a test machine and seen the alert arrive. Do the same with the pulse: block it and time two things. How long until the alarm is raised, and how long until a person acts on it? The first should match the timeout you set yourself. The second is the one that actually protects you.

The anchor is tested in the same way. Block the pulse while one of the two receivers is switched off, and check that the other still raises the alarm. Read old evidence back and check that the seal holds. Restore a system from the immutable copy, time it from zero, and check that what came back is complete. Repeat all of this on a schedule, and review every use of the emergency account afterwards.

## When you set it up

The question tells you what has to exist. A few details decide whether it holds in practice:

- Accept records only over an authenticated channel, so that one host cannot write in another's name, and stamp each record with the collector's own clock. A compromised host can lie about the time.
- Seal what arrives with a signature or a hash chain, and keep the key where the store's own administrators cannot reach it.
- Give every source a quota, so that a compromised host cannot flood the store and push the evidence out. A source that hits its quota is an alarm.
- Sign what you deploy, record how it was built, and verify the signature at deployment. An SBOM is an inventory, not proof, and the build system and its signing keys fall under layer 4.
- A machine cannot answer a second factor. Let it prove its identity by what it is and where it runs, and give it short-lived credentials.
- Store the emergency key so that taking it out leaves a trace, and test it on a schedule. The alarm it raises must never block the login, or people will learn to switch it off.
- Keep the record long enough to answer questions you did not see coming, because intrusions are often found late. Logs about people are also personal data: decide what you collect, why, who may read it and for how long, and tell the people it concerns.

## The chain on one page

![The chain of oversight, top to bottom. Servers, cloud and identity (layer 1, the record) are assumed to be open to takeover. Their records and beats cross a one-way boundary to a separate collector (layer 2, the observer). A steady pulse goes from there to two outside receivers at different providers (layer 3, the alarm), which raise the alarm to a person on a separate channel. Underneath, layer 4, the keys, decides who may change layers 1 to 3: borrowed time, two pairs of eyes and a noisy spare key.](/images/hvem-vokter-vokterne-i-it-infrastruktur/oversight-chain.svg)

| Layer and its question | How it fails | What closes it |
| --- | --- | --- |
| 1 The record: who can erase or forge it? | Local logs are edited, or the code that writes them is not the code you approved | One-way forwarding, sealed storage and signed builds |
| 2 The observer: who notices when the record stops? | Auditing is turned off, the log stream is killed, or a valid credential acts out of pattern | A separate collector that alerts on tampering, silence and out-of-pattern behaviour |
| 3 The alarm: who notices when the observer is gone? | The observer or its notification path crashes, loses storage or gets cut off | A steady pulse to two outside receivers |
| 4 The keys: who can change layers 1–3? | Permanent keys with no owner, or one compromised superuser who disables the whole chain | Borrowed time, two pairs of eyes and a noisy spare key |

When the observer does alert, the alert also says where to start:

| What the observer sees | What it means | Look here |
| --- | --- | --- |
| The log was cleared | Someone tried to wipe the trail | The host, at once; assume full compromise |
| Audit rules changed | Someone is blinding the recorder before acting | Recent privilege use on the host |
| A valid identity acts out of pattern | A stolen credential, or a service or agent acting beyond its declared scope | The identity's baseline, its owner and any approved change |
| The log stream stops | The host is down, cut off, or the sender was killed | A witness the host does not control (network, hypervisor) first, then the logging process |
| Two witnesses disagree | The host is hiding something, or one witness is broken | The witness the host cannot touch: network, control plane, identity provider |
| Approval rules bypassed | A privileged user changed the guardrails for themselves | Control plane and repository settings, layer 4 |

When someone says a system is monitored, this is the question to ask: who can silence the monitoring, and who would notice?
