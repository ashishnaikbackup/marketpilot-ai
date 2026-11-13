import test from "node:test";
import assert from "node:assert/strict";
import { paperBotRoute } from "../src/paper-bot.js";

const db = {
  prepare() {
    const result = {
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ success: true }),
    };
    return { ...result, bind() { return result; } };
  },
};
const request = (path, token) => new Request("https://unit.test"+path, {
  headers: token ? { Authorization: "Bearer "+token } : {},
});

test("paper bot positions do not expose records without a read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 401);
});

test("paper bot positions reject wrong read tokens", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions", "wrong"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 401);
});

test("paper bot positions return only after valid read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions", "private-test-token"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).positions, []);
});

test("paper bot reports are protected by the read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/reports"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/reports"));
  assert.equal(response.status, 401);
});

test("paper bot reports return only after valid read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/reports", "private-test-token"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/reports"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).reports, []);
});
