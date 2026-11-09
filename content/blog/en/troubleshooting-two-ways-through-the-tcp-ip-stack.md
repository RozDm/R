---
title: "Network troubleshooting: two ways through the TCP/IP stack"
description: "Network troubleshooting bottom-up or top-down: the thinking behind the TCP/IP model, and how to choose the right way."
date: "2026-11-09"
tags: ["Nettverk", "TCP/IP"]
translationOf: "feilsoking-to-veier-gjennom-tcp-ip-stakken"
---

‘The network is down’ is a symptom, not a diagnosis. Network troubleshooting is less about commands than about a way of thinking: which questions you ask, in what order, and what the answers actually prove. Here are the two ways through the TCP/IP stack, bottom-up and top-down, and how to choose between them.

## Prove, don't guess

Good troubleshooting is a series of small experiments. Each step tests a claim — ‘the cable works’, ‘the name resolves’, ‘the port answers’ — and the answer is either a proof or an elimination. A step whose answer you already know is wasted; a good step splits what is left in two.

The most dangerous trap is the convincing first guess. ‘It must be DNS’ may well be true, but the hypothesis you like best is the one you must test hardest. Otherwise you only look for what confirms it.

Before the first test, three questions pay off:

- What fails, and what works? One website, everything on the internet, or just the printer?
- For whom? One user, one office or everyone?
- Since when, and what changed? A change over the weekend is often the whole explanation.

The answers decide where you start.

## The TCP/IP layers as a thinking tool

The TCP/IP model has four layers in [RFC 1122](https://www.rfc-editor.org/rfc/rfc1122.html) and five in many textbooks. For troubleshooting I use five, with physical and link apart, because a dead cable and a misconfigured VLAN are different faults. That gives each layer its own question:

| Layer | The question | Typical faults |
| --- | --- | --- |
| 1 Physical | Is there a signal? | Cable, port, power, Wi-Fi coverage |
| 2 Link | Can I reach the neighbour? | VLAN, switch port, ARP |
| 3 Internet (IP) | Is there a route? | Address, netmask, gateway, routing |
| 4 Transport | Is the port open? | Firewall, a service that isn't listening |
| 5 Application | Does the service answer correctly? | DNS, TLS, HTTP, login |

What makes the model useful is the dependencies. Each layer rests on the ones below: if a layer works, everything under it works too, and if it fails, the fault lies there or further down. That turns a vague ‘it doesn't work’ into a series of yes/no questions where each answer means something definite.

But a proof only holds for the path you tested. An answer to ping shows that ICMP gets through, not that TCP on port 443 does: load balancing can send them different ways, and firewalls can treat them differently. A test from your own machine says little about the user's. So test as close to the user's path as you can: the same machine, the same network, the same protocol.

And a proof only holds for what you tested with. A small ping doesn't prove that big packets get through, and one answer doesn't prove the line copes with load: too small an MTU in a tunnel, or packet loss on a bad cable, lets the tests through but stops the real traffic. The layers leak, too: an ARP lookup without an answer looks like layer 2, but often comes from a wrong netmask at layer 3.

## Bottom-up: solid ground

The first way starts at the cable and proves layer by layer upwards: a signal, contact with the neighbour, a route to the target, an open port, a service that answers.

It fits when the symptom is broad — many users or every service down — when something physical has changed, on new installations, and when one machine has no network at all. It also fits when you know little: the method needs no theory about the fault, only thoroughness.

Its strength is that nothing gets skipped. Every proven layer is solid ground, and you never chase a ghost high up that really comes from a fault further down. Its weakness is time: if the fault is an expired certificate, you have proven four layers for nothing. And it needs access to the lower layers — cables, switches, routing — which you don't always have.

## Top-down: start where the symptom is

The second way starts where the user notices the fault, in the application, and goes only as far down as it needs to.

It fits when one service fails while the rest work: email goes through, but the intranet won't open. Its strength is speed, because day to day the fault is often high up: a service that has stopped, a certificate that has expired, a DNS record that is missing. And here the error message is not just a sign that something is wrong, but a signpost:

| The error says | It means | Look here |
| --- | --- | --- |
| The name doesn't exist | DNS answered but doesn't know the name | The DNS record, layer 5 |
| DNS doesn't answer | No reply: lost on the way there or back, or the DNS service is down | The way to the DNS server, layers 1–4, or the service itself |
| The connection is refused | Something said no: nothing listens, or a firewall rejects | The service or the firewall, layer 4 |
| The connection times out | No answer: packets vanish on the way there or back | Firewall or routing, layer 4 and down |
| No reply once connected | The connection stands, but the service behind it doesn't answer | The application, layer 5 |
| Certificate error | The trust fails, or you reached the wrong host | TLS, layer 5; for a wrong host, DNS or a proxy |

Its weakness is that symptoms can lie. A fault far down can pass for one high up: through a VPN tunnel with too small an MTU, the name resolves, ping answers and the port opens, but the connection hangs when the server sends its certificate chain. It looks like a TLS fault, but the cause sits at layer 3. The defence is to let go quickly: if a hypothesis high up doesn't hold, go down.

## Start in the middle

Divide and conquer is not a third way but a way to choose where to start when the symptom points nowhere. You start in the middle, with one test against the target at the network layer, and the answer picks the direction. If the target answers, layers 1–3 work and you move up to layers 4 and 5. If it doesn't, the fault lies at layer 3 or below, and you work your way down. The next test splits that half again: if the gateway answers but the target doesn't, layers 1 and 2 are fine locally, and the fault lies on the way beyond. Each test halves what is left: it is a binary search.

But a test is never better than what it measures. Many firewalls block ping, so an unanswered ping proves nothing on its own, and an answered one doesn't prove that the application's traffic gets through. Choose tests that take the same path as whatever is failing.

## Same fault, two ways

A typical case: on Monday morning users can't get into the intranet, but email and the internet work. One service fails for everyone, so top-down is the natural choice:

1. The name resolves, so DNS works. But the connection times out rather than being refused: no one answers, so the packets vanish somewhere.
2. The server answers ping. There is a way there, at least for ICMP.
3. On the server, the service is running and listening on the port. The fault is not a dead process but somewhere on the way.
4. The traffic on the server shows the connection attempts never arrive. Something between the networks drops them.
5. What changed? A firewall rule over the weekend, which took the office network's access with it.

Bottom-up would have walked the same fault like this: signal, neighbour, address and gateway on the client are all fine, four proofs without a finding. Then the target answers ping but the port doesn't, and from there the rest is the same: the server listens, the packets don't arrive, the firewall. Both ways end at the same answer; bottom-up just spends more steps proving what already worked.

Had it been the cable, though, the user would have had trouble with everything, not just the intranet. The three questions from the start would then have sent you bottom-up at once, and the first test would have found the fault. That is why the questions come before the tests.

## Which way?

![The TCP/IP stack with five layers, from 1 Physical at the bottom to 5 Application at the top. Bottom-up starts at layer 1 and goes up, top-down starts at layer 5 and goes down, and starting in the middle means layer 3, then up or down depending on the answer.](/images/feilsoking-to-veier-gjennom-tcp-ip-stakken/tcp-ip-stack.svg)

- Many users or every service down, or something physical changed: bottom-up.
- One service fails, the rest work: top-down.
- The symptom points nowhere: start in the middle, and let the answer pick the direction.
- And always first: what changed?

## Principles for either way

- **Write down what you have proven, and how.** The notes become the diagnosis, and a colleague can carry on where you left off.
- **Change one thing at a time.** Otherwise you don't know what fixed the fault, or what caused a new one.
- **Don't trust a single signal.** Confirm with a second, independent test.
- **Test from the user's side.** A proof only holds for the path you tested.
- **Tell the symptom from the cause.** The fault isn't solved when it works again, but when you know why the rule disappeared and how to stop it happening again.

Commands change with tools and operating systems. The way of thinking doesn't.
