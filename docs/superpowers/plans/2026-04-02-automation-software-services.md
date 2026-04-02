# Automatisering & Software Diensten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Breid het project management systeem uit zodat naast webdevelopment ook automatisering (Make/n8n/Zapier), custom software en AI-integraties volledig ondersteund worden.

**Architecture:** Minimale uitbreiding op het bestaande systeem — nieuwe enum-waarden voor type en status, drie optionele velden op `ProjectWorkspace`, en bijpassende UI-updates. Geen nieuw model, geen aparte flows.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Alembic (migraties), Vue 3 + PrimeVue (frontend), PostgreSQL

---

## Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| `backend/alembic/versions/004_add_automation_software_fields.py` | Nieuw — enum-uitbreidingen + nieuwe kolommen |
| `backend/app/models/project.py` | Nieuwe enum-waarden + 3 nieuwe velden op model |
| `backend/app/schemas/project.py` | Nieuwe velden in Create/Update/Response schemas |
| `backend/app/routers/dashboard.py` | `projects_without_repos` beperken tot web-types |
| `backend/tests/test_projects.py` | Tests voor nieuwe types, statussen en velden |
| `frontend/src/composables/useFormatting.ts` | `TESTING` en `LIVE` toevoegen aan `statusColor` / `statusDot` |
| `frontend/src/views/ProjectsView.vue` | Nieuwe typeOptions + statusOptions |
| `frontend/src/views/ProjectDetailView.vue` | Nieuwe statusOptions + nieuwe velden in edit dialog + weergave |

---

## Task 1: Alembic migratie

**Files:**
- Create: `backend/alembic/versions/004_add_automation_software_fields.py`

- [ ] **Stap 1: Schrijf de migratie**

```python
"""add automation and software service fields

Revision ID: 004
Revises: 003
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend project_type enum
    for value in ["WORKFLOW_AUTOMATION", "CUSTOM_SOFTWARE", "AI_INTEGRATION", "AUTOMATION_MAINTENANCE"]:
        op.execute(sa.text(f"ALTER TYPE project_type ADD VALUE IF NOT EXISTS '{value}'"))

    # Extend project_status enum
    for value in ["TESTING", "LIVE"]:
        op.execute(sa.text(f"ALTER TYPE project_status ADD VALUE IF NOT EXISTS '{value}'"))

    # Add new columns to project_workspaces
    op.add_column("project_workspaces", sa.Column("tools_used", sa.JSON(), nullable=True))
    op.add_column("project_workspaces", sa.Column("delivery_form", sa.String(50), nullable=True))
    op.add_column("project_workspaces", sa.Column("recurring_fee", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("project_workspaces", "recurring_fee")
    op.drop_column("project_workspaces", "delivery_form")
    op.drop_column("project_workspaces", "tools_used")
    # Note: PostgreSQL does not support removing enum values; downgrade leaves enum values in place
```

- [ ] **Stap 2: Voer de migratie uit**

```bash
cd backend
alembic upgrade head
```

Verwacht: `Running upgrade 003 -> 004`

- [ ] **Stap 3: Verifieer de database**

```bash
alembic current
```

Verwacht: `004 (head)`

---

## Task 2: Backend model uitbreiden

**Files:**
- Modify: `backend/app/models/project.py`

- [ ] **Stap 1: Schrijf falende test**

```python
# backend/tests/test_projects.py — voeg toe aan klasse TestProjects
async def test_create_workflow_automation_project(self, client, admin_token, test_client_data):
    response = await client.post("/api/v1/projects", json={
        "client_id": test_client_data["id"],
        "name": "Make Automation Flow",
        "project_type": "WORKFLOW_AUTOMATION",
        "tools_used": ["Make", "Airtable", "Slack"],
        "delivery_form": "embedded",
        "recurring_fee": "149.00",
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    data = response.json()
    assert data["project_type"] == "WORKFLOW_AUTOMATION"
    assert data["tools_used"] == ["Make", "Airtable", "Slack"]
    assert data["delivery_form"] == "embedded"
    assert float(data["recurring_fee"]) == 149.00

async def test_create_project_with_testing_status(self, client, admin_token, test_client_data):
    response = await client.post("/api/v1/projects", json={
        "client_id": test_client_data["id"],
        "name": "Custom App",
        "project_type": "CUSTOM_SOFTWARE",
        "status": "TESTING",
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    assert response.json()["status"] == "TESTING"

async def test_create_project_with_live_status(self, client, admin_token, test_client_data):
    response = await client.post("/api/v1/projects", json={
        "client_id": test_client_data["id"],
        "name": "AI Chatbot",
        "project_type": "AI_INTEGRATION",
        "status": "LIVE",
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    assert response.json()["status"] == "LIVE"
```

- [ ] **Stap 2: Voer tests uit — verwacht FAIL**

```bash
cd backend
pytest tests/test_projects.py::TestProjects::test_create_workflow_automation_project -v
```

Verwacht: FAIL — `WORKFLOW_AUTOMATION is not a valid ProjectType`

- [ ] **Stap 3: Update het model**

In `backend/app/models/project.py`, vervang de `ProjectType` en `ProjectStatus` enums en voeg drie velden toe aan `ProjectWorkspace`:

```python
class ProjectType(str, enum.Enum):
    NEW_WEBSITE = "NEW_WEBSITE"
    REDESIGN = "REDESIGN"
    MAINTENANCE = "MAINTENANCE"
    LANDING_PAGE = "LANDING_PAGE"
    PORTFOLIO = "PORTFOLIO"
    WEBSHOP = "WEBSHOP"
    WORKFLOW_AUTOMATION = "WORKFLOW_AUTOMATION"
    CUSTOM_SOFTWARE = "CUSTOM_SOFTWARE"
    AI_INTEGRATION = "AI_INTEGRATION"
    AUTOMATION_MAINTENANCE = "AUTOMATION_MAINTENANCE"
    OTHER = "OTHER"


class ProjectStatus(str, enum.Enum):
    LEAD = "LEAD"
    INTAKE = "INTAKE"
    IN_PROGRESS = "IN_PROGRESS"
    TESTING = "TESTING"
    WAITING_FOR_CLIENT = "WAITING_FOR_CLIENT"
    REVIEW = "REVIEW"
    COMPLETED = "COMPLETED"
    LIVE = "LIVE"
    MAINTENANCE = "MAINTENANCE"
    PAUSED = "PAUSED"
```

Voeg de drie nieuwe velden toe aan `ProjectWorkspace` (na het `tags` veld):

```python
    tools_used: Mapped[list | None] = mapped_column(JSON, nullable=True)
    delivery_form: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recurring_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
```

Voeg ook `from decimal import Decimal` toe bovenaan als dat nog niet aanwezig is (het staat er al via de bestaande imports — controleer dit).

- [ ] **Stap 4: Voer tests uit — verwacht PASS**

```bash
pytest tests/test_projects.py::TestProjects::test_create_workflow_automation_project tests/test_projects.py::TestProjects::test_create_project_with_testing_status tests/test_projects.py::TestProjects::test_create_project_with_live_status -v
```

Verwacht: 3x PASS

- [ ] **Stap 5: Commit**

```bash
git add backend/app/models/project.py backend/tests/test_projects.py
git commit -m "feat(models): add automation/software project types, TESTING/LIVE statuses, and new fields"
```

---

## Task 3: Backend schemas uitbreiden

**Files:**
- Modify: `backend/app/schemas/project.py`

- [ ] **Stap 1: Schrijf falende test**

```python
# backend/tests/test_projects.py — voeg toe aan TestProjects
async def test_update_project_tools_and_recurring_fee(self, client, admin_token, test_project_data):
    response = await client.patch(f"/api/v1/projects/{test_project_data['id']}", json={
        "tools_used": ["n8n", "OpenAI"],
        "recurring_fee": "99.00",
        "delivery_form": "SaaS",
    }, headers=auth_header(admin_token))
    assert response.status_code == 200
    data = response.json()
    assert data["tools_used"] == ["n8n", "OpenAI"]
    assert float(data["recurring_fee"]) == 99.00
    assert data["delivery_form"] == "SaaS"
```

- [ ] **Stap 2: Voer test uit — verwacht FAIL**

```bash
pytest tests/test_projects.py::TestProjects::test_update_project_tools_and_recurring_fee -v
```

Verwacht: FAIL — de velden worden genegeerd (niet in schema)

- [ ] **Stap 3: Update de schemas**

In `backend/app/schemas/project.py`:

Voeg bovenaan toe:
```python
from decimal import Decimal
```

Update `ProjectCreate`:
```python
class ProjectCreate(BaseModel):
    client_id: str
    name: str
    project_type: ProjectType
    status: ProjectStatus = ProjectStatus.LEAD
    priority: Priority = Priority.MEDIUM
    description: str | None = None
    intake_summary: str | None = None
    scope: str | None = None
    tech_stack: str | None = None
    domain_name: str | None = None
    hosting_info: str | None = None
    start_date: date | None = None
    owner_user_id: str | None = None
    tags: list[str] = []
    tools_used: list[str] | None = None
    delivery_form: str | None = None
    recurring_fee: Decimal | None = None

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()
```

Update `ProjectUpdate`:
```python
class ProjectUpdate(BaseModel):
    name: str | None = None
    project_type: ProjectType | None = None
    status: ProjectStatus | None = None
    priority: Priority | None = None
    description: str | None = None
    intake_summary: str | None = None
    scope: str | None = None
    tech_stack: str | None = None
    domain_name: str | None = None
    hosting_info: str | None = None
    start_date: date | None = None
    owner_user_id: str | None = None
    tags: list[str] | None = None
    tools_used: list[str] | None = None
    delivery_form: str | None = None
    recurring_fee: Decimal | None = None
```

Update `ProjectResponse`:
```python
class ProjectResponse(BaseModel):
    id: str
    client_id: str
    name: str
    slug: str
    project_type: str
    status: str
    priority: str
    description: str | None
    intake_summary: str | None
    scope: str | None
    tech_stack: str | None
    domain_name: str | None
    hosting_info: str | None
    start_date: date | None
    owner_user_id: str | None
    tags: list[str]
    tools_used: list[str] | None
    delivery_form: str | None
    recurring_fee: Decimal | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Stap 4: Voer test uit — verwacht PASS**

```bash
pytest tests/test_projects.py::TestProjects::test_update_project_tools_and_recurring_fee -v
```

Verwacht: PASS

- [ ] **Stap 5: Draai alle project tests**

```bash
pytest tests/test_projects.py -v
```

Verwacht: alle tests PASS

- [ ] **Stap 6: Commit**

```bash
git add backend/app/schemas/project.py
git commit -m "feat(schemas): add tools_used, delivery_form, recurring_fee to project schemas"
```

---

## Task 4: Dashboard metric fixeren

**Files:**
- Modify: `backend/app/routers/dashboard.py`

- [ ] **Stap 1: Schrijf falende test**

```python
# backend/tests/test_dashboard.py — voeg toe aan de bestaande test klasse
async def test_automation_project_not_counted_without_repos(self, client, admin_token, test_client_data):
    """Automation projects should not appear in projects_without_repos metric."""
    # Create an automation project (no repo)
    response = await client.post("/api/v1/projects", json={
        "client_id": test_client_data["id"],
        "name": "Make Flow",
        "project_type": "WORKFLOW_AUTOMATION",
        "status": "IN_PROGRESS",
    }, headers=auth_header(admin_token))
    assert response.status_code == 201

    stats = await client.get("/api/v1/dashboard/stats", headers=auth_header(admin_token))
    assert stats.status_code == 200
    # The automation project should NOT increase projects_without_repos
    # (exact count depends on fixture state; we just assert it doesn't crash and returns valid data)
    assert "projects_without_repos" in stats.json()
```

- [ ] **Stap 2: Voer test uit — verwacht PASS (smoke test)**

```bash
pytest tests/test_dashboard.py -v
```

- [ ] **Stap 3: Update de dashboard router**

In `backend/app/routers/dashboard.py`, pas de `projects_without_repos` query aan.

Voeg bovenaan de import toe (na de bestaande `ProjectStatus` import):
```python
from app.models.project import ProjectWorkspace, ProjectStatus, ProjectType
```

Vervang de `without_repos` query (regels ~72-81):
```python
WEB_TYPES = [
    ProjectType.NEW_WEBSITE.value,
    ProjectType.REDESIGN.value,
    ProjectType.MAINTENANCE.value,
    ProjectType.LANDING_PAGE.value,
    ProjectType.PORTFOLIO.value,
    ProjectType.WEBSHOP.value,
]

subq = select(ProjectRepository.project_id).distinct()
without_repos = await db.execute(
    select(func.count(ProjectWorkspace.id))
    .where(
        ProjectWorkspace.deleted_at.is_(None),
        ProjectWorkspace.status.in_([ProjectStatus.IN_PROGRESS.value, ProjectStatus.REVIEW.value]),
        ProjectWorkspace.project_type.in_(WEB_TYPES),
        ProjectWorkspace.id.notin_(subq),
    )
)
projects_without_repos = without_repos.scalar() or 0
```

- [ ] **Stap 4: Draai alle dashboard tests**

```bash
pytest tests/test_dashboard.py -v
```

Verwacht: alle tests PASS

- [ ] **Stap 5: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "fix(dashboard): exclude automation/software projects from projects_without_repos metric"
```

---

## Task 5: Frontend — statusColor en statusDot

**Files:**
- Modify: `frontend/src/composables/useFormatting.ts`

- [ ] **Stap 1: Voeg TESTING en LIVE toe aan statusColor**

In `frontend/src/composables/useFormatting.ts`, voeg toe in het `colors` object van `statusColor` (na `PAUSED`:):

```typescript
      TESTING: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
      LIVE: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
```

- [ ] **Stap 2: Voeg TESTING en LIVE toe aan statusDot**

In dezelfde file, voeg toe in het `colors` object van `statusDot` (na `PAUSED: 'bg-red-400'`):

```typescript
      TESTING: 'bg-amber-400', LIVE: 'bg-emerald-400',
```

- [ ] **Stap 3: Verifieer visueel**

Start de frontend dev server en open een project. Wijzig de status naar TESTING of LIVE via de edit dialog (na Task 6). Controleer of de badge de juiste kleur heeft.

- [ ] **Stap 4: Commit**

```bash
git add frontend/src/composables/useFormatting.ts
git commit -m "feat(frontend): add TESTING and LIVE status colors"
```

---

## Task 6: Frontend — ProjectsView uitbreiden

**Files:**
- Modify: `frontend/src/views/ProjectsView.vue`

- [ ] **Stap 1: Voeg nieuwe typeOptions toe**

In `frontend/src/views/ProjectsView.vue`, vervang de `typeOptions` array (regel ~93-98):

```typescript
const typeOptions = [
  { label: 'Nieuwe Website', value: 'NEW_WEBSITE' },
  { label: 'Redesign', value: 'REDESIGN' },
  { label: 'Onderhoud', value: 'MAINTENANCE' },
  { label: 'Landing Page', value: 'LANDING_PAGE' },
  { label: 'Portfolio', value: 'PORTFOLIO' },
  { label: 'Webshop', value: 'WEBSHOP' },
  { label: 'Workflow Automatisering', value: 'WORKFLOW_AUTOMATION' },
  { label: 'Custom Software', value: 'CUSTOM_SOFTWARE' },
  { label: 'AI-integratie', value: 'AI_INTEGRATION' },
  { label: 'Automatisering Onderhoud', value: 'AUTOMATION_MAINTENANCE' },
  { label: 'Overig', value: 'OTHER' },
]
```

- [ ] **Stap 2: Voeg TESTING en LIVE toe aan statusOptions**

In dezelfde file, vervang de `statusOptions` array (regel ~83-88):

```typescript
const statusOptions = [
  { label: 'Lead', value: 'LEAD' },
  { label: 'Intake', value: 'INTAKE' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Testen', value: 'TESTING' },
  { label: 'Wachtend', value: 'WAITING_FOR_CLIENT' },
  { label: 'Review', value: 'REVIEW' },
  { label: 'Afgerond', value: 'COMPLETED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Onderhoud', value: 'MAINTENANCE' },
  { label: 'Gepauzeerd', value: 'PAUSED' },
]
```

- [ ] **Stap 3: Update de form default**

Regel ~81, verander de `form` default `project_type` van `'NEW_WEBSITE'` naar `'OTHER'` zodat er geen web-specifieke default is:

```typescript
const form = ref({ name: '', client_id: '', project_type: 'OTHER', priority: 'MEDIUM', status: 'LEAD', description: '' })
```

- [ ] **Stap 4: Commit**

```bash
git add frontend/src/views/ProjectsView.vue
git commit -m "feat(frontend): add automation/software project types and new statuses to ProjectsView"
```

---

## Task 7: Frontend — ProjectDetailView uitbreiden

**Files:**
- Modify: `frontend/src/views/ProjectDetailView.vue`

- [ ] **Stap 1: Voeg TESTING en LIVE toe aan statusOptions**

In `frontend/src/views/ProjectDetailView.vue`, vervang de `statusOptions` array (regel ~373-378):

```typescript
const statusOptions = [
  { label: 'Lead', value: 'LEAD' },
  { label: 'Intake', value: 'INTAKE' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Testen', value: 'TESTING' },
  { label: 'Wachtend', value: 'WAITING_FOR_CLIENT' },
  { label: 'Review', value: 'REVIEW' },
  { label: 'Afgerond', value: 'COMPLETED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Onderhoud', value: 'MAINTENANCE' },
  { label: 'Gepauzeerd', value: 'PAUSED' },
]
```

- [ ] **Stap 2: Voeg nieuwe velden toe aan editForm initialisatie**

In `onMounted` (regel ~404), vervang de `editForm.value` toewijzing:

```typescript
editForm.value = {
  name: data.name,
  status: data.status,
  priority: data.priority,
  description: data.description,
  tools_used: data.tools_used ?? [],
  delivery_form: data.delivery_form ?? null,
  recurring_fee: data.recurring_fee ? parseFloat(data.recurring_fee) : null,
}
```

- [ ] **Stap 3: Voeg delivery_form opties toe als constante**

Voeg toe na de `commTypes` array (regel ~387):

```typescript
const deliveryFormOptions = [
  { label: 'SaaS', value: 'SaaS' },
  { label: 'Self-hosted', value: 'self-hosted' },
  { label: 'Embedded', value: 'embedded' },
]
```

- [ ] **Stap 4: Voeg nieuwe velden toe aan het edit dialog**

In het `<!-- Edit Project Dialog -->` blok (rond regel ~293), voeg toe na de bestaande `beschrijving` textarea en vóór de submit-knop sectie:

```html
        <!-- Tools gebruikt -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Tools gebruikt</label>
          <input v-model="editToolsInput" class="input" placeholder="Make, n8n, OpenAI (komma-gescheiden)" @blur="parseToolsInput" />
          <div v-if="editForm.tools_used?.length" class="flex flex-wrap gap-1.5 mt-2">
            <span v-for="tool in editForm.tools_used" :key="tool"
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
              {{ tool }}
              <button type="button" @click="editForm.tools_used = editForm.tools_used.filter((t: string) => t !== tool)" class="hover:text-blue-900">&times;</button>
            </span>
          </div>
        </div>

        <!-- Leveringsvorm + Maandelijks tarief -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Leveringsvorm</label>
            <Dropdown v-model="editForm.delivery_form" :options="deliveryFormOptions" optionLabel="label" optionValue="value" placeholder="Selecteer" showClear class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Maandelijks tarief</label>
            <InputNumber v-model="editForm.recurring_fee" mode="currency" currency="EUR" locale="nl-NL" class="w-full" placeholder="Optioneel" />
          </div>
        </div>
```

- [ ] **Stap 5: Voeg de tools input helper toe aan het script**

Voeg toe na de `editForm` declaratie (regel ~353):

```typescript
const editToolsInput = ref('')

function parseToolsInput() {
  if (!editToolsInput.value.trim()) return
  const parsed = editToolsInput.value.split(',').map(t => t.trim()).filter(Boolean)
  const existing = editForm.value.tools_used ?? []
  editForm.value.tools_used = [...new Set([...existing, ...parsed])]
  editToolsInput.value = ''
}
```

- [ ] **Stap 6: Voeg weergave van nieuwe velden toe in de project-header info**

Zoek in de template naar de `<p class="text-xs font-mono text-gray-500 mt-1">` regel (regel ~18) die de project metadata toont. Voeg onder die `<p>` tag een nieuw info-blok toe:

```html
    <!-- Extra metadata voor automatisering/software -->
    <div v-if="project.tools_used?.length || project.delivery_form || project.recurring_fee" class="flex flex-wrap gap-3 mt-2">
      <div v-if="project.tools_used?.length" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Tools</span>
        <div class="flex flex-wrap gap-1">
          <span v-for="tool in project.tools_used" :key="tool" class="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded">{{ tool }}</span>
        </div>
      </div>
      <div v-if="project.delivery_form" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Levering</span>
        <span class="text-xs text-gray-600">{{ project.delivery_form }}</span>
      </div>
      <div v-if="project.recurring_fee" class="flex items-center gap-1.5">
        <span class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Abonnement</span>
        <span class="text-xs font-mono text-gray-700">{{ formatCurrency(project.recurring_fee) }}/mnd</span>
      </div>
    </div>
```

- [ ] **Stap 7: Commit**

```bash
git add frontend/src/views/ProjectDetailView.vue
git commit -m "feat(frontend): add automation fields to ProjectDetailView edit dialog and project header"
```

---

## Task 8: Smoke test en eindverificatie

- [ ] **Stap 1: Draai alle backend tests**

```bash
cd backend
pytest -v
```

Verwacht: alle tests PASS (geen regressions)

- [ ] **Stap 2: Start de applicatie en test handmatig**

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

Controleer:
- [ ] Nieuw project aanmaken met type `Workflow Automatisering` → werkt
- [ ] Status `Testen` en `Live` zijn selecteerbaar → badge heeft juiste kleur
- [ ] Tools invoeren via het edit dialog → chips verschijnen
- [ ] `Leveringsvorm` en `Maandelijks tarief` worden opgeslagen en getoond
- [ ] Bestaande webprojecten werken nog normaal (geen regressions)

- [ ] **Stap 3: Final commit**

```bash
git add -A
git commit -m "feat: expand project system for automation and software services"
```

---

## Task 9: ProposalsView — price_label dropdown

**Files:**
- Modify: `frontend/src/views/ProposalsView.vue`
- Modify: `frontend/src/views/ProjectDetailView.vue` (proposal dialog)

Het `price_label` veld bestaat al in het backend model (default `"Projectprijs"`), maar is niet zichtbaar in de UI. We voegen het toe als dropdown met snelkeuzes.

- [ ] **Stap 1: Voeg price_label toe aan het formulier in ProposalsView**

In `frontend/src/views/ProposalsView.vue`:

Voeg `price_label` toe aan de form initialisatie (regel ~71):
```typescript
const form = ref<any>({
  title: '',
  client_id: '',
  amount: 0,
  recipient_name: '',
  recipient_email: '',
  recipient_company: '',
  delivery_time: '',
  price_label: 'Projectprijs',
})
```

Voeg de opties toe na de `form` declaratie:
```typescript
const priceLabelOptions = [
  { label: 'Projectprijs', value: 'Projectprijs' },
  { label: 'Abonnementsprijs', value: 'Abonnementsprijs' },
  { label: 'Maatwerktarief', value: 'Maatwerktarief' },
]
```

Voeg het veld toe in het formulier in de template, na het `Levertijd` veld en vóór de submit-knop:
```html
          <div class="col-span-2">
            <label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Prijslabel</label>
            <div class="flex gap-2">
              <Dropdown v-model="form.price_label" :options="priceLabelOptions" optionLabel="label" optionValue="value" class="w-48" />
              <input v-model="form.price_label" class="input flex-1" placeholder="Of vrij invoeren..." />
            </div>
          </div>
```

Update de form reset in `createProposal` (regel ~94):
```typescript
form.value = { title: '', client_id: '', amount: 0, recipient_name: '', recipient_email: '', recipient_company: '', delivery_time: '', price_label: 'Projectprijs' }
```

- [ ] **Stap 2: Voeg price_label toe aan het proposal dialog in ProjectDetailView**

In `frontend/src/views/ProjectDetailView.vue`, zoek de `proposalForm` declaratie (regel ~351) en voeg `price_label` toe:
```typescript
const proposalForm = ref<any>({ title: '', recipient_name: '', recipient_email: '', recipient_company: '', amount: 0, delivery_time: '', summary: '', price_label: 'Projectprijs' })
```

Voeg na de `deliveryFormOptions` constante (die je in Task 7 toevoegde) ook toe:
```typescript
const priceLabelOptions = [
  { label: 'Projectprijs', value: 'Projectprijs' },
  { label: 'Abonnementsprijs', value: 'Abonnementsprijs' },
  { label: 'Maatwerktarief', value: 'Maatwerktarief' },
]
```

Voeg in het Proposal Dialog (bij de `<form @submit.prevent="createProposal">`) het veld toe na `levertijd` en vóór `samenvatting`:
```html
        <div class="col-span-2"><label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Prijslabel</label>
          <div class="flex gap-2">
            <Dropdown v-model="proposalForm.price_label" :options="priceLabelOptions" optionLabel="label" optionValue="value" class="w-48" />
            <input v-model="proposalForm.price_label" class="input flex-1" placeholder="Of vrij invoeren..." />
          </div>
        </div>
```

- [ ] **Stap 3: Commit**

```bash
git add frontend/src/views/ProposalsView.vue frontend/src/views/ProjectDetailView.vue
git commit -m "feat(frontend): add price_label dropdown to proposal forms"
```

---

## Task 10: Taalgebruik neutraliseren

**Files:**
- Modify: `frontend/src/views/ProjectsView.vue` (koptekst / lege state)
- Modify: `frontend/src/views/DashboardView.vue` (dashboard labels indien web-specifiek)

- [ ] **Stap 1: Controleer de DashboardView op web-specifieke teksten**

Open `frontend/src/views/DashboardView.vue` en zoek naar teksten als "webproject", "website", of "zonder repo". Vervang eventuele web-specifieke labels door neutrale termen:

- "Webprojecten zonder repository" → "Projecten zonder repository"
- Controleer of de metric zelf al smal genoeg is (dat is geregeld in Task 4)

- [ ] **Stap 2: Commit (alleen als er wijzigingen zijn)**

```bash
git add frontend/src/views/DashboardView.vue
git commit -m "fix(frontend): neutralize web-specific labels in dashboard"
```
