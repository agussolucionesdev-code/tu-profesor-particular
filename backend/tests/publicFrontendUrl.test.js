import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_FRONTEND_URL,
  getPublicFrontendUrl,
} from "../src/config/publicFrontendUrl.js";

describe("public frontend URL", () => {
  it("uses the first valid origin from a comma-separated configuration", () => {
    expect(
      getPublicFrontendUrl(
        "https://turnos.tuprofesorparticular.com.ar, https://www.tuprofesorparticular.com.ar",
      ),
    ).toBe("https://turnos.tuprofesorparticular.com.ar");
  });

  it("normalizes trailing slash, route and query to an origin", () => {
    expect(getPublicFrontendUrl("https://example.com/some/path?preview=1")).toBe(
      "https://example.com",
    );
  });

  it("rejects unsupported protocols and credentials", () => {
    expect(getPublicFrontendUrl("javascript:alert(1)")).toBe(
      DEFAULT_PUBLIC_FRONTEND_URL,
    );
    expect(getPublicFrontendUrl("https://user:secret@example.com")).toBe(
      DEFAULT_PUBLIC_FRONTEND_URL,
    );
  });

  it("skips an invalid first entry when a later origin is valid", () => {
    expect(getPublicFrontendUrl("not-a-url, http://localhost:5173/")).toBe(
      "http://localhost:5173",
    );
  });
});
