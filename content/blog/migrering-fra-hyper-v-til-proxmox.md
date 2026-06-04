---
title: "Fra Hyper-V til Proxmox: hva jeg lærte av migreringen"
description: "Erfaringer fra en virtualiseringsmigrering fra Hyper-V til Proxmox VE — planlegging, gjennomføring, fallgruver, og resultater som lavere lisenskostnader og bedre skalerbarhet."
date: "2026-02-10"
tags: ["Proxmox", "Hyper-V", "Virtualisering", "DevOps"]
---

Da jeg jobbet med drift av en intern virtualiseringsplattform, sto vi overfor et
velkjent valg: fortsette å betale for lisenser, eller flytte over til en åpen
løsning. Vi valgte å migrere fra Hyper-V til **Proxmox VE**. Her er det viktigste
jeg lærte underveis.

## Hvorfor migrere?

Det var tre hovedgrunner:

- **Lisenskostnader.** Proxmox VE er åpen kildekode, og man betaler kun for en
  valgfri støtteavtale. For et miljø med mange verter utgjør dette mye.
- **Skalerbarhet.** Innebygd støtte for clustering og live-migrering uten
  ekstra lisenser gjorde det enklere å vokse.
- **Fleksibilitet.** KVM og LXC i samme grensesnitt, med et REST-API som er
  enkelt å automatisere mot.

## Planlegging

Det viktigste arbeidet skjer før selve migreringen:

1. Kartlegg alle virtuelle maskiner: ressursbruk, avhengigheter og oppetidskrav.
2. Sett opp Proxmox-verten med riktig lagring (jeg brukte ZFS for snapshots og
   integritet).
3. Lag en rekkefølge — start med ikke-kritiske maskiner for å verifisere
   prosessen.
4. Ha en rollback-plan. Ikke slett kilden før den nye maskinen er verifisert.

## Selve migreringen

Hyper-V bruker VHDX-disker, mens Proxmox foretrekker qcow2. Konverteringen er
rett frem:

```bash
# Konverter Hyper-V-disk (VHDX) til qcow2
qemu-img convert -O qcow2 vm-disk.vhdx vm-disk.qcow2

# Importer disken til en Proxmox-VM (her med ID 100)
qm importdisk 100 vm-disk.qcow2 local-lvm
```

Etter import knytter du disken til maskinen i Proxmox-grensesnittet, setter
oppstartsrekkefølge, og starter den i et isolert nettverk for testing først.

## Fallgruver

- **VirtIO-drivere.** Windows-gjester trenger VirtIO-drivere for disk og nettverk
  for å yte godt. Installer dem *før* du skrur av Hyper-V Integration Services.
- **Statiske IP-er.** Nettverkskortet endrer seg, så statiske konfigurasjoner må
  ofte settes på nytt.
- **Tidssynkronisering.** Pass på at NTP er riktig satt opp på den nye verten.

## Resultater

Etter migreringen satt vi igjen med **lavere lisenskostnader** og en plattform
som var **enklere å skalere**. Automatisering mot Proxmox-API-et gjorde at vi
kunne provisjonere nye maskiner raskere enn før.

## Oppsummering

En migrering som dette handler mindre om kommandoene og mer om planlegging,
testing og en trygg rollback-plan. Tar du det stegvis, er Proxmox et solid og
kostnadseffektivt alternativ til Hyper-V.
