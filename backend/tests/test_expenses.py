import pytest
from tests.conftest import auth_header


class TestExpenses:
    async def test_create_expense_default_category(self, client, admin_token):
        response = await client.post(
            "/api/v1/expenses",
            json={"description": "Adobe CC", "amount_incl_vat": "121.00", "vat_rate": "21", "date": "2026-01-15"},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "Overig"

    async def test_create_expense_with_category(self, client, admin_token):
        response = await client.post(
            "/api/v1/expenses",
            json={"description": "MacBook", "amount_incl_vat": "2420.00", "vat_rate": "21", "date": "2026-02-01", "category": "Hardware"},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 201
        assert response.json()["category"] == "Hardware"

    async def test_create_expense_invalid_category(self, client, admin_token):
        response = await client.post(
            "/api/v1/expenses",
            json={"description": "Test", "amount_incl_vat": "100.00", "vat_rate": "21", "date": "2026-01-01", "category": "Onzin"},
            headers=auth_header(admin_token),
        )
        assert response.status_code == 422

    async def test_update_expense_category(self, client, admin_token):
        create_resp = await client.post(
            "/api/v1/expenses",
            json={"description": "Treinkaartje", "amount_incl_vat": "24.20", "vat_rate": "21", "date": "2026-03-01"},
            headers=auth_header(admin_token),
        )
        expense_id = create_resp.json()["id"]

        update_resp = await client.put(
            f"/api/v1/expenses/{expense_id}",
            json={"category": "Reizen"},
            headers=auth_header(admin_token),
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["category"] == "Reizen"

    async def test_expense_response_includes_category(self, client, admin_token):
        await client.post(
            "/api/v1/expenses",
            json={"description": "Slack", "amount_incl_vat": "9.68", "vat_rate": "21", "date": "2026-01-10", "category": "Abonnementen"},
            headers=auth_header(admin_token),
        )
        list_resp = await client.get("/api/v1/expenses", headers=auth_header(admin_token))
        assert list_resp.status_code == 200
        categories = [e["category"] for e in list_resp.json()]
        assert "Abonnementen" in categories
