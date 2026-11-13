---
title: "Hvem vokter vokterne? Tilsyn i IT-infrastruktur"
description: "Alt som kan beskytte et system, kan også blinde det. Ett spørsmål, stilt om igjen til svarene tar slutt, gir fire lag med tilsyn og et anker."
date: "2026-11-11"
updated: "2026-11-13"
tags: ["Sikkerhet", "SOC"]
---

Alt som har makt til å beskytte et system, har også makt til å blinde det. En administrator som kan reparere serverne, kan også slette loggene deres. Programvaren som skal oppdage inntrengere, kan slås av, og en autonom agent som styrer infrastrukturen, kan skjule hva den gjorde. Setter du en ny vokter over den første, har du bare flyttet problemet ett trinn opp.

Resten av artikkelen følger ett spørsmål, stilt om igjen til det ikke lenger gir noe nytt svar. Det som står igjen da, er fire lag med tilsyn og et sted der kjeden slutter.

## Ett spørsmål

Spørsmålet er dette: **hvem kan få denne kontrollen til å tie, og hvem merker det?**

Det kan stilles til alt som skal passe på noe annet: en logg, et overvåkingssystem, en godkjenningsregel, en administratorkonto. Svaret peker på en ny vokter, og så stiller du det samme spørsmålet om den. Slik blir «er vi godt nok sikret?», som ingen kan svare på, til en rekke spørsmål som har svar.

To regler hindrer at rekken blir uendelig. En ny vokter teller bare hvis den lukker en måte å svikte på som den forrige lot stå åpen. Og den teller bare hvis den ikke deler skjebne med det den passer på. Har de samme passord, samme maskinvare eller samme nettverksvei, tar én feil begge, og vokteren var ingen vokter. Ingeniører kaller det uavhengige feildomener.

## Et innbrudd, spørsmål for spørsmål

Anta at laptopen til en administrator blir kompromittert en tirsdagskveld, slik at inntrengeren når alt administratoren når.

I et flatt oppsett har administratoren permanente nøkler både til serverne og til overvåkingssystemet, for enkelhets skyld. Inntrengeren logger inn, setter varslene på pause, kjører nyttelasten sin, sletter de lokale loggene og tømmer sikkerhetskopiene. Onsdag morgen er alle dashbord fortsatt grønne.

Oppsettet hadde logger, overvåking og sikkerhetskopier. Etter den andre regelen var ingen av dem en vokter, for alle tre kunne nås med den samme kontoen som serverne. Still spørsmålet til hver av dem etter tur.

### Hvem kan slette sporet?

Inntrengeren kan, for loggene ligger på maskinen de beskriver. En slik logg er en dagbok: alle med full tilgang på maskinen kan skrive den om i etterkant. Og «maskinen» er enhver kilde til spor, også kontrollplanet i en skykonto, en identitetsleverandør eller et kodelager.

Ingen merker det heller, så lenge den eneste kopien ligger der. Sporet må derfor forlate kilden i det øyeblikket det skrives, over en grense som bare virker én vei, og forsegles der det lander. Kilden kan legge til nye linjer, men ikke lese tilbake, endre eller slette det som allerede har krysset grensen. Blir maskinen overtatt fem sekunder senere, er alt som var levert før det, utenfor rekkevidde. Sikkerhetskopiene hører hjemme bak den samme typen grense, i et miljø den stjålne laptopen ikke når.

Det samme gjelder det som skriver sporet. Et program som ble tuklet med før det ble rullet ut, logger pliktoppfyllende under et betrodd navn, og en agent kan fortelle sin egen historie om hvorfor den handlet. Som bevis teller det som krysset grensen, fanget der den som blir overvåket, ikke kan redigere det: forespørsler, verktøykall, argumenter og godkjenninger.

Slik oppstår det første laget, sporet.

### Hvem merker at sporet stopper?

Det som er sendt, er trygt. Men inntrengeren trenger ikke slette gamle spor hvis det går an å hindre at nye blir laget. En forsiktig angriper tømmer ikke loggen, for det synes. Vedkommende endrer heller revisjonsreglene slik at visse handlinger overses, eller dreper prosessen som sender loggene bort. Den stilleste endrer ingenting og bruker en gyldig legitimasjon.

Noen på den andre siden av grensen må altså passe på tre ting: tegn på at revisjonen er rørt, en kilde som blir stille, og en gyldig identitet som handler utenfor mønsteret. Stillhet lar seg bare oppdage når den bryter en rytme, så hver kilde sender jevne slag gjennom den samme kanalen som sporene, og observatøren varsler når et slag uteblir. På samme måte krever atferd utenfor mønsteret at det finnes et mønster: et normalbilde av hva hver identitet vanligvis gjør.

Spørsmålet avslører to svakheter hos observatøren. Et slag viser at kilden lever, og ikke mer: en dypt kompromittert vert kan slå videre mens den skjuler hva den gjør. Kontroller den derfor mot vitner den ikke styrer, som nettverket, skyens kontrollplan eller hypervisoren og identitetsleverandøren, og tro på vitnet verten ikke kan røre, når to av dem er uenige. Den andre svakheten er mottakeren: et varsel som havner hos den det gjelder, kan lukkes av den samme personen, så det må gå til noen andre.

Det er det andre laget, observatøren.

### Hvem merker at observatøren er borte?

Inntrengeren satte varslene på pause, og ingen merket det. Observatøren er selv et system, med samler, overvåkingsmotor og varslingsvei, og når et slikt system er stille, kan alt være i orden. Det kan også ha krasjet, fylt disken eller blitt stengt ute av en brannmur for tre dager siden.

Løsningen er å snu signalet, som i en «dead man's switch». En uavhengig tjeneste utenfor infrastrukturen din venter på en jevn puls som sier at observatøren lever og kan snakke, og slår alarm når pulsen uteblir i noen minutter. Pulsen må gå gjennom hele kjeden for å bevise noe: utløst inne i overvåkingsmotoren, sendt gjennom varslingsruteren og levert utenfor. En puls fra et eget, tidsstyrt skript forteller ikke mer enn at skriptet virker. Alarmen må dessuten nå et menneske over en vei som ikke avhenger av infrastrukturen den gjelder, med egen legitimasjon og eget nett. Firmaets e-post kan være nede samtidig.

Den eksterne mottakeren er det tredje laget, alarmen. Pulsen viser at alarmveien lever. Den sier ingenting om reglene, og en inntrenger som når observatøren, demper heller én alarm enn å drepe det hele. Da kommer pulsen som før, og ett spørsmål gjenstår.

### Hvem kan endre alt dette?

Noen må administrere samleren, varslingen og tilgangsreglene, og ofte er det en tjenestekonto, en automatisert jobb eller en agent og ikke et menneske. Kan én konto endre alle lagene på én gang, deler de skjebne igjen, og du er tilbake i det flate oppsettet. Det samme skjer når en tjenestekonto som ingen eier, har permanent legitimasjon med for vid tilgang.

Tre grenser holder de høyeste rettighetene i sjakk:

- Lånt tid. Ingen har permanent full tilgang. Høye rettigheter lånes til en erklært oppgave, med avgrenset omfang og utløpstid, og lånet skrives til sporet før økten starter. Tjenestekontoer og agenter låner på samme måte, og hver av dem har en navngitt menneskelig eier.
- To par øyne. Den som foreslår en endring i kritisk infrastruktur, i utrullingen av den eller i alarmreglene, kan ikke være den som godkjenner den. En endring i selve godkjenningsreglene utløser et varsel i lag 2. Regelen er forbeholdt det som endrer vokterne selv eller ikke kan gjøres om. Alt annet gjør en agent i sitt eget tempo innenfor omfanget den har lånt, ellers blir godkjenningene så mange at ingen leser dem.
- En bråkete reservenøkkel (en break-glass-konto). Nødkontoen til bruk når de vanlige innloggingssystemene er nede, kan ikke avhenge av dem. Den er derfor det ene stående unntaket, og den slår alarm over en uavhengig kanal idet den brukes.

Nøklene er det fjerde laget. Det passer ikke på laget før seg, slik de to forrige gjør, men avgjør hvem som får endre de tre andre.

Med de fire lagene på plass treffer den samme stjålne laptopen en grense i hvert steg. Det ligger ingen permanente nøkler på den, og en forespørsel om høye rettigheter på et uvanlig tidspunkt kommer til en annen person som et spørsmål. Dreper inntrengeren loggavsenderen, er alt som var sendt fram til da, allerede lagret på den andre siden, og samleren varsler om stillheten. Får vedkommende observatøren til å tie, stopper pulsen, og mottakeren utenfor tilkaller teamet. Én dempet alarm krever en andre person og etterlater en linje i det forseglede sporet. Nødkontoen slår alarm ved innlogging, før den første kommandoen er kjørt.

Bruddet skjer fortsatt, men nå er det synlig og dyrt. Hvor kort det blir, avgjøres av det som skjer etter alarmen. Tilsyn stopper ikke et angrep. Det bestemmer hvor lenge angrepet får vare uoppdaget.

## Når slutter du å spørre?

Du kan fortsette: hvem passer på pulsmottakeren, og hvem passer på den igjen? De to reglene fra starten gir svaret. Tilsyn kan settes ut av spill på fire hovedmåter: ved å ødelegge eller forfalske beviset, ved å blinde eller snike seg forbi den som leser det, ved å få alarmen til å tie og ved å ta nøklene. De fire lagene lukker hver sin, og en femte vokter tilfører ingenting med mindre den lukker en femte måte å svikte på.

Ved enden av kjeden står derfor noe du velger å stole på: en ekstern pulsmottaker, et menneske utenfor den daglige driften som leser sporet, eller lagring som nekter overskriving og sletting i en fastsatt periode, også overfor sine egne administratorer. Det er ankeret. Lagene flytter tillit uten å fjerne den, og ankeret er der den blir liggende. En vokter over ankeret ville bare flytte spørsmålet én gang til, så du dupliserer det i stedet: to pulsmottakere hos ulike leverandører, slik at ett avbrudd eller én kapret konto ikke gjør deg blind, og bevis i to adskilte miljøer, slik at ett tapt eksemplar ikke er slutten. Det du må vite, er hvor ankeret sitter, og at ingen enkeltfeil kan nå det.

Det samme spørsmålet er stilt i hele nettets målestokk. Sertifikatutstedere (CA-er) går god for at et nettsted er det det gir seg ut for å være, og etter et innbrudd hos en av dem i 2011 ble spørsmålet stilt om dem. Svaret ble Certificate Transparency: i praksis blir hvert offentlig betrodd sertifikat publisert i åpne logger som bare kan utvides, hvem som helst kan drive en overvåker som leter etter sertifikater de ikke ventet, og nettleserne avviser et sertifikat som ikke bærer loggenes signerte løfte om å ta det med. Loggene blir ikke voktet av enda en vokter. Nettleserne krever løfter fra flere logger som drives av ulike operatører, altså et duplisert anker. En utsteder kan fortsatt utstede et dårlig sertifikat, men sertifikatet kan ikke lenger skjule seg.

I et lite miljø, der én person driver både serverne og sikkerheten, kan du ikke fordele rollene mellom mennesker. Du kan fordele dem over grenser: send loggene dit den daglige kontoen din ikke kan slette dem, send pulsen til en mottaker utenfor din egen infrastruktur, og avtal en fast tid der en annen person, gjerne en utenforstående, leser et sammendrag av det som angår vokterne selv: endrede regler, dempede alarmer, lånte rettigheter og hull i sporet. De to første virker også når ingen ser på. Avtalen er et avbøtende tiltak. Leseren vil ikke kjenne igjen et stille angrep, men vokterne kan ikke lenger endres uten at noen ser det, og med en ukentlig gjennomgang er oppdagelsesvinduet en uke.

## Kjeden på ett ark

![Tilsynskjeden, ovenfra og ned. Servere, sky og identitet (lag 1, sporet) antas å kunne bli overtatt. Sporene og slagene deres krysser en enveisgrense til en egen samler (lag 2, observatøren). Derfra går en jevn puls til to eksterne mottakere hos ulike leverandører (lag 3, alarmen), som varsler et menneske på egen kanal. Nederst avgjør lag 4, nøklene, hvem som får endre lag 1 til 3: lånt tid, to par øyne og en bråkete reservenøkkel.](/images/hvem-vokter-vokterne-i-it-infrastruktur/tilsynskjeden.svg)

| Kontrollen | Hvem kan få den til å tie | Hvem merker det |
| --- | --- | --- |
| Lokale logger og sikkerhetskopier | Den som tar over maskinen | Ingen, før sporet sendes ut én vei og forsegles (lag 1, sporet) |
| Loggstrømmen ut av kilden | Den som endrer revisjonsreglene eller dreper avsenderen, og den som går forbi med en gyldig legitimasjon | En egen samler som varsler om tukling, stillhet og atferd utenfor mønsteret (lag 2, observatøren) |
| Observatøren | En krasj, en full disk, en brannmur eller en inntrenger | Eksterne mottakere som venter på en jevn puls (lag 3, alarmen) |
| Reglene og tilgangene til lag 1–3 | Den som har nøklene | En andre person og det forseglede sporet; reservenøkkelen slår alarm selv (lag 4, nøklene) |
| Ankeret: pulsmottakeren og bevislageret | Et avbrudd eller en kapret konto hos leverandøren | Ingen, og derfor finnes det to av hvert |

Går du gjennom ditt eget oppsett rad for rad, begynner du med radene der svaret i dag er «ingen».

## Det spørsmålet ikke fanger

Spørsmålet finner hull i konstruksjonen, men ikke slitasjen hos menneskene og rutinene som holder den ved like. Fire ting svikter selv med alle lagene på plass.

Godkjenninger blir stemplet. En andre person er bare en vokter så lenge vedkommende leser det som skal godkjennes, og slitne godkjennere leser ikke. En angriper kan også vente på en ekte forespørsel og ta over økten etter at den er godkjent. Hold volumet lavt, vis godkjenneren hva, hvor og hvorfor, og følg med på selve godkjenningene: en godkjenner som sier ja til alt på to sekunder, er et funn. To personer kan dessuten bli enige om å se en annen vei. Regelen gjør misbruk til en sammensvergelse, som er vanskeligere, men ikke umulig.

Utløp henger etter. En legitimasjon som skulle ha utløpt, virker fortsatt hvis tilbaketrekkingen er ødelagt og ingen følger med, og maskinlegitimasjon er den vanlige synderen. Test tilbaketrekking på fast tid, og varsle når en legitimasjon overlever utløpsdatoen sin.

Normalbilder kan læres opp. En identitet som glir av sted i små steg, blir normal, og en detektor som er stilt for stramt, drukner folk i falske alarmer til de slutter å lese. Hold en kort liste over ting som aldri er normale for en identitet, uansett historikk, og hold alarmene så få at et menneske fortsatt leser hver av dem.

Kompleksitet er en risiko i seg selv. Hver kontroll er en ny del som kan svikte, og en ny ting noen må drifte. Foretrekk få og enkle deler, og fjern en kontroll du ikke kan teste.

## Når du setter det opp

Spørsmålet sier hva som må finnes. Noen detaljer avgjør om det holder i praksis:

- Ta bare imot spor over en autentisert kanal, slik at én vert ikke kan skrive i en annens navn, og stemple hvert spor med samlerens egen klokke. En kompromittert vert kan lyve om tiden.
- Forsegl det som kommer inn, med en signatur eller en hash-kjede, hold signeringsnøkkelen utenfor rekkevidde for lagerets egne administratorer, og legg jevnlig en kopi av den siste hashen der heller ikke samleren kan endre den. En overtatt samler kan da legge til løgner, men ikke skrive om det som allerede er forseglet.
- Gi hver kilde en kvote, slik at en kompromittert vert ikke kan oversvømme lageret og presse ut eldre bevis eller bevis fra andre kilder. En kilde som når kvoten, behandles som en kilde som er blitt stille: det den gjør etterpå, ser du ikke, så alarmen er like alvorlig.
- Signer det du ruller ut, registrer hvordan det ble bygget, og kontroller signaturen ved utrulling. En signatur viser hvor noe kommer fra, og en liste over innholdet viser hva det består av. Ingen av dem viser at det er harmløst: ondsinnet kode som kom inn før byggingen, blir bygget og signert som alt annet. Byggesystemet, signeringsnøklene og veien koden kommer inn, hører derfor under lag 4.
- En maskin kan ikke svare på en andre faktor. La den bevise identiteten sin med hva den er og hvor den kjører, og gi den kortlevd legitimasjon.
- Oppbevar nødnøkkelen slik at det setter spor når den tas ut, og test den på fast tid. Alarmen den utløser, må aldri blokkere innloggingen, ellers lærer folk seg å slå den av.
- Behold sporet lenge nok til å svare på spørsmål du ikke så komme, for innbrudd oppdages ofte sent. Logger om mennesker er samtidig personopplysninger: bestem hva du samler, hvorfor, hvem som kan lese det, og hvor lenge det lagres, og si fra til dem det gjelder.

Når oppsettet står og observatøren varsler, sier varselet også hvor du skal begynne:

| Hva observatøren ser | Hva det betyr | Se her |
| --- | --- | --- |
| Loggen ble tømt | Noen prøvde å utslette sporet | Verten, med en gang; anta full kompromittering |
| Revisjonsregler endret | Noen blinder opptakeren før de handler | Nylig bruk av privilegier på verten |
| En gyldig identitet handler utenfor mønsteret | En stjålet legitimasjon, eller en tjeneste eller agent som handler utenfor sitt erklærte område | Identitetens normalbilde, dens eier og eventuell godkjent endring |
| Loggstrømmen stopper | Verten er nede, avskåret, eller avsenderen ble drept | Et vitne verten ikke styrer (nettverk, hypervisor) først, så loggprosessen |
| To vitner er uenige | Verten skjuler noe, eller ett vitne er ødelagt | Vitnet verten ikke kan røre: nettverket, kontrollplanet, identitetsleverandøren |
| Godkjenningsregler omgått | En privilegert bruker endret rekkverket for seg selv | Kontrollplanet og innstillingene i kodelageret, lag 4 |

## Et svar er en påstand til det er prøvd

«Samleren varsler når en kilde blir stille» er en påstand om oppsettet ditt. Den blir et bevis først når du har stoppet loggstrømmen på en testmaskin og sett varselet komme. Gjør det samme med pulsen: blokker den, og ta tiden to ganger. Hvor lang tid tar det før alarmen går, og hvor lang tid før et menneske handler på den? Det første bør stemme med tidsavbruddet du selv har satt. Det andre er det som faktisk beskytter deg.

Ankeret prøves på samme måte. Blokker pulsen mens én av de to mottakerne er slått av, og sjekk at den andre fortsatt slår alarm. Les gamle bevis tilbake, og kontroller at forseglingen holder. Gjenopprett et system fra den uforanderlige kopien, ta tiden fra null, og sjekk at det som kom tilbake, er komplett. Gjenta alt dette på fast tid, og gå gjennom hver bruk av nødkontoen i etterkant.
