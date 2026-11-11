---
title: "Hvem vokter vokterne? Tilsyn i IT-infrastruktur"
description: "Alt som kan beskytte et system, kan også blinde det. Fire lag med tilsyn, slik at ingen vokter må stoles på alene."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
draft: true
---

«Vi har satt opp overvåking» er en trøst, ikke en garanti. Hvert verktøy og hver administrator som har makt til å beskytte et system, har også makt til å blinde det, ødelegge det eller skjule hva som skjedde. Sikkerhet handler mindre om å finne en ufeilbarlig vokter enn om å bygge en kjede der ingen enkelt vokter må stoles på alene.

## Å flytte risikoen

Når du gir en administrator full tilgang til å reparere servere, eller installerer en agent som skal oppdage inntrengere, løser du ett problem og skaper et annet. Vokteren blir det mest verdifulle målet i rommet.

En ny vokter over den første flytter bare spørsmålet ett trinn opp. Hvis du ikke bestemmer hvordan kjeden fungerer, og hvor den slutter, ender du med en haug verktøy som alle har den samme svake siden.

Tre spørsmål er verdt å stille før du stoler på en kontroll:

1. Kan den som blir overvåket, slette sporet etter det vedkommende gjorde?
2. Hvis selve alarmsystemet dør eller kuttes av, hvilken lyd lager det da?
3. Hva skjer når kontoen som er ment for nødsituasjoner, brukes en rolig tirsdag?

Svarene avgjør om du har ekte tilsyn eller bare nok et enkelt feilpunkt.

## Fire lag med tilsyn

I stedet for å stable voktere i det uendelige deler du tilsynet i fire oppgaver: å skrive sporet, å se på sporet, å se på alarmen og å holde nøklene. Hvert lag kontrollerer det under seg over en grense som bare virker én vei.

| Lag | Spørsmålet | Typisk svikt | Det som vokter det |
| --- | --- | --- | --- |
| 1 Sporet | Ble handlingen skrevet ned? | Lokale logger redigeres eller slettes | Videresending én vei, med en gang linjen er skrevet |
| 2 Observatøren | Så noen sporet? | Revisjon slås av, eller strømmen drepes | En ekstern samler som varsler om tukling og om stillhet |
| 3 Alarmen | Er vokteren fortsatt våken? | Overvåkeren krasjer, mister lagring eller blir avskåret | Kontinuerlig puls til en ekstern mottaker |
| 4 Nøklene | Hvem kan endre lagene over? | Én kompromittert superbruker slår av hele kjeden | Midlertidige rettigheter, to par øyne og en bråkete reservenøkkel |

Det som får lagene til å holde, er skilte skjebner. Hvis systemet som samler loggene deler passord, maskinvare eller nettverksveier med serverne det overvåker, tar én feil ned begge samtidig.

### Lag 1: sporet

En logg som blir liggende på maskinen den beskriver, er bare en dagbok. Alle med full tilgang på maskinen kan skrive den om eller slette den i etterkant.

For at et spor skal telle som bevis, må det forlate verten i det øyeblikket det skrives, over en grense som bare virker én vei. Kildemaskinen kan legge til nye linjer, men den må ikke kunne lese tilbake, endre eller slette det som allerede har krysset grensen. Selv om maskinen blir helt overtatt fem sekunder senere, er sporet fram til da utenfor rekkevidde.

### Lag 2: observatøren

Å flytte loggene bort fra maskinen beskytter fortiden, men ikke de neste ti minuttene. En inntrenger med full tilgang trenger ikke slette gamle spor hvis vedkommende bare kan stoppe at nye blir laget.

Å tømme en logg setter et tydelig merke, så en forsiktig angriper endrer heller revisjonsreglene slik at visse handlinger overses, eller dreper prosessen som sender loggene bort. Da kommer det ingen feilmelding hos mottakeren, bare et hull.

Observatøren på den andre siden av grensen må derfor passe på to ting samtidig: åpenbare tegn på at revisjonen er rørt, og en vert som plutselig blir stille.

| Hva observatøren ser | Hva det betyr | Se her |
| --- | --- | --- |
| Loggen ble tømt | Noen prøvde å utslette sporet | Verten, med en gang; anta full kompromittering |
| Revisjonsregler endret | Noen blinder opptakeren før de handler | Nylig bruk av privilegier på verten |
| Loggstrømmen stopper | Verten er nede, avskåret, eller avsenderen ble drept | Nettverksveien først, så loggprosessen |
| Godkjenningsregler omgått | En privilegert bruker endret rekkverket for seg selv | Kontrollplanet og innstillingene i repoet, lag 4 |

### Lag 3: hvem overvåker overvåkeren?

Lag 2 passer på vertene: at de ikke blir stille og ikke blinder sporet. Lag 3 passer på selve samlesentralen. Loggstrømmen er nå beskyttet mot verten, men hva beskytter systemet som samler loggene, og alarmene som bygger på det, mot full disk, død database eller brutt forbindelse?

Et alarmsystem som aldri ringer, forteller deg ingenting. Alt kan være i orden, eller overvåkeren kan ha krasjet, fylt disken eller blitt stengt ute av en brannmur for tre dager siden.

Løsningen er å snu signalet. I stedet for å vente på en melding om at noe er ødelagt, venter en uavhengig tjeneste utenfor infrastrukturen din på en jevn puls som sier at overvåkeren lever og kan snakke.

For at pulsen skal bevise noe, må den gå gjennom hele kjeden: utløst inne i overvåkingsmotoren, sendt gjennom varslingsruteren og levert utenfor. En puls fra et eget tidsskript beviser bare at skriptet virker. Når den ekte pulsen uteblir i noen minutter, slår den eksterne mottakeren alarm. Det er det eneste leddet som ikke deler skjebne med resten av oppsettet.

### Lag 4: de som har nøklene

Selv med logger som går én vei og en ekstern puls må noen administrere samleren, overvåkeren og tilgangsreglene. Hvis én konto kan endre alt på en gang, faller de fire lagene sammen til ett enkelt feilpunkt. Tre grenser holder rettigheter på toppnivå i sjakk:

- **Lånt tid.** Ingen har permanent full tilgang til daglig arbeid. Høye rettigheter sjekkes ut til en bestemt oppgave og utløper av seg selv, og selve lånet registreres før økten starter.
- **To par øyne.** Den som foreslår en endring i kritisk infrastruktur, eller i pipelinen som ruller den ut, kan ikke være den som godkjenner den. Og fordi en administrator kan ha rett til å slå av tomannsregelen i ti sekunder, må enhver endring i godkjenningsreglene selv utløse et umiddelbart varsel i lag 2.
- **En bråkete reservenøkkel.** Ethvert system trenger en nødkonto for når vanlige innloggingssystemer er nede. Den nøkkelen holdes innelåst, brukes aldri til rutinearbeid og utløser en øyeblikkelig alarm over en uavhengig kanal i det den berøres. Alarmen må aldri blokkere innloggingen eller være avhengig av innloggingssystemer som kan være nede, ellers er nøkkelen ubrukelig i akkurat det avbruddet den finnes for, og ingeniører i panikk lærer seg å slå den av. Oppgaven er å bråke i etterkant, så teamet vet at nødnøkkelen ble brukt klokken 03:15, av denne personen, fra dette stedet.

## Samme brudd, to oppsett

Anta at en administrators laptop blir kompromittert en tirsdagskveld, slik at inntrengeren får samme rekkevidde som administratoren.

I et flatt oppsett har administratoren permanente nøkler både til serverne og til overvåkingssystemet, av bekvemmelighet. Inntrengeren logger inn, setter varslene på pause, kjører nyttelasten sin, sletter de lokale loggene og tømmer sikkerhetskopiene. Onsdag morgen er alle dashbord fortsatt grønne.

Med de fire lagene på plass treffer den samme stjålne laptopen en grense i hvert trinn:

- Det finnes ingen permanente nøkler på maskinen. Å heve rettighetene krever en ny forespørsel som logges utenfor verten før tilgangen gis.
- Selv om inntrengeren kommer seg inn på en server og dreper logg-avsenderen, er alt fram til det sekundet allerede lagret på den andre siden av en enveisgrense, og den plutselige stillheten varsler samleren.
- Hvis vedkommende prøver å tie overvåkeren selv, stopper den eksterne pulsen, og mottakeren utenfor tilkaller teamet.
- Hvis vedkommende strekker seg etter nødkontoen, utløses reservenøkkelalarmen før den første kommandoen er kjørt.

Bruddet skjer fortsatt, men det kan ikke skjule seg.

## Kjeden slutter et sted

Hvert lag flytter tillit, ingen fjerner den. Du kan ikke bygge et uendelig tårn av voktere som vokter voktere. Ved enden av kjeden står noe du rett og slett velger å stole på: lagring som fysisk nekter overskriving i en fastsatt periode, en ekstern pulsmottaker, eller et menneske utenfor den daglige driften som leser sporet. Det er ikke en svakhet i designet, det er ankeret. Målet er å vite hvor ankeret sitter, og å sørge for at ingen enkeltfeil kan nå det.

I et lite miljø, der én person driver både serverne og sikkerheten, kan du ikke fordele rollene mellom mennesker. Du kan likevel fordele dem over grenser: send loggene dit den daglige kontoen din ikke kan slette dem, legg pulsen utenfor, og sett en fast tid i kalenderen der noen andre leser sammendraget.

## Prinsipper

1. **Bevis går én vei.** En maskin kan legge til i sporet, men ikke redigere eller slette det den allerede har sendt.
2. **Vokteren bor utenfor den voktede.** Samleren og alarmen deler ikke legitimasjon, nettverksskjebne eller maskinvare med maskinene de vokter.
3. **Stillhet er en feil, ikke fred.** Både en stille server og en stille overvåker slår alarm når pulsen deres uteblir.
4. **Makt leies, eies aldri.** Rutinearbeid bruker minimale rettigheter. Full tilgang er midlertidig og logget, og for nødnøkler høylytt med vilje.
5. **Test alarmen, ikke konfigurasjonen.** Stopp loggstrømmen på en testmaskin, blokker overvåkerens puls, og ta tiden to ganger: hvor lenge til den eksterne mottakeren slår alarm, og hvor lenge til et menneske handler på den. Det første er tidsavbruddet du selv har satt, det andre er det som faktisk beskytter deg.

Verktøy og plattformer skifter med noen års mellomrom. Tillitens geometri gjør ikke det.
