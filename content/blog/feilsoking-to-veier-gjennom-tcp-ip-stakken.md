---
title: "Feilsøking: to veier gjennom TCP/IP-stakken"
description: "Nedenfra fra kabelen eller ovenfra fra applikasjonen: tankegangen bak feilsøking etter TCP/IP-modellen, og hvordan du velger vei."
date: "2026-11-09"
tags: ["TCP/IP"]
---

«Nettet virker ikke» er et symptom, ikke en diagnose. Veien fra symptom til årsak handler mindre om kommandoer enn om tankegang: hvilke spørsmål du stiller, i hvilken rekkefølge, og hva svarene faktisk beviser.

## Å bevise, ikke å gjette

God feilsøking er en serie små eksperimenter. Hvert steg tester en påstand — «kabelen virker», «navnet slås opp», «porten svarer» — og svaret er enten et bevis eller en eliminering. Et steg der du allerede vet svaret, er bortkastet; et godt steg deler det som gjenstår, i to.

Den farligste fellen er den overbevisende første gjetningen. «Det er sikkert DNS» kan godt stemme, men hypotesen du liker best, er den du må teste hardest. Ellers leter du bare etter det som bekrefter den.

Før første test lønner det seg å stille tre spørsmål:

- Hva feiler, og hva virker? Én nettside, alt mot internett, eller bare skriveren?
- For hvem? Én bruker, ett kontor eller alle?
- Siden når, og hva ble endret? En endring i helgen er ofte hele forklaringen.

Svarene avgjør hvor du begynner.

## Lagene som tankeverktøy

TCP/IP-modellen beskrives med fire eller fem lag. Til feilsøking bruker jeg fem, med fysisk lag og linklag hver for seg, fordi en død kabel og et feilkonfigurert VLAN er to forskjellige feil. Da får hvert lag sitt eget spørsmål:

| Lag | Spørsmålet | Typiske feil |
| --- | --- | --- |
| 1 Fysisk | Er det signal? | Kabel, port, strøm, Wi-Fi-dekning |
| 2 Link | Får jeg kontakt med naboen? | VLAN, svitsjeport, ARP |
| 3 Internett (IP) | Finnes det en vei dit? | Adresse, nettmaske, gateway, ruting |
| 4 Transport | Er porten åpen? | Brannmur, en tjeneste som ikke lytter |
| 5 Applikasjon | Svarer tjenesten riktig? | DNS, TLS, HTTP, pålogging |

Det som gjør modellen nyttig, er avhengighetene. Hvert lag hviler på lagene under: virker et lag, virker alt under det også, og feiler det, ligger feilen der eller lenger ned. Slik blir et vagt «det virker ikke» til en rekke ja/nei-spørsmål der hvert svar betyr noe bestemt.

Men et bevis gjelder bare veien du testet. Et svar på ping viser at ICMP kommer fram, ikke at TCP på port 443 gjør det: lastbalansering kan sende dem forskjellige veier, og brannmurer kan behandle dem ulikt. En test fra din egen maskin sier lite om brukerens. Test derfor så nær brukerens vei som mulig: samme maskin, samme nett, samme protokoll.

Og et bevis gjelder bare det du testet med. Et lite ping beviser ikke at store pakker kommer fram, og ett svar beviser ikke at linjen tåler last: for liten MTU i en tunnel eller pakketap på en dårlig kabel slipper testene gjennom, men stopper den virkelige trafikken. Lagene lekker også: et ARP-oppslag uten svar ser ut som lag 2, men skyldes ofte en feil nettmaske på lag 3.

## Nedenfra og opp: sikker grunn

Den første veien begynner ved kabelen og beviser lag for lag oppover: signal, kontakt med naboen, en vei til målet, en åpen port, en tjeneste som svarer.

Den passer når symptomet er bredt — mange brukere eller alle tjenester er nede — når noe fysisk er endret, ved nye installasjoner, og når én maskin ikke har nett i det hele tatt. Den passer også når du vet lite: metoden krever ingen teori om feilen, bare grundighet.

Styrken er at ingenting hoppes over. Hvert bevist lag er sikker grunn, og du jager aldri et spøkelse høyt oppe som egentlig skyldes en feil lenger nede. Svakheten er tiden: er feilen et utløpt sertifikat, har du bevist fire lag forgjeves. Og den krever tilgang til de nederste lagene, til kabler, svitsjer og ruting, som du ikke alltid har.

## Ovenfra og ned: begynn der symptomet er

Den andre veien begynner der brukeren merker feilen, i applikasjonen, og går bare så langt ned som nødvendig.

Den passer når én tjeneste feiler mens resten virker: e-posten går, men intranettet åpner seg ikke. Styrken er farten, for i hverdagen ligger feilen ofte høyt oppe: en tjeneste som har stoppet, et sertifikat som er utløpt, en DNS-post som mangler. Og her er feilmeldingen ikke bare et tegn på at noe er galt, men et veiskilt:

| Feilen sier | Det betyr | Let her |
| --- | --- | --- |
| Navnet finnes ikke | DNS svarte, men kjenner ikke navnet | DNS-oppføringen, lag 5 |
| DNS svarer ikke | Spørsmålet nådde aldri DNS-serveren | Veien til DNS-serveren, lag 1–4 |
| Tilkoblingen avvises | Noe sa nei: ingenting lytter, eller en brannmur avviser | Tjenesten eller brannmuren, lag 4 |
| Tidsavbrudd ved tilkobling | Ingen svar: pakkene forsvinner på vei dit eller tilbake | Brannmur eller ruting, lag 4 og nedover |
| Ikke noe svar etter tilkobling | Forbindelsen står, men tjenesten bak svarer ikke | Applikasjonen, lag 5 |
| Sertifikatfeil | Tilliten svikter, eller du havnet hos feil vert | TLS, lag 5; ved feil vert DNS eller en proxy |

Svakheten er at symptomer kan lyve. En feil langt nede kan forkle seg som en feil høyt oppe: gjennom en VPN-tunnel med for liten MTU slås navnet opp, ping svarer og porten åpner seg, men forbindelsen henger når serveren sender sertifikatkjeden. Det ser ut som en TLS-feil, men årsaken ligger på lag 3. Forsvaret er å gi slipp raskt: holder ikke en hypotese høyt oppe, går du ned.

## Begynn på midten

Splitt og hersk er ingen tredje vei, men en måte å velge startpunkt på når symptomet ikke peker noe sted. Du begynner på midten, med én test mot målet på nettverkslaget, og svaret velger retningen. Svarer målet, virker lag 1–3, og du leter videre ovenfra og ned. Svarer det ikke, ligger feilen på lag 3 eller under, og du går nedenfra og opp. Svarer gatewayen, men ikke målet, er lag 1 og 2 i orden lokalt, og feilen ligger på veien videre. Hver test halverer det som gjenstår: det er binærsøk.

Men en test er aldri bedre enn det den måler. Mange brannmurer blokkerer ping, så et ping uten svar beviser ingenting alene, og et ping med svar beviser ikke at applikasjonens trafikk kommer fram. Velg tester som går samme vei som det som feiler.

## Samme feil, to veier

Et typisk tilfelle: mandag morgen kommer brukerne ikke inn på intranettet, men e-post og internett virker. Én tjeneste feiler for alle, så ovenfra og ned er det naturlige valget:

1. Navnet slås opp, så DNS virker. Men tilkoblingen får tidsavbrudd, ikke avvisning: ingen svarer, altså forsvinner pakkene et sted.
2. Serveren svarer på ping. Det finnes en vei dit, i hvert fall for ICMP.
3. På serveren kjører tjenesten og lytter på porten. Feilen er ikke en død prosess, men et sted på veien.
4. Tilkoblingsforsøkene når aldri serveren. Noe mellom nettene kaster dem.
5. Hva ble endret? En brannmurregel i helgen, som tok med seg tilgangen fra kontornettet.

Nedenfra og opp hadde gått gjennom den samme feilen slik: signal, nabo, adresse og gateway på klienten er i orden, fire bevis uten funn. Så svarer målet på ping, men porten svarer ikke, og derfra er resten likt: serveren lytter, pakkene kommer ikke fram, brannmuren. Begge veier ender i samme svar; nedenfra og opp bruker bare flere steg på å bevise det som allerede virket.

Hadde det derimot vært kabelen, hadde brukeren hatt feil på alt, ikke bare intranettet. Da hadde de tre spørsmålene fra starten sendt deg nedenfra og opp med en gang, og første test hadde funnet feilen. Derfor kommer spørsmålene før testene.

## Hvilken vei?

- Mange brukere eller alle tjenester nede, eller noe fysisk endret: nedenfra og opp.
- Én tjeneste feiler, resten virker: ovenfra og ned.
- Symptomet peker ingen steder: begynn på midten, og la svaret velge retningen.
- Og alltid først: hva ble endret?

## Prinsippene som gjelder uansett

- **Skriv ned hva du har bevist, og hvordan.** Notatene blir diagnosen, og en kollega kan fortsette der du slapp.
- **Endre én ting om gangen.** Ellers vet du ikke hva som løste feilen, eller hva som skapte en ny.
- **Stol ikke på ett signal.** Bekreft med en annen, uavhengig test.
- **Test fra brukerens side.** Et bevis gjelder bare veien du testet.
- **Skill symptom fra årsak.** Feilen er ikke løst når det virker igjen, men når du vet hvorfor regelen forsvant og hvordan du hindrer at det skjer igjen.

Kommandoene endrer seg med verktøy og operativsystem. Tankegangen gjør det ikke.
