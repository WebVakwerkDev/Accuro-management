# Design: Uitbreiding naar Automatisering & Software Diensten

**Datum:** 2026-04-02  
**Status:** Goedgekeurd  
**Aanpak:** Minimale uitbreiding op bestaand systeem (Aanpak A)

## Achtergrond

Het systeem was oorspronkelijk gebouwd voor webdevelopment. De eigenaar biedt voortaan ook automatiseringsdiensten (Make, n8n, Zapier), custom software op maat en AI-integraties aan. De uitbreiding moet deze diensten volledig ondersteunen zonder het bestaande systeem te breken.

## Scope

### Wat verandert

1. `ProjectType` enum — 4 nieuwe types
2. `ProjectStatus` enum — 2 nieuwe statussen
3. `ProjectWorkspace` model — 3 nieuwe optionele velden
4. Alembic migratie — 1 nieuwe migratie
5. Backend schemas — uitbreiden met nieuwe velden
6. Frontend — conditionele velden, nieuwe badges, finance filter, offerte label
7. Dashboard — `projects_without_repos` metric beperken tot web-types

### Wat niet verandert

- Factuurlogica en belastingoverzichten
- Klantbeheer
- Tijdregistratie en taken
- Gebruikers en rechten

---

## Data Model

### ProjectType (uitbreiding)

```python
# Nieuw
WORKFLOW_AUTOMATION    = "WORKFLOW_AUTOMATION"    # Make, n8n, Zapier
CUSTOM_SOFTWARE        = "CUSTOM_SOFTWARE"         # Maatwerk applicaties
AI_INTEGRATION         = "AI_INTEGRATION"          # Chatbots, LLM-koppelingen
AUTOMATION_MAINTENANCE = "AUTOMATION_MAINTENANCE"  # Recurring onderhoud automations
```

Bestaande waarden blijven ongewijzigd.

### ProjectStatus (uitbreiding)

```python
# Nieuw — ingevoegd tussen IN_PROGRESS en REVIEW
TESTING = "TESTING"   # Testfase voor software/automations
LIVE    = "LIVE"      # Actief in productie (na COMPLETED)
```

Volledige flow: `LEAD → INTAKE → IN_PROGRESS → TESTING → WAITING_FOR_CLIENT → REVIEW → COMPLETED → LIVE → MAINTENANCE → PAUSED`

### ProjectWorkspace (nieuwe velden)

| Veld | Type | Nullable | Beschrijving |
|------|------|----------|--------------|
| `tools_used` | JSON (list) | Ja | Tools/platforms gebruikt in het project, bijv. `["Make", "OpenAI", "Airtable"]` |
| `delivery_form` | VARCHAR(50) | Ja | Leveringsvorm: `SaaS`, `self-hosted`, of `embedded` |
| `recurring_fee` | NUMERIC(10,2) | Ja | Maandelijks abonnementsbedrag als actief bij klant |

Bestaande velden `domain_name` en `hosting_info` blijven staan — ze zijn al optioneel en verstoren niet-webprojecten niet.

---

## Migratie

**Bestand:** `backend/alembic/versions/004_add_automation_software_fields.py`

- `ALTER TYPE project_type ADD VALUE` voor de 4 nieuwe enum-waarden
- `ALTER TYPE project_status ADD VALUE` voor `TESTING` en `LIVE`
- `ALTER TABLE project_workspaces ADD COLUMN tools_used JSON`
- `ALTER TABLE project_workspaces ADD COLUMN delivery_form VARCHAR(50)`
- `ALTER TABLE project_workspaces ADD COLUMN recurring_fee NUMERIC(10,2)`

PostgreSQL laat `ADD VALUE` toe zonder tabel-rebuild; geen data-verlies op bestaande rijen.

---

## Backend

### Schemas (`app/schemas/project.py`)

- `ProjectWorkspaceCreate` en `ProjectWorkspaceUpdate` krijgen `tools_used: list | None`, `delivery_form: str | None`, `recurring_fee: Decimal | None`
- `ProjectWorkspaceRead` idem

### Dashboard (`app/routers/dashboard.py`)

- `projects_without_repos` metric wordt gefilterd op web-types: `NEW_WEBSITE`, `REDESIGN`, `MAINTENANCE`, `LANDING_PAGE`, `PORTFOLIO`, `WEBSHOP`
- Automatiserings- en softwareprojecten tellen niet mee in deze metric

### Finance router (optioneel, fase 2)

- Filter op `project_type` in omzetoverzicht zodat web vs. automatisering apart zichtbaar is

---

## Frontend

### ProjectsView & ProjectDetailView

- Projecttype-dropdown krijgt 4 nieuwe opties met duidelijke labels in het Nederlands
- Nieuwe velden worden conditioneel getoond:
  - `tools_used`: tag-input (chips), zichtbaar voor alle types
  - `delivery_form`: dropdown, zichtbaar bij `CUSTOM_SOFTWARE` en `AI_INTEGRATION`
  - `recurring_fee`: geldbedrag input, zichtbaar bij `AUTOMATION_MAINTENANCE` of wanneer het veld al een waarde heeft

### Statusbadges

| Status | Kleur |
|--------|-------|
| `TESTING` | Amber/oranje |
| `LIVE` | Groen (onderscheiden van `COMPLETED`) |

### ProposalsView

- `price_label` wordt een dropdown met snelkeuzes: `Projectprijs`, `Abonnementsprijs`, `Maatwerktarief`
- Vrije invoer blijft mogelijk

### Taalgebruik

- Web-specifieke labels ("webproject") worden geneutraliseerd naar "project" of "opdracht" door de hele UI

---

## Beslissingen en afwegingen

| Beslissing | Alternatief | Reden keuze |
|------------|-------------|-------------|
| Één model voor alle projecttypes | Apart `ServiceContract` model | Minder complexiteit, voldoende voor solo bureau |
| Recurring fee als veld op project | Aparte facturatie-cyclus entiteit | Pragmatisch, uitbreidbaar later |
| Conditionele velden in UI | Aparte views per projecttype | Minder duplicatie, één projectoverzicht |

---

## Wat dit niet oplost

- Automatisch aanmaken van recurring facturen op basis van `recurring_fee` (kan later als losse feature)
- Aparte omzetrapportage per dienst type in de finance view (optioneel, fase 2)
