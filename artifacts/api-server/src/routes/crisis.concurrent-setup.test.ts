import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetRateLimits } from "../middlewares/rate-limit";

function post(port: number, route: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: route, method: "POST" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("crisis setup concurrency and errors", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;
  let originalPath: string | undefined;

  beforeAll(async () => {
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-concurrent-"));
    mkdirSync(path.join(fakeHome, "git-dojo"), { recursive: true });
    originalHome = process.env.HOME;
    originalPath = process.env.PATH;
    process.env.HOME = fakeHome;

    const { default: crisisRouter } = await import("./crisis.js");
    const app = express();
    app.use("/", crisisRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  beforeEach(() => {
    resetRateLimits();
    process.env.PATH = originalPath;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("serializes overlapping setup requests for the same scenario", async () => {
    const route = "/crisis/scenarios/crisis-smoke/setup";
    const [first, second] = await Promise.all([post(port, route), post(port, route)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);

    const check = await post(port, "/crisis/scenarios/crisis-smoke/check");
    expect(check.status).toBe(200);
    expect(check.body.passed).toBe(true);
  }, 30_000);

  it("returns a 5xx with the structured failure body when setup fails", async () => {
    process.env.PATH = path.join(fakeHome, "missing-bin");
    const response = await post(port, "/crisis/scenarios/crisis-smoke/setup");

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.message).toEqual(expect.any(String));
    expect(response.body.path).toEqual(expect.any(String));
  });
});