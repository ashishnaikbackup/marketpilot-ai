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

test("scheduled engine sizes long futures by lot and records expiry", async () => {
  const writes = [];
  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (sql.includes("FROM bot_accounts")) return { region:"INDIA", starting_cash:1000000 };
              if (sql.includes("COALESCE(SUM")) return { pnl:0 };
              if (sql.includes("COUNT(*)")) return { n:0 };
              return null;
            },
            all: async () => ({ results:[] }),
            run: async () => { writes.push({sql,args}); return { success:true }; },
          };
        },
      };
    },
  };
  const candles=[];let price=100;candles.push({close:price});
  for(let i=1;i<55;i++){price+=i%2===1?1.2:-0.5;candles.push({close:price});}
  const observedAt=new Date().toISOString();
  const expiry=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const snapshot={schema_version:1,region:"INDIA",source:"test-fixture",data_mode:"live",observed_at:observedAt,instruments:[{symbol:"NIFTY-FUT",instrument_id:"NIFTY-FUT-ID",asset_class:"FUTURE",expiry,lot_size:25,candles,quote:{bid:price-0.1,ask:price,timestamp:observedAt}}],option_contracts:[]};
  const request=new Request("https://unit.test/api/v1/paper-bot/run",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer run-secret"},body:JSON.stringify({snapshot})});
  const response=await (await import("../src/paper-bot.js")).paperBotRoute(request,{DB:mockDb,BOT_RUN_TOKEN:"run-secret"},new URL("https://unit.test/api/v1/paper-bot/run"));
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.opened,1);
  assert.equal(result.decisions[0].asset_class,"FUTURE");
  const insert=writes.find(x=>x.sql.includes("INSERT INTO bot_positions"));
  assert.ok(insert);
  assert.equal(insert.args[4],"FUTURE");
  assert.equal(insert.args[5],expiry);
  assert.ok(insert.args[6]>0);
  assert.equal(insert.args[7],25);
});
