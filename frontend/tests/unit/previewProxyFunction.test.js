import test from "node:test";
import assert from "node:assert/strict";
import previewProxy from "../../api/preview-proxy.js";

const createResponse = () => {
  const response = {
    headers: {},
    statusCode: 200,
    payload: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return response;
};

test("the preview proxy removes browser CORS headers and forwards booking data", async (t) => {
  let captured;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ success: true, bookingCode: "ABC234" }), {
      status: 201,
      headers: { "content-type": "application/json", "x-request-id": "request-1" },
    });
  });

  const req = {
    method: "POST",
    query: { __proxy_path: "bookings/reserve", source: "preview" },
    headers: {
      origin: "https://preview.example.vercel.app",
      referer: "https://preview.example.vercel.app/reservar",
      cookie: "private=value",
      "content-type": "application/json",
      "idempotency-key": "booking-test-key",
      "x-vercel-forwarded-for": "203.0.113.10",
    },
    body: { studentName: "Reserva de prueba" },
  };
  const res = createResponse();

  await previewProxy(req, res);

  assert.equal(
    captured.url,
    "https://tu-profesor-particular-backend.onrender.com/api/bookings/reserve?source=preview",
  );
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.get("origin"), null);
  assert.equal(captured.options.headers.get("referer"), null);
  assert.equal(captured.options.headers.get("cookie"), null);
  assert.equal(captured.options.headers.get("content-type"), "application/json");
  assert.equal(captured.options.headers.get("idempotency-key"), "booking-test-key");
  assert.equal(captured.options.headers.get("x-forwarded-for"), "203.0.113.10");
  assert.equal(captured.options.body, JSON.stringify(req.body));
  assert.equal(res.statusCode, 201);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.headers["x-request-id"], "request-1");
  assert.match(res.payload, /ABC234/);
});

test("the proxy cannot call itself or escape the backend API", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("fetch should not be called");
  });

  for (const path of ["", "../health", "bookings/../auth", "preview-proxy"]) {
    const res = createResponse();
    await previewProxy(
      { method: "GET", query: { __proxy_path: path }, headers: {} },
      res,
    );
    assert.equal(res.statusCode, 404);
  }

  assert.equal(fetchMock.mock.callCount(), 0);
});

test("upstream failures produce a generic retryable response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("backend unavailable");
  });
  const res = createResponse();

  await previewProxy(
    {
      method: "GET",
      query: { __proxy_path: "settings" },
      headers: {},
    },
    res,
  );

  assert.equal(res.statusCode, 502);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /servicio de turnos/i);
});
