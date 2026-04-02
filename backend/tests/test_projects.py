import pytest
from tests.conftest import auth_header


class TestProjects:
    async def test_create_project(self, client, admin_token, test_client_data):
        response = await client.post("/api/v1/projects", json={
            "client_id": test_client_data["id"],
            "name": "New Website",
            "project_type": "NEW_WEBSITE",
            "priority": "HIGH",
            "description": "Build a new website",
        }, headers=auth_header(admin_token))
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Website"
        assert data["slug"] == "new-website"
        assert data["project_type"] == "NEW_WEBSITE"
        assert data["priority"] == "HIGH"
        assert data["status"] == "LEAD"

    async def test_create_project_invalid_client(self, client, admin_token):
        response = await client.post("/api/v1/projects", json={
            "client_id": "nonexistent",
            "name": "Test",
            "project_type": "OTHER",
        }, headers=auth_header(admin_token))
        assert response.status_code == 404

    async def test_list_projects(self, client, admin_token, test_project_data):
        response = await client.get("/api/v1/projects", headers=auth_header(admin_token))
        assert response.status_code == 200
        assert len(response.json()) >= 1

    async def test_list_projects_filter_status(self, client, admin_token, test_project_data):
        response = await client.get("/api/v1/projects?status=LEAD", headers=auth_header(admin_token))
        assert response.status_code == 200
        for p in response.json():
            assert p["status"] == "LEAD"

    async def test_get_project(self, client, admin_token, test_project_data):
        response = await client.get(f"/api/v1/projects/{test_project_data['id']}", headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Project"
        assert "client" in data
        assert "communications" in data
        assert "change_requests" in data

    async def test_get_project_by_slug(self, client, admin_token, test_project_data):
        slug = test_project_data["slug"]
        response = await client.get(f"/api/v1/projects/by-slug/{slug}", headers=auth_header(admin_token))
        assert response.status_code == 200
        assert response.json()["id"] == test_project_data["id"]

    async def test_update_project(self, client, admin_token, test_project_data):
        response = await client.patch(f"/api/v1/projects/{test_project_data['id']}", json={
            "status": "IN_PROGRESS",
            "priority": "URGENT",
        }, headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "IN_PROGRESS"
        assert data["priority"] == "URGENT"

    async def test_delete_project_soft(self, client, admin_token, test_project_data):
        response = await client.delete(f"/api/v1/projects/{test_project_data['id']}", headers=auth_header(admin_token))
        assert response.status_code == 204

        response = await client.get(f"/api/v1/projects/{test_project_data['id']}", headers=auth_header(admin_token))
        assert response.status_code == 404

    async def test_employee_can_create_project(self, client, employee_token, test_client_data):
        response = await client.post("/api/v1/projects", json={
            "client_id": test_client_data["id"],
            "name": "Employee Project",
            "project_type": "OTHER",
        }, headers=auth_header(employee_token))
        assert response.status_code == 201

    async def test_employee_cannot_delete_project(self, client, employee_token, test_project_data):
        response = await client.delete(f"/api/v1/projects/{test_project_data['id']}", headers=auth_header(employee_token))
        assert response.status_code == 403

    async def test_finance_cannot_access_projects(self, client, finance_token):
        response = await client.get("/api/v1/projects", headers=auth_header(finance_token))
        assert response.status_code == 403

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
