---
title: "Feilsøking: to veier gjennom TCP/IP-stakken"
description: "Nedenfra fra kabelen eller ovenfra fra applikasjonen: slik velger du vei gjennom TCP/IP-stakken når noe ikke virker, med kommandoer for hvert lag."
date: "2026-11-09"
tags: ["TCP/IP"]
---

«Nettet virker ikke» er et symptom, ikke en diagnose. Den raskeste veien fra symptom til årsak er å gå gjennom TCP/IP-stakken ett lag om gangen — og å begynne i riktig ende.

## Fem lag, fem spørsmål

TCP/IP-modellen har fire lag. Når jeg feilsøker, deler jeg det nederste i to, fysisk lag og linklag, fordi en død kabel og et feilkonfigurert VLAN er to forskjellige feil med forskjellige verktøy. Da får hvert lag sitt eget spørsmål:

| Lag | Spørsmålet | Typiske feil |
| --- | --- | --- |
| 1 Fysisk | Er det signal? | Kabel, port, strøm, Wi-Fi-dekning |
| 2 Link | Får jeg kontakt med naboen? | VLAN, svitsjeport, ARP |
| 3 Internett (IP) | Finnes det en vei dit? | Adresse, nettmaske, gateway, ruting |
| 4 Transport | Er porten åpen? | Brannmur, en tjeneste som ikke lytter |
| 5 Applikasjon | Svarer tjenesten riktig? | DNS, TLS, HTTP, pålogging |

Hvert lag hviler på lagene under. Virker et lag, virker alt under det også — i hvert fall på veien dit. Det er hele logikken bak begge metodene: du beviser ett lag og vet dermed noe om de andre.

Eksemplene bruker IPv4. Med IPv6 er lagene de samme, men ARP heter NDP (`ip -6 neigh`), og en `fe80::`-adresse er helt normal.

## Nedenfra og opp

Begynn ved kabelen når mange brukere eller alle tjenester er nede, når noe fysisk er endret (flytting, ny kabel, ny svitsj), eller når én maskin ikke har nett i det hele tatt. Bevis hvert lag før du går videre:

```bash
# 1 Physical: is there a link? NO-CARRIER means no signal
ip -br link                # names: eth0 here, often ens18 or enp3s0
ethtool eth0 | grep -E 'Link detected|Speed|Duplex'
ip -s link show eth0       # growing error counters: cable, port, duplex

# 2 Link: do frames flow? These need no IP address (DHCP may have failed)
sudo tcpdump -ni eth0 -c 5 arp            # neighbours' ARP: frames arrive
ip route show default                     # the gateway, if DHCP gave one
sudo arping -D -c 3 -I eth0 192.168.1.1   # a reply with a MAC: L2 works

# 3 Internet: an address, a route and an answer
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

# 4 Transport: does the port answer? Without nc, bash can test it too
nc -zv -w 3 10.20.0.15 443
timeout 3 bash -c '</dev/tcp/10.20.0.15/443' && echo open

# 5 Application: the name and the service
getent hosts app.example.com  # the same lookup programs make
curl -v https://app.example.com/
```

`arping -D` er iputils-utgaven (Debian/Ubuntu: pakken `iputils-arping`), og `traceroute -T` krever pakken `traceroute`; ellers gjør `mtr -n -T -P 443 10.20.0.15` det samme.

Fordelen er at ingenting hoppes over: når du er på toppen, vet du at alt under virker. Ulempen er tiden. Er feilen et utløpt sertifikat, har du sjekket fire lag forgjeves.

## Ovenfra og ned

Begynn i applikasjonen når én tjeneste feiler mens resten virker: e-posten går, men intranettet åpner seg ikke. Første kommando er `curl -v`. Den går gjennom alle lagene på én gang, og feilmeldingen forteller hvor du skal lete videre. Med `--connect-timeout` slipper du å vente i over to minutter når pakkene forsvinner:

```bash
curl -v --connect-timeout 5 https://app.example.com/
```

Bak en proxy går curl via den (miljøvariabelen `https_proxy`; `curl -v` skriver da `Uses proxy env variable`), mens ping, nc og traceroute går direkte. Legg til `--noproxy '*'` når du tester selve nettet.

| curl sier | Lag | Neste steg |
| --- | --- | --- |
| `Could not resolve host` | 5, DNS | `getent hosts`, `dig`, resolver-oppsettet |
| `Resolving timed out` | 5, DNS | DNS-serveren svarer ikke: `dig`, `/etc/resolv.conf` |
| `Connection refused` | 4 | Maskinen (eller en brannmur) svarer, men ingenting lytter på porten |
| `Connection timed out` eller `Timeout was reached` | 4 eller lavere | Pakkene forsvinner: en brannmur som kaster dem, ruting eller lenger ned |
| Henger etter `Client hello` | 3, MTU | Små pakker går, store forsvinner: test MTU (lag 3 nedenfra) |
| `SSL certificate problem` | 5, TLS | Sertifikat, kjede, klokke |
| HTTP `502` eller `503` | 5, tjenesten | Loggene i proxyen og tjenesten bak |

Et DNS-triks: `dig` spør DNS-serveren direkte, mens programmene bruker systemets resolver, med hosts-filen, søkedomener og cache. Er `dig` og `getent hosts` uenige, ligger feilen i maskinens eget oppsett, ikke i DNS. Og mens DNS er nede, kan du teste resten forbi den: `curl -v --resolve app.example.com:443:10.20.0.15 https://app.example.com/` sender riktig navn i TLS (SNI) og HTTP uten noe DNS-oppslag.

Svarer maskinen, men ikke tjenesten, fortsetter du på serveren:

```bash
# on the server: does anything listen on 443, and what does it log?
sudo ss -tlnp 'sport = :443'
systemctl status nginx
journalctl -u nginx --since '15 min ago'
```

Fordelen er farten: ligger feilen høyt oppe, og i hverdagen gjør den ofte det, finner du den med et par kommandoer. Ulempen er at en feil langt nede kan forkle seg som en feil høyt oppe. Uten nettverkskabel sier curl `Could not resolve host`, og du kan bruke tid på en DNS som virker.

## Samme feil, to veier

Et typisk tilfelle: mandag morgen kommer brukerne ikke inn på app.example.com, men e-post og internett virker. Én tjeneste feiler og resten virker, altså ovenfra og ned:

1. `curl -v` viser `Trying 10.20.0.15:443...` og deretter timeout. Navnet ble slått opp, så DNS virker, men TCP-forbindelsen kommer ikke i stand.
2. `ping 10.20.0.15` svarer. Det finnes en vei dit, så lag 1–3 virker, i hvert fall for ICMP.
3. `nc -zv 10.20.0.15 443` får timeout, mens `ss -tlnp` på serveren viser at nginx lytter på 443.
4. `sudo tcpdump -ni eth0 'tcp port 443'` på serveren viser ingen SYN fra klienten: noe før serveren kaster pakkene. Det kan være en brannmur i nettet, eller en som hører til serveren, men filtrerer utenfor den: en security group i skyen (AWS, Azure) eller brannmuren i Proxmox. Kommer SYN-pakkene fram uten svar, er det serverens egen brannmur (`sudo nft list ruleset`).
5. Her var det brannmuren mellom nettene. En endring i helgen hadde fjernet regelen som slapp kontornettet inn på port 443.

Fem kommandoer. Nedenfra og opp hadde funnet det samme, men først etter å ha bevist kabel, ARP, adresse og gateway på en klient der alt var i orden.

Omvendt: hadde nettverkskortet vist `NO-CARRIER`, ville nedenfra og opp funnet feilen med første kommando, mens ovenfra og ned først hadde fått en DNS-feil å jage.

## Hvilken vei?

- Mange brukere eller alle tjenester nede, eller noe fysisk endret: nedenfra og opp.
- Én tjeneste feiler, resten virker: ovenfra og ned.
- Usikker: begynn på midten med `ping` til målet. Svarer det, virker lag 1–3, og feilen ligger over. Svarer det ikke, let under. Det kalles splitt og hersk. To forbehold: mange brannmurer blokkerer ICMP, så et ping uten svar beviser ingenting alene, og med lastbalansering (ECMP) eller policy-ruting kan TCP ta en annen vei enn ping. Bekreft med en TCP-test som `nc -zv` eller `traceroute -T`.

Uansett vei: skriv ned hva du har bevist på hvert lag, og endre én ting om gangen.

## Det samme på Windows

De samme fem lagene i PowerShell:

```powershell
# 1 Physical: Status should be Up; Disconnected means no signal
Get-NetAdapter

# 2 Link (needs an IPv4 address; 169.254.x.x = no DHCP answer, see 3):
# forget the gateway's entry, ping it, read the answer. Reachable means
# OK, Unreachable or Incomplete points at VLAN or port (run as admin)
Remove-NetNeighbor -IPAddress 192.168.1.1 -Confirm:$false 2>$null
ping -n 1 192.168.1.1 > $null
Get-NetNeighbor -IPAddress 192.168.1.1

# 3 Internet: address, route, answer, path, full-size packets (MTU)
Get-NetIPConfiguration
Find-NetRoute -RemoteIPAddress 10.20.0.15
ping 10.20.0.15
tracert -d 10.20.0.15
ping -f -l 1472 10.20.0.15

# 4 Transport: TcpTestSucceeded is True or False
Test-NetConnection 10.20.0.15 -Port 443
Get-NetTCPConnection -State Listen -LocalPort 443   # on the server

# 5 Application: the name and the service
Resolve-DnsName app.example.com
curl.exe -v --connect-timeout 5 https://app.example.com/
```

I Windows PowerShell 5.1 er `curl` et alias for `Invoke-WebRequest`. Skriv `curl.exe` for å få ekte curl, som har fulgt med Windows siden 2018. `Test-NetConnection app.example.com -Port 443` slår opp navnet og tester porten i én kommando, et godt første steg ovenfra og ned.
