# SEO Plan - Status Pages Hub

Laatst bijgewerkt: 8 juni 2026

Dit document is de SEO-backlog voor de statusdashboard-app. De strategie is gebaseerd op DataForSEO-data voor Google, Verenigde Staten, Engels. Controleer volumes en SERPs opnieuw voordat grote contentinvesteringen worden gedaan.

## 1. Positionering

### Productbelofte

Monitor meerdere externe Atlassian Statuspage-compatible statuspagina's in een centraal dashboard.

### Primaire doelgroep

- SRE- en DevOps-teams
- SaaS-beheerders
- Support- en operations-teams
- Organisaties die afhankelijk zijn van externe cloud- en softwareleveranciers

### Primaire SEO-propositie

**Status Page Aggregator**

Dit is het hoofdonderwerp voor de homepage. Het keyword sluit exact aan op het product en heeft de beste combinatie van relevantie, haalbaarheid en commerciele waarde.

## 2. Keywordonderzoek

DataForSEO-meting: Verenigde Staten, Engels.

| Keyword | Volume p/m | Difficulty | CPC | Jaartrend | Besluit |
|---|---:|---:|---:|---:|---|
| status page aggregator | 40 | 5 | $17.10 | +50% | Primair homepage-keyword |
| service health dashboard | 140 | 50 | $3.17 | +22% | Niet targeten; verkeerde SERP-intentie |
| status page monitoring | 30 | 100 | $0 | -86% | Niet actief targeten |
| outage dashboard | 20 | 68 | $0 | Onbekend | Niet targeten; vooral stroomstoringen |
| free status dashboard | 10 | Onbekend | $0 | Stabiel | Secundaire landingspagina |
| service status dashboard | 10 | 100 | $19.77 | Stabiel | Alleen ondersteunend gebruiken |
| service status monitor | 10 | Onbekend | $0 | Stabiel | Ondersteunend keyword |
| Atlassian status dashboard | 10 | Onbekend | $0 | Stabiel | Providerpagina |
| StatusGator alternative | 10 | Onbekend | $12.66 | Stabiel | Vergelijkingspagina |

### Ondersteunende termen zonder meetbaar volume

Gebruik deze termen natuurlijk in copy, headings en FAQ's. Maak er voorlopig geen zelfstandige pagina's voor.

- multiple status pages
- monitor multiple status pages
- status pages dashboard
- third-party status monitoring
- centralized service status monitoring
- vendor status monitoring
- Atlassian Statuspage monitor
- monitor Atlassian status pages
- status page checker
- component status monitoring
- planned maintenance dashboard
- free status page aggregator

### Uitgesloten keywords

- `status dashboard`: volume 210, difficulty 100 en vooral navigatie-intentie
- `status page`: volume 2.400, difficulty 88 en te breed
- `service health dashboard`: SERP wordt gedomineerd door AWS, Microsoft en ServiceNow
- `outage dashboard`: SERP gaat vooral over stroomstoringen en Downdetector
- `status page monitoring`: difficulty 100 en sterk dalende trend

## 3. SERP-inzichten

Voor `status page aggregator` stonden tijdens het onderzoek onder andere:

1. Reddit
2. statuspageaggregator.com
3. GitHub - StatusGator status page aggregator
4. StatusGator
5. IncidentHub
6. statusaggregation.com
7. Dev.to
8. statusaggregator.com

### Wat dit betekent

- Kleine gespecialiseerde websites kunnen ranken.
- Exacte aansluiting op de zoekintentie is belangrijk.
- Google beloont productpagina's die expliciet "monitor multiple status pages" communiceren.
- Een openbaar GitHub-project kan extra zichtbaarheid en backlinks opleveren.
- Een goede uitlegpagina kan concurreren naast productpagina's.

## 4. Websitestructuur

Publiceer niet direct tientallen dunne pagina's. Begin met deze structuur:

| Prioriteit | URL | Primair keyword | Zoekintentie |
|---:|---|---|---|
| P0 | `/` | status page aggregator | Product / navigatie |
| P1 | `/free-status-dashboard` | free status dashboard | Informatief / product |
| P1 | `/atlassian-status-dashboard` | Atlassian status dashboard | Provider / product |
| P1 | `/statusgator-alternative` | StatusGator alternative | Vergelijking |
| P2 | `/guides/monitor-multiple-status-pages` | Ondersteunt homepage | Informatief |
| P2 | `/supported-status-pages` | Atlassian Statuspage compatibility | Productondersteuning |

## 5. Homepagebrief

### URL

`/`

### Title

```text
Status Page Aggregator - Monitor Multiple Status Pages
```

### Meta description

```text
Monitor multiple Atlassian-compatible status pages in one free dashboard. Track outages, degraded components and planned maintenance without an account.
```

### H1

```text
Monitor Multiple Status Pages in One Dashboard
```

### Introductie

Leg binnen de eerste 100 woorden uit:

- dat de app meerdere statuspagina's bundelt;
- dat de app Atlassian Statuspage-compatible pagina's ondersteunt;
- dat gebruikers storingen, componenten en gepland onderhoud kunnen volgen;
- dat er geen account nodig is;
- dat dashboards gedeeld kunnen worden.

### Aanbevolen secties

1. Hero met primaire CTA
2. Live of vooraf gevuld voorbeelddashboard
3. Probleem: statusinformatie staat verspreid
4. Oplossing: een centrale status page aggregator
5. Ondersteunde functionaliteiten
6. Werking in drie stappen
7. Ondersteunde providers en API-vereisten
8. Privacy en lokale opslag
9. Veelgestelde vragen
10. Interne links naar landingspagina's en handleidingen

### Primaire CTA

```text
Create Your Free Status Dashboard
```

### Ondersteunende claims

- No account required
- Free to use
- Data stored locally
- Shareable dashboards
- Automatic 60-second refresh
- Component-level monitoring
- Planned maintenance tracking

## 6. Landingspagina's

### `/free-status-dashboard`

**Doel:** gebruikers overtuigen die specifiek een gratis oplossing zoeken.

**Title**

```text
Free Status Dashboard for Multiple Services
```

**H1**

```text
Create a Free Dashboard for Multiple Status Pages
```

**Inhoud**

- Wat gratis betekent
- Geen account
- Lokale opslag
- Deelbare dashboardlinks
- Beperkingen en ondersteunde providers
- CTA naar het dashboard

### `/atlassian-status-dashboard`

**Doel:** providergerichte zoekintentie afvangen.

**Title**

```text
Atlassian Status Dashboard - Monitor Multiple Status Pages
```

**H1**

```text
Monitor Atlassian Statuspage Services in One Dashboard
```

**Inhoud**

- Ondersteuning voor `/api/v2/status.json`
- Ondersteuning voor `/api/v2/summary.json`
- Componentselectie
- Gepland onderhoud
- Voorbeeld met GitHub Status
- Duidelijke uitleg van compatibiliteit

### `/statusgator-alternative`

**Doel:** commerciele vergelijkingsintentie afvangen.

**Belangrijk:** wees eerlijk. Het product is geen volledige kopie van StatusGator.

**Title**

```text
Free StatusGator Alternative for Simple Status Aggregation
```

**Inhoud**

- Voor wie deze app geschikt is
- Wat lokaal en gratis gebruik betekent
- Welke functies wel en niet aanwezig zijn
- Vergelijkingstabel
- Geen ongefundeerde claims

## 7. Technische SEO-backlog

### P0 - Voor indexatie

- [ ] Geef de homepage een vaste SEO-title.
- [ ] Stop met het vervangen van `document.title` door actuele systeemstatus.
- [ ] Voeg een unieke meta description toe.
- [ ] Voeg een canonical URL toe.
- [ ] Voeg Open Graph-tags toe.
- [ ] Voeg Twitter Card-tags toe.
- [ ] Voeg `public/robots.txt` toe.
- [ ] Voeg `public/sitemap.xml` toe.
- [ ] Voeg `SoftwareApplication` structured data toe.
- [ ] Zet interne instellingen- en importpagina's op `noindex`.
- [ ] Maak marketingcontent indexeerbaar zonder client-side interactie.

### P1 - Rendering en architectuur

- [ ] Kies prerendering, static generation of SSR voor SEO-landingspagina's.
- [ ] Zorg dat iedere indexeerbare pagina unieke metadata heeft.
- [ ] Voeg een echte 404-pagina toe.
- [ ] Controleer canonical gedrag voor gedeelde dashboardhashes.
- [ ] Voorkom indexatie van persoonlijke of gedeelde dashboardconfiguraties.
- [ ] Voeg broodkruimels toe op guides en vergelijkingspagina's.

### P1 - Performance

- [ ] Meet Core Web Vitals met Lighthouse en Search Console.
- [ ] Verwijder of self-host render-blocking Google Fonts.
- [ ] Beperk ongebruikte JavaScript op marketingpagina's.
- [ ] Optimaliseer afbeeldingen en social previews.
- [ ] Controleer mobiele layout en tap targets.

### P2 - Structured data

- [ ] Voeg `SoftwareApplication` schema toe op de homepage.
- [ ] Voeg `BreadcrumbList` toe op onderliggende pagina's.
- [ ] Voeg alleen `FAQPage` toe als de FAQ zichtbaar op de pagina staat.
- [ ] Valideer schema via Google's Rich Results Test.

## 8. Contentplan

Publiceer content om de homepage te ondersteunen, niet om willekeurig volume te produceren.

### Fase 1

1. What Is a Status Page Aggregator?
2. How to Monitor Multiple Status Pages
3. Status Page Aggregator vs Uptime Monitor
4. How to Monitor Atlassian Statuspage Components

### Fase 2

1. StatusGator Alternatives for Simple Status Monitoring
2. How to Build a Vendor Status Dashboard
3. How to Track Planned Maintenance Across Vendors
4. Third-Party Status Monitoring for SRE Teams

### Contentvereisten

- [ ] Een duidelijke zoekintentie per artikel
- [ ] Een primaire interne link naar de homepage
- [ ] Een relevante product-CTA
- [ ] Originele voorbeelden of screenshots
- [ ] Geen pagina's maken puur voor nulvolumevarianten
- [ ] Jaarlijks actualiseren van vergelijking- en toolpagina's

## 9. Interne linking

### Homepage linkt naar

- Free Status Dashboard
- Atlassian Status Dashboard
- StatusGator Alternative
- Monitor Multiple Status Pages guide

### Iedere landingspagina linkt naar

- Homepage met gedeeltelijk beschrijvende anchor
- Minimaal een relevante guide
- Supported Status Pages
- Primaire product-CTA

### Anchorvariatie

Gebruik variatie en vermijd exact-match overoptimalisatie:

- status page aggregator
- monitor multiple status pages
- central status dashboard
- free status dashboard
- Atlassian status monitoring
- view all service statuses

## 10. Autoriteit en backlinks

### Eerste 90 dagen

- [ ] Maak de GitHub-repository openbaar als open source onderdeel van de strategie wordt.
- [ ] Schrijf een productgerichte GitHub README met websitelink.
- [ ] Publiceer een launchpost op Product Hunt.
- [ ] Deel een technische introductie op Dev.to.
- [ ] Dien het project in bij relevante "awesome status page"-lijsten.
- [ ] Deel een inhoudelijke case in relevante SRE- en DevOps-community's.
- [ ] Benader artikelen die status page aggregators vergelijken.
- [ ] Maak deelbare voorbeeldtemplates voor bekende services.

### Backlinkdoel

- 10 relevante verwijzende domeinen binnen 90 dagen
- 25 relevante verwijzende domeinen binnen 6 maanden

Kwaliteit en relevantie zijn belangrijker dan aantallen.

## 11. Meting

### Installeren

- [ ] Google Search Console
- [ ] Bing Webmaster Tools
- [ ] Privacyvriendelijke analytics
- [ ] Rank tracking voor de bewezen keywords
- [ ] Conversiemeting voor aangemaakte dashboards

### Te volgen keywords

- status page aggregator
- free status dashboard
- service status monitor
- Atlassian status dashboard
- StatusGator alternative
- Branded zoekopdrachten voor Status Pages Hub

### Maandelijkse KPI's

- Geindexeerde pagina's
- Organische impressies
- Organische klikken
- Gemiddelde positie per targetkeyword
- CTR per landingspagina
- Nieuwe verwijzende domeinen
- Aangemaakte dashboards
- Conversie van organisch bezoek
- Branded search volume

## 12. Doelen

### Binnen 30 dagen

- [ ] Homepage technisch indexeerbaar
- [ ] Metadata, canonical, robots en sitemap actief
- [ ] Drie kernlandingspagina's gepubliceerd
- [ ] Search Console geconfigureerd
- [ ] Eerste indexatie gecontroleerd

### Binnen 90 dagen

- [ ] Top 20 voor `status page aggregator`
- [ ] Minimaal 10 relevante verwijzende domeinen
- [ ] Vier sterke ondersteunende artikelen
- [ ] Eerste organische dashboardgebruikers

### Binnen 6 maanden

- [ ] Top 10 voor `status page aggregator`
- [ ] Top 10 voor minimaal twee secundaire keywords
- [ ] Minimaal 25 relevante verwijzende domeinen
- [ ] Stabiele groei in branded en non-branded zoekverkeer

## 13. Beslisregels

Gebruik deze regels bij nieuwe SEO-ideeen:

1. Maak alleen een nieuwe landingspagina bij een afwijkende zoekintentie.
2. Gebruik nulvolume-keywords als ondersteunende copy, niet automatisch als pagina.
3. Kies productrelevantie boven hoger maar verkeerd zoekvolume.
4. Publiceer geen claims over providers die technisch niet worden ondersteund.
5. Houd de homepage primair gericht op `status page aggregator`.
6. Controleer keywords en SERPs ieder kwartaal opnieuw met DataForSEO.
7. Verbeter bestaande pagina's voordat er veel nieuwe content wordt toegevoegd.

## 14. Eerstvolgende acties

Werk in deze volgorde:

1. [ ] Domein en definitieve merknaam vastleggen
2. [ ] Homepagecopy en vaste metadata implementeren
3. [ ] Robots, sitemap, canonical en structured data toevoegen
4. [ ] Marketingcontent statisch indexeerbaar maken
5. [ ] Free Status Dashboard-pagina publiceren
6. [ ] Atlassian Status Dashboard-pagina publiceren
7. [ ] Search Console en analytics instellen
8. [ ] Eerste handleiding publiceren
9. [ ] GitHub- en communitylaunch uitvoeren
10. [ ] Na 30 dagen rankings en indexatie evalueren
