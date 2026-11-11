---
title: "Hvem vokter vokterne? Tilsyn i IT-infrastruktur"
description: "Alt som kan beskytte et system, kan også blinde det: administratorer, agenter, overvåkingsverktøy. Fire lag med tilsyn, fra enveislogger til ekstern puls."
date: "2026-11-11"
tags: ["Sikkerhet", "SOC"]
draft: true
---

«Vi har satt opp overvåking» er en trøst, ikke en garanti. Hvert verktøy, hver administrator og hver autonom agent som har makt til å beskytte et system, har også makt til å blinde det, ødelegge det eller skjule hva som skjedde. Sikkerhet handler mindre om å finne en ufeilbarlig vokter enn om å bygge en kjede der ingen enkelt vokter må stoles på alene.

## Å flytte risikoen

Når du gir en administrator full tilgang til å reparere servere, installerer en agent som skal oppdage inntrengere, eller lar en autonom KI-tjeneste styre infrastrukturen, løser du ett problem og skaper et annet. Vokteren blir det mest verdifulle målet i rommet.

En ny vokter over den første flytter bare spørsmålet ett trinn opp. Hvis du ikke bestemmer hvordan kjeden fungerer, og hvor den slutter, ender du med en haug verktøy som alle har den samme svake siden.

Fire spørsmål er verdt å stille før du stoler på en kontroll:

1. Kan den som blir overvåket, enten det er et menneske, en maskin eller en agent, slette sporet etter sine egne handlinger?
2. Hvis selve alarmsystemet dør eller kuttes av, hvilken lyd lager det da?
3. Har hver ikke-menneskelig identitet (tjenestekonto, token, nøkkel, agent) en navngitt menneskelig eier og en utløpsdato?
4. Hva skjer når kontoen som er ment for nødsituasjoner, brukes en rolig tirsdag?

Svarene avgjør om du har ekte tilsyn eller bare nok et enkelt feilpunkt.

## Fire lag med tilsyn

I stedet for å stable voktere i det uendelige deler du tilsynet i fire oppgaver: å skrive sporet, å se på sporet, å se på alarmen og å holde nøklene. Fire, fordi det finnes fire hovedmåter å sette tilsynet ut av spill på: ødelegge eller forfalske beviset, blinde eller snike seg forbi leseren, stilne alarmen eller ta nøklene. En femte vokter ville ikke tilføre noe med mindre den lukket en femte måte å svikte på. Lag 2 og 3 passer hvert på laget før seg, over en grense den voktede siden ikke kan krysse tilbake. Lag 1 produserer beviset, og lag 4 er annerledes: det avgjør hvem som får endre de tre andre.

![Tilsynskjeden, ovenfra og ned. Servere, sky og identitet (lag 1, sporet) antas å kunne bli overtatt. Sporene og slagene deres krysser en enveisgrense til en egen samler (lag 2, observatøren). Derfra går en jevn puls til to eksterne mottakere hos ulike leverandører (lag 3, alarmen), som varsler et menneske på egen kanal. Nederst avgjør lag 4, nøklene, hvem som får endre lag 1 til 3: lånt tid, to par øyne og en bråkete reservenøkkel.](/images/hvem-vokter-vokterne-i-it-infrastruktur/tilsynskjeden.svg)

| Lag og spørsmålet | Typisk svikt | Det som vokter det |
| --- | --- | --- |
| 1 Sporet: ble handlingen skrevet ned? | Lokale logger redigeres, eller koden som skriver dem, er ikke den du godkjente | Videresending én vei, forseglet lagring og signerte bygg |
| 2 Observatøren: så noen sporet? | Revisjon slås av, strømmen drepes, eller en gyldig legitimasjon opptrer utenfor mønsteret | En egen samler som varsler om tukling, stillhet og atferd utenfor mønsteret |
| 3 Alarmen: er vokteren fortsatt våken? | Overvåkeren eller varslingsveien krasjer, mister lagring eller blir avskåret | Kontinuerlig puls til en ekstern mottaker |
| 4 Nøklene: hvem kan endre lag 1–3? | Permanente nøkler uten eier, eller én kompromittert superbruker som slår av hele kjeden | Midlertidig omfang, navngitte eiere, tomannsgodkjenning og en bråkete reservenøkkel |

Det som får lagene til å holde, er skilte skjebner, eller med ingeniørord uavhengige feildomener. Hvis systemet som samler loggene deler passord, maskinvare eller nettverksveier med serverne det overvåker, tar én feil ned begge samtidig.

### Lag 1: sporet

En logg som blir liggende på maskinen den beskriver, er bare en dagbok. Alle med full tilgang på maskinen kan skrive den om eller slette den i etterkant. Og «maskinen» er enhver kilde til spor: en server, kontrollplanet i en skykonto, en identitetsleverandør, et kodelager. Den som administrerer kilden, kan få den til å tie.

For at et spor skal telle som bevis, må det forlate verten i det øyeblikket det skrives, over en grense som bare virker én vei. Kildemaskinen kan legge til nye linjer, men den må ikke kunne lese tilbake, endre eller slette det som allerede har krysset grensen. Selv om maskinen blir helt overtatt fem sekunder senere, er alt som var levert før det øyeblikket utenfor rekkevidde. Hold vinduet mellom skriving og levering så kort du kan.

Ta bare imot spor over en autentisert kanal, slik at én vert ikke kan skrive i en annens navn, og stemple hvert spor med samlerens egen klokke, for en kompromittert vert kan lyve om tiden. Forsegl det som kommer inn, med en signatur eller en hash-kjede, og hold nøkkelen eller den siste hashen utenfor rekkevidden til lagerets egne administratorer: en kjede de kan bygge på nytt, beviser ingenting. Lageret ligger i et eget miljø, adskilt fra systemene det registrerer. Gi hver kilde en kvote, slik at en kompromittert vert ikke kan oversvømme lageret og presse beviset ut, og behandle en kilde som når kvoten, som en alarm, ikke som støy. Hold sporet rikt nok og langt nok til å svare på spørsmål du ikke så komme: alarmene dekker dem du så komme, og innbrudd oppdages ofte sent. Logger om mennesker er personopplysninger, så bestem hva du samler, hvorfor, hvem som kan lese det og hvor lenge det lagres, og si fra til dem det gjelder.

Et spor er også bare så ærlig som det som skriver det. Hvis en angriper tukler med koden før den rulles ut, vil loggene trofast registrere hva et ondsinnet program gjør. Tilliten må derfor rekke tilbake til byggingen: signer det du ruller ut, registrer hvordan det ble bygget, og kontroller signaturen ved utrulling og, der du kan, mens det kjører. En liste over ingredienser (en SBOM) er en oversikt, ikke et bevis. Og en signatur viser hvor en artefakt kommer fra, ikke at den er harmløs, så byggesystemet og signeringsnøklene er også voktere, og hører inn under lag 4.

En agent legger til en vri til: den kan skrive sin egen historie. For en agent er sporet det som krysset grensen dens, altså forespørsler, verktøykall, argumenter og godkjenninger, fanget der agenten ikke kan redigere dem. Agentens egen forklaring på hvorfor den handlet, er en påstand, ikke et bevis.

### Lag 2: observatøren

Å flytte loggene bort fra maskinen beskytter fortiden, men ikke de neste ti minuttene. En inntrenger med full tilgang trenger ikke slette gamle spor hvis vedkommende bare kan stoppe at nye blir laget.

Å tømme en logg setter et tydelig merke, så en forsiktig angriper endrer heller revisjonsreglene slik at visse handlinger overses, eller dreper prosessen som sender loggene bort. Da kommer det ingen feilmelding hos mottakeren, bare et hull. Den stilleste inntrengeren endrer ingenting i det hele tatt: vedkommende bruker en gyldig legitimasjon, og det eneste sporet er atferd utenfor mønsteret. Det samme gjelder en tjeneste eller en agent som handler utenfor sitt erklærte formål.

Observatøren på den andre siden av grensen må derfor passe på tre ting samtidig: åpenbare tegn på at revisjonen er rørt, en kilde som plutselig blir stille, og en gyldig identitet som handler utenfor mønsteret.

En stille vert er ikke uten videre en ødelagt vert, så stillhet trenger en rytme å bryte: hver kilde, enten det er en vert, en tjeneste eller en agent, sender et jevnt slag gjennom den samme kanalen, og observatøren varsler når et slag uteblir. Der slag ikke er mulig, send en testhendelse på fast tid og sjekk at den kommer fram. Utenfor mønsteret krever også et mønster: hold et normalbilde av hva hver identitet vanligvis gjør, og følg de privilegerte tettest.

Et slag beviser at en kilde lever, ikke at den er ærlig. En dypt kompromittert vert kan fortsette å slå mens den skjuler hva den gjør, så behandle verten som ett vitne og kontroller den mot vitner den ikke styrer: nettverket, skyens kontrollplan eller hypervisoren, identitetsleverandøren. Når to vitner er uenige, tro på det verten ikke kan røre.

| Hva observatøren ser | Hva det betyr | Se her |
| --- | --- | --- |
| Loggen ble tømt | Noen prøvde å utslette sporet | Verten, med en gang; anta full kompromittering |
| Revisjonsregler endret | Noen blinder opptakeren før de handler | Nylig bruk av privilegier på verten |
| En gyldig identitet handler utenfor mønsteret | En stjålet legitimasjon, eller en tjeneste eller agent som handler utenfor sitt erklærte område | Identitetens normalbilde, dens eier og eventuell godkjent endring |
| Loggstrømmen stopper | Verten er nede, avskåret, eller avsenderen ble drept | Et vitne verten ikke styrer (nettverk, hypervisor) først, så loggprosessen |
| To vitner er uenige | Verten skjuler noe, eller ett vitne er ødelagt | Vitnet verten ikke kan røre: nettverket, kontrollplanet, identitetsleverandøren |
| Godkjenningsregler omgått | En privilegert bruker endret rekkverket for seg selv | Kontrollplanet og innstillingene i repoet, lag 4 |

### Lag 3: hvem overvåker overvåkeren?

Lag 2 passer på kildene: at de ikke blir stille og ikke blinder sporet. Lag 3 passer på selve samlesentralen. Loggstrømmen er nå beskyttet mot verten, men hva beskytter systemet som samler loggene, og alarmene som bygger på det, mot full disk, død database eller brutt forbindelse?

Et alarmsystem som aldri ringer, forteller deg ingenting. Alt kan være i orden, eller overvåkeren kan ha krasjet, fylt disken eller blitt stengt ute av en brannmur for tre dager siden.

Løsningen er å snu signalet, som i en «dead man's switch». I stedet for å vente på en melding om at noe er ødelagt, venter en uavhengig tjeneste utenfor infrastrukturen din på en jevn puls som sier at overvåkeren lever og kan snakke.

For at pulsen skal bevise noe, må den gå gjennom hele kjeden: utløst inne i overvåkingsmotoren, sendt gjennom varslingsruteren og levert utenfor. En puls fra et eget tidsskript beviser bare at skriptet virker. Når den ekte pulsen uteblir i noen minutter, slår den eksterne mottakeren alarm. Det er det eneste leddet som ikke deler skjebne med resten av oppsettet, og alarmen det slår, må nå et menneske over en vei som ikke avhenger av infrastrukturen det overvåker: egen legitimasjon, eget nett, ikke firmaets e-post som kanskje er nede. Pulsen beviser at alarmveien lever. Den beviser ikke at overvåkeren fortsatt ser kildene sine; det er slagene i lag 2 til for. Sammen dekker de hele veien fra kilde til menneske.

Ingen av dem beviser at reglene er intakte. En inntrenger som når overvåkeren, demper heller én alarm eller legger inn en pause enn å drepe det hele, og pulsen fortsetter å komme. Derfor er hver endring i alarmregler og pauser selv en hendelse for lag 2, og overvåkerens konfigurasjon hører inn under lag 4 som alle andre nøkler.

### Lag 4: de som har nøklene

Selv med logger som går én vei og en ekstern puls må noen administrere samleren, overvåkeren og tilgangsreglene, og i dag er det ofte ikke et menneske. Tjenestekontoer, automatisering og agenter er mange ganger flere enn menneskene, og for mange av dem har permanent legitimasjon med for vid tilgang som ingen eier. Hvis én konto kan endre alle lagene på en gang, eller en foreldreløs tjenestekonto går løs, faller de fire lagene sammen til ett enkelt feilpunkt.

Prinsippene er de samme for mennesker og maskiner, mekanismene er ikke det. En maskin kan ikke svare på en andre faktor, så den må bevise identiteten sin med hva den er og hvor den kjører, med kortlevd legitimasjon. Tre grenser holder rettigheter på toppnivå i sjakk:

- **Lånt tid.** Ingen har permanent full tilgang til daglig arbeid (ingen stående privilegier). Høye rettigheter sjekkes ut akkurat i tide til en erklært oppgave, med avgrenset omfang og utløpsdato, og selve lånet registreres før økten starter. Tjenestekontoer og agenter låner på samme måte, og hver har en navngitt menneskelig eier som svarer for livssyklusen og for at tilgangen trekkes tilbake. De vurderes ikke bare etter om nøkkelen er gyldig, men etter om atferden holder seg innenfor formålet de fikk.
- **To par øyne.** Den som foreslår en endring i kritisk infrastruktur, eller i pipelinen som ruller den ut, kan ikke være den som godkjenner den (fireøyeprinsippet). Og fordi en administrator kan ha rett til å slå av tomannsregelen i ti sekunder, må enhver endring i godkjenningsreglene selv utløse et umiddelbart varsel i lag 2.
- **En bråkete reservenøkkel** (break-glass-konto). Ethvert system trenger en nødkonto for når vanlige innloggingssystemer er nede. Den må ikke avhenge av de systemene, og det er hele poenget. Nøkkelen holdes innelåst, brukes aldri til rutinearbeid og utløser en øyeblikkelig alarm over en uavhengig kanal i det den brukes. Alarmen må aldri blokkere innloggingen eller trenge innloggingssystemer som kan være nede, ellers er nøkkelen ubrukelig i akkurat det avbruddet den finnes for, og ingeniører i panikk lærer seg å slå den av. Oppgaven er ikke å stoppe innloggingen, men å melde fra med en gang: nødnøkkelen ble brukt klokken 03:15, av denne personen, fra dette stedet. Test nøkkelen på fast tid, for en nøkkel ingen har prøvd, åpner kanskje ingenting, og gå gjennom hver bruk i etterkant.

## Samme brudd, to oppsett

Anta at en administrators laptop blir kompromittert en tirsdagskveld, slik at inntrengeren får samme rekkevidde som administratoren.

I et flatt oppsett har administratoren permanente nøkler både til serverne og til overvåkingssystemet, av bekvemmelighet. Inntrengeren logger inn, setter varslene på pause, kjører nyttelasten sin, sletter de lokale loggene og tømmer sikkerhetskopiene. Onsdag morgen er alle dashbord fortsatt grønne.

Med de fire lagene på plass treffer den samme stjålne laptopen en grense i hvert trinn:

- Det finnes ingen permanente nøkler på maskinen. Å heve rettighetene krever en ny forespørsel som logges utenfor verten før tilgangen gis, og for de høyeste rettighetene må en annen person godkjenne den. En forespørsel til en uvanlig tid når den personen som et spørsmål, ikke som en formalitet.
- Selv om inntrengeren kommer seg inn på en server og dreper loggavsenderen, er alt som var levert fram til det sekundet allerede lagret på den andre siden av en enveisgrense, og samleren slår alarm på den plutselige stillheten.
- Hvis vedkommende prøver å stilne overvåkeren selv, stopper den eksterne pulsen, og mottakeren utenfor tilkaller teamet; demper vedkommende i stedet én enkelt alarm, er endringen i reglene en alarm i seg selv.
- Hvis vedkommende går løs på sikkerhetskopiene, ligger de bak den samme typen enveisgrense: uforanderlige, i et eget miljø som den stjålne laptopen ikke når.
- Hvis vedkommende strekker seg etter nødkontoen, utløses reservenøkkelalarmen ved innloggingen, før den første kommandoen er kjørt.

Bruddet skjer fortsatt, men det kan ikke skjule seg. Det er det ærlige målet: ikke usårbarhet, men et brudd som er synlig, dyrt og kort.

## Samme form i internettets målestokk

Ingenting av dette er nytt, og det virker i hele nettets målestokk. Sertifikatutstedere (CA-er) er voktere: de går god for hvem som eier et nettsted. Et innbrudd hos en av dem i 2011 førte til Certificate Transparency. I praksis blir hvert offentlig betrodd sertifikat nå publisert i åpne logger som bare kan utvides, og som hvem som helst kan kontrollere. Alle kan drive en overvåker som leter etter sertifikater de ikke ventet, og nettlesere som Chrome og Safari avviser et sertifikat som ikke bærer loggenes signerte løfte om å ta det med. Loggen er lag 1, overvåkerne er lag 2, og nettleserens avvisning er ankeret. Loggen hindrer ikke en CA i å utstede et dårlig sertifikat. Den sørger for at det dårlige sertifikatet ikke kan skjule seg.

## Det som fortsatt svikter

De fire lagene gjør et angrep dyrere og kortere. De gjør det ikke umulig, og hvert lag har sin egen måte å svikte på.

- **Godkjenninger blir stemplet.** En andre person er bare en vokter så lenge vedkommende leser det de godkjenner. Slitne godkjennere stempler, og en angriper kan vente på en ekte administrators forespørsel og ta over økten etter at den er godkjent. Hold volumet lavt, vis godkjenneren hva, hvor og hvorfor, bind den hevede økten til enheten og oppgaven, og følg med på selve godkjenningene: en godkjenner som sier ja til alt på to sekunder, er et funn.
- **Utløp kan henge etter.** En legitimasjon som burde ha utløpt, virker fortsatt hvis tilbaketrekkingen er ødelagt eller ingen følger med, og maskinlegitimasjon er den vanlige synderen. Test tilbaketrekking på fast tid, og varsle når en legitimasjon overlever sin erklærte utløpsdato.
- **Normalbilder kan læres opp.** En identitet som glir av sted i små steg, blir normal, og en detektor som er stilt for stramt, drukner folk i falske alarmer til de slutter å lese. Hold en kort liste over ting som aldri er normale for en identitet, uansett historikk, og hold alarmene så få at et menneske fortsatt leser hver av dem.
- **Kompleksitet er en risiko.** Hvert lag er en ny del som kan svikte, og en ny ting noen må drifte. Foretrekk få, enkle deler, test hver av dem, og fjern et lag du ikke kan teste.

## Kjeden slutter et sted

Hvert lag flytter tillit, ingen fjerner den. Du kan ikke bygge et uendelig tårn av voktere som vokter voktere. Ved enden av kjeden står noe du rett og slett velger å stole på: lagring som nekter overskriving og sletting i en fastsatt periode, selv overfor sine egne administratorer, en ekstern pulsmottaker, eller et menneske utenfor den daglige driften som leser sporet. Det er ikke en svakhet i designet, det er ankeret. Målet er å vite hvor ankeret sitter, og å sørge for at ingen enkeltfeil kan nå det.

Ingen vokter ankeret, og det er med vilje: en vokter over den siste vokteren flytter bare spørsmålet igjen. Du dupliserer ankeret i stedet. To pulsmottakere hos ulike leverandører gjør at ett avbrudd, eller én kapret konto, ikke kan gjøre deg blind, og beviset oppbevares i to adskilte miljøer, så ett tapt eksemplar ikke er slutten.

I et lite miljø, der én person driver både serverne og sikkerheten, kan du ikke fordele det daglige arbeidet mellom mennesker. Du kan likevel fordele dem over grenser: send loggene dit den daglige kontoen din ikke kan slette dem, legg pulsen utenfor, og sett en fast tid i kalenderen der en annen person, gjerne en utenforstående, leser sammendraget. Vær ærlig om hva det gir. De to første virker av seg selv, enten noen ser på eller ikke. Kalenderplassen er bare en lindring: med en ukentlig gjennomgang er oppdagelsesvinduet en uke, ikke minutter.

## Prinsipper

1. **Bevis går én vei.** En maskin kan legge til i sporet, men ikke redigere eller slette det den allerede har sendt.
2. **Vokteren bor utenfor den voktede.** Samleren og alarmen deler ikke legitimasjon, nettverksskjebne eller maskinvare med maskinene de vokter.
3. **Stillhet er en feil, ikke fred.** En stille server, en taus overvåker og en agent som ikke svarer, utløser alle alarm når hjerteslaget uteblir.
4. **Makt leies, eies aldri.** Rutinearbeid bruker minimale rettigheter. Full tilgang er midlertidig, avgrenset, logget og knyttet til en navngitt eier. Det ene stående unntaket, nødnøkkelen, er høylytt med vilje.
5. **Test alarmen, ikke konfigurasjonen.** Stopp loggstrømmen på en testmaskin, blokker overvåkerens puls, og ta tiden to ganger: hvor lenge til den eksterne mottakeren slår alarm, og hvor lenge til et menneske handler på den. Det første bør stemme med tidsavbruddet du selv har satt, og gjør det ikke det, er det allerede et funn. Det andre er det som faktisk beskytter deg. Gjenta det på fast tid: en alarm ingen har utløst med vilje, er bare et håp.
6. **Test ankeret, ikke bare alarmen.** Et anker blir ikke voktet av en ny vokter, det dupliseres og testes. Gjenopprett et system fra den uforanderlige kopien og ta tiden fra null. Sjekk at det som kom tilbake, er komplett, og at artefaktene fortsatt lar seg verifisere. En sikkerhetskopi ingen har gjenopprettet, er bare en teori.
7. **Færre, enklere deler.** Hvert lag er en ny ting som kan svikte, og en ny ting noen må drifte. Et lag du ikke kan teste, er et lag du ikke kan stole på.

Verktøy og plattformer skifter med noen års mellomrom. Tillitens geometri gjør ikke det.
