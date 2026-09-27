from datetime import date, timedelta
import json
import math
import unittest

from app.main import (
    DailySale,
    ProductSalesInput,
    app,
    build_daily_sales_dataframe,
    calculate_restock_quantity,
    calculate_risk_level,
    forecast_product,
    run_linear_regression_forecast,
)


def sales(quantities: list[int]) -> list[DailySale]:
    first_day = date(2026, 1, 1)
    return [
        DailySale(
            date=first_day + timedelta(days=index),
            quantity=quantity,
        )
        for index, quantity in enumerate(quantities)
    ]


def product(
    quantities: list[int],
    *,
    product_id: int = 1,
    current_stock: int = 100,
    threshold: int = 5,
) -> ProductSalesInput:
    return ProductSalesInput(
        product_id=product_id,
        product_name=f"Produit {product_id}",
        category="Test",
        price=10.0,
        current_stock=current_stock,
        stock_alert_threshold=threshold,
        daily_sales=sales(quantities),
    )


async def asgi_request(
    method: str,
    path: str,
    payload: dict | None = None,
) -> tuple[int, dict]:
    body = (
        json.dumps(payload).encode("utf-8")
        if payload is not None
        else b""
    )
    request_sent = False
    messages: list[dict] = []

    async def receive() -> dict:
        nonlocal request_sent

        if not request_sent:
            request_sent = True
            return {
                "type": "http.request",
                "body": body,
                "more_body": False,
            }

        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        messages.append(message)

    headers = []
    if payload is not None:
        headers.append((b"content-type", b"application/json"))

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

    status_code = next(
        message["status"]
        for message in messages
        if message["type"] == "http.response.start"
    )
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )

    return status_code, json.loads(response_body or b"{}")


def valid_payload() -> dict:
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


class ForecastApiTest(unittest.IsolatedAsyncioTestCase):
    async def test_health_endpoint(self) -> None:
        status, body = await asgi_request("GET", "/health")

        self.assertEqual(200, status)
        self.assertEqual("ok", body["status"])
        self.assertEqual("smartcommerce-ml-service", body["service"])

    async def test_valid_forecast_payload(self) -> None:
        status, body = await asgi_request(
            "POST",
            "/forecast/stock",
            valid_payload(),
        )

        self.assertEqual(200, status)
        self.assertEqual("python_scikit_learn", body["provider"])
        self.assertEqual(1, body["summary"]["total_products_analyzed"])
        self.assertEqual("linear_regression", body["products"][0]["ml_model"])

    async def test_invalid_date_returns_422(self) -> None:
        payload = valid_payload()
        payload["products"][0]["daily_sales"][0]["date"] = "invalid-date"

        status, _ = await asgi_request(
            "POST",
            "/forecast/stock",
            payload,
        )

        self.assertEqual(422, status)

    async def test_missing_required_products_returns_422(self) -> None:
        status, _ = await asgi_request(
            "POST",
            "/forecast/stock",
            {"analysis_window_days": 30},
        )

        self.assertEqual(422, status)

    async def test_existing_numeric_bounds_return_422(self) -> None:
        mutations = (
            ("analysis_window_days", 6),
            ("analysis_window_days", 366),
            ("forecast_horizon_days", 6),
            ("forecast_horizon_days", 181),
        )

        for field, value in mutations:
            with self.subTest(field=field, value=value):
                payload = valid_payload()
                payload[field] = value
                status, _ = await asgi_request(
                    "POST",
                    "/forecast/stock",
                    payload,
                )
                self.assertEqual(422, status)

        for field in (
            "quantity",
            "current_stock",
            "stock_alert_threshold",
        ):
            with self.subTest(field=field):
                payload = valid_payload()
                if field == "quantity":
                    payload["products"][0]["daily_sales"][0][field] = -1
                else:
                    payload["products"][0][field] = -1
                status, _ = await asgi_request(
                    "POST",
                    "/forecast/stock",
                    payload,
                )
                self.assertEqual(422, status)

    async def test_empty_products_list_is_accepted(self) -> None:
        payload = valid_payload()
        payload["products"] = []

        status, body = await asgi_request(
            "POST",
            "/forecast/stock",
            payload,
        )

        self.assertEqual(200, status)
        self.assertEqual([], body["products"])
        self.assertEqual(0, body["summary"]["total_products_analyzed"])

    async def test_products_are_sorted_by_risk_priority(self) -> None:
        payload = valid_payload()
        payload["products"] = [
            self.payload_product(4, [1], 100, 0),
            self.payload_product(1, [0], 0, 0),
            self.payload_product(3, [1], 20, 0),
            self.payload_product(2, [20], 10, 0),
        ]

        status, body = await asgi_request(
            "POST",
            "/forecast/stock",
            payload,
        )

        self.assertEqual(200, status)
        self.assertEqual(
            ["critical", "high", "medium", "low"],
            [item["risk_level"] for item in body["products"]],
        )

    @staticmethod
    def payload_product(
        product_id: int,
        quantities: list[int],
        stock: int,
        threshold: int,
    ) -> dict:
        return {
            "product_id": product_id,
            "product_name": f"Produit {product_id}",
            "price": 10.0,
            "current_stock": stock,
            "stock_alert_threshold": threshold,
            "daily_sales": [
                {
                    "date": f"2026-01-{index + 1:02d}",
                    "quantity": quantity,
                }
                for index, quantity in enumerate(quantities)
            ],
        }


class ForecastModelTest(unittest.TestCase):
    def test_empty_history_uses_zero_sales_fallback(self) -> None:
        result = forecast_product(product([]), 30)

        self.assertEqual("moving_average_fallback", result.ml_model)
        self.assertEqual(0, result.total_sold)
        self.assertEqual(0, result.projected_demand_30_days)
        self.assertIsNone(result.days_until_stockout)
        self.assertTrue(math.isfinite(result.projected_demand_30_days))

    def test_zero_sales_use_fallback(self) -> None:
        result = forecast_product(product([0, 0, 0, 0]), 30)

        self.assertEqual("moving_average_fallback", result.ml_model)
        self.assertEqual(0, result.projected_demand_30_days)

    def test_one_non_zero_day_uses_fallback(self) -> None:
        result = forecast_product(product([0, 4, 0, 0]), 30)

        self.assertEqual("moving_average_fallback", result.ml_model)
        self.assertEqual(30.0, result.projected_demand_30_days)

    def test_two_non_zero_days_select_linear_regression(self) -> None:
        result = forecast_product(product([1, 2]), 7)

        self.assertEqual("linear_regression", result.ml_model)
        self.assertGreaterEqual(result.projected_demand_30_days, 0)
        self.assertTrue(math.isfinite(result.projected_demand_30_days))

    def test_linear_forecast_is_deterministic(self) -> None:
        item = product([0, 1, 0, 2, 3, 0, 4, 2])

        first = forecast_product(item, 30)
        second = forecast_product(item, 30)

        self.assertEqual(first, second)
        self.assertEqual("linear_regression", first.ml_model)

    def test_increasing_stable_and_decreasing_trends(self) -> None:
        cases = (
            (list(range(1, 15)), "increasing"),
            ([3] * 14, "stable"),
            (list(range(14, 0, -1)), "decreasing"),
        )

        for quantities, expected in cases:
            with self.subTest(expected=expected):
                df = build_daily_sales_dataframe(sales(quantities))
                result = run_linear_regression_forecast(df, 7)
                self.assertEqual(expected, result["trend"])
                self.assertGreaterEqual(result["projected_demand"], 0)
                self.assertTrue(math.isfinite(result["projected_demand"]))

    def test_realistic_zero_sale_days_keep_linear_path(self) -> None:
        result = forecast_product(
            product([0, 2, 0, 3, 0, 4, 0, 1]),
            30,
        )

        self.assertEqual("linear_regression", result.ml_model)
        self.assertGreaterEqual(result.projected_demand_30_days, 0)

    def test_metrics_are_calculated_for_long_history(self) -> None:
        result = forecast_product(product(list(range(1, 31))), 7)

        self.assertEqual("linear_regression", result.ml_model)
        self.assertAlmostEqual(1.0, result.r2_score)
        self.assertAlmostEqual(0.0, result.mae)
        self.assertAlmostEqual(0.0, result.rmse)
        self.assertEqual(7, result.validation_days)


class RiskAndRestockTest(unittest.TestCase):
    def test_risk_levels_and_boundaries(self) -> None:
        cases = (
            ((10, 10, None, 0), "critical"),
            ((11, 10, None, 11), "high"),
            ((100, 10, 7, 10), "high"),
            ((100, 10, 30, 10), "medium"),
            ((100, 10, 30.1, 10), "low"),
        )

        for arguments, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(
                    expected,
                    calculate_risk_level(*arguments),
                )

    def test_restock_calculation_with_simple_values(self) -> None:
        self.assertEqual(
            15,
            calculate_restock_quantity(0, 5, 10, "critical"),
        )
        self.assertEqual(
            7,
            calculate_restock_quantity(3, 5, 5, "high"),
        )
        self.assertEqual(
            0,
            calculate_restock_quantity(100, 5, 10, "low"),
        )

    def test_restock_quantity_is_never_negative(self) -> None:
        self.assertEqual(
            0,
            calculate_restock_quantity(100, 0, 1, "medium"),
        )


if __name__ == "__main__":
    unittest.main()
