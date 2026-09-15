import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import progressRouter from "./progress";
import drillsRouter from "./drills";
import { resetRateLimits } from "../middlewares/rate-limit";

const app = express();
app.use(express.json());
app.use("/api", progressRouter, drillsRouter);

let server: Server;
let baseUrl: string;
const oldOwner = process.env.REPL_OWNER;
const oldOwnerId = process.env.REPL_OWNER_ID;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => {
  process.env.REPL_OWNER = "the-owner";
  process.env.REPL_OWNER_ID = "12345";
  resetRateLimits();
});

afterEach(() => {
  if (oldOwner === undefined) delete process.env.REPL_OWNER;
  else process.env.REPL_OWNER = oldOwner;
  if (oldOwnerId === undefined) delete process.env.REPL_OWNER_ID;
  else process.env.REPL_OWNER_ID = oldOwnerId;
});

const routes = [
  { path: "/api/progress/complete", body: {} },
  { path: "/api/drills/due", body: {} },
  { path: "/api/drills/attempt", body: {} },
] as const;

async function post(
  path: string,
  body: unknown,
  identityHeaders?: Record<string, string>,
) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...identityHeaders,
    },
    body: JSON.stringify(body),
  });
}

describe.each(routes)("$path owner protection", ({ path, body }) => {
  it("rejects anonymous edge-proxy callers with 403", async () => {
    const response = await post(path, body, {
      "X-Replit-User-Name": "",
      "X-Replit-User-Id": "",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This action is limited to the workspace owner.",
    });
  });

  it("allows workspace-internal callers through to route validation", async () => {
    const response = await post(path, body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
  });

  it("allows the owner through to route validation", async () => {
    const response = await post(path, body, {
      "X-Replit-User-Name": "the-owner",
      "X-Replit-User-Id": "12345",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
  });
});