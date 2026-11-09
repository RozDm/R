---
title: "Feilsøking: to veier gjennom TCP/IP-stakken"
description: "Nedenfra fra kabelen eller ovenfra fra applikasjonen: slik velger du vei gjennom TCP/IP-stakken når noe ikke virker, med kommandoer for hvert lag."
date: "2026-11-09"
tags: ["TCP/IP"]
draft: true
---

«Nettet virker ikke» er et symptom, ikke en diagnose. Den raskeste veien fra symptom til årsak er å gå gjennom TCP/IP-stakken ett lag om gangen — og å begynne i riktig ende.

## Fem lag, fem spørsmål

TCP/IP-modellen har fire lag. Når jeg feilsøker, deler jeg det nederste i to, fysisk lag og linklag, fordi en død kabel og et feil VLAN er to forskjellige feil med forskjellige verktøy. Da får hvert lag sitt eget spørsmål:

| Lag | Spørsmålet | Typiske feil |
| --- | --- | --- |
| 1 Fysisk | Er det signal? | Kabel, port, strøm, Wi-Fi-dekning |
| 2 Link | Får jeg kontakt med naboen? | VLAN, svitsjeport, ARP |
| 3 Internett (IP) | Finnes det en vei dit? | Adresse, nettmaske, gateway, ruting |
| 4 Transport | Er porten åpen? | Brannmur, en tjeneste som ikke lytter |
| 5 Applikasjon | Svarer tjenesten riktig? | DNS, TLS, HTTP, pålogging |

Hvert lag hviler på lagene under. Virker et lag, virker alt under det også — i hvert fall på veien dit. Det er hele logikken bak begge metodene: du beviser ett lag og vet dermed noe om de andre.

## Nedenfra og opp

Begynn ved kabelen når mange brukere eller alle tjenester er nede, når noe fysisk er endret (flytting, ny kabel, ny svitsj), eller når én maskin ikke har nett i det hele tatt. Bevis hvert lag før du går videre:

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

Fordelen er at ingenting hoppes over: når du er på toppen, vet du at alt under virker. Ulempen er tiden. Er feilen et utløpt sertifikat, har du sjekket fire lag forgjeves.

## Ovenfra og ned

Begynn i applikasjonen når én tjeneste feiler mens resten virker: e-posten går, men intranettet åpner seg ikke. Første kommando er `curl -v`. Den går gjennom alle lagene på én gang, og feilmeldingen forteller hvor du skal lete videre:

```bash
curl -v https://app.example.com/
```

| curl sier | Lag | Neste steg |
| --- | --- | --- |
| `Could not resolve host` | 5, DNS | `getent hosts`, `dig`, resolver-oppsettet |
| `SSL certificate problem` | 5, TLS | Sertifikat, kjede, klokke |
| HTTP `502` eller `503` | 5, tjenesten | Loggene i proxyen og tjenesten bak |
| `Connection refused` | 4 | Maskinen (eller en brannmur) svarer, men ingenting lytter på porten |
| `Connection timed out` | 3 eller lavere | Pakkene forsvinner: brannmur, ruting eller lenger ned |

Et triks på DNS-laget: `dig` spør DNS-serveren direkte, mens programmene bruker systemets resolver, med hosts-filen, søkedomener og cache. Er `dig` og `getent hosts` uenige, ligger feilen i maskinens eget oppsett, ikke i DNS.

Svarer maskinen, men ikke tjenesten, fortsetter du på serveren:

```bash
# on the server: does anything listen on 443, and what does it log?
sudo ss -tlnp | grep ':443'
systemctl status nginx
journalctl -u nginx --since '15 min ago'
```

Fordelen er farten: ligger feilen høyt oppe, og i hverdagen gjør den ofte det, finner du den med et par kommandoer. Ulempen er at en feil langt nede kan forkle seg som en feil høyt oppe. Uten nettverkskabel sier curl `Could not resolve host`, og du kan bruke tid på en DNS som virker.

## Samme feil, to veier

Et typisk tilfelle: mandag morgen kommer brukerne ikke inn på app.example.com, men e-post og internett virker. Én tjeneste feiler og resten virker, altså ovenfra og ned:

1. `curl -v` viser `Trying 10.20.0.15:443...` og deretter timeout. Navnet ble slått opp, så DNS virker, men TCP-forbindelsen kommer ikke i stand.
2. `ping 10.20.0.15` svarer. Det finnes en vei dit, så lag 1–3 virker.
3. `nc -zv 10.20.0.15 443` får timeout, mens `ss -tlnp` på serveren viser at nginx lytter på 443.
4. Altså stopper noe pakkene mellom klienten og serveren: brannmuren. En endring i helgen hadde fjernet regelen som slapp kontornettet inn på port 443.

Fire kommandoer. Nedenfra og opp hadde funnet det samme, men først etter å ha bevist kabel, ARP, adresse og gateway på en klient der alt var i orden.

Omvendt: hadde nettverkskortet vist `NO-CARRIER`, ville nedenfra og opp funnet feilen med første kommando, mens ovenfra og ned først hadde fått en DNS-feil å jage.

## Hvilken vei?

- Mange brukere eller alle tjenester nede, eller noe fysisk endret: nedenfra og opp.
- Én tjeneste feiler, resten virker: ovenfra og ned.
- Usikker: begynn på midten med `ping` til målet. Svarer det, virker lag 1–3, og feilen ligger over. Svarer det ikke, let under. Det kalles splitt og hersk. Men mange brannmurer blokkerer ICMP, så et ping uten svar beviser ingenting alene: bekreft med en TCP-test som `nc -zv`.

Uansett vei: skriv ned hva du har bevist på hvert lag, og endre én ting om gangen.

## Det samme på Windows

De samme fem lagene i PowerShell:

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

I Windows PowerShell 5.1 er `curl` et alias for `Invoke-WebRequest`. Skriv `curl.exe` for å få ekte curl, som har fulgt med Windows siden 2018. `Test-NetConnection app.example.com -Port 443` slår opp navnet og tester porten i én kommando, et godt første steg ovenfra og ned.
