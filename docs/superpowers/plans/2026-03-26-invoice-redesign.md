# Invoice & Proposal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace invoice/proposal PDF templates with a cleaner design, add multi-line item support with server-side price calculation, and add per-field frontend validation.

**Architecture:** Bottom-up — migration first, then backend (model → schema → router), then templates, then frontend. Each layer is tested before the next is built. The backend owns all financial calculations; the frontend is display-only for computed values.

**Tech Stack:** FastAPI + SQLAlchemy async + Pydantic v2 + Alembic (PostgreSQL/SQLite) + Jinja2 + WeasyPrint · Vue 3 Composition API + PrimeVue · pytest-asyncio + httpx (SQLite in-memory for tests)

---

## Files Changed

| File | Action |
|---|---|
| `backend/alembic/versions/004_invoice_description_nullable.py` | Create |
| `backend/app/models/invoice.py` | Modify — `description` nullable |
| `backend/app/schemas/invoice.py` | Modify — optional description, new model validator, remove subtotal_positive + desc_min, remove subtotal from InvoiceUpdate, InvoiceResponse.description → str\|None |
| `backend/app/routers/invoices.py` | Modify — server-side recalculation in create + update, add website_url to settings_data |
| `backend/app/templates/invoice.html` | Replace |
| `backend/app/templates/proposal.html` | Replace |
| `frontend/src/views/InvoicesView.vue` | Replace — line items form + per-field validation |
| `backend/tests/test_invoices.py` | Modify — update broken test, add 7 new tests |

---

## Task 1: Alembic Migration — Make `description` Nullable

**Files:**
- Create: `backend/alembic/versions/004_invoice_description_nullable.py`

- [ ] **Step 1: Write the migration file**

```python
"""make invoice description nullable

Revision ID: 004
Revises: 003
Create Date: 2026-03-26
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.alter_column("description", nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.alter_column("description", nullable=False)
```

`batch_alter_table` works on both PostgreSQL (production) and SQLite (tests).

- [ ] **Step 2: Run migration in Docker**

```bash
docker compose exec backend alembic upgrade head
```

Expected output ends with: `Running upgrade 003 -> 004, make invoice description nullable`

---

## Task 2: Update Invoice Model & Response Schema

**Files:**
- Modify: `backend/app/models/invoice.py:32`
- Modify: `backend/app/schemas/invoice.py`

- [ ] **Step 1: Update the model**

In `backend/app/models/invoice.py`, change line 32:

```python
# Before:
description: Mapped[str] = mapped_column(Text, nullable=False)

# After:
description: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Update `InvoiceCreate` schema**

Replace the entire `InvoiceCreate` class in `backend/app/schemas/invoice.py`:

```python
from pydantic import BaseModel, field_validator, model_validator
from datetime import date, datetime
from decimal import Decimal
from typing import Self
from app.models.invoice import InvoiceStatus


class InvoiceLineItem(BaseModel):
    description: str
    quantity: Decimal
    unit_price: Decimal
    total: Decimal


class InvoiceCreate(BaseModel):
    client_id: str
    project_id: str | None = None
    issue_date: date
    service_date: date | None = None
    due_date: date
    subtotal: Decimal = Decimal("0")
    vat_rate: Decimal = Decimal("21.00")
    description: str | None = None
    notes: str | None = None
    line_items: list[InvoiceLineItem] = []

    @field_validator("vat_rate")
    @classmethod
    def vat_range(cls, v: Decimal) -> Decimal:
        if v < 0 or v > 100:
            raise ValueError("VAT rate must be between 0 and 100")
        return v

    @model_validator(mode="after")
    def require_description_or_line_items(self) -> Self:
        has_description = bool(self.description and self.description.strip())
        has_line_items = len(self.line_items) > 0
        if not has_description and not has_line_items:
            raise ValueError("Geef een omschrijving of minimaal één regelitem op")
        return self
```

- [ ] **Step 3: Update `InvoiceUpdate` schema — remove `subtotal`**

Replace the `InvoiceUpdate` class:

```python
class InvoiceUpdate(BaseModel):
    issue_date: date | None = None
    service_date: date | None = None
    due_date: date | None = None
    vat_rate: Decimal | None = None
    description: str | None = None
    notes: str | None = None
    status: InvoiceStatus | None = None
    line_items: list[InvoiceLineItem] | None = None
```

- [ ] **Step 4: Update `InvoiceResponse.description` type**

Change `description: str` to `description: str | None` in `InvoiceResponse`.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/004_invoice_description_nullable.py \
        backend/app/models/invoice.py \
        backend/app/schemas/invoice.py
git commit -m "feat: make invoice description optional, add line items model validator"
```

---

## Task 3: Update Router — Server-Side Recalculation

**Files:**
- Modify: `backend/app/routers/invoices.py`

- [ ] **Step 1: Write failing tests first** (see Task 7 for full test file — write these two now)

Add to `backend/tests/test_invoices.py`:

```python
async def test_create_invoice_with_line_items(self, client, admin_token, test_client_data):
    response = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "Website", "quantity": "2", "unit_price": "500.00", "total": "0"},
            {"description": "Hosting", "quantity": "1", "unit_price": "100.00", "total": "0"},
        ],
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    data = response.json()
    assert float(data["subtotal"]) == 1100.00
    assert float(data["vat_amount"]) == 231.00
    assert float(data["total_amount"]) == 1331.00
    # Backend must overwrite the client-supplied total=0
    assert float(data["line_items"][0]["total"]) == 1000.00
    assert float(data["line_items"][1]["total"]) == 100.00

async def test_create_invoice_no_description_no_items_returns_422(self, client, admin_token, test_client_data):
    response = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
    }, headers=auth_header(admin_token))
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec backend pytest tests/test_invoices.py -v -k "line_items or no_description"
```

Expected: FAIL (router doesn't recalculate yet)

- [ ] **Step 3: Update `create_invoice` router**

In `backend/app/routers/invoices.py`, replace the `create_invoice` function body with:

```python
@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.FINANCE)),
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    client = await db.execute(select(Client).where(Client.id == body.client_id, Client.deleted_at.is_(None)))
    if not client.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    invoice_number = await _generate_invoice_number(db)

    # Server-side calculation: recalculate from line items when present
    line_items_data = []
    if body.line_items:
        for item in body.line_items:
            item_total = (item.quantity * item.unit_price).quantize(Decimal("0.01"))
            line_items_data.append({
                "description": item.description,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "total": str(item_total),
            })
        subtotal = sum(Decimal(i["total"]) for i in line_items_data)
    else:
        subtotal = body.subtotal

    vat_amount, total_amount = _calculate_vat(subtotal, body.vat_rate)

    invoice = Invoice(
        client_id=body.client_id,
        project_id=body.project_id,
        invoice_number=invoice_number,
        issue_date=body.issue_date,
        service_date=body.service_date,
        due_date=body.due_date,
        status=InvoiceStatus.DRAFT.value,
        subtotal=subtotal,
        vat_rate=body.vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        description=body.description,
        notes=body.notes,
        line_items=line_items_data,
    )
    db.add(invoice)
    await db.flush()

    await create_audit_log(
        db, "Invoice", invoice.id, "CREATE",
        actor_user_id=current_user.id,
        metadata={"invoice_number": invoice_number, "total": str(total_amount)},
        ip_address=get_client_ip(request),
    )
    return InvoiceResponse.model_validate(invoice)
```

- [ ] **Step 4: Update `update_invoice` router**

Replace the update logic in `update_invoice` to handle line items recalculation. The key change is in how subtotal/vat are recalculated. Replace lines 141–175 with:

```python
@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    request: Request,
    current_user=Depends(require_role(Role.ADMIN, Role.FINANCE)),
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    changes = {}
    update_data = body.model_dump(exclude_unset=True)

    # Handle line_items update with server-side recalculation
    if "line_items" in update_data and update_data["line_items"] is not None:
        raw_items = update_data["line_items"]
        line_items_data = []
        for item in raw_items:
            qty = Decimal(str(item["quantity"]))
            price = Decimal(str(item["unit_price"]))
            item_total = (qty * price).quantize(Decimal("0.01"))
            line_items_data.append({
                "description": item["description"],
                "quantity": str(qty),
                "unit_price": str(price),
                "total": str(item_total),
            })
        new_subtotal = sum(Decimal(i["total"]) for i in line_items_data)
        changes["line_items"] = {"old": str(invoice.line_items), "new": str(line_items_data)}
        invoice.line_items = line_items_data
        invoice.subtotal = new_subtotal
        del update_data["line_items"]

    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        old_value = getattr(invoice, field)
        if str(old_value) != str(value):
            changes[field] = {"old": str(old_value), "new": str(value)}
            setattr(invoice, field, value)

    # Recalculate VAT whenever subtotal or vat_rate may have changed
    if changes:
        vat_amount, total_amount = _calculate_vat(invoice.subtotal, invoice.vat_rate)
        invoice.vat_amount = vat_amount
        invoice.total_amount = total_amount
        await db.flush()
        await db.refresh(invoice)
        await create_audit_log(
            db, "Invoice", invoice.id, "UPDATE",
            actor_user_id=current_user.id,
            metadata=changes,
            ip_address=get_client_ip(request),
        )

    return InvoiceResponse.model_validate(invoice)
```

- [ ] **Step 5: Add `website_url` to `settings_data` in `download_invoice_pdf`**

In the `download_invoice_pdf` endpoint (around line 264), add one line to `settings_data`:

```python
settings_data = {
    ...existing fields...,
    "website_url": settings.website_url,  # Add this line
}
```

- [ ] **Step 6: Run the new tests**

```bash
docker compose exec backend pytest tests/test_invoices.py -v -k "line_items or no_description"
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/invoices.py backend/tests/test_invoices.py
git commit -m "feat: server-side line items recalculation in invoice create/update"
```

---

## Task 4: Replace `invoice.html` Template

**Files:**
- Replace: `backend/app/templates/invoice.html`

- [ ] **Step 1: Replace the template**

Replace the entire contents of `backend/app/templates/invoice.html` with:

```html
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<style>
    @page { size: A4; margin: 2cm 2.5cm 2.5cm 2.5cm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.5;
        color: #1a1a1a;
        background: #fff;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 48px;
    }
    .brand { font-size: 18pt; font-weight: 700; color: #111; letter-spacing: -.2px; }
    .brand-sub { font-size: 9.5pt; color: #777; margin-top: 3px; }
    .header-info {
        display: grid;
        grid-template-columns: auto auto;
        gap: 3px 20px;
        font-size: 10pt;
        text-align: left;
    }
    .hi-lbl { font-weight: 700; color: #111; white-space: nowrap; }
    .hi-val { color: #444; }
    .recipient {
        margin-bottom: 36px;
        font-size: 10.5pt;
        line-height: 1.75;
        color: #1a1a1a;
    }
    .recipient strong { font-weight: 700; }
    .recipient .tav { color: #777; font-size: 10pt; }
    .doc-title {
        font-size: 17pt;
        font-weight: 700;
        letter-spacing: .5px;
        color: #111;
        margin-bottom: 14px;
    }
    .meta {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 16px;
        font-size: 10.5pt;
        max-width: 340px;
    }
    .mk { font-weight: 700; color: #111; }
    .mv { color: #333; }
    .divider { border: none; border-top: 1px solid #d0d0d0; margin: 18px 0 0 0; }
    .items { width: 100%; border-collapse: collapse; margin-top: 0; }
    .items thead tr {
        border-top: 1.5px solid #111;
        border-bottom: 1.5px solid #111;
    }
    .items th {
        font-size: 9pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: #555;
        padding: 7px 8px;
        text-align: left;
    }
    .items th.r { text-align: right; }
    .items tbody td {
        padding: 9px 8px;
        font-size: 10.5pt;
        vertical-align: top;
        border-bottom: 1px solid #ececec;
        color: #1a1a1a;
    }
    .items tbody td.r {
        text-align: right;
        white-space: nowrap;
    }
    .bottom {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 2px;
        padding-bottom: 20px;
        border-bottom: 1px solid #ddd;
    }
    .vat-tbl { border-collapse: collapse; font-size: 9.5pt; margin-top: 14px; }
    .vat-tbl th {
        font-weight: 700;
        color: #555;
        text-align: left;
        padding: 5px 24px 4px 0;
        border-bottom: 1px solid #ccc;
    }
    .vat-tbl td { padding: 5px 24px 0 0; color: #444; }
    .totals { border-collapse: collapse; min-width: 200px; font-size: 10.5pt; }
    .totals td { padding: 4px 0 4px 24px; color: #555; }
    .totals td:last-child {
        text-align: right;
        white-space: nowrap;
    }
    .totals .grand td {
        font-size: 12pt;
        font-weight: 700;
        color: #111;
        border-top: 1.5px solid #111;
        padding-top: 8px;
    }
    .payment {
        padding-top: 18px;
        font-size: 10.5pt;
        color: #333;
        line-height: 1.9;
    }
    .footer {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 10px;
        border-top: 1px solid #e5e5e5;
        font-size: 9pt;
        color: #bbb;
    }
</style>
</head>
<body>

<div class="header">
    <div>
        <div class="brand">{{ settings.company_name }}</div>
        {% if settings.website_url or settings.email %}
        <div class="brand-sub">
            {% if settings.website_url %}{{ settings.website_url }}{% endif %}
            {% if settings.website_url and settings.email %} &middot; {% endif %}
            {% if settings.email %}{{ settings.email }}{% endif %}
        </div>
        {% endif %}
    </div>
    <div class="header-info">
        {% if settings.address %}<span class="hi-lbl">Adres</span><span class="hi-val">{{ settings.address }}</span>{% endif %}
        {% if settings.phone %}<span class="hi-lbl">Telefoon</span><span class="hi-val">{{ settings.phone }}</span>{% endif %}
        {% if settings.iban %}<span class="hi-lbl">IBAN</span><span class="hi-val">{{ settings.iban }}</span>{% endif %}
        {% if settings.kvk_number %}<span class="hi-lbl">KVK</span><span class="hi-val">{{ settings.kvk_number }}</span>{% endif %}
        {% if settings.vat_number %}<span class="hi-lbl">BTW</span><span class="hi-val">{{ settings.vat_number }}</span>{% endif %}
    </div>
</div>

<div class="recipient">
    <strong>{{ client.company_name }}</strong><br/>
    {% if client.contact_name %}<span class="tav">T.a.v. {{ client.contact_name }}</span><br/>{% endif %}
    {% if client.address %}{{ client.address }}<br/>{% endif %}
    {% if client.email %}{{ client.email }}{% endif %}
</div>

<div class="doc-title">FACTUUR</div>
<div class="meta">
    <span class="mk">Factuurnummer</span><span class="mv">{{ invoice.invoice_number }}</span>
    <span class="mk">Factuurdatum</span><span class="mv">{{ invoice.issue_date|date_nl }}</span>
    <span class="mk">Vervaldatum</span><span class="mv">{{ invoice.due_date|date_nl }}</span>
    {% if invoice.service_date %}
    <span class="mk">Leveringsdatum</span><span class="mv">{{ invoice.service_date|date_nl }}</span>
    {% endif %}
</div>
<hr class="divider"/>

<table class="items">
    <thead>
        <tr>
            <th style="width:50%;">Omschrijving</th>
            <th class="r">Aantal</th>
            <th class="r">Tarief</th>
            <th class="r">Bedrag excl. BTW</th>
        </tr>
    </thead>
    <tbody>
        {% if invoice.line_items %}
            {% for item in invoice.line_items %}
            <tr>
                <td>{{ item.description }}</td>
                <td class="r">{{ item.quantity }}</td>
                <td class="r">{{ item.unit_price|currency_plain }}</td>
                <td class="r">{{ item.total|currency_plain }}</td>
            </tr>
            {% endfor %}
        {% else %}
            <tr>
                <td>{{ invoice.description }}</td>
                <td class="r">1</td>
                <td class="r">{{ invoice.subtotal|currency_plain }}</td>
                <td class="r">{{ invoice.subtotal|currency_plain }}</td>
            </tr>
        {% endif %}
    </tbody>
</table>

<div class="bottom">
    <table class="vat-tbl">
        <thead>
            <tr>
                <th>BTW-percentage</th>
                <th>Grondslag</th>
                <th>BTW-bedrag</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{% if invoice.vat_rate == 0 %}Vrijgesteld{% else %}{{ invoice.vat_rate }}%{% endif %}</td>
                <td>{{ invoice.subtotal|currency }}</td>
                <td>{{ invoice.vat_amount|currency }}</td>
            </tr>
        </tbody>
    </table>
    <table class="totals">
        <tr><td>Subtotaal</td><td>{{ invoice.subtotal|currency }}</td></tr>
        <tr><td>BTW {{ invoice.vat_rate }}%</td><td>{{ invoice.vat_amount|currency }}</td></tr>
        <tr class="grand"><td>Totaal te voldoen</td><td>{{ invoice.total_amount|currency }}</td></tr>
    </table>
</div>

<div class="payment">
    {% if settings.iban %}
    Betaal het bedrag voor de vervaldatum op <strong>{{ settings.iban }}</strong>
    t.n.v. <strong>{{ settings.account_holder_name or settings.company_name }}</strong>
    o.v.v. factuurnummer <strong>{{ invoice.invoice_number }}</strong>.
    {% endif %}
    {% if invoice.notes %}<br/><br/>{{ invoice.notes }}{% endif %}
    {% if settings.email %}<br/><br/>Vragen? Neem contact op via <strong>{{ settings.email }}</strong>.{% endif %}
</div>

<div class="footer">
    <span>{{ settings.company_name }}{% if settings.address %} &middot; {{ settings.address }}{% endif %}</span>
    <span>
        {% if settings.kvk_number %}KVK: {{ settings.kvk_number }}{% endif %}
        {% if settings.kvk_number and settings.vat_number %} &middot; {% endif %}
        {% if settings.vat_number %}BTW: {{ settings.vat_number }}{% endif %}
    </span>
</div>

</body>
</html>
```

- [ ] **Step 2: Verify template renders in Docker**

```bash
docker compose exec backend python -c "
from app.services.pdf_service import generate_invoice_pdf
from decimal import Decimal
from datetime import date
pdf = generate_invoice_pdf(
    {'invoice_number': 'TEST-001', 'issue_date': date.today(), 'due_date': date.today(),
     'service_date': None, 'subtotal': Decimal('1000'), 'vat_rate': Decimal('21'),
     'vat_amount': Decimal('210'), 'total_amount': Decimal('1210'),
     'description': 'Test', 'notes': None, 'line_items': []},
    {'company_name': 'Test BV', 'contact_name': 'Jan', 'email': 'jan@test.nl', 'address': 'Teststraat 1'},
    {'company_name': 'MijnBedrijf', 'email': 'info@mijn.nl', 'address': 'Straat 1',
     'phone': None, 'iban': 'NL00TEST', 'kvk_number': '12345678', 'vat_number': 'NL123B01',
     'account_holder_name': 'MijnBedrijf', 'payment_term_days': 30,
     'invoice_footer_text': None, 'website_url': 'mijn.nl'}
)
print(f'PDF OK: {len(pdf)} bytes')
"
```

Expected: `PDF OK: XXXXX bytes`

- [ ] **Step 3: Commit**

```bash
git add backend/app/templates/invoice.html
git commit -m "feat: replace invoice PDF template with new design"
```

---

## Task 5: Update `proposal.html` Template

**Files:**
- Replace: `backend/app/templates/proposal.html`

- [ ] **Step 1: Replace the template**

Replace the entire contents of `backend/app/templates/proposal.html`:

```html
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<style>
    @page { size: A4; margin: 2cm 2.5cm 2.5cm 2.5cm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.5;
        color: #1a1a1a;
        background: #fff;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 48px;
    }
    .brand { font-size: 18pt; font-weight: 700; color: #111; letter-spacing: -.2px; }
    .brand-sub { font-size: 9.5pt; color: #777; margin-top: 3px; }
    .header-info {
        display: grid;
        grid-template-columns: auto auto;
        gap: 3px 20px;
        font-size: 10pt;
        text-align: left;
    }
    .hi-lbl { font-weight: 700; color: #111; white-space: nowrap; }
    .hi-val { color: #444; }
    .doc-title { font-size: 17pt; font-weight: 700; letter-spacing: .5px; color: #111; margin-bottom: 8px; }
    .subtitle { font-size: 11pt; color: #555; margin-bottom: 30px; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .meta-block h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
    .meta-block p { font-size: 10pt; margin-bottom: 2px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 12pt; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .section p { margin-bottom: 8px; }
    .price-box {
        border: 1.5px solid #d0d0d0;
        border-radius: 4px;
        padding: 20px;
        margin: 30px 0;
        text-align: center;
    }
    .price-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .price-amount { font-size: 28pt; font-weight: 700; color: #111; margin: 8px 0; }
    .price-note { font-size: 9pt; color: #888; }
    .footer {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 10px;
        border-top: 1px solid #e5e5e5;
        font-size: 9pt;
        color: #bbb;
    }
</style>
</head>
<body>

<div class="header">
    <div>
        <div class="brand">{{ settings.company_name }}</div>
        {% if settings.website_url or settings.email %}
        <div class="brand-sub">
            {% if settings.website_url %}{{ settings.website_url }}{% endif %}
            {% if settings.website_url and settings.email %} &middot; {% endif %}
            {% if settings.email %}{{ settings.email }}{% endif %}
        </div>
        {% endif %}
    </div>
    <div class="header-info">
        {% if settings.address %}<span class="hi-lbl">Adres</span><span class="hi-val">{{ settings.address }}</span>{% endif %}
        {% if settings.phone %}<span class="hi-lbl">Telefoon</span><span class="hi-val">{{ settings.phone }}</span>{% endif %}
        {% if settings.kvk_number %}<span class="hi-lbl">KVK</span><span class="hi-val">{{ settings.kvk_number }}</span>{% endif %}
        {% if settings.vat_number %}<span class="hi-lbl">BTW</span><span class="hi-val">{{ settings.vat_number }}</span>{% endif %}
    </div>
</div>

<div class="doc-title">OFFERTE</div>
<div class="subtitle">{{ proposal.title }} — voor {{ proposal.recipient_company or proposal.recipient_name }}</div>

<div class="meta-grid">
    <div class="meta-block">
        <h3>Opgesteld voor</h3>
        <p><strong>{{ proposal.recipient_name }}</strong></p>
        {% if proposal.recipient_company %}<p>{{ proposal.recipient_company }}</p>{% endif %}
        <p>{{ proposal.recipient_email }}</p>
        {% if proposal.recipient_address %}<p>{{ proposal.recipient_address }}</p>{% endif %}
    </div>
    <div class="meta-block" style="text-align: right;">
        <h3>Datum</h3>
        <p>{{ generated_at }}</p>
        {% if proposal.delivery_time %}
        <h3 style="margin-top: 10px;">Levertijd</h3>
        <p>{{ proposal.delivery_time }}</p>
        {% endif %}
    </div>
</div>

{% if proposal.summary %}
<div class="section">
    <h2>Samenvatting</h2>
    <p>{{ proposal.summary }}</p>
</div>
{% endif %}

{% if proposal.scope %}
<div class="section">
    <h2>Scope</h2>
    <p>{{ proposal.scope }}</p>
</div>
{% endif %}

<div class="price-box">
    <div class="price-label">{{ proposal.price_label }}</div>
    <div class="price-amount">{{ proposal.amount|currency }}</div>
    <div class="price-note">Exclusief {{ settings.default_vat_rate }}% BTW</div>
</div>

{% if proposal.notes %}
<div class="section">
    <h2>Opmerkingen</h2>
    <p>{{ proposal.notes }}</p>
</div>
{% endif %}

{% if settings.default_terms_text %}
<div class="section">
    <h2>Voorwaarden</h2>
    <p style="font-size: 9pt; color: #555;">{{ settings.default_terms_text }}</p>
</div>
{% endif %}

<div class="footer">
    <span>{{ settings.company_name }}{% if settings.address %} &middot; {{ settings.address }}{% endif %}</span>
    <span>
        {% if settings.kvk_number %}KVK: {{ settings.kvk_number }}{% endif %}
        {% if settings.kvk_number and settings.vat_number %} &middot; {% endif %}
        {% if settings.vat_number %}BTW: {{ settings.vat_number }}{% endif %}
        {% if settings.quote_footer_text %} &middot; {{ settings.quote_footer_text }}{% endif %}
    </span>
</div>
{% if settings.default_quote_valid_days %}
<div style="text-align:center; font-size:9pt; color:#aaa; margin-top:10px;">
    Deze offerte is {{ settings.default_quote_valid_days }} dagen geldig.
</div>
{% endif %}

</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/templates/proposal.html
git commit -m "feat: align proposal PDF template with new invoice style"
```

---

## Task 6: Frontend — Line Items Form + Validation

**Files:**
- Replace: `frontend/src/views/InvoicesView.vue`

- [ ] **Step 1: Replace InvoicesView.vue**

Replace the entire file:

```vue
<template>
  <div class="space-y-5 animate-slide-up">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Dropdown v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value"
          placeholder="Status" showClear class="w-40" @change="loadInvoices" />
        <span class="text-xs font-mono text-gray-400">{{ invoices.length }} facturen</span>
      </div>
      <button class="btn-primary" @click="openCreate"><i class="pi pi-plus text-xs"></i> Nieuwe factuur</button>
    </div>

    <div v-if="loading" class="card">
      <div v-for="i in 6" :key="i" class="flex items-center gap-4 px-5 py-3.5 border-b border-gray-200 last:border-0">
        <div class="skeleton h-4 w-24"></div><div class="skeleton h-4 w-32"></div><div class="skeleton h-4 w-20"></div>
        <div class="flex-1"></div><div class="skeleton h-5 w-16 rounded-md"></div>
      </div>
    </div>

    <div v-else class="card overflow-hidden light-table">
      <DataTable :value="invoices" stripedRows paginator :rows="20" sortField="created_at" :sortOrder="-1">
        <Column field="invoice_number" header="Nummer" sortable style="width:130px">
          <template #body="{ data }"><span class="font-mono text-xs text-gray-700">{{ data.invoice_number }}</span></template>
        </Column>
        <Column header="Klant" sortable>
          <template #body="{ data }"><span class="text-gray-700">{{ clientMap[data.client_id] || '—' }}</span></template>
        </Column>
        <Column field="issue_date" header="Datum" sortable style="width:120px">
          <template #body="{ data }"><span class="font-mono text-xs text-gray-500">{{ formatDate(data.issue_date) }}</span></template>
        </Column>
        <Column field="total_amount" header="Totaal" sortable style="width:130px">
          <template #body="{ data }"><span class="font-mono text-sm font-medium text-gray-800">{{ formatCurrency(data.total_amount) }}</span></template>
        </Column>
        <Column field="status" header="Status" sortable style="width:110px">
          <template #body="{ data }"><span :class="statusColor(data.status)" class="badge">{{ data.status }}</span></template>
        </Column>
        <Column header="" style="width:140px">
          <template #body="{ data }">
            <div class="flex gap-1 justify-end">
              <button class="btn-icon" @click.stop="downloadPdf(data)" title="PDF"><i class="pi pi-file-pdf text-xs"></i></button>
              <button v-if="data.status !== 'PAID'" class="btn-icon text-green-600 hover:text-green-700" @click.stop="markPaid(data)" title="Betaald"><i class="pi pi-check text-xs"></i></button>
              <button class="btn-icon text-red-600 hover:text-red-700" @click.stop="deleteInvoice(data)" title="Verwijderen"><i class="pi pi-trash text-xs"></i></button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" header="Nieuwe factuur" modal :style="{ width: '720px' }">
      <form @submit.prevent="createInvoice" class="space-y-4">

        <!-- Client + Dates -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Klant</label>
            <Dropdown v-model="form.client_id" :options="clientOptions" optionLabel="label" optionValue="value"
              placeholder="Selecteer klant" class="w-full" :class="{ 'p-invalid': errors.client_id }" />
            <p v-if="errors.client_id" class="field-error">{{ errors.client_id }}</p>
          </div>
          <div>
            <label class="form-label">BTW-tarief</label>
            <InputNumber v-model="form.vat_rate" suffix="%" class="w-full" :min="0" :max="100"
              :class="{ 'p-invalid': errors.vat_rate }" />
            <p v-if="errors.vat_rate" class="field-error">{{ errors.vat_rate }}</p>
          </div>
          <div>
            <label class="form-label">Factuurdatum</label>
            <Calendar v-model="form.issue_date" dateFormat="dd-mm-yy" class="w-full"
              :class="{ 'p-invalid': errors.issue_date }" />
            <p v-if="errors.issue_date" class="field-error">{{ errors.issue_date }}</p>
          </div>
          <div>
            <label class="form-label">Vervaldatum</label>
            <Calendar v-model="form.due_date" dateFormat="dd-mm-yy" class="w-full"
              :class="{ 'p-invalid': errors.due_date }" />
            <p v-if="errors.due_date" class="field-error">{{ errors.due_date }}</p>
          </div>
        </div>

        <!-- Line Items -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="form-label mb-0">Regelitems</label>
          </div>
          <p v-if="errors.line_items" class="field-error mb-2">{{ errors.line_items }}</p>

          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b-2 border-gray-800">
                <th class="text-left py-1.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Omschrijving</th>
                <th class="text-right py-1.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Aantal</th>
                <th class="text-right py-1.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Tarief (€)</th>
                <th class="text-right py-1.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Bedrag (€)</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in lineItems" :key="i" class="border-b border-gray-100">
                <td class="py-1 px-1">
                  <input v-model="item.description" class="input text-sm w-full"
                    :class="{ 'border-red-400': errors[`item_${i}_description`] }"
                    placeholder="Omschrijving"
                    @input="clearItemError(i, 'description')" />
                  <p v-if="errors[`item_${i}_description`]" class="field-error">{{ errors[`item_${i}_description`] }}</p>
                </td>
                <td class="py-1 px-1">
                  <input v-model.number="item.quantity" type="number" min="0.01" step="0.01" class="input text-sm text-right w-full"
                    :class="{ 'border-red-400': errors[`item_${i}_quantity`] }"
                    @input="recalcItem(i); clearItemError(i, 'quantity')" />
                  <p v-if="errors[`item_${i}_quantity`]" class="field-error">{{ errors[`item_${i}_quantity`] }}</p>
                </td>
                <td class="py-1 px-1">
                  <input v-model.number="item.unit_price" type="number" min="0" step="0.01" class="input text-sm text-right w-full"
                    :class="{ 'border-red-400': errors[`item_${i}_unit_price`] }"
                    @input="recalcItem(i); clearItemError(i, 'unit_price')" />
                  <p v-if="errors[`item_${i}_unit_price`]" class="field-error">{{ errors[`item_${i}_unit_price`] }}</p>
                </td>
                <td class="py-1 px-2 text-right font-mono text-gray-700">{{ formatCurrency(item.total) }}</td>
                <td class="py-1 px-1 text-center">
                  <button type="button" class="btn-icon text-red-400 hover:text-red-600" @click="removeLine(i)"
                    :disabled="lineItems.length === 1" title="Verwijderen">
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <button type="button" class="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium" @click="addLine">
            <i class="pi pi-plus text-xs mr-1"></i>Regel toevoegen
          </button>
        </div>

        <!-- Summary -->
        <div class="flex justify-end">
          <table class="text-sm border-collapse">
            <tr>
              <td class="py-0.5 pr-8 text-gray-500">Subtotaal</td>
              <td class="py-0.5 text-right font-mono text-gray-700">{{ formatCurrency(subtotal) }}</td>
            </tr>
            <tr>
              <td class="py-0.5 pr-8 text-gray-500">BTW {{ form.vat_rate }}%</td>
              <td class="py-0.5 text-right font-mono text-gray-700">{{ formatCurrency(vatAmount) }}</td>
            </tr>
            <tr class="border-t-2 border-gray-800">
              <td class="pt-1.5 pr-8 font-semibold text-gray-800">Totaal</td>
              <td class="pt-1.5 text-right font-mono font-semibold text-gray-900">{{ formatCurrency(totalAmount) }}</td>
            </tr>
          </table>
        </div>

        <!-- Notes -->
        <div>
          <label class="form-label">Notities (optioneel)</label>
          <textarea v-model="form.notes" class="input min-h-[60px]" />
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <button type="button" class="btn-secondary" @click="closeCreate">Annuleren</button>
          <button type="submit" class="btn-primary" :disabled="saving">Aanmaken</button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { invoicesApi, clientsApi } from '@/api/services'
import { useFormatting } from '@/composables/useFormatting'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Calendar from 'primevue/calendar'
import InputNumber from 'primevue/inputnumber'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface InvoiceForm {
  client_id: string
  vat_rate: number
  issue_date: Date
  due_date: Date
  notes: string
}

// ─── State ───────────────────────────────────────────────────────────────────

const { showError, showSuccess } = useErrorHandler()
const confirm = useConfirm()
const { formatDate, formatCurrency, statusColor, downloadBlob, toISODate } = useFormatting()

const invoices = ref<any[]>([])
const clientOptions = ref<any[]>([])
const clientMap = ref<Record<string, string>>({})
const loading = ref(true)
const showCreate = ref(false)
const saving = ref(false)
const submitted = ref(false)
const errors = ref<Record<string, string>>({})
const filters = ref<{ status: string | null }>({ status: null })

const today = new Date()
const defaultDue = new Date(today.getTime() + 30 * 86400000)

const form = ref<InvoiceForm>({
  client_id: '',
  vat_rate: 21,
  issue_date: today,
  due_date: defaultDue,
  notes: '',
})

const lineItems = ref<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }])

const statusOptions = [
  { label: 'Concept', value: 'DRAFT' },
  { label: 'Verzonden', value: 'SENT' },
  { label: 'Betaald', value: 'PAID' },
  { label: 'Achterstallig', value: 'OVERDUE' },
]

// ─── Computed ─────────────────────────────────────────────────────────────────

const subtotal = computed(() =>
  lineItems.value.reduce((sum, item) => sum + item.total, 0)
)

const vatAmount = computed(() =>
  Math.round(subtotal.value * (form.value.vat_rate / 100) * 100) / 100
)

const totalAmount = computed(() => subtotal.value + vatAmount.value)

// ─── Line item helpers ────────────────────────────────────────────────────────

function recalcItem(i: number): void {
  const item = lineItems.value[i]
  item.total = Math.round(item.quantity * item.unit_price * 100) / 100
}

function addLine(): void {
  lineItems.value.push({ description: '', quantity: 1, unit_price: 0, total: 0 })
}

function removeLine(i: number): void {
  if (lineItems.value.length > 1) lineItems.value.splice(i, 1)
}

function clearItemError(i: number, field: string): void {
  delete errors.value[`item_${i}_${field}`]
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): boolean {
  const e: Record<string, string> = {}

  if (!form.value.client_id) e.client_id = 'Selecteer een klant'
  if (!form.value.issue_date) e.issue_date = 'Factuurdatum is verplicht'
  if (!form.value.due_date) {
    e.due_date = 'Vervaldatum is verplicht'
  } else if (form.value.issue_date && form.value.due_date < form.value.issue_date) {
    e.due_date = 'Vervaldatum moet na factuurdatum liggen'
  }
  if (form.value.vat_rate < 0 || form.value.vat_rate > 100) {
    e.vat_rate = 'BTW-tarief moet tussen 0 en 100 liggen'
  }
  if (lineItems.value.length === 0) {
    e.line_items = 'Voeg minimaal één regel toe'
  } else {
    lineItems.value.forEach((item, i) => {
      if (!item.description.trim()) e[`item_${i}_description`] = 'Omschrijving is verplicht'
      if (item.quantity <= 0) e[`item_${i}_quantity`] = 'Aantal moet groter dan 0 zijn'
      if (item.unit_price < 0) e[`item_${i}_unit_price`] = 'Tarief mag niet negatief zijn'
    })
  }

  errors.value = e
  return Object.keys(e).length === 0
}

// ─── Dialog helpers ───────────────────────────────────────────────────────────

function openCreate(): void {
  showCreate.value = true
}

function closeCreate(): void {
  showCreate.value = false
  resetForm()
}

function resetForm(): void {
  const now = new Date()
  form.value = {
    client_id: '',
    vat_rate: 21,
    issue_date: now,
    due_date: new Date(now.getTime() + 30 * 86400000),
    notes: '',
  }
  lineItems.value = [{ description: '', quantity: 1, unit_price: 0, total: 0 }]
  errors.value = {}
  submitted.value = false
}

// ─── API actions ──────────────────────────────────────────────────────────────

onMounted(async () => { await Promise.all([loadInvoices(), loadClients()]) })

async function loadClients(): Promise<void> {
  try {
    const { data } = await clientsApi.list()
    clientOptions.value = data.map((c: any) => ({ label: c.company_name, value: c.id }))
    clientMap.value = Object.fromEntries(data.map((c: any) => [c.id, c.company_name]))
  } catch (err: any) { showError(err) }
}

async function loadInvoices(): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (filters.value.status) params.status = filters.value.status
    const { data } = await invoicesApi.list(params)
    invoices.value = data
  } catch (err: any) { showError(err) }
  loading.value = false
}

async function createInvoice(): Promise<void> {
  submitted.value = true
  if (!validate()) return

  saving.value = true
  try {
    await invoicesApi.create({
      client_id: form.value.client_id,
      issue_date: toISODate(form.value.issue_date),
      due_date: toISODate(form.value.due_date),
      vat_rate: form.value.vat_rate,
      notes: form.value.notes || null,
      subtotal: 0,
      line_items: lineItems.value.map(item => ({
        description: item.description,
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
        total: String(item.total),
      })),
    })
    closeCreate()
    showSuccess('Factuur aangemaakt')
    await loadInvoices()
  } catch (err: any) {
    // Map 422 field errors from FastAPI to per-field errors
    if (err?.response?.status === 422) {
      const detail = err.response.data?.detail
      if (Array.isArray(detail)) {
        const mapped: Record<string, string> = {}
        detail.forEach((d: any) => {
          const field = d.loc?.[d.loc.length - 1]
          if (field) mapped[String(field)] = d.msg
        })
        if (Object.keys(mapped).length > 0) {
          errors.value = { ...errors.value, ...mapped }
          return
        }
      }
    }
    showError(err)
  } finally {
    saving.value = false
  }
}

async function markPaid(inv: any): Promise<void> {
  try {
    await invoicesApi.markPaid(inv.id)
    showSuccess('Betaald')
    await loadInvoices()
  } catch (err: any) { showError(err) }
}

async function downloadPdf(inv: any): Promise<void> {
  try {
    const { data } = await invoicesApi.downloadPdf(inv.id)
    downloadBlob(data, `factuur-${inv.invoice_number}.pdf`)
  } catch (err: any) { showError(err, 'PDF genereren mislukt') }
}

function deleteInvoice(inv: any): void {
  confirm.require({
    message: `Factuur ${inv.invoice_number} verwijderen?`,
    header: 'Bevestiging',
    acceptLabel: 'Verwijderen',
    rejectLabel: 'Annuleren',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await invoicesApi.delete(inv.id)
        showSuccess('Verwijderd')
        await loadInvoices()
      } catch (err: any) { showError(err) }
    },
  })
}
</script>

<style scoped>
.form-label {
  @apply block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider;
}
.field-error {
  @apply text-xs text-red-500 mt-1;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/InvoicesView.vue
git commit -m "feat: invoice form with line items, live totals, and per-field validation"
```

---

## Task 7: Update & Add Backend Tests

**Files:**
- Modify: `backend/tests/test_invoices.py`

- [ ] **Step 1: Update the existing broken test**

`test_update_invoice_recalculates_vat` sends `subtotal` in the PATCH body, which is now removed from `InvoiceUpdate`. Replace it:

```python
async def test_update_invoice_recalculates_via_line_items(self, client, admin_token, test_client_data):
    """PATCH with new line_items recalculates subtotal, VAT, and total."""
    inv = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "Initial", "quantity": "1", "unit_price": "1000.00", "total": "1000.00"},
        ],
    }, headers=auth_header(admin_token))
    inv_id = inv.json()["id"]

    response = await client.patch(f"/api/v1/invoices/{inv_id}", json={
        "line_items": [
            {"description": "Updated", "quantity": "2", "unit_price": "1000.00", "total": "0"},
        ],
    }, headers=auth_header(admin_token))
    assert response.status_code == 200
    assert float(response.json()["subtotal"]) == 2000.00
    assert float(response.json()["vat_amount"]) == 420.00
    assert float(response.json()["total_amount"]) == 2420.00
```

- [ ] **Step 2: Add the remaining 6 new tests**

Add to `TestInvoices` class in `backend/tests/test_invoices.py`:

```python
async def test_create_invoice_line_items_no_description(self, client, admin_token, test_client_data):
    """Line items present with no description → 201 (happy path)."""
    response = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "Design", "quantity": "1", "unit_price": "750.00", "total": "750.00"},
        ],
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    assert response.json()["description"] is None

async def test_create_invoice_item_total_recalculated_server_side(self, client, admin_token, test_client_data):
    """Client-supplied item total is ignored; backend recalculates from quantity * unit_price."""
    response = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 0,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "Item", "quantity": "3", "unit_price": "200.00", "total": "99999"},
        ],
    }, headers=auth_header(admin_token))
    assert response.status_code == 201
    stored_total = float(response.json()["line_items"][0]["total"])
    assert stored_total == 600.00  # 3 × 200, not the client-supplied 99999

async def test_invoice_pdf_returns_pdf_content_type(self, client, admin_token, test_client_data):
    """PDF endpoint returns a valid PDF for an invoice with line items."""
    from unittest.mock import patch

    inv = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "Service", "quantity": "1", "unit_price": "500.00", "total": "500.00"},
        ],
    }, headers=auth_header(admin_token))
    inv_id = inv.json()["id"]

    # Patch WeasyPrint to avoid external font/library dependency in tests
    with patch("app.services.pdf_service.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-1.4 fake"
        response = await client.get(
            f"/api/v1/invoices/{inv_id}/pdf",
            headers=auth_header(admin_token),
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

async def test_invoice_pdf_without_line_items_uses_fallback(self, client, admin_token, test_client_data):
    """Legacy invoice with description only still generates a PDF (fallback row)."""
    from unittest.mock import patch

    inv = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "subtotal": 1000.00,
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "description": "Legacy invoice",
    }, headers=auth_header(admin_token))
    inv_id = inv.json()["id"]

    with patch("app.services.pdf_service.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-1.4 fake"
        response = await client.get(
            f"/api/v1/invoices/{inv_id}/pdf",
            headers=auth_header(admin_token),
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

async def test_update_invoice_line_items_item_total_recalculated(self, client, admin_token, test_client_data):
    """PATCH line_items: stored item.total must equal quantity * unit_price."""
    inv = await client.post("/api/v1/invoices", json={
        "client_id": test_client_data["id"],
        "vat_rate": 21.00,
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "line_items": [
            {"description": "A", "quantity": "1", "unit_price": "100.00", "total": "100.00"},
        ],
    }, headers=auth_header(admin_token))
    inv_id = inv.json()["id"]

    response = await client.patch(f"/api/v1/invoices/{inv_id}", json={
        "line_items": [
            {"description": "B", "quantity": "5", "unit_price": "50.00", "total": "0"},
        ],
    }, headers=auth_header(admin_token))
    assert response.status_code == 200
    assert float(response.json()["line_items"][0]["total"]) == 250.00
```

- [ ] **Step 3: Run the full test suite**

```bash
docker compose exec backend pytest tests/test_invoices.py -v
```

Expected: all tests PASS (no failures)

- [ ] **Step 4: Run the entire test suite to catch regressions**

```bash
docker compose exec backend pytest -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_invoices.py
git commit -m "test: update invoice tests for line items and optional description"
```

---

## Task 8: Cleanup & Final Verification

- [ ] **Step 1: Manual browser test**

Start the app:
```bash
docker compose up
```

Open `http://localhost:5173` (or the configured frontend port), navigate to Facturen, create a new invoice with 2+ line items:
- Verify totals update live on every keystroke
- Verify validation errors appear when submitting with missing fields
- Verify PDF download shows the new template design
- Navigate to Offertes, download a proposal PDF — verify it uses the new header/footer style

- [ ] **Step 2: Remove spec and plan docs**

```bash
git rm -r docs/superpowers/
git commit -m "chore: remove brainstorm docs, keep repo clean"
```

- [ ] **Step 3: Final check**

```bash
docker compose exec backend pytest -v
```

Expected: all tests PASS. Done.
