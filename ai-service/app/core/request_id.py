import logging
from time import perf_counter
from uuid import UUID, uuid4

from starlette.responses import JSONResponse


logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = b"x-request-id"


def resolve_request_id(value: str | None) -> str:
    if isinstance(value, str) and len(value) == 36:
        try:
            parsed = UUID(value)
        except ValueError:
            pass
        else:
            if str(parsed) == value.lower():
                return value

    return str(uuid4())


class RequestIdMiddleware:
    def __init__(self, app, service_name: str) -> None:
        self.app = app
        self.service_name = service_name

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming_id = self._header_value(scope.get("headers", []))
        request_id = resolve_request_id(incoming_id)
        scope.setdefault("state", {})["request_id"] = request_id
        started_at = perf_counter()
        response_started = False

        async def send_with_request_id(message) -> None:
            nonlocal response_started

            if message["type"] == "http.response.start":
                response_started = True
                headers = [
                    header
                    for header in message.get("headers", [])
                    if header[0].lower() != REQUEST_ID_HEADER
                ]
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message["headers"] = headers

            await send(message)

        logger.info(
            "HTTP request started",
            extra={
                "request_id": request_id,
                "service": self.service_name,
                "method": scope.get("method"),
                "path": scope.get("path"),
            },
        )

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception(
                "Unhandled HTTP request error",
                extra={
                    "request_id": request_id,
                    "service": self.service_name,
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                },
            )

            if response_started:
                raise

            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error"},
            )
            await response(scope, receive, send_with_request_id)
        finally:
            logger.info(
                "HTTP request finished",
                extra={
                    "request_id": request_id,
                    "service": self.service_name,
                    "duration_ms": int(
                        (perf_counter() - started_at) * 1000
                    ),
                },
            )

    @staticmethod
    def _header_value(headers) -> str | None:
        for name, value in headers:
            if name.lower() == REQUEST_ID_HEADER:
                try:
                    return value.decode("ascii")
                except UnicodeDecodeError:
                    return None

        return None
