const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"}});
const error=(s,n=422)=>json({detail:s},n);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
function trend(i){
 const c=i.candles?.map(x=>x.close);
 if(!Array.isArray(c)||c.length<55||!c.every(x=>finite(x)&&x>0))return {side:"NONE",reason:"Need at least 55 valid daily closes."};
 const sma20=avg(c.slice(-20)),sma50=avg(c.slice(-50)),last=c.at(-1),prior=c.at(-6);
 let gain=0,loss=0;for(let n=c.length-14;n<c.length;n++){const d=c[n]-c[n-1];if(d>0)gain+=d;else loss-=d;}
 const rsi=loss===0?100:100-100/(1+(gain/14)/(loss/14)),momentum=prior>0?last/prior-1:0;
 if(last>sma20&&sma20>sma50&&rsi>=52&&rsi<=72&&momentum>.005)return {side:"BULLISH",reason:"Price above rising 20/50-day averages; RSI and five-session momentum confirm.",sma20,sma50,rsi,momentum};
 if(last<sma20&&sma20<sma50&&rsi>=28&&rsi<=48&&momentum<-.005)return {side:"BEARISH",reason:"Price below falling 20/50-day averages; RSI and five-session momentum confirm.",sma20,sma50,rsi,momentum};
 return {side:"NONE",reason:"Trend, RSI and momentum do not align.",sma20,sma50,rsi,momentum};
}
function fresh(q,nowMs){if(!q||!finite(q.bid)||!finite(q.ask)||q.bid<=0||q.ask<q.bid||!q.timestamp)return false;const age=nowMs-Date.parse(q.timestamp);return Number.isFinite(age)&&age>=-60000&&age<=300000;}
async function run(snapshot,env,trigger="manual"){
 if(!env.DB)throw Error("D1 binding DB is not configured.");
 if(!snapshot||snapshot.schema_version!==1||!["INDIA","GLOBAL"].includes(snapshot.region)||!Array.isArray(snapshot.instruments)||snapshot.instruments.length>1000||!snapshot.source||!snapshot.observed_at)throw Error("Invalid normalized snapshot. See docs/PAPER_BOT.md for the schema.");
 const nowMs=Date.now(),stamp=Date.parse(snapshot.observed_at),age=nowMs-stamp;
 if(!Number.isFinite(stamp)||age< -60000||age>900000||!["live","delayed"].includes(snapshot.data_mode))return {status:"skipped",reason:"Data is missing, future-dated, older than 15 minutes or not live/delayed.",data_age_seconds:Number.isFinite(age)?Math.round(age/1000):null};
 const region=snapshot.region,account=await env.DB.prepare("SELECT * FROM bot_accounts WHERE region=?").bind(region).first();
 if(!account)throw Error("Paper account is missing. Apply the D1 migration first.");
 const runId=id(),started=now(),decisions=[],instruments=new Map(snapshot.instruments.map(x=>[x.symbol,x])),contracts=new Map((snapshot.option_contracts||[]).map(x=>[x.contract_id,x]));
 let closed=0,opened=0,realized=0,unrealized=0;
 const positions=await env.DB.prepare("SELECT * FROM bot_positions WHERE region=? AND status='OPEN'").bind(region).all();
 for(const p of positions.results||[]){
  const q=p.asset_class==="OPTION"?contracts.get(p.instrument_id):instruments.get(p.symbol)?.quote;
  if(!fresh(q,nowMs)){decisions.push({symbol:p.symbol,action:"HOLD",reason:"No fresh two-sided quote; mark withheld."});continue;}
  const mark=q.bid,pnl=(mark-p.entry_price)*p.quantity*p.lot_size;
  unrealized+=pnl;
  await env.DB.prepare("UPDATE bot_positions SET last_price=?,last_observed_at=? WHERE id=?").bind(mark,snapshot.observed_at,p.id).run();
  const exit=mark<=p.stop_price?"STOP":mark>=p.target_price?"TARGET":(nowMs-Date.parse(p.opened_at))/86400000>=10?"TIME_EXIT":null;
  if(exit){await env.DB.prepare("UPDATE bot_positions SET status='CLOSED',exit_price=?,closed_at=?,realized_pnl=?,exit_reason=? WHERE id=?").bind(mark,now(),pnl,exit,p.id).run();closed++;realized+=pnl;decisions.push({symbol:p.symbol,action:"CLOSE",reason:exit,price:mark,pnl:Number(pnl.toFixed(2))});}
 }
 const accountAfter=await env.DB.prepare("SELECT COALESCE(SUM(realized_pnl),0) AS pnl FROM bot_positions WHERE region=? AND status='CLOSED'").bind(region).first();
 await env.DB.prepare("UPDATE bot_accounts SET realized_pnl=?,updated_at=? WHERE region=?").bind(Number(accountAfter?.pnl||0),now(),region).run();
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM bot_positions WHERE region=? AND status='OPEN'").bind(region).first();
 let slots=Math.max(0,12-Number(count?.n||0));
 const equity=Number(account.starting_cash)+Number(accountAfter?.pnl||0)+unrealized;
 const candidates=[];
 for(const i of snapshot.instruments){
  if(!i||!i.symbol||!["EQUITY","ETF"].includes(i.asset_class))continue;
  const s=trend(i);if(s.side!=="BULLISH")continue;
  if(!fresh(i.quote,nowMs)){decisions.push({symbol:i.symbol,action:"SKIP",reason:"Fresh bid/ask unavailable."});continue;}
  const existing=await env.DB.prepare("SELECT id FROM bot_positions WHERE region=? AND symbol=? AND status='OPEN'").bind(region,i.symbol).first();if(existing)continue;
  const entry=i.quote.ask,stop=entry*.97,target=entry*1.06,risk=equity*.0025,qty=Math.floor(Math.min(risk/(entry-stop),equity*.08/entry));
  if(qty<1){decisions.push({symbol:i.symbol,action:"SKIP",reason:"Below minimum size under risk budget."});continue;}
  candidates.push({i,s,entry,stop,target,qty,score:s.momentum});
 }
 candidates.sort((a,b)=>b.score-a.score);
 for(const x of candidates.slice(0,slots)){
  const pid=id();await env.DB.prepare("INSERT INTO bot_positions (id,region,symbol,instrument_id,asset_class,side,option_type,strike,expiry,quantity,lot_size,entry_price,last_price,stop_price,target_price,status,opened_at,last_observed_at,source,run_id,thesis,exit_reason,realized_pnl) VALUES (?,?,?,?,?,'LONG',NULL,NULL,NULL,?,1,?,?,?,?, 'OPEN',?,?,?,?,?,NULL,0)")
   .bind(pid,region,x.i.symbol,x.i.instrument_id||x.i.symbol,x.i.asset_class,x.qty,x.entry,x.entry,x.stop,x.target,now(),snapshot.observed_at,snapshot.source,runId,x.s.reason).run();
  opened++;decisions.push({symbol:x.i.symbol,action:"PAPER_BUY",asset_class:x.i.asset_class,quantity:x.qty,entry:Number(x.entry.toFixed(4)),stop:Number(x.stop.toFixed(4)),target:Number(x.target.toFixed(4)),reason:x.s.reason});
 }
 const signals=new Map(snapshot.instruments.map(i=>[i.symbol,trend(i)])),optionPicks=[];
 for(const o of snapshot.option_contracts||[]){
  const s=signals.get(o.underlying);if(!s||!["BULLISH","BEARISH"].includes(s.side)||!o.contract_id||!o.symbol||!fresh(o,nowMs))continue;
  const right=region==="INDIA"?(s.side==="BULLISH"?"CE":"PE"):(s.side==="BULLISH"?"CALL":"PUT"),expiry=Date.parse(region==="INDIA"?o.expiry+"T15:30:00+05:30":o.expiry+"T23:59:59Z"),dte=(expiry-nowMs)/86400000,mid=(o.bid+o.ask)/2;
  if(o.option_type!==right||!finite(o.strike)||!Number.isInteger(o.lot_size)||o.lot_size<1||!finite(o.delta)||Math.abs(o.delta)<.35||Math.abs(o.delta)>.65||!finite(o.iv)||o.iv<=0||o.iv>1.5||!Number.isInteger(o.open_interest)||o.open_interest<(region==="INDIA"?500:100)||!Number.isInteger(o.volume)||o.volume<(region==="INDIA"?50:10)||dte<7||dte>(region==="INDIA"?45:60)||mid<=0||(o.ask-o.bid)/mid>(region==="INDIA"?.025:.05))continue;
  const existing=await env.DB.prepare("SELECT id FROM bot_positions WHERE region=? AND instrument_id=? AND status='OPEN'").bind(region,o.contract_id).first();if(existing)continue;
  optionPicks.push({o,s,rank:Math.abs(Math.abs(o.delta)-.5)+(o.ask-o.bid)/mid});
 }
 optionPicks.sort((a,b)=>a.rank-b.rank);
 let optionOpened=0;
 for(const {o,s} of optionPicks.slice(0,Math.min(4,slots-opened))){
  const entry=o.ask,stop=entry*.7,target=entry*1.45,lot=o.lot_size;
  if(entry*lot*.3>equity*.0025||entry*lot>equity*.08){decisions.push({symbol:o.symbol,action:"SKIP",reason:"One-lot option risk exceeds portfolio limit."});continue;}
  const pid=id();await env.DB.prepare("INSERT INTO bot_positions (id,region,symbol,instrument_id,asset_class,side,option_type,strike,expiry,quantity,lot_size,entry_price,last_price,stop_price,target_price,status,opened_at,last_observed_at,source,run_id,thesis,exit_reason,realized_pnl) VALUES (?,?,?,?,?,'LONG',?,?,?,?,?,?,?,?,?,'OPEN',?,?,?,?,?,NULL,0)")
   .bind(pid,region,o.symbol,o.contract_id,"OPTION",o.option_type,o.strike,o.expiry,1,lot,entry,entry,stop,target,now(),snapshot.observed_at,snapshot.source,runId,s.reason+" Underlying trend selects "+o.option_type+"; long premium only.").run();
  optionOpened++;decisions.push({symbol:o.symbol,action:"PAPER_BUY",asset_class:"OPTION",option_type:o.option_type,strike:o.strike,expiry:o.expiry,quantity:1,lot_size:lot,entry:Number(entry.toFixed(4)),stop:Number(stop.toFixed(4)),target:Number(target.toFixed(4)),reason:s.reason+" Contract passed spread, liquidity, expiry and delta filters."});
 }
 opened+=optionOpened;
 const report={run_id:runId,region,currency:region==="INDIA"?"INR":"USD",trigger,source:snapshot.source,data_mode:snapshot.data_mode,observed_at:snapshot.observed_at,started_at:started,completed_at:now(),scanned:snapshot.instruments.length,option_contracts_seen:(snapshot.option_contracts||[]).length,opened,closed,realized_this_run:Number(realized.toFixed(2)),unrealized_estimate:Number(unrealized.toFixed(2)),decisions,notes:["Experimental rule-based paper simulation; not a validated strategy or investment advice.","No broker orders are sent. Long-only equity/ETF and long-premium option positions only.","Equity uses ask for entry and bid for mark/exit; fees, taxes, market impact and corporate actions are excluded.","No fresh quote means no new trade and no fabricated mark."]};
 await env.DB.prepare("INSERT INTO bot_runs (id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(runId,region,trigger,snapshot.source,snapshot.data_mode,snapshot.observed_at,started,report.completed_at,"completed",report.scanned,opened,closed,report.realized_this_run,JSON.stringify(report)).run();
 return report;
}
export async function paperBotRoute(request,env,url){
 const path=url.pathname;
 if(request.method==="GET"&&path==="/api/v1/paper-bot/status")return json({configured:Boolean(env.DB),feed_configured:Boolean(env.MARKET_DATA_SNAPSHOT_URL),mode:"paper_only",strategy_version:"trend-options-v1",schedule_utc:["10:20 UTC weekdays — India closing scan","22:30 UTC weekdays — global closing scan"],message:!env.DB?"D1 database is not configured.":!env.MARKET_DATA_SNAPSHOT_URL?"Normalized licensed market-data adapter is not configured.":"Bot services are configured; verify provider entitlements and data quality."});
 if(request.method==="GET"&&path==="/api/v1/paper-bot/positions"){
  if(!env.DB)return error("D1 database is not configured.",503);
  const region=url.searchParams.get("region"),r=region?await env.DB.prepare("SELECT * FROM bot_positions WHERE region=? ORDER BY opened_at DESC LIMIT 200").bind(region).all():await env.DB.prepare("SELECT * FROM bot_positions ORDER BY opened_at DESC LIMIT 200").all();
  return json({positions:r.results||[],mode:"paper_only"});
 }
 if(request.method==="GET"&&path==="/api/v1/paper-bot/reports"){
  if(!env.DB)return error("D1 database is not configured.",503);
  const r=await env.DB.prepare("SELECT id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json FROM bot_runs ORDER BY started_at DESC LIMIT 50").all();
  return json({reports:(r.results||[]).map(x=>({...x,report:JSON.parse(x.report_json||"{}")}))});
 }
 if(request.method==="POST"&&path==="/api/v1/paper-bot/run"){
  if(!env.DB)return error("D1 database is not configured.",503);
  if(!env.BOT_RUN_TOKEN||request.headers.get("Authorization")!=="Bearer "+env.BOT_RUN_TOKEN)return error("Valid server-side BOT_RUN_TOKEN required.",401);
  try{const p=await request.json();return json(await run(p.snapshot,env,"manual"));}catch(e){return error(e instanceof Error?e.message:"Invalid paper-bot request.");}
 }
 return null;
}
export async function scheduledPaperBot(event,env){
 if(!env.DB||!env.MARKET_DATA_SNAPSHOT_URL)return;
 const region=new Date(event.scheduledTime).getUTCHours()===10?"INDIA":"GLOBAL";
 try{
  const u=new URL(env.MARKET_DATA_SNAPSHOT_URL);u.searchParams.set("region",region);u.searchParams.set("purpose","paper-trading-eod");
  const r=await fetch(u.toString(),{headers:env.MARKET_DATA_API_TOKEN?{Authorization:"Bearer "+env.MARKET_DATA_API_TOKEN}:{}});
  if(!r.ok)throw Error("Provider adapter HTTP "+r.status);
  await run(await r.json(),env,"scheduled_eod");
 }catch(e){
  const at=now();await env.DB.prepare("INSERT INTO bot_runs (id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json) VALUES (?,?,?, ?,?,?,?,?,?,0,0,0,0,?)")
   .bind(id(),region,"scheduled_eod","unavailable","unavailable",at,at,now(),"skipped",JSON.stringify({status:"skipped",region,reason:e instanceof Error?e.message:"Market data unavailable."})).run();
 }
}
