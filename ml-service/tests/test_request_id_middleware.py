import json
import unittest
from unittest.mock import patch
from uuid import UUID

from app.main import app


VALID_REQUEST_ID = "71530000-0000-4000-8000-000000000010"


def valid_payload():
    return {
        "analysis_window_days": 30,
        "forecast_horizon_days": 7,
        "products": [
            {
                "product_id": 1,
                "product_name": "Produit test",
                "category": "Test",
                "price": 10.0,
                "current_stock": 20,
                "stock_alert_threshold": 5,
                "daily_sales": [
                    {"date": "2026-01-01", "quantity": 1},
                    {"date": "2026-01-02", "quantity": 2},
                ],
            }
        ],
    }


async def asgi_request(method, path, payload=None, request_id=None):
    body = json.dumps(payload).encode() if payload is not None else b""
    request_sent = False
    messages = []

    async def receive():
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    headers = []
    if payload is not None:
        headers.append((b"content-type", b"application/json"))
    if request_id is not None:
        headers.append((b"x-request-id", request_id.encode("ascii")))

    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "root_path": "",
            "headers": headers,
            "client": ("test", 1234),
            "server": ("test", 80),
        },
        receive,
        send,
    )

    start = next(item for item in messages if item["type"] == "http.response.start")
    response_headers = {
        key.decode().lower(): value.decode()
        for key, value in start.get("headers", [])
    }
    response_body = b"".join(
        item.get("body", b"")
        for item in messages
        if item["type"] == "http.response.body"
    )
    return start["status"], json.loads(response_body or b"{}"), response_headers


class MlRequestIdMiddlewareTest(unittest.IsolatedAsyncioTestCase):
    async def test_valid_id_is_preserved_on_forecast_and_logs(self):
        with self.assertLogs("app.main", level="INFO") as logs:
            status, _, headers = await asgi_request(
                "POST", "/forecast/stock", valid_payload(), VALID_REQUEST_ID
            )

        self.assertEqual(200, status)
        self.assertEqual(VALID_REQUEST_ID, headers["x-request-id"])
        self.assertTrue(
            any(record.request_id == VALID_REQUEST_ID for record in logs.records)
        )

    async def test_missing_id_is_generated_on_health(self):
        status, _, headers = await asgi_request("GET", "/health")
        self.assertEqual(200, status)
        self.assert_canonical_uuid(headers["x-request-id"])

    async def test_invalid_and_oversized_ids_are_replaced(self):
        for invalid_id in ("invalid", "x" * 500):
            with self.subTest(invalid_id=invalid_id[:10]):
                status, _, headers = await asgi_request(
                    "GET", "/health", request_id=invalid_id
                )
                self.assertEqual(200, status)
                resolved = headers["x-request-id"]
                self.assert_canonical_uuid(resolved)
                self.assertNotEqual(invalid_id, resolved)

    async def test_validation_422_keeps_detail_list_and_request_id(self):
        status, body, headers = await asgi_request(
            "POST", "/forecast/stock", {"products": "invalid"}, VALID_REQUEST_ID
        )
        self.assertEqual(422, status)
        self.assertIsInstance(body["detail"], list)
        self.assertEqual(VALID_REQUEST_ID, headers["x-request-id"])

    async def test_unexpected_500_is_generic_logged_and_correlated(self):
        with self.assertLogs("app.request_id", level="ERROR") as logs:
            with patch(
                "app.main.forecast_product",
                side_effect=RuntimeError("internal ML secret"),
            ):
                status, body, headers = await asgi_request(
                    "POST", "/forecast/stock", valid_payload(), VALID_REQUEST_ID
                )

        self.assertEqual(500, status)
        self.assertEqual({"detail": "Internal Server Error"}, body)
        self.assertNotIn("internal ML secret", json.dumps(body))
        self.assertEqual(VALID_REQUEST_ID, headers["x-request-id"])
        self.assertTrue(
            any(record.request_id == VALID_REQUEST_ID for record in logs.records)
        )

    def assert_canonical_uuid(self, value):
        self.assertEqual(36, len(value))
        self.assertEqual(value.lower(), str(UUID(value)))


if __name__ == "__main__":
    unittest.main()
