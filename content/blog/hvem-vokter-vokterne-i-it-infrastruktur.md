---
title: "Hvem vokter vokterne? Tilsyn i IT-infrastruktur"
description: "Admin, logg, SIEM og revisjon: hvert lag kontrollerer det forrige, men ingen kontrollerer seg selv. Hvor kjeden brytes, og hva du gjør med det."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
draft: true
---

«Quis custodiet ipsos custodes?», hvem vokter vokterne? Spørsmålet er over to tusen år gammelt, og i IT er det helt konkret. Administratoren ser alt i systemet. Loggen ser administratoren. Overvåkingen ser loggen. Men hvem ser overvåkingen, og hvem ser den som eier den?

Svaret er ikke ett verktøy, men to regler: ingen vokter seg selv, og stillhet er en alarm. Under står det hvordan de ser ut lag for lag, og hvor kjeden likevel tar slutt.

## Problemet: vokteren har nøkkelen

Den som har root, har også skrivetilgang til loggen som beskriver hva vedkommende gjør. En angriper med root, eller en administrator med en dårlig dag, rydder som regel først her:

```bash
# what an intruder with root does first
history -c
journalctl --rotate && journalctl --vacuum-time=1s
: > /var/log/auth.log
```

På Windows heter det samme `wevtutil cl Security`. Hendelse 1102 sier at loggen ble tømt, men den hendelsen ligger i loggen som ble tømt. En lokal logg er et vitne som overlever bare så lenge ingen kommer til det.

Første regel følger av det: loggen må forlate maskinen før noen rekker å røre den.

## Lag 1: loggen forlater maskinen

To ting må på plass på hver server: en revisjonsregel som sier hva som skal logges, og videresending til en maskin administratoren ikke har skrivetilgang til.

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

Køen med `resumeRetryCount="-1"` gjør at meldingene ikke går tapt hvis samleserveren er nede. På Windows gjør Windows Event Forwarding eller en agent (Wazuh, for eksempel) den samme jobben.

## Lag 2: en annen rolle leser loggen

En samleserver hjelper bare hvis den som drifter serverne ikke også eier den. Ellers har du flyttet nøkkelen, ikke fjernet den. Skillet mellom roller gjør jobben:

- infrastrukturadministratoren skriver til serverne, men kan ikke slette fra SIEM-en;
- SOC leser og varsler, men kan ikke endre serverne;
- den som administrerer SIEM-en, er ikke en av dem som blir overvåket.

Noen få varsler dekker mesteparten av det som betyr noe: logg tømt, revisjonstjenesten stoppet, ny administratorbruker, endring i `sudoers`, pålogging utenfor vanlig mønster. Sjekken for den første finnes også lokalt:

```powershell
# Windows, PowerShell 7: the same check locally, but the alert belongs in the SIEM
Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 1102 } -MaxEvents 5
```

## Lag 3: hvem overvåker overvåkeren?

Når Prometheus eller Zabbix selv går ned, kommer det ingen alarm, bare stillhet. Løsningen er en alarm som alltid er aktiv (en «Watchdog», eller dead man's switch), sendt til en tjeneste utenfor din egen infrastruktur. Hvis meldingene slutter å komme, er det den eksterne tjenesten som varsler.

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

Tjenesten er satt til å varsle etter for eksempel fem minutter uten ping. Det er den eneste delen som ikke deler skjebne med resten av kjeden.

## Lag 4: de som har privilegier

Selv med logg og SIEM finnes det kontoer som kan alt. Tre ting gjør dem mindre farlige:

- **Tilgang etter behov.** Hemmeligheter og rotpålogging hentes midlertidig (Vault, PAM) i stedet for å ligge permanent hos personen. Alt som utstedes, logges av systemet som utsteder.
- **Break-glass.** Én nødkonto med lang, oppbevart passord, og en alarm som går av ved enhver bruk. Den skal være bråkete med vilje.
- **Fire øyne på endringer.** Når infrastruktur settes opp som kode, er pull request med godkjenning og beskyttet gren den andre personen. Da blir pipelinen selv en privilegert aktør som må vokte og voktes: hvem kan endre den, og hvor ligger tokenet?

## Kjeden slutter et sted

Hvert lag flytter tilliten, det fjerner den ikke. Til slutt står du igjen med noe du må stole på: en uavhengig revisjon, en kopi av loggene på lagring som ikke kan overskrives, et menneske utenfor teamet som ser på resultatene. Det er ikke en svakhet, men det er verdt å vite hvor det stoppet.

I et lite miljø, der én person er både administrator og SOC, får du ikke full rollefordeling. Det du kan gjøre, er å legge siste ledd utenfor deg selv: logger sendt til en tredjepart, en ekstern heartbeat og en fast tid i kalenderen der noen andre leser sammendraget.

## Sjekkliste

1. Loggen forlater maskinen i sanntid, og administratoren kan ikke slette den andre enden.
2. Den som vokter, er en annen enn den som blir voktet.
3. Stillhet utløser alarm: en alltid-aktiv melding sjekkes utenfra.
4. Privilegert bruk støyer med vilje, og break-glass varsler hver gang.
5. Det er testet: tøm loggen på en testmaskin og mål hvor lang tid det går før noen merker det.
