---
title: "Who watches the watchers? Oversight in IT infrastructure"
description: "Every guard that can protect a system can also blind it. Four layers of oversight, so that no single guard has to be trusted alone."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
translationOf: "hvem-vokter-vokterne-i-it-infrastruktur"
draft: true
---

"We added monitoring" is a comfort, not a guarantee. Every tool or administrator with the power to protect a system also has the power to blind it, break it, or hide what happened. Security is less about finding an infallible guard than about building a chain where no single guard has to be trusted alone.

## Moving the risk

When you give an administrator full rights to fix servers, or install an agent to watch for intrusions, you solve one problem and create another. The guard becomes the most valuable target in the room.

Putting a second guard over the first only moves the question one step up. If you do not decide how the chain works, and where it stops, you end up with a pile of tools that all share the same weak spot.

Before trusting any control, three questions pay off:

1. Can the person or system being watched erase the record of what they did?
2. If the alarm system itself dies or gets cut off, what sound does it make?
3. What happens when the account meant for emergencies is used on a quiet Tuesday?

The answers decide whether you have real oversight or just another single point of failure.

## Four layers of oversight

Instead of stacking guards endlessly, split oversight into four jobs: writing the record, watching the record, watching the alarm, and holding the keys. Each layer checks the one below it across a boundary that only works one way.

| Layer | The question | Typical failure | What guards it |
| --- | --- | --- | --- |
| 1 The record | Was the action written down? | Local logs are edited or deleted | One-way forwarding as soon as a line is written |
| 2 The observer | Did anyone see the record? | Auditing is turned off, or the stream is killed | An outside collector that alerts on tampering and on silence |
| 3 The alarm | Is the watcher still awake? | The monitor crashes, loses storage, or gets cut off | A continuous pulse sent to an outside receiver |
| 4 The keys | Who can change the layers above? | One compromised superuser disables the whole chain | Temporary rights, two pairs of eyes, and a noisy spare key |

What makes the layers hold is separation of fate. If the system that collects logs shares passwords, hardware, or network paths with the servers it watches, a single fault takes both down together.

### Layer 1: the record

A log that stays on the machine it describes is only a diary. Anyone with full rights on that machine can rewrite it or delete it after the fact.

For a record to count as evidence, it must leave the host the moment it is written, crossing a one-way boundary. The source machine may add new lines, but it must have no way to read back, alter, or delete what has already crossed. Even if the machine is completely taken over five seconds later, the trail up to that moment is out of reach.

### Layer 2: the observer

Moving the logs off the machine protects the past, but not the next ten minutes. An intruder with full rights does not need to erase old records if they can simply stop new ones from being made.

Clearing a log leaves an obvious mark, so a careful attacker will rather change the audit rules to ignore certain actions, or kill the process that sends the logs away. That leaves no error message at the destination, only a gap.

The observer on the other side of the boundary must therefore watch for two things at once: explicit signs that auditing was touched, and a host that suddenly goes quiet.

| What the observer sees | What it means | Look here |
| --- | --- | --- |
| The log was cleared | Someone tried to wipe the trail | The host, at once; assume full compromise |
| Audit rules changed | Someone is blinding the recorder before acting | Recent privilege use on the host |
| The log stream stops | The host is down, cut off, or the sender was killed | The network path first, then the logging process |
| Approval rules bypassed | A privileged user changed the guardrails for themselves | Control plane and repository settings, Layer 4 |

### Layer 3: who monitors the monitor?

An alarm system that never rings tells you nothing. Everything might be fine, or the monitor might have crashed, filled its disk, or been blocked at a firewall three days ago.

The fix is to invert the signal. Instead of waiting for a message that says something is broken, an independent service outside your infrastructure waits for a steady pulse that says the monitor is alive and able to speak.

For the pulse to prove anything, it has to travel through the whole chain: triggered inside the monitoring engine, passed through the notification router, and delivered outside. A pulse sent by a separate timer script only proves the script works. When the real pulse stops arriving for a few minutes, the outside receiver raises the alarm. It is the one link that does not share a fate with the rest of your setup.

### Layer 4: those with the keys

Even with one-way logs and an external heartbeat, someone has to manage the log collector, the monitor, and the access rules. If one account can change all of them at once, the four layers collapse back into a single point of failure. Three boundaries keep top-level rights in check:

- **Borrowed time.** Nobody holds permanent full access for daily work. High privileges are checked out for a specific task and expire on their own, and the act of borrowing them is recorded before the session starts.
- **Two pairs of eyes.** The person who proposes a change to critical infrastructure, or to the pipeline that deploys it, cannot be the one who approves it. And because an administrator might have the rights to turn off the two-person rule for ten seconds, any change to the approval rules themselves must trigger an immediate alert at Layer 2.
- **A noisy spare key.** Every system needs an emergency account for when normal login systems are down. That key stays locked away, is never used for routine work, and sets off an immediate alarm through an independent channel the moment it is touched.

## Same breach, two designs

Suppose an administrator's laptop is compromised on a Tuesday evening, giving an intruder the same reach the administrator has.

In a flat setup, the administrator holds permanent keys to both the servers and the monitoring system for convenience. The intruder logs in, pauses the alerts, runs their payload, deletes the local logs, and wipes the backups. On Wednesday morning every dashboard is still green.

With the four layers in place, the same stolen laptop hits a boundary at every step:

- There are no permanent keys on the machine; elevating rights requires a fresh request that gets logged outside the host before access is granted.
- Even if the intruder gets onto a server and kills the log sender, everything up to that second is already stored across a one-way boundary, and the sudden silence alerts the collector.
- If they try to silence the monitor itself, the external pulse stops and the outside receiver pages the team.
- If they reach for the emergency account, the spare-key alarm fires before they run their first command.

The breach still happens, but it cannot hide.

## The chain ends somewhere

Every layer moves trust; none removes it. You cannot build an infinite tower of guards watching guards. At the end of the chain sits something you simply choose to rely on: storage that physically refuses overwrites for a set period, an outside pulse receiver, or a person outside daily operations who reads the trail. That is not a weakness in the design, it is the anchor. The goal is to know where that anchor sits, and to make sure no single failure can reach it.

In a small environment, where one person runs both the servers and the security, you cannot split roles between people. You can still split them across boundaries: send the logs where your day-to-day account cannot delete them, put the heartbeat on the outside, and set a fixed slot in the calendar where someone else reads the summary.

## Principles

1. **Evidence travels one way.** A machine can add to the record, but cannot edit or erase what it has already sent.
2. **The watcher lives outside the watched.** The collector and the alarm do not share credentials, network fate, or hardware with the machines they guard.
3. **Silence is a fault, not peace.** Both a quiet server and a quiet monitor raise an alarm when their pulse stops.
4. **Power is rented, never owned.** Routine work uses minimal rights; full access is temporary, logged, and, for emergency keys, loud by design.
5. **Test the alarm, not the configuration.** Stop the log stream on a test machine, block the monitor's pulse, and measure with a stopwatch how long it takes before someone notices.

Tools and platforms change every few years. The geometry of trust doesn't.
