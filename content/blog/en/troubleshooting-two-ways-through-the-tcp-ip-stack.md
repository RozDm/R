---
title: "Troubleshooting: two ways through the TCP/IP stack"
description: "Bottom-up from the cable or top-down from the application: how to pick a way through the TCP/IP stack when something breaks, with commands for every layer."
date: "2026-11-09"
tags: ["TCP/IP"]
translationOf: "feilsoking-to-veier-gjennom-tcp-ip-stakken"
---

‘The network is down’ is a symptom, not a diagnosis. The quickest way from symptom to cause is to walk the TCP/IP stack one layer at a time — and to start at the right end.

## Five layers, five questions

The TCP/IP model has four layers. When I troubleshoot, I split the bottom one in two, physical and link, because a dead cable and a wrong VLAN are different faults with different tools. That gives each layer its own question:

| Layer | The question | Typical faults |
| --- | --- | --- |
| 1 Physical | Is there a signal? | Cable, port, power, Wi-Fi coverage |
| 2 Link | Can I reach the neighbour? | VLAN, switch port, ARP |
| 3 Internet (IP) | Is there a way there? | Address, netmask, gateway, routing |
| 4 Transport | Is the port open? | Firewall, a service that isn't listening |
| 5 Application | Does the service answer correctly? | DNS, TLS, HTTP, login |

Each layer rests on the ones below. If a layer works, everything under it works too — at least on the way there. That is the whole logic behind both methods: prove one layer and you learn something about the others.

## Bottom-up

Start at the cable when many users or every service is down, when something physical has changed (a move, a new cable, a new switch), or when one machine has no network at all. Prove each layer before moving on:

```bash
# 1 Physical: is there a link? NO-CARRIER means no signal
ip -br link
ethtool eth0 | grep -E 'Link detected|Speed|Duplex'
ip -s link show eth0       # growing error counters: cable, port, duplex

# 2 Link: does the gateway answer ARP? The entry counts even if
# the gateway ignores the ping itself
ping -c 1 192.168.1.1 > /dev/null
ip neigh show 192.168.1.1  # REACHABLE/STALE: fine; FAILED: VLAN, port

# 3 Internet: an address, a route and an answer
ip -br addr                # no IPv4, or 169.254.x.x: no DHCP answer
ip route get 10.20.0.15    # the gateway and interface the packet uses
ping -c 3 10.20.0.15
traceroute -n 10.20.0.15   # where the path stops (or tracepath, mtr)
# full-size packets: if only these get lost, it's the MTU
ping -c 3 -M do -s 1472 10.20.0.15

# 4 Transport: does the port answer? Without nc, bash can test it too
nc -zv -w 3 10.20.0.15 443
timeout 3 bash -c '</dev/tcp/10.20.0.15/443' && echo open

# 5 Application: the name and the service
getent hosts app.example.com  # the same lookup programs make
curl -v https://app.example.com/
```

The upside is that nothing gets skipped: once you reach the top, you know everything below works. The downside is time. If the fault is an expired certificate, you have checked four layers for nothing.

## Top-down

Start at the application when one service fails while the rest work: email goes through, but the intranet won't open. The first command is `curl -v`. It goes through every layer in one go, and its error message tells you where to look next:

```bash
curl -v https://app.example.com/
```

| curl says | Layer | Next step |
| --- | --- | --- |
| `Could not resolve host` | 5, DNS | `getent hosts`, `dig`, the resolver setup |
| `SSL certificate problem` | 5, TLS | Certificate, chain, clock |
| HTTP `502` or `503` | 5, the service | The logs of the proxy and the service behind it |
| `Connection refused` | 4 | The host (or a firewall) answers, but nothing listens on the port |
| `Connection timed out` | 3 or below | The packets vanish: firewall, routing or further down |

A trick at the DNS layer: `dig` asks the DNS server directly, while programs use the system resolver, with the hosts file, search domains and cache. When `dig` and `getent hosts` disagree, the fault is in the machine's own setup, not in DNS.

If the host answers but the service doesn't, carry on on the server:

```bash
# on the server: does anything listen on 443, and what does it log?
sudo ss -tlnp | grep ':443'
systemctl status nginx
journalctl -u nginx --since '15 min ago'
```

The upside is speed: if the fault is high up, and day to day it often is, a couple of commands find it. The downside is that a fault far down can pass for one high up. With no network cable, curl says `Could not resolve host`, and you can spend time on a DNS that works.

## Same fault, two ways

A typical case: on Monday morning users can't get into app.example.com, but email and the internet work. One service fails and the rest work, so top-down:

1. `curl -v` shows `Trying 10.20.0.15:443...` and then a timeout. The name was resolved, so DNS works, but the TCP connection never comes up.
2. `ping 10.20.0.15` answers. There is a way there, so layers 1–3 work.
3. `nc -zv 10.20.0.15 443` times out, while `ss -tlnp` on the server shows nginx listening on 443.
4. So something between the client and the server drops the packets: the firewall. A change over the weekend had removed the rule that let the office network in on port 443.

Four commands. Bottom-up would have found the same, but only after proving the cable, ARP, address and gateway on a client where everything was fine.

The other way round: had the network card shown `NO-CARRIER`, bottom-up would have found the fault with its first command, while top-down would first have had a DNS error to chase.

## Which way?

- Many users or every service down, or something physical changed: bottom-up.
- One service fails, the rest work: top-down.
- Unsure: start in the middle with a `ping` to the target. If it answers, layers 1–3 work and the fault lies above; if it doesn't, look below. That is divide and conquer. But many firewalls block ICMP, so an unanswered ping proves nothing on its own: confirm with a TCP test such as `nc -zv`.

Whichever way: write down what you have proven at each layer, and change one thing at a time.

## The same on Windows

The same five layers in PowerShell:

```powershell
# 1 Physical: Status should be Up; Disconnected means no signal
Get-NetAdapter

# 2 Link: the gateway's ARP entry
Get-NetNeighbor -IPAddress 192.168.1.1

# 3 Internet: address, route, answer, path
Get-NetIPConfiguration
Find-NetRoute -RemoteIPAddress 10.20.0.15
ping 10.20.0.15
tracert -d 10.20.0.15

# 4 Transport: TcpTestSucceeded is True or False
Test-NetConnection 10.20.0.15 -Port 443
Get-NetTCPConnection -State Listen -LocalPort 443   # on the server

# 5 Application: the name and the service
Resolve-DnsName app.example.com
curl.exe -v https://app.example.com/
```

In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`. Type `curl.exe` to get the real curl, which has shipped with Windows since 2018. `Test-NetConnection app.example.com -Port 443` resolves the name and tests the port in one command, a good first step top-down.
