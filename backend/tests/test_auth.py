import pytest
from tests.conftest import auth_header


class TestAuth:
    async def test_login_success(self, client, admin_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "TestPassword1!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" not in data  # refresh token is now in HTTP-only cookie
        assert data["token_type"] == "bearer"
        assert "refresh_token" in response.cookies

    async def test_login_wrong_password(self, client, admin_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "WrongPassword1!",
        })
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client):
        response = await client.post("/api/v1/auth/login", json={
            "email": "nobody@test.com",
            "password": "TestPassword1!",
        })
        assert response.status_code == 401

    async def test_login_invalid_email(self, client):
        response = await client.post("/api/v1/auth/login", json={
            "email": "not-an-email",
            "password": "TestPassword1!",
        })
        assert response.status_code == 422

    async def test_get_me(self, client, admin_token, admin_user):
        response = await client.get("/api/v1/auth/me", headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "ADMIN"
        assert data["name"] == "Test Admin"

    async def test_get_me_no_token(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403

    async def test_get_me_invalid_token(self, client):
        response = await client.get("/api/v1/auth/me", headers=auth_header("invalid-token"))
        assert response.status_code == 401

    async def test_change_password(self, client, admin_token):
        response = await client.put("/api/v1/auth/me/password", json={
            "current_password": "TestPassword1!",
            "new_password": "NewPassword123!",
        }, headers=auth_header(admin_token))
        assert response.status_code == 204

        # Verify new password works
        response = await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "NewPassword123!",
        })
        assert response.status_code == 200

    async def test_change_password_wrong_current(self, client, admin_token):
        response = await client.put("/api/v1/auth/me/password", json={
            "current_password": "WrongPassword1!",
            "new_password": "NewPassword123!",
        }, headers=auth_header(admin_token))
        assert response.status_code == 400

    async def test_change_password_weak_new(self, client, admin_token):
        response = await client.put("/api/v1/auth/me/password", json={
            "current_password": "TestPassword1!",
            "new_password": "weak",
        }, headers=auth_header(admin_token))
        assert response.status_code == 422

    async def test_logout(self, client, admin_token):
        response = await client.post("/api/v1/auth/logout", headers=auth_header(admin_token))
        assert response.status_code == 204
