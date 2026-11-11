---
title: "Hvem vokter vokterne? Tilsyn i IT-infrastruktur"
description: "Alt som kan beskytte et system, kan også blinde det. Fire lag med tilsyn, slik at ingen vokter må stoles på alene."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
draft: true
---

«Vi har satt opp overvåking» er en trøst, ikke en garanti. Hvert verktøy og hver administrator som har makt til å beskytte et system, har også makt til å blinde det, ødelegge det eller skjule hva som skjedde. Sikkerhet handler mindre om å finne en ufeilbarlig vokter enn om å bygge en kjede der ingen enkelt vokter må stoles på alene.

## Å flytte risikoen

Når du gir en administrator full tilgang til å reparere servere, eller installerer en agent som skal oppdage inntrengere, løser du ett problem og skaper et annet. Vokteren blir det mest verdifulle målet i rommet. Og vokteren trenger ikke være et menneske: en tjenestekonto, en pipeline som ruller ut endringer eller en KI-agent med brede rettigheter er også en vokter, og alt som står under, gjelder for den på samme måte.

En ny vokter over den første flytter bare spørsmålet ett trinn opp. Hvis du ikke bestemmer hvordan kjeden fungerer, og hvor den slutter, ender du med en haug verktøy som alle har den samme svake siden.

Tre spørsmål er verdt å stille før du stoler på en kontroll:

1. Kan den som blir overvåket, slette sporet etter det vedkommende gjorde?
2. Hvis selve alarmsystemet dør eller kuttes av, hvilken lyd lager det da?
3. Hva skjer når kontoen som er ment for nødsituasjoner, brukes en rolig tirsdag?

Svarene avgjør om du har ekte tilsyn eller bare nok et enkelt feilpunkt.

## Fire lag med tilsyn

I stedet for å stable voktere i det uendelige deler du tilsynet i fire oppgaver: å skrive sporet, å se på sporet, å se på alarmen og å holde nøklene. Fire, fordi det finnes fire forskjellige måter å sette tilsynet ut av spill på: ødelegge beviset, blinde leseren, stilne alarmen eller ta nøklene. En femte vokter ville ikke tilføre noe med mindre den lukket en femte måte å svikte på. Lag 2 og 3 passer hvert på laget før seg, over en grense den voktede siden ikke kan krysse tilbake. Lag 1 produserer beviset, og lag 4 er annerledes: det avgjør hvem som får endre de tre andre.

| Lag | Spørsmålet | Typisk svikt | Det som vokter det |
| --- | --- | --- | --- |
| 1 Sporet | Ble handlingen skrevet ned? | Lokale logger redigeres eller slettes | Videresending én vei, med en gang linjen er skrevet |
| 2 Observatøren | Så noen sporet? | Revisjon slås av, eller strømmen drepes | En egen samler som varsler om tukling og om stillhet |
| 3 Alarmen | Er vokteren fortsatt våken? | Overvåkeren krasjer, mister lagring eller blir avskåret | Kontinuerlig puls til en ekstern mottaker |
| 4 Nøklene | Hvem kan endre lag 1–3? | Én kompromittert superbruker slår av hele kjeden | Midlertidige rettigheter, to par øyne og en bråkete reservenøkkel |

Det som får lagene til å holde, er skilte skjebner, eller med ingeniørord uavhengige feildomener. Hvis systemet som samler loggene deler passord, maskinvare eller nettverksveier med serverne det overvåker, tar én feil ned begge samtidig.

### Lag 1: sporet

En logg som blir liggende på maskinen den beskriver, er bare en dagbok. Alle med full tilgang på maskinen kan skrive den om eller slette den i etterkant. Og «maskinen» er enhver kilde til spor: en server, kontrollplanet i en skykonto, en identitetsleverandør, et kodelager. Den som administrerer kilden, kan få den til å tie.

For at et spor skal telle som bevis, må det forlate verten i det øyeblikket det skrives, over en grense som bare virker én vei. Kildemaskinen kan legge til nye linjer, men den må ikke kunne lese tilbake, endre eller slette det som allerede har krysset grensen. Selv om maskinen blir helt overtatt fem sekunder senere, er alt som var levert før det øyeblikket utenfor rekkevidde. Hold vinduet mellom skriving og levering så kort du kan.

Hos mottakeren forsegles det som kommer inn, med en signatur eller en hash-kjede, slik at en senere endring av et lagret spor kan oppdages, og lageret ligger i et eget miljø, adskilt fra systemene det registrerer.

### Lag 2: observatøren

Å flytte loggene bort fra maskinen beskytter fortiden, men ikke de neste ti minuttene. En inntrenger med full tilgang trenger ikke slette gamle spor hvis vedkommende bare kan stoppe at nye blir laget.

Å tømme en logg setter et tydelig merke, så en forsiktig angriper endrer heller revisjonsreglene slik at visse handlinger overses, eller dreper prosessen som sender loggene bort. Da kommer det ingen feilmelding hos mottakeren, bare et hull.

Observatøren på den andre siden av grensen må derfor passe på to ting samtidig: åpenbare tegn på at revisjonen er rørt, og en vert som plutselig blir stille.

En stille vert er ikke uten videre en ødelagt vert, så stillhet trenger et utgangspunkt: hver kilde sender et jevnt slag gjennom den samme kanalen, og observatøren varsler når et slag uteblir. Der slag ikke er mulig, send en testhendelse på fast tid og sjekk at den kommer fram.

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

For at pulsen skal bevise noe, må den gå gjennom hele kjeden: utløst inne i overvåkingsmotoren, sendt gjennom varslingsruteren og levert utenfor. En puls fra et eget tidsskript beviser bare at skriptet virker. Når den ekte pulsen uteblir i noen minutter, slår den eksterne mottakeren alarm. Det er det eneste leddet som ikke deler skjebne med resten av oppsettet. Pulsen beviser at alarmveien lever. Den beviser ikke at overvåkeren fortsatt ser vertene; det er slagene i lag 2 til for. Sammen dekker de hele veien fra vert til menneske.

### Lag 4: de som har nøklene

Selv med logger som går én vei og en ekstern puls må noen administrere samleren, overvåkeren og tilgangsreglene. Hvis én konto kan endre alt på en gang, faller de fire lagene sammen til ett enkelt feilpunkt. Tre grenser holder rettigheter på toppnivå i sjakk:

- **Lånt tid.** Ingen har permanent full tilgang til daglig arbeid (ingen stående privilegier). Høye rettigheter sjekkes ut akkurat i tide til en bestemt oppgave og utløper av seg selv, og selve lånet registreres før økten starter.
- **To par øyne.** Den som foreslår en endring i kritisk infrastruktur, eller i pipelinen som ruller den ut, kan ikke være den som godkjenner den (fireøyeprinsippet). Og fordi en administrator kan ha rett til å slå av tomannsregelen i ti sekunder, må enhver endring i godkjenningsreglene selv utløse et umiddelbart varsel i lag 2.
- **En bråkete reservenøkkel** (break-glass-konto). Ethvert system trenger en nødkonto for når vanlige innloggingssystemer er nede. Den må ikke avhenge av de systemene, og det er hele poenget. Nøkkelen holdes innelåst, brukes aldri til rutinearbeid og utløser en øyeblikkelig alarm over en uavhengig kanal i det den brukes. Alarmen må aldri blokkere innloggingen eller trenge innloggingssystemer som kan være nede, ellers er nøkkelen ubrukelig i akkurat det avbruddet den finnes for, og ingeniører i panikk lærer seg å slå den av. Oppgaven er ikke å stoppe innloggingen, men å melde fra med en gang: nødnøkkelen ble brukt klokken 03:15, av denne personen, fra dette stedet. Test nøkkelen på fast tid, for en nøkkel ingen har prøvd, åpner kanskje ingenting, og gå gjennom hver bruk i etterkant.

## Samme brudd, to oppsett

Anta at en administrators laptop blir kompromittert en tirsdagskveld, slik at inntrengeren får samme rekkevidde som administratoren.

I et flatt oppsett har administratoren permanente nøkler både til serverne og til overvåkingssystemet, av bekvemmelighet. Inntrengeren logger inn, setter varslene på pause, kjører nyttelasten sin, sletter de lokale loggene og tømmer sikkerhetskopiene. Onsdag morgen er alle dashbord fortsatt grønne.

Med de fire lagene på plass treffer den samme stjålne laptopen en grense i hvert trinn:

- Det finnes ingen permanente nøkler på maskinen. Å heve rettighetene krever en ny forespørsel som logges utenfor verten før tilgangen gis, og for de høyeste rettighetene må en annen person godkjenne den. En forespørsel til en uvanlig tid når den personen som et spørsmål, ikke som en formalitet.
- Selv om inntrengeren kommer seg inn på en server og dreper logg-avsenderen, er alt som var levert fram til det sekundet allerede lagret på den andre siden av en enveisgrense, og den plutselige stillheten varsler samleren.
- Hvis vedkommende prøver å tie overvåkeren selv, stopper den eksterne pulsen, og mottakeren utenfor tilkaller teamet.
- Hvis vedkommende strekker seg etter nødkontoen, utløses reservenøkkelalarmen ved innloggingen, før den første kommandoen er kjørt.

Bruddet skjer fortsatt, men det kan ikke skjule seg.

## Kjeden slutter et sted

Hvert lag flytter tillit, ingen fjerner den. Du kan ikke bygge et uendelig tårn av voktere som vokter voktere. Ved enden av kjeden står noe du rett og slett velger å stole på: lagring som nekter overskriving og sletting i en fastsatt periode, selv overfor sine egne administratorer, en ekstern pulsmottaker, eller et menneske utenfor den daglige driften som leser sporet. Det er ikke en svakhet i designet, det er ankeret. Målet er å vite hvor ankeret sitter, og å sørge for at ingen enkeltfeil kan nå det.

I et lite miljø, der én person driver både serverne og sikkerheten, kan du ikke fordele rollene mellom mennesker. Du kan likevel fordele dem over grenser: send loggene dit den daglige kontoen din ikke kan slette dem, legg pulsen utenfor, og sett en fast tid i kalenderen der noen andre leser sammendraget.

## Prinsipper

1. **Bevis går én vei.** En maskin kan legge til i sporet, men ikke redigere eller slette det den allerede har sendt.
2. **Vokteren bor utenfor den voktede.** Samleren og alarmen deler ikke legitimasjon, nettverksskjebne eller maskinvare med maskinene de vokter.
3. **Stillhet er en feil, ikke fred.** Både en stille server og en stille overvåker slår alarm når pulsen deres uteblir.
4. **Makt leies, eies aldri.** Rutinearbeid bruker minimale rettigheter. Full tilgang er midlertidig og logget, og for nødnøkler høylytt med vilje.
5. **Test alarmen, ikke konfigurasjonen.** Stopp loggstrømmen på en testmaskin, blokker overvåkerens puls, og ta tiden to ganger: hvor lenge til den eksterne mottakeren slår alarm, og hvor lenge til et menneske handler på den. Det første er tidsavbruddet du selv har satt, det andre er det som faktisk beskytter deg. Gjenta det på fast tid: en alarm ingen har utløst med vilje, er som en sikkerhetskopi ingen har gjenopprettet.

Verktøy og plattformer skifter med noen års mellomrom. Tillitens geometri gjør ikke det.
