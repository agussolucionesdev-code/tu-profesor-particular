import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const create = vi.fn();

vi.mock("../src/models/User.js", () => ({
  default: { findOne, create },
}));

const { ensureConfiguredAdmin } = await import("../src/config/adminSeed.js");

describe("ensureConfiguredAdmin", () => {
  beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
    process.env.ADMIN_USERNAME = "admin@example.com";
    process.env.ADMIN_PASSWORD = "new-secure-password";
    delete process.env.ADMIN_PASSWORD_ROTATE;
  });

  afterEach(() => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_ROTATE;
  });

  it("rotates the existing admin password only when explicitly enabled", async () => {
    const existingUser = {
      username: "admin@example.com",
      password: await bcrypt.hash("old-compromised-password", 4),
      save: vi.fn().mockResolvedValue(undefined),
    };
    findOne.mockResolvedValue(existingUser);
    process.env.ADMIN_PASSWORD_ROTATE = "true";

    await ensureConfiguredAdmin();

    expect(await bcrypt.compare(process.env.ADMIN_PASSWORD, existingUser.password)).toBe(true);
    expect(existingUser.save).toHaveBeenCalledOnce();
  });

  it("does not alter an existing admin without the explicit rotation flag", async () => {
    const existingUser = {
      username: "admin@example.com",
      password: await bcrypt.hash("old-compromised-password", 4),
      save: vi.fn().mockResolvedValue(undefined),
    };
    findOne.mockResolvedValue(existingUser);

    await ensureConfiguredAdmin();

    expect(await bcrypt.compare(process.env.ADMIN_PASSWORD, existingUser.password)).toBe(false);
    expect(existingUser.save).not.toHaveBeenCalled();
  });
});
