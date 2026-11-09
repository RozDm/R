---
title: "Troubleshooting tools, layer by layer"
description: "The commands for every layer of the TCP/IP stack, for Linux and for Windows in PowerShell 7, and the error messages that show where to look."
date: "2026-11-09"
tags: ["TCP/IP", "Linux", "PowerShell"]
translationOf: "verktoy-for-feilsoking-lag-for-lag"
draft: true
---

The method is in [Troubleshooting: two ways through the TCP/IP stack](/en/blog/troubleshooting-two-ways-through-the-tcp-ip-stack/). These are the tools: the commands for every layer, for Linux and for Windows in PowerShell 7.

## Layer by layer

Under each layer, Linux comes first and Windows in PowerShell 7 after it. Some commands work in both: `curl` is the same, with the same options, and `ping` exists on both with options of its own (`-n` instead of `-c`). On Windows you can use both sets: the PowerShell commands, and the Linux ones through WSL (see the last part).

### 1 Physical: is there a signal?

```bash
# Linux
ip -br link            # NO-CARRIER means no signal; eth0 may be ens18
ethtool eth0 | grep -E 'Link detected|Speed|Duplex'
ip -s link show eth0   # growing error counters: cable, port, duplex
```

```powershell
# Windows, PowerShell 7
Get-NetAdapter         # Status Up; Disconnected means no signal
Get-NetAdapterStatistics | Format-List Name, *Errors, *Discarded*
```

### 2 Link: can I reach the neighbour?

```bash
# Linux: needs no IP address, so it works even when DHCP has failed
sudo tcpdump -ni eth0 -c 5 arp            # neighbours' ARP: frames arrive
ip route show default                     # the gateway, if DHCP gave one
sudo arping -D -c 3 -I eth0 192.168.1.1   # a reply with a MAC: L2 works
```

```powershell
# Windows, PowerShell 7
Get-NetRoute -DestinationPrefix 0.0.0.0/0   # the gateway, from DHCP
# Forget its ARP entry, ping it, read the answer (needs an IPv4 address
# and admin): Reachable means OK, Unreachable or Incomplete: VLAN, port
Remove-NetNeighbor -IPAddress 192.168.1.1 -Confirm:$false 2>$null
ping -n 1 192.168.1.1 > $null
Get-NetNeighbor -IPAddress 192.168.1.1
```

### 3 Internet: is there a route?

```bash
# Linux
ip -br addr                # no IPv4, or 169.254.x.x: no DHCP answer
ping -c 3 192.168.1.1      # the gateway first
ip route get 10.20.0.15    # then the target: the gateway and interface
ping -c 3 10.20.0.15
traceroute -n 10.20.0.15   # where the path stops (or tracepath, mtr)
# UDP probes blocked? Follow TCP 443, like the application does
sudo traceroute -n -T -p 443 10.20.0.15
# MTU: -s 1472 makes a 1500-byte packet. Through a VPN or overlay less
# is normal (WireGuard: 1420); lower -s until it passes
ping -c 3 -M do -s 1472 10.20.0.15
```

```powershell
# Windows, PowerShell 7
Get-NetIPConfiguration                      # address, gateway, DNS
ping 192.168.1.1                            # the gateway first
Find-NetRoute -RemoteIPAddress 10.20.0.15   # the route to the target
ping 10.20.0.15
Test-Connection 10.20.0.15 -Traceroute      # where the path stops
Test-Connection 10.20.0.15 -MtuSize         # finds the path MTU itself
```

### 4 Transport: is the port open?

```bash
# Linux
nc -zv -w 3 10.20.0.15 443
timeout 3 bash -c '</dev/tcp/10.20.0.15/443' && echo open   # without nc
```

```powershell
# Windows, PowerShell 7
Test-Connection 10.20.0.15 -TcpPort 443   # True or False
Test-NetConnection 10.20.0.15 -Port 443   # the same, with details
```

### 5 Application: does the service answer correctly?

```bash
# Linux
getent hosts app.example.com  # the same lookup programs make
curl -v https://app.example.com/
```

```powershell
# Windows, PowerShell 7
Resolve-DnsName app.example.com    # the Windows resolver, hosts file too
curl -v https://app.example.com/   # PowerShell 7: the real curl.exe
```

`arping -D` is the iputils version (Debian/Ubuntu: the `iputils-arping` package), and `traceroute -T` needs the `traceroute` package; otherwise `mtr -n -T -P 443 10.20.0.15` does the same.

## What curl tells you

The first command top-down is `curl -v`, in PowerShell 7 too, where `curl` is the real curl rather than an alias. `--connect-timeout` spares you a wait of over two minutes when the packets vanish:

```bash
curl -v --connect-timeout 5 https://app.example.com/
```

Behind a proxy, curl goes through it (the `https_proxy` environment variable; `curl -v` then says `Uses proxy env variable`), while ping, nc and traceroute go direct. Add `--noproxy '*'` when you test the network itself. On Windows the browser follows the system proxy settings, while curl only reads the environment variables.

| curl says | Layer | Next step |
| --- | --- | --- |
| `Could not resolve host` | 5, DNS | `getent hosts`, `dig`, the resolver setup |
| `Resolving timed out` | 5, DNS | The DNS server doesn't answer: `dig`, `/etc/resolv.conf` |
| `Connection refused` | 4 | The host (or a firewall) answers, but nothing listens on the port |
| `Connection timed out` or `Timeout was reached` | 4 or below | The packets vanish: a firewall dropping them, routing or further down |
| Hangs after `Client hello` | 3, MTU | Small packets pass, big ones vanish: test the MTU (layer 3, bottom-up) |
| `SSL certificate problem`, on Windows `schannel:` | 5, TLS | Certificate, chain, clock |
| HTTP `502` or `503` | 5, the service | The logs of the proxy and the service behind it |

A DNS trick: `dig` asks the DNS server directly, while programs use the system resolver, with the hosts file, search domains and cache. When `dig` and `getent hosts` disagree, the fault is in the machine's own setup, not in DNS. On Windows, `Resolve-DnsName -Server` does what `dig` does. And while DNS is down, you can test the rest past it: `curl -v --resolve app.example.com:443:10.20.0.15 https://app.example.com/` sends the right name in TLS (SNI) and HTTP without any DNS lookup.

If the host answers but the service doesn't, continue on the server:

```bash
# on the server: does anything listen on 443, and what does it log?
sudo ss -tlnp 'sport = :443'
systemctl status nginx
journalctl -u nginx --since '15 min ago'
```

```powershell
# on a Windows server (IIS here): anything on 443, the service, the log
Get-NetTCPConnection -State Listen -LocalPort 443
Get-Service W3SVC
Get-WinEvent -LogName System -MaxEvents 20
```

## Linux commands in WSL

From PowerShell 7 you can run the Linux tools directly, for example `wsl ip -br addr` or `wsl curl -v https://app.example.com/`. But in WSL 2 they run in a lightweight virtual machine with its own network card behind NAT in Windows, the default mode:

- Layers 1 and 2 see the virtual network, not your cable: `ethtool`, `arping` and `tcpdump` show WSL's own switch. Check these layers in PowerShell.
- Layers 3–5 from WSL go through Windows, DNS included (on Windows 11, DNS goes through Windows by default). A fault that only shows in WSL may lie in WSL itself: run the same test in PowerShell and compare.
- With `networkingMode=mirrored` in `.wslconfig` (Windows 11 22H2 and later), WSL mirrors the host's network cards, and layers 3–5 behave almost as on the host. Layers 1 and 2 still belong to Windows.

PowerShell 7 also exists for Linux (`pwsh`). There `Test-Connection` and all the Linux commands work, but not `Get-Net*`, which only exists on Windows.
