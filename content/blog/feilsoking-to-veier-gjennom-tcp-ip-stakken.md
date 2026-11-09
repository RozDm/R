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

TCP/IP-modellen har fire lag. Når jeg feilsøker, deler jeg det nederste i to, fysisk lag og linklag, fordi en død kabel og et feilkonfigurert VLAN er to forskjellige feil. Da får hvert lag sitt eget spørsmål:

| Lag | Spørsmålet | Typiske feil |
| --- | --- | --- |
| 1 Fysisk | Er det signal? | Kabel, port, strøm, Wi-Fi-dekning |
| 2 Link | Får jeg kontakt med naboen? | VLAN, svitsjeport, ARP |
| 3 Internett (IP) | Finnes det en vei dit? | Adresse, nettmaske, gateway, ruting |
| 4 Transport | Er porten åpen? | Brannmur, en tjeneste som ikke lytter |
| 5 Applikasjon | Svarer tjenesten riktig? | DNS, TLS, HTTP, pålogging |

Det som gjør modellen nyttig, er avhengighetene. Hvert lag hviler på lagene under: virker et lag, virker alt under det også, og feiler det, ligger feilen der eller lenger ned. Slik blir et vagt «det virker ikke» til en rekke ja/nei-spørsmål der hvert svar betyr noe bestemt.

Men et bevis gjelder bare veien du testet. Et svar på ping viser at ICMP kommer fram, ikke at TCP på port 443 gjør det: lastbalansering kan sende dem forskjellige veier, og brannmurer kan behandle dem ulikt. En test fra din egen maskin sier lite om brukerens. Test derfor så nær brukerens vei som mulig: samme maskin, samme nett, samme protokoll.

## Nedenfra og opp: sikker grunn

Den første veien begynner ved kabelen og beviser lag for lag oppover: signal, kontakt med naboen, en vei til målet, en åpen port, en tjeneste som svarer.

Den passer når symptomet er bredt — mange brukere eller alle tjenester er nede — når noe fysisk er endret, ved nye installasjoner, og når én maskin ikke har nett i det hele tatt. Den passer også når du vet lite: metoden krever ingen teori om feilen, bare grundighet.

Styrken er at ingenting hoppes over. Hvert bevist lag er sikker grunn, og du jager aldri et spøkelse høyt oppe som egentlig skyldes en feil lenger nede. Svakheten er tiden: er feilen et utløpt sertifikat, har du bevist fire lag forgjeves. Og den krever tilgang til de nederste lagene, til kabler, svitsjer og ruting, som du ikke alltid har.

## Ovenfra og ned: begynn der symptomet er

Den andre veien begynner der brukeren merker feilen, i applikasjonen, og går bare så langt ned som nødvendig.

Den passer når én tjeneste feiler mens resten virker: e-posten går, men intranettet åpner seg ikke. Styrken er farten, for i hverdagen ligger feilen ofte høyt oppe: en tjeneste som har stoppet, et sertifikat som er utløpt, en DNS-post som mangler. Og her er feilmeldingen ikke bare et tegn på at noe er galt, men et veiskilt:

| Feilen sier | Det betyr | Let her |
| --- | --- | --- |
| Navnet kan ikke slås opp | Navnet ble aldri til en adresse | DNS, lag 5 |
| Tilkoblingen avvises | Noe svarte, men ingenting lytter på porten | Tjenesten, lag 4 |
| Tidsavbrudd | Ingen svarte: pakkene forsvinner på veien | Brannmur eller ruting, lag 4 og nedover |
| Sertifikatfeil | Forbindelsen kom fram, men tilliten svikter | TLS, lag 5 |

Svakheten er at symptomer kan lyve. En feil langt nede kan forkle seg som en feil høyt oppe: uten nettverkskabel ser det ut som en DNS-feil, og du kan bruke tid på en DNS som virker. Forsvaret er å gi slipp raskt: holder ikke en hypotese høyt oppe, går du ned.

## Splitt og hersk: begynn på midten

Er du usikker, begynn på midten. Én test som når målet på nettverkslaget, deler problemet i to: svarer målet, virker lag 1–3 og feilen ligger over; svarer det ikke, ligger den under. Neste test deler det som gjenstår, igjen. Det er binærsøk, og det er ofte den raskeste veien når symptomet ikke peker noe sted.

Men en test er aldri bedre enn det den måler. Mange brannmurer blokkerer ping, så et ping uten svar beviser ingenting alene, og et ping med svar beviser ikke at applikasjonens trafikk kommer fram. Velg tester som går samme vei som det som feiler.

## Samme feil, to veier

Et typisk tilfelle: mandag morgen kommer brukerne ikke inn på intranettet, men e-post og internett virker. Én tjeneste feiler for alle, så jeg går ovenfra og ned, og hver test fjerner en del av mulighetene:

1. Navnet slås opp, så DNS virker. Men forbindelsen kommer aldri i stand: tidsavbrudd, ikke avvisning. Ingen svarer, altså forsvinner pakkene et sted.
2. Serveren svarer på ping. Det finnes en vei dit, i hvert fall for ICMP.
3. Porten svarer ikke, men på serveren lytter tjenesten som den skal.
4. Forbindelsesforsøkene når aldri serveren. Noe mellom nettene kaster dem.
5. Hva ble endret? En brannmurregel i helgen, som tok med seg tilgangen fra kontornettet.

Fem tester, og hver av dem snevret inn det som gjensto. Nedenfra og opp hadde funnet det samme, men først etter å ha bevist kabel, nabo, adresse og gateway på en klient der alt var i orden: riktig, men tregt.

Omvendt: hadde nettverkskortet mistet signalet, ville nedenfra og opp funnet feilen med første test, mens ovenfra og ned først hadde fått en DNS-feil å jage. Ingen av veiene er best i seg selv; symptomet og omfanget avgjør.

## Hvilken vei?

- Mange brukere eller alle tjenester nede, eller noe fysisk endret: nedenfra og opp.
- Én tjeneste feiler, resten virker: ovenfra og ned.
- Symptomet peker ingen steder: begynn på midten.
- Og alltid først: hva ble endret?

## Prinsippene som gjelder uansett

- **Skriv ned hva du har bevist, og hvordan.** Notatene blir diagnosen, og en kollega kan fortsette der du slapp.
- **Endre én ting om gangen.** Ellers vet du ikke hva som løste feilen, eller hva som skapte en ny.
- **Stol ikke på ett signal.** Bekreft med en annen, uavhengig test.
- **Test fra brukerens side.** Et bevis gjelder bare veien du testet.
- **Skill symptom fra årsak.** Feilen er ikke løst når det virker igjen, men når du vet hvorfor regelen forsvant og hvordan du hindrer at det skjer igjen.

Kommandoene endrer seg med verktøy og operativsystem. Tankegangen gjør det ikke.
