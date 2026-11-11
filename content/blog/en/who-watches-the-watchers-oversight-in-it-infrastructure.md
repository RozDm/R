---
title: "Who watches the watchers? Oversight in IT infrastructure"
description: "Every guard that can protect a system can also blind it. Four layers of oversight, so that no single guard has to be trusted alone."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
translationOf: "hvem-vokter-vokterne-i-it-infrastruktur"
draft: true
---

"We added monitoring" is a comfort, not a guarantee. Every tool, administrator or autonomous agent with the power to protect a system also has the power to blind it, break it, or hide what happened. Security is less about finding an infallible guard than about building a chain where no single guard has to be trusted alone.

## Moving the risk

When you give an administrator full rights to fix servers, install an agent to watch for intrusions, or let an autonomous AI service manage infrastructure, you solve one problem and create another. The guard becomes the most valuable target in the room.

Putting a second guard over the first only moves the question one step up. If you do not decide how the chain works, and where it stops, you end up with a pile of tools that all share the same weak spot.

Before trusting any control, four questions pay off:

1. Can the person, machine or agent being watched erase the record of what they did?
2. If the alarm system itself dies or gets cut off, what sound does it make?
3. Does every non-human identity (service account, token, key, agent) have a named human owner and an expiry date?
4. What happens when the account meant for emergencies is used on a quiet Tuesday?

The answers decide whether you have real oversight or just another single point of failure.

## Four layers of oversight

Instead of stacking guards endlessly, split oversight into four jobs: writing the record, watching the record, watching the alarm, and holding the keys. Four, because there are four distinct ways to defeat oversight: destroy the evidence, blind the reader, silence the alarm, or take the keys. A fifth guard would add nothing unless it closed a fifth way to fail. Layers 2 and 3 each watch the one before them, across a boundary the watched side cannot cross back. Layer 1 produces the evidence, and Layer 4 is different: it decides who may change the other three.

![The chain of oversight, top to bottom. Servers, cloud and identity (layer 1, the record) are assumed to be taken over. Their records and beats cross a one-way boundary to a separate collector (layer 2, the observer). A steady pulse goes from there to two outside receivers at different providers (layer 3, the alarm), which raise the alarm to a person on its own channel. Underneath, layer 4, the keys, decides who may change layers 1 to 3: borrowed time, two pairs of eyes and a noisy spare key.](/images/hvem-vokter-vokterne-i-it-infrastruktur/oversight-chain.svg)

| Layer and its question | Typical failure | What guards it |
| --- | --- | --- |
| 1 The record: was the action written down? | Local logs are edited, or the code that writes them is not the code you approved | One-way forwarding, sealed storage, signed builds |
| 2 The observer: did anyone see the record? | Auditing is turned off, the stream is killed, or a valid credential acts out of pattern | A separate collector that alerts on tampering, silence and out-of-pattern behaviour |
| 3 The alarm: is the watcher still awake? | The monitor or its notification path crashes, loses storage, or gets cut off | A continuous pulse sent to an outside receiver |
| 4 The keys: who can change layers 1–3? | Permanent, ownerless machine keys, or one compromised superuser who disables the whole chain | Temporary scope, named owners, two-person approval, and a noisy spare key |

What makes the layers hold is separation of fate, or in engineering terms, independent failure domains. If the system that collects logs shares passwords, hardware, or network paths with the servers it watches, a single fault takes both down together.

### Layer 1: the record

A log that stays on the machine it describes is only a diary. Anyone with full rights on that machine can rewrite it or delete it after the fact. And "the machine" is any source of records: a server, a cloud account's control plane, an identity provider, a code repository. Whoever administers the source can silence it.

For a record to count as evidence, it must leave the host the moment it is written, crossing a one-way boundary. The source machine may add new lines, but it must have no way to read back, alter, or delete what has already crossed. Even if the machine is completely taken over five seconds later, everything delivered before that moment is out of reach. Keep the window between writing and delivering as short as you can.

At the destination, seal what arrives with a signature or a hash chain, so that a later change to a stored record is detectable, and keep the store in a separate environment from the systems it records. Keep the record rich enough and long enough to answer questions you did not see coming: alerts cover the ones you did, and intrusions are often found late.

A record is also only as honest as whatever writes it. If an attacker tampers with the code before it is deployed, the logs will faithfully record the actions of a malicious program. So trust has to reach back to the build: sign what you deploy, record how it was built, and verify the signature at deployment and, where you can, while it runs. A list of ingredients (an SBOM) is an inventory, not proof. And a signature shows where an artifact came from, not that it is harmless, so the builder and its signing keys are guards too, and fall under Layer 4.

An agent adds one more twist: it can write its own story. For an agent, the record is what crossed its boundary, meaning requests, tool calls, arguments and approvals, captured where the agent cannot edit them. Its own account of why it acted is a claim, not evidence.

### Layer 2: the observer

Moving the logs off the machine protects the past, but not the next ten minutes. An intruder with full rights does not need to erase old records if they can simply stop new ones from being made.

Clearing a log leaves an obvious mark, so a careful attacker will rather change the audit rules to ignore certain actions, or kill the process that sends the logs away. That leaves no error message at the destination, only a gap. The quietest intruder changes nothing at all: they use a valid credential, and the only trace is behaviour out of pattern. The same goes for a service or an agent that acts beyond its declared purpose.

The observer on the other side of the boundary must therefore watch for three things at once: explicit signs that auditing was touched, a source that suddenly goes quiet, and a valid identity acting out of pattern.

A quiet host is not automatically a broken one, so silence needs a rhythm to break: every source, whether a host, a service or an agent, emits a regular beat through the same pipe, and the observer alerts when a beat is missing. Where a beat is not possible, inject a test event on a schedule and check that it arrives. Out of pattern needs a pattern too: keep a baseline of what each identity normally does, and watch the privileged ones most closely.

A beat proves a source is alive, not that it is honest. A deeply compromised host can keep beating while it hides what it does, so treat the host as one witness and check it against witnesses it does not control: the network, the cloud control plane or hypervisor, the identity provider. When two witnesses disagree, believe the one the host cannot touch.

| What the observer sees | What it means | Look here |
| --- | --- | --- |
| The log was cleared | Someone tried to wipe the trail | The host, at once; assume full compromise |
| Audit rules changed | Someone is blinding the recorder before acting | Recent privilege use on the host |
| A valid identity acts out of pattern | A stolen credential, or a service or agent acting beyond its declared scope | The identity's baseline, its owner and any approved change |
| The log stream stops | The host is down, cut off, or the sender was killed | The network path first, then the logging process |
| Two witnesses disagree | The host is hiding something, or one witness is broken | The witness the host cannot touch: network, control plane, identity provider |
| Approval rules bypassed | A privileged user changed the guardrails for themselves | Control plane and repository settings, Layer 4 |

### Layer 3: who monitors the monitor?

Layer 2 watches the sources: that they do not go quiet and do not blind the record. Layer 3 watches the collecting centre itself. The log stream is now protected from the host, but what protects the system that collects those logs, and the alarms built on it, from a full disk, a dead database or a cut link?

An alarm system that never rings tells you nothing. Everything might be fine, or the monitor might have crashed, filled its disk, or been blocked at a firewall three days ago.

The fix is to invert the signal. Instead of waiting for a message that says something is broken, an independent service outside your infrastructure waits for a steady pulse that says the monitor is alive and able to speak.

For the pulse to prove anything, it has to travel through the whole chain: triggered inside the monitoring engine, passed through the notification router, and delivered outside. A pulse sent by a separate timer script only proves the script works. When the real pulse stops arriving for a few minutes, the outside receiver raises the alarm. The alarm must then reach a person by a path that does not depend on the infrastructure it watches: its own credentials, its own network, not the company mail that may be down. It is the one link that does not share a fate with the rest of your setup. The pulse proves the alarm path is alive. It does not prove the monitor still sees its sources; that is what the beats in Layer 2 are for. Between them, the whole path from source to human is covered.

### Layer 4: those with the keys

Even with one-way logs and an external heartbeat, someone has to manage the log collector, the monitor, and the access rules, and today that someone is often not a person. Service accounts, automation and agents outnumber people many times over, and too many of them carry permanent, over-scoped credentials that nobody owns. If one account can change all of the layers at once, or an orphaned service account roams free, the four layers collapse back into a single point of failure.

The principles are the same for people and machines; the mechanisms differ. A machine cannot answer a second factor, so it has to prove its identity by what it is and where it runs, with short-lived credentials. Three boundaries keep top-level rights in check:

- **Borrowed time.** Nobody holds permanent full access for daily work (zero standing privileges). High privileges are checked out just in time for a declared task, with a bounded scope and an expiry, and the act of borrowing them is recorded before the session starts. Service accounts and agents borrow the same way, and each has a named human owner who answers for its lifecycle and revocation. They are judged not only by whether the key is valid, but by whether their behaviour stays within the purpose they were granted.
- **Two pairs of eyes.** The person who proposes a change to critical infrastructure, or to the pipeline that deploys it, cannot be the one who approves it (separation of duties). And because an administrator might have the rights to turn off the two-person rule for ten seconds, any change to the approval rules themselves must trigger an immediate alert at Layer 2.
- **A noisy spare key** (a break-glass account). Every system needs an emergency account for when normal login systems are down. It must not depend on those systems, which is the whole point of it. The key stays locked away, is never used for routine work, and sets off an immediate alarm through an independent channel the moment it is used. That alarm must never block the login or need the login systems that may be down, or the key is useless in the very outage it exists for, and engineers in a panic will learn to disable it. Its job is not to stop the login but to announce it at once: the emergency key was used at 03:15, by this person, from this place. Test the key on a schedule, because a key nobody has tried may not open anything, and review every use afterwards.

## Same breach, two designs

Suppose an administrator's laptop is compromised on a Tuesday evening, giving an intruder the same reach the administrator has.

In a flat setup, the administrator holds permanent keys to both the servers and the monitoring system for convenience. The intruder logs in, pauses the alerts, runs their payload, deletes the local logs, and wipes the backups. On Wednesday morning every dashboard is still green.

With the four layers in place, the same stolen laptop hits a boundary at every step:

- There are no permanent keys on the machine; elevating rights requires a fresh request that gets logged outside the host before access is granted, and for the highest rights a second person must approve it. A request at an odd hour reaches that person as a question, not a formality.
- Even if the intruder gets onto a server and kills the log sender, everything delivered up to that second is already stored across a one-way boundary, and the sudden silence alerts the collector.
- If they try to silence the monitor itself, the external pulse stops and the outside receiver pages the team.
- If they go for the backups, those sit behind the same kind of one-way boundary: immutable, in a separate environment the stolen laptop cannot reach.
- If they reach for the emergency account, the spare-key alarm fires at sign-in, before they run their first command.

The breach still happens, but it cannot hide. That is the honest goal: not invulnerability, but a breach that is visible, costly and short.

## The same shape at web scale

None of this is new, and it works at the scale of the whole web. Certificate authorities are guards: they vouch for who owns a website. A breach at one of them in 2011 led to Certificate Transparency. In practice, every publicly trusted certificate is now published in open logs that can only be added to and that anyone can verify. Anyone can run a monitor that looks for certificates they did not expect, and browsers such as Chrome and Safari refuse a certificate that is not in a log. The log is Layer 1, the monitors are Layer 2, and the browsers' refusal is the anchor. The log does not stop a certificate authority from issuing a bad certificate. It makes sure the bad certificate cannot hide.

## What still fails

The four layers raise the cost of an attack and shorten its life. They do not make it impossible, and each layer has its own way to fail.

- **Approvals get stamped.** A second person is only a guard while they read what they approve. Tired approvers rubber-stamp, and an attacker can wait for a real administrator's request and take over the session after it is approved. Keep the volume low, show the approver what, where and why, bind the elevated session to the device and the task, and watch the approvals themselves: a reviewer who approves everything in two seconds is a finding.
- **Expiry can lag.** A credential that should have expired still works if the revocation path is broken or nobody watches it, and machine credentials are the usual suspects. Test revocation on a schedule, and alert on any credential that outlives its declared expiry.
- **Baselines can be taught.** An identity that drifts in small steps becomes normal, and a detector tuned too tight drowns people in false alarms until they stop reading. Keep a short list of things that are never normal for an identity, whatever its history, and keep alerts few enough that a person still reads each one.
- **Complexity is a risk.** Every layer is another part that can fail and another thing someone must run. Prefer few, simple parts, test each one, and remove a layer you cannot test.

## The chain ends somewhere

Every layer moves trust; none removes it. You cannot build an infinite tower of guards watching guards. At the end of the chain sits something you simply choose to rely on: storage that refuses overwrites and deletion for a set period, even from its own administrators, an outside pulse receiver, or a person outside daily operations who reads the trail. That is not a weakness in the design, it is the anchor. The goal is to know where that anchor sits, and to make sure no single failure can reach it.

Nobody watches the anchor, and that is by design: a guard over the last guard only moves the question again. You duplicate the anchor instead. Two pulse receivers at different providers mean that one outage, or one captured account, cannot blind you, and the evidence is kept in two separate environments, so one lost copy is not the end.

In a small environment, where one person runs both the servers and the security, you cannot split roles between people. You can still split them across boundaries: send the logs where your day-to-day account cannot delete them, put the heartbeat on the outside, and set a fixed slot in the calendar where someone else reads the summary. Be honest about what that buys. The first two work on their own, whether or not anyone is looking. The calendar slot is only a mitigation: with a weekly review, your detection window is a week, not minutes.

## Principles

1. **Evidence travels one way.** A machine can add to the record, but cannot edit or erase what it has already sent.
2. **The watcher lives outside the watched.** The collector and the alarm do not share credentials, network fate, or hardware with the machines they guard.
3. **Silence is a fault, not peace.** A quiet server, a silent monitor and an agent that stops answering all raise an alarm when their heartbeat stops.
4. **Power is rented, never owned.** Routine work uses minimal rights; full access is temporary, scoped, logged, tied to a named owner, and, for emergency keys, loud by design.
5. **Test the alarm, not the configuration.** Stop the log stream on a test machine, block the monitor's pulse, and measure two times with a stopwatch: how long until the outside receiver raises the alarm, and how long until a person acts on it. The first is the timeout you configured; the second is the one that actually protects you. Repeat it on a schedule: an alarm nobody has triggered on purpose is only a hope.
6. **Test the anchor, not just the alarm.** An anchor is not watched by another guard; it is duplicated and tested. Restore a system from the immutable copy and time it from zero. Check that what came back is complete and that its artifacts still verify. A backup nobody has restored is only a theory.
7. **Fewer, simpler parts.** Every layer is another thing that can fail and another thing someone must run. A layer you cannot test is a layer you cannot trust.

Tools and platforms change every few years. The geometry of trust doesn't.
