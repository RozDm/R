---
title: "Who watches the watchers? Oversight in IT infrastructure"
description: "Admin, log, SIEM and audit: each layer checks the one before, but none checks itself. Where the chain breaks, and what to do about it."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
translationOf: "hvem-vokter-vokterne-i-it-infrastruktur"
draft: true
---

"Quis custodiet ipsos custodes?", who guards the guards? The question is over two thousand years old, and in IT it is entirely concrete. The administrator sees everything in the system. The log sees the administrator. Monitoring sees the log. But who sees the monitoring, and who sees the person who owns it?

The answer is not one tool but two rules: nobody watches themselves, and silence is an alarm. Below is what they look like layer by layer, and where the chain ends anyway.

## The problem: the guard holds the key

Whoever has root also has write access to the log that describes what they do. An intruder with root, or an administrator having a bad day, usually tidies up here first:

```bash
# what an intruder with root does first
history -c
journalctl --rotate && journalctl --vacuum-time=1s
: > /var/log/auth.log
```

On Windows the same thing is `wevtutil cl Security`. Event 1102 says the log was cleared, but that event lives in the log that was just cleared. A local log is a witness that survives only as long as nobody gets to it.

The first rule follows: the log must leave the machine before anyone can touch it.

## Layer 1: the log leaves the machine

Two things belong on every server: an audit rule saying what to record, and forwarding to a machine the administrator cannot write to.

```bash
# /etc/audit/rules.d/watchers.rules
-w /etc/sudoers   -p wa -k sudo_changes
-w /etc/sudoers.d -p wa -k sudo_changes
-a always,exit -F arch=b64 -S execve -F euid=0 -F auid>=1000 -F auid!=unset -k root_exec
# last line: rules become immutable until reboot, so stopping the watcher
# needs a reboot, and a reboot is itself an event somebody sees
-e 2
```

```bash
# /etc/rsyslog.d/50-forward.conf
# auditd must reach syslog first: active = yes in /etc/audit/plugins.d/syslog.conf
global(
  DefaultNetstreamDriver="gtls"
  DefaultNetstreamDriverCAFile="/etc/ssl/certs/log-ca.pem"
)
action(type="omfwd" target="logs.example.net" port="6514" protocol="tcp"
       StreamDriver="gtls" StreamDriverMode="1"
       StreamDriverAuthMode="x509/name" StreamDriverPermittedPeers="logs.example.net"
       queue.type="LinkedList" queue.filename="fwd" action.resumeRetryCount="-1")
```

The queue with `resumeRetryCount="-1"` keeps messages from being lost when the collector is down. On Windows, Windows Event Forwarding or an agent (Wazuh, for example) does the same job.

## Layer 2: a different role reads the log

A collector helps only if the person who runs the servers does not also own it. Otherwise you have moved the key, not removed it. Separating roles does the work:

- the infrastructure administrator writes to the servers but cannot delete from the SIEM;
- the SOC reads and raises alerts but cannot change the servers;
- whoever administers the SIEM is not among those being watched.

A handful of alerts covers most of what matters: log cleared, audit service stopped, new administrator account, a change to `sudoers`, a login outside the usual pattern. The check for the first one exists locally too:

```powershell
# Windows, PowerShell 7: the same check locally, but the alert belongs in the SIEM
Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 1102 } -MaxEvents 5
```

## Layer 3: who monitors the monitor?

When Prometheus or Zabbix itself goes down, no alarm arrives, only silence. The fix is an alert that is always firing (a "Watchdog", or dead man's switch), sent to a service outside your own infrastructure. If the messages stop arriving, the external service raises the alarm.

```yaml
# Prometheus rule: always firing on purpose
groups:
  - name: meta
    rules:
      - alert: Watchdog
        expr: vector(1)
        labels: { severity: none }
        annotations:
          summary: "Always firing; silence means the alert pipeline is down"
```

```yaml
# Alertmanager: route it to an external heartbeat, not to the team
route:
  receiver: team
  routes:
    - matchers: [alertname="Watchdog"]
      receiver: heartbeat
      group_interval: 1m
      repeat_interval: 1m
receivers:
  - name: heartbeat
    webhook_configs:
      - url: https://heartbeat.example.net/ping/<token>
        send_resolved: false
```

The service is set to alert after, say, five minutes without a ping. It is the only part that does not share a fate with the rest of the chain.

## Layer 4: those with privileges

Even with logging and a SIEM there are accounts that can do everything. Three things make them less dangerous:

- **Access on demand.** Secrets and root logins are fetched temporarily (Vault, PAM) rather than sitting permanently with a person. Everything issued is logged by the system that issues it.
- **Break-glass.** One emergency account with a long, stored password, and an alarm that fires on any use. It should be noisy by design.
- **Four eyes on changes.** When infrastructure is defined as code, a pull request with approval and a protected branch is the second person. The pipeline then becomes a privileged actor that must guard and be guarded: who can change it, and where does its token live?

## The chain ends somewhere

Every layer moves the trust, it does not remove it. In the end you are left with something you have to trust: an independent audit, a copy of the logs on storage that cannot be overwritten, a person outside the team who reads the results. That is not a weakness, but it is worth knowing where it stops.

In a small environment, where one person is both administrator and SOC, you do not get full separation of roles. What you can do is put the last link outside yourself: logs sent to a third party, an external heartbeat, and a fixed slot in the calendar where someone else reads the summary.

## Checklist

1. The log leaves the machine in real time, and the administrator cannot delete the other end.
2. The one who watches is not the one being watched.
3. Silence raises an alarm: an always-firing message is checked from outside.
4. Privileged use is noisy by design, and break-glass alerts every time.
5. It has been tested: clear the log on a test machine and measure how long it takes before anyone notices.
