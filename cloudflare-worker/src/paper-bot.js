import { hasBearer } from "./security.js";
import { evaluate, STRATEGY_VERSION } from "./engine.js";
import { fetchSnapshot, providerInfo } from "./providers.js";
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const error=(s,n=422)=>json({detail:s},n);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
async function telegramNotify(env,region,report){
 if(!env?.TELEGRAM_BOT_TOKEN||!env?.TELEGRAM_CHAT_ID)return false;
 const buys=(report.decisions||[]).filter(x=>x.action==="PAPER_BUY").map(x=>"- BUY "+x.symbol+" @ "+(x.entry??"—")+" · "+(x.quantity??1)+" x "+(x.lot_size??1));
 const exits=(report.decisions||[]).filter(x=>x.action==="CLOSE").map(x=>"- EXIT "+x.symbol+" · "+x.reason+" · P&L "+(x.pnl??"—"));
 const currency=region==="INDIA"?"₹":"$";
 const message=["MARKETPILOT · PAPER BOT",region+" end-of-day report","Status: "+(report.status||"completed"),"Time: "+(report.completed_at||now()),"Scanned: "+(report.scanned??0)+" · opened: "+(report.opened??0)+" · closed: "+(report.closed??0),"Realised P&L: "+currency+(report.realized_this_run??report.realized_pnl??0),"Source: "+(report.source||"unavailable")+" · "+(report.data_mode||"unknown"),...(buys.length?["Paper buys:",...buys]:["No new simulated buys."]),...(exits.length?["Exits:",...exits]:[]),"SIMULATED ONLY — no broker orders sent."].join(String.fromCharCode(10)).slice(0,3900);
 try{
  const response=await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message,disable_web_page_preview:true})});
  return response.ok;
 }catch{return false;}
}
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
 if(!env?.DB)throw Error("D1 binding DB is not configured.");
 if(!snapshot||snapshot.schema_version!==1||!["INDIA","GLOBAL"].includes(snapshot.region)||!Array.isArray(snapshot.instruments)||snapshot.instruments.length>1000||!snapshot.source||!snapshot.observed_at)throw Error("Invalid normalized snapshot. See docs/PAPER_BOT.md for the schema.");
 const nowMs=Date.now(),stamp=Date.parse(snapshot.observed_at),age=nowMs-stamp;
 if(!Number.isFinite(stamp)||age< -60000||age>900000||!["live","delayed","eod"].includes(snapshot.data_mode))return {status:"skipped",reason:"Data is missing, future-dated, older than 15 minutes or not live/delayed/eod.",data_age_seconds:Number.isFinite(age)?Math.round(age/1000):null};
 const region=snapshot.region;
 const account=await env.DB.prepare("SELECT * FROM bot_accounts WHERE region=?").bind(region).first();
 if(!account)throw Error("Paper account is missing. Apply the D1 migrations first.");
 const open=((await env.DB.prepare("SELECT * FROM bot_positions WHERE region=? AND status='OPEN'").bind(region).all()).results)||[];
 const closed=((await env.DB.prepare("SELECT strategy,realized_pnl FROM bot_positions WHERE region=? AND status='CLOSED'").bind(region).all()).results)||[];
 const runId=id(),started=now();
 const r=evaluate({snapshot,account:{starting_cash:Number(account.starting_cash)},open,closedHistory:closed.map(x=>({strategy:x.strategy||"legacy",net_pnl:Number(x.realized_pnl||0)})),nowMs});
 const stamped=now(),db=env.DB,stmts=[];
 for(const m of r.marks)stmts.push(db.prepare("UPDATE bot_positions SET last_price=?,last_observed_at=? WHERE id=?").bind(m.last_price,m.observed_at,m.id));
 for(const x of r.exits)stmts.push(db.prepare("UPDATE bot_positions SET status='CLOSED',exit_price=?,closed_at=?,realized_pnl=?,gross_pnl=?,exit_fees=?,holding_days=?,exit_reason=? WHERE id=?").bind(x.exit_price,stamped,x.net_pnl,x.gross_pnl,x.exit_fees,x.holding_days,x.exit_reason,x.id));
 for(const e of r.entries)stmts.push(db.prepare("INSERT INTO bot_positions (id,region,symbol,instrument_id,asset_class,side,option_type,strike,expiry,quantity,lot_size,entry_price,last_price,stop_price,target_price,status,opened_at,last_observed_at,source,run_id,thesis,exit_reason,realized_pnl,strategy,exchange,order_type,risk_amount,capital_allocated,entry_fees,slippage_bps,price_basis,explanation) VALUES (?,?,?,?,?,'LONG',?,?,?,?,?,?,?,?,?,'OPEN',?,?,?,?,?,NULL,0,?,?,?,?,?,?,?,?,?)")
  .bind(id(),region,e.symbol,e.instrument_id,e.asset_class,e.option_type,e.strike,e.expiry,e.quantity,e.lot_size,e.entry_price,e.entry_price,e.stop_price,e.target_price,stamped,snapshot.observed_at,snapshot.source,runId,e.thesis,e.strategy,e.exchange,e.order_type,e.risk_amount,e.capital_allocated,e.entry_fees,e.slippage_bps,e.price_basis,e.explanation));
 const q=r.snapshotRow;
 stmts.push(db.prepare("UPDATE bot_accounts SET realized_pnl=?,updated_at=? WHERE region=?").bind(q.realized_pnl,stamped,region));
 stmts.push(db.prepare("INSERT INTO bot_equity_snapshots (id,region,recorded_at,data_mode,equity,cash,exposure,realized_pnl,unrealized_pnl,open_positions,run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id(),region,stamped,snapshot.data_mode,q.equity,q.cash,q.exposure,q.realized_pnl,q.unrealized_pnl,q.open_positions,runId));
 const report={run_id:runId,trigger,started_at:started,completed_at:stamped,status:"completed",scanned:snapshot.instruments.length,opened:r.entries.length,closed:r.exits.length,realized_this_run:r.report.portfolio.realized_this_run,unrealized_estimate:r.report.portfolio.unrealized_pnl,option_contracts_seen:(snapshot.option_contracts||[]).length,...r.report};
 stmts.push(db.prepare("INSERT INTO bot_runs (id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(runId,region,trigger,snapshot.source,snapshot.data_mode,snapshot.observed_at,started,stamped,"completed",report.scanned,report.opened,report.closed,report.realized_this_run,JSON.stringify(report)));
 await db.batch(stmts);
 return report;
}
function stats(rows,snaps){
 const net=rows.map(x=>Number(x.realized_pnl||0)),wins=net.filter(x=>x>0),losses=net.filter(x=>x<0);
 const gw=wins.reduce((a,b)=>a+b,0),gl=-losses.reduce((a,b)=>a+b,0);
 let peak=-Infinity,maxDD=0;for(const s of [...snaps].reverse()){peak=Math.max(peak,s.equity);if(peak>0)maxDD=Math.min(maxDD,s.equity/peak-1);}
 return {closed_trades:rows.length,wins:wins.length,losses:losses.length,win_rate_pct:rows.length?Number((wins.length/rows.length*100).toFixed(1)):null,net_realized_pnl:Number(net.reduce((a,b)=>a+b,0).toFixed(2)),profit_factor:gl>0?Number((gw/gl).toFixed(2)):null,avg_win:wins.length?Number((gw/wins.length).toFixed(2)):null,avg_loss:losses.length?Number((-gl/losses.length).toFixed(2)):null,avg_holding_days:rows.length?Number((rows.reduce((a,b)=>a+Number(b.holding_days||0),0)/rows.length).toFixed(2)):null,max_drawdown_pct:Number((maxDD*100).toFixed(2))};
}
const readGuard=(request,env)=>{
 if(!env?.DB)return error("D1 database is not configured.",503);
 if(!env.BOT_READ_TOKEN)return error("Paper bot read access is disabled until BOT_READ_TOKEN is configured.",503);
 if(!hasBearer(request,env.BOT_READ_TOKEN))return error("Valid paper bot read token required.",401);
 return null;
};
const regionParam=url=>{const r=(url.searchParams.get("region")||"").toUpperCase();return ["INDIA","GLOBAL"].includes(r)?r:null;};
const limitParam=(url,def,max)=>{const n=parseInt(url.searchParams.get("limit")||"",10);return Number.isInteger(n)&&n>0?Math.min(n,max):def;};
export async function paperBotRoute(request,env,url){
 const path=url.pathname;
 if(request.method==="GET"&&path==="/api/v1/paper-bot/status"){
  const info=providerInfo(env);
  return json({configured:Boolean(env?.DB),feed_configured:info.configured,provider:info,mode:"paper_only",strategy_version:STRATEGY_VERSION,
   schedule_utc:["India EOD run 10:20 UTC (15:50 IST), Mon-Fri","Global EOD run 22:30 UTC, Mon-Fri","Intraday runs every 5-15 minutes only when a live/delayed snapshot adapter is configured"],
   message:!env?.DB?"D1 database is not configured.":!info.configured?info.message:"Bot services are configured; verify provider entitlements and data quality."});
 }
 if(request.method==="GET"&&path==="/api/v1/paper-bot/positions"){
  const g=readGuard(request,env);if(g)return g;
  const region=regionParam(url),lim=limitParam(url,200,500);
  const r=region?await env.DB.prepare("SELECT * FROM bot_positions WHERE region=? ORDER BY opened_at DESC LIMIT ?").bind(region,lim).all():await env.DB.prepare("SELECT * FROM bot_positions ORDER BY opened_at DESC LIMIT ?").bind(lim).all();
  return json({positions:r.results||[],mode:"paper_only"});
 }
 if(request.method==="GET"&&path==="/api/v1/paper-bot/portfolio"){
  const g=readGuard(request,env);if(g)return g;
  const region=regionParam(url)||"INDIA";
  const account=await env.DB.prepare("SELECT * FROM bot_accounts WHERE region=?").bind(region).first();
  if(!account)return error("Paper account not found. Apply D1 migrations.",404);
  const closed=((await env.DB.prepare("SELECT realized_pnl,holding_days FROM bot_positions WHERE region=? AND status='CLOSED'").bind(region).all()).results)||[];
  const snaps=((await env.DB.prepare("SELECT * FROM bot_equity_snapshots WHERE region=? ORDER BY recorded_at DESC LIMIT 500").bind(region).all()).results)||[];
  const latest=snaps[0]||null;
  return json({region,mode:"paper_only",currency:region==="INDIA"?"INR":"USD",starting_capital:Number(account.starting_cash),latest_snapshot:latest,
   equity:latest?latest.equity:Number(account.starting_cash),cash:latest?latest.cash:Number(account.starting_cash),
   total_pnl:latest?Number((latest.equity-Number(account.starting_cash)).toFixed(2)):0,
   stats:stats(closed,snaps),has_history:snaps.length>0});
 }
 if(request.method==="GET"&&path==="/api/v1/paper-bot/equity"){
  const g=readGuard(request,env);if(g)return g;
  const region=regionParam(url)||"INDIA",lim=limitParam(url,200,1000);
  const r=await env.DB.prepare("SELECT recorded_at,data_mode,equity,cash,exposure,realized_pnl,unrealized_pnl,open_positions FROM bot_equity_snapshots WHERE region=? ORDER BY recorded_at DESC LIMIT ?").bind(region,lim).all();
  return json({region,points:(r.results||[]).slice().reverse()});
 }
 if(request.method==="GET"&&path==="/api/v1/paper-bot/reports"){
  const g=readGuard(request,env);if(g)return g;
  const region=regionParam(url),lim=limitParam(url,50,200);
  const cols="id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json";
  const r=region?await env.DB.prepare("SELECT "+cols+" FROM bot_runs WHERE region=? ORDER BY started_at DESC LIMIT ?").bind(region,lim).all():await env.DB.prepare("SELECT "+cols+" FROM bot_runs ORDER BY started_at DESC LIMIT ?").bind(lim).all();
  return json({reports:(r.results||[]).map(x=>{let report={};try{report=JSON.parse(x.report_json||"{}");}catch{}return {...x,report_json:undefined,report};})});
 }
 if(request.method==="POST"&&path==="/api/v1/paper-bot/run"){
  if(!env?.DB)return error("D1 database is not configured.",503);
  if(!hasBearer(request,env.BOT_RUN_TOKEN))return error("Valid server-side BOT_RUN_TOKEN required.",401);
  try{const p=await request.json();return json(await run(p.snapshot,env,"manual"));}catch(e){return error(e instanceof Error?e.message:"Paper bot run failed.",422);}
 }
 return null;
}
async function logSkipped(env,region,trigger,reason){
 const at=now();
 await env.DB.prepare("INSERT INTO bot_runs (id,region,trigger,source,data_mode,observed_at,started_at,completed_at,status,scanned,opened,closed,realized_pnl,report_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
  .bind(id(),region,trigger,"unavailable","unavailable",at,at,now(),"skipped",0,0,0,0,JSON.stringify({status:"skipped",stance:"NO_TRADE",region,reason:String(reason).slice(0,300),inactive_reason:String(reason).slice(0,300),notes:["Data unavailable: the bot did nothing and invented nothing."]})).run();
}
// Which regions to run at this cron tick. EOD providers only run once per day at the EOD slot.
export function regionsFor(event,env){
 const t=event.scheduledTime,utc=new Date(t),hour=utc.getUTCHours(),minute=utc.getUTCMinutes(),weekday=utc.getUTCDay()>=1&&utc.getUTCDay()<=5;
 const ist=new Date(t+330*60000),istMin=ist.getUTCHours()*60+ist.getUTCMinutes(),indiaDay=ist.getUTCDay()>=1&&ist.getUTCDay()<=5;
 const indiaEod=hour===10&&minute===20&&indiaDay,globalEod=hour===22&&minute===30&&weekday;
 if(providerInfo(env).data_mode==="eod")return [...(indiaEod?[{region:"INDIA",eod:true}]:[]),...(globalEod?[{region:"GLOBAL",eod:true}]:[])];
 const out=[];
 if((indiaDay&&istMin>=555&&istMin<=930)||indiaEod)out.push({region:"INDIA",eod:indiaEod});
 if(minute%15===0||globalEod)out.push({region:"GLOBAL",eod:globalEod});
 return out;
}
export async function scheduledPaperBot(event,env){
 if(!env?.DB||!providerInfo(env).configured)return;
 for(const {region,eod} of regionsFor(event,env)){
  const trigger=eod?"scheduled_eod":"scheduled_intraday";
  try{
   const result=await run(await fetchSnapshot(env,region,eod?"paper_eod":"paper_intraday"),env,trigger);
   if(eod)await telegramNotify(env,region,result);
   if(result?.status==="skipped")await logSkipped(env,region,trigger,result.reason||"Snapshot skipped.");
  }catch(e){
   const reason=e instanceof Error?e.message:"Provider unavailable.";
   try{await logSkipped(env,region,trigger,reason);}catch{}
   if(eod)await telegramNotify(env,region,{status:"skipped",region,completed_at:now(),reason});
  }
 }
}
