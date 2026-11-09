---
title: "Verktøy for feilsøking lag for lag"
description: "Kommandoene for hvert lag i TCP/IP-stakken, for Linux og for Windows i PowerShell 7, og feilmeldingene som viser hvor du skal lete."
date: "2026-11-09"
tags: ["TCP/IP", "Linux", "PowerShell"]
draft: true
---

Metoden står i [Feilsøking: to veier gjennom TCP/IP-stakken](/blogg/feilsoking-to-veier-gjennom-tcp-ip-stakken/). Her er verktøyene: kommandoene for hvert lag, for Linux og for Windows i PowerShell 7.

## Lag for lag

Under hvert lag står Linux først og Windows i PowerShell 7 etter. Noen kommandoer virker begge steder: `curl` er den samme med de samme valgene, og `ping` finnes på begge, med egne valg (`-n` i stedet for `-c`). På Windows kan du bruke begge settene, PowerShell-kommandoene og Linux-kommandoene gjennom WSL (se siste del).

### 1 Fysisk: er det signal?

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

### 2 Link: får jeg kontakt med naboen?

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

### 3 Internett: finnes det en vei dit?

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

### 4 Transport: er porten åpen?

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

### 5 Applikasjon: svarer tjenesten riktig?

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

`arping -D` er iputils-utgaven (Debian/Ubuntu: pakken `iputils-arping`), og `traceroute -T` krever pakken `traceroute`; ellers gjør `mtr -n -T -P 443 10.20.0.15` det samme.

## Hva curl forteller

Første kommando ovenfra og ned er `curl -v`, også i PowerShell 7, der `curl` er ekte curl og ikke et alias. Med `--connect-timeout` slipper du å vente i over to minutter når pakkene forsvinner:

```bash
curl -v --connect-timeout 5 https://app.example.com/
```

Bak en proxy går curl via den (miljøvariabelen `https_proxy`; `curl -v` skriver da `Uses proxy env variable`), mens ping, nc og traceroute går direkte. Legg til `--noproxy '*'` når du tester selve nettet. På Windows følger nettleseren systemets proxy-innstillinger, mens curl bare leser miljøvariablene.

| curl sier | Lag | Neste steg |
| --- | --- | --- |
| `Could not resolve host` | 5, DNS | `getent hosts`, `dig`, resolver-oppsettet |
| `Resolving timed out` | 5, DNS | DNS-serveren svarer ikke: `dig`, `/etc/resolv.conf` |
| `Connection refused` | 4 | Maskinen (eller en brannmur) svarer, men ingenting lytter på porten |
| `Connection timed out` eller `Timeout was reached` | 4 eller lavere | Pakkene forsvinner: en brannmur som kaster dem, ruting eller lenger ned |
| Henger etter `Client hello` | 3, MTU | Små pakker går, store forsvinner: test MTU (lag 3 nedenfra) |
| `SSL certificate problem`, på Windows `schannel:` | 5, TLS | Sertifikat, kjede, klokke |
| HTTP `502` eller `503` | 5, tjenesten | Loggene i proxyen og tjenesten bak |

Et DNS-triks: `dig` spør DNS-serveren direkte, mens programmene bruker systemets resolver, med hosts-filen, søkedomener og cache. Er `dig` og `getent hosts` uenige, ligger feilen i maskinens eget oppsett, ikke i DNS. På Windows gjør `Resolve-DnsName -Server` det samme som `dig`. Og mens DNS er nede, kan du teste resten forbi den: `curl -v --resolve app.example.com:443:10.20.0.15 https://app.example.com/` sender riktig navn i TLS (SNI) og HTTP uten noe DNS-oppslag.

Svarer maskinen, men ikke tjenesten, fortsetter du på serveren:

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

## Linux-kommandoer i WSL

Fra PowerShell 7 kan du kjøre Linux-verktøyene direkte, for eksempel `wsl ip -br addr` eller `wsl curl -v https://app.example.com/`. Men i WSL 2 kjører de i en lett virtuell maskin med eget nettverkskort bak NAT i Windows, som er standardmodusen:

- Lag 1 og 2 ser det virtuelle nettet, ikke kabelen din: `ethtool`, `arping` og `tcpdump` viser WSLs egen svitsj. Sjekk disse lagene i PowerShell.
- Lag 3–5 fra WSL går gjennom Windows, også DNS (på Windows 11 går DNS via Windows som standard). En feil som bare finnes i WSL, kan ligge i WSL selv: kjør samme test i PowerShell og sammenlign.
- Med `networkingMode=mirrored` i `.wslconfig` (Windows 11 22H2 og nyere) speiler WSL vertens nettverkskort, og lag 3–5 oppfører seg nesten som på verten. Lag 1 og 2 hører fortsatt til Windows.

PowerShell 7 finnes også for Linux (`pwsh`). Der virker `Test-Connection` og alle Linux-kommandoene, men ikke `Get-Net*`, som bare finnes på Windows.
