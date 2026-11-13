import { paperBotRoute, scheduledPaperBot } from "./paper-bot.js";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
});
const error = (message, status = 422) => json({ detail: message }, status);
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const erf = (x) => {
  const sign = x < 0 ? -1 : 1, a = Math.abs(x), p = 0.3275911, z = 1 / (1 + p * a);
  return sign * (1 - (((((1.061405429*z-1.453152027)*z)+1.421413741)*z-0.284496736)*z+0.254829592)*z*Math.exp(-a*a));
};
const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
const pdf = (x) => Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI);
function bs(side, s, k, t, r, v) {
  if (![s,k,t,r,v].every(finite) || s<=0 || k<=0 || t<=0 || v<=0 || v>5 || r<-.05 || r>.3) throw Error("Invalid Black-Scholes inputs.");
  const root=Math.sqrt(t), d1=(Math.log(s/k)+(r+.5*v*v)*t)/(v*root), d2=d1-v*root, disc=Math.exp(-r*t), density=pdf(d1);
  const call=side==="call";
  return {
    theoretical_price: call ? s*cdf(d1)-k*disc*cdf(d2) : k*disc*cdf(-d2)-s*cdf(-d1),
    delta: call ? cdf(d1) : cdf(d1)-1,
    gamma: density/(s*v*root),
    theta_per_year: -(s*density*v)/(2*root) + (call ? -r*k*disc*cdf(d2) : r*k*disc*cdf(-d2)),
    vega_per_1pct: s*density*root/100,
  };
}
async function body(request) { try { return await request.json(); } catch { throw Error("Request body must be valid JSON."); } }
function sma(values, window) {
  const out=[]; let sum=0;
  for(let i=0;i<values.length;i++){sum+=values[i];if(i>=window)sum-=values[i-window];out.push(i>=window-1?sum/window:null);}
  return out;
}
async function route(request, env) {
  const url=new URL(request.url), path=url.pathname;
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  const paperBotResponse=await paperBotRoute(request,env,url);if(paperBotResponse)return paperBotResponse;
  if(request.method==="GET" && (path==="/" || path==="/api/v1/health")) return json({status:"ok",service:"marketpilot-cloudflare-api",runtime:"cloudflare-workers",data_mode:"calculations_only",ai_binding_configured:Boolean(env?.AI?.run),ai_chat_enabled:env?.AI_CHAT_ENABLED==="true"});
  if(request.method==="GET" && path==="/api/v1/ai/status") { const enabled=env?.AI_CHAT_ENABLED==="true"; const configured=Boolean(env?.AI?.run); return json({available:enabled&&configured,enabled,provider:"cloudflare_workers_ai",model:"@cf/google/gemma-4-26b-a4b-it",mode:!enabled?"disabled_by_default":configured?"configured":"not_configured",disclaimer:"AI chat is disabled by default until rate limiting and abuse controls are configured. Binding availability does not guarantee inference capacity or free daily quota."}); }
  if(request.method==="GET" && path==="/api/v1/market-data/status") return json({provider_connected:Boolean(env?.MARKET_DATA_SNAPSHOT_URL),provider:env?.MARKET_DATA_PROVIDER||null,data_mode:env?.MARKET_DATA_SNAPSHOT_URL?"adapter_configured_not_verified":"unavailable",instruments:[],message:env?.MARKET_DATA_SNAPSHOT_URL?"A normalized provider adapter URL is configured; live entitlements, timestamps and schema must still be verified.":"No normalized market-data adapter is configured. Live analytics remain disabled."});
  if(request.method==="GET" && path==="/api/v1/instruments") return json({instruments:["NIFTY","BANKNIFTY","FINNIFTY"],source:"bootstrap_catalogue",contract_master_verified:false});
  if(request.method!=="POST") return error("Route not found.",404);
  const p=await body(request);
  try {
    if(path==="/api/v1/ai/chat"){
      if(env?.AI_CHAT_ENABLED!=="true") return error("AI chat is disabled by default. Enable it only after configuring Cloudflare-side rate limiting and abuse monitoring.",503);
      if(!env?.AI?.run) return error("Workers AI binding is not configured. Add the AI binding named AI in Cloudflare Worker settings.",503);
      if(!Array.isArray(p.messages)||!p.messages.length||p.messages.length>12) throw Error("Provide 1 to 12 chat messages.");
      const messages=p.messages.map(m=>{
        if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string"||!m.content.trim()||m.content.length>4000) throw Error("Each message must have role user/assistant and 1 to 4000 characters.");
        return {role:m.role,content:m.content};
      });
      const context=typeof p.context==="string"?p.context.slice(0,6000):"";
      const latestQuestion=[...messages].reverse().find(m=>m.role==="user")?.content||"";
      const q=latestQuestion.toLowerCase();
      const intent=/expense|budget|cash flow|savings goal|income|spending|financial health/.test(q)?"personal_finance":/nifty|banknifty|finnifty|option|pcr|open interest|greeks|expiry|ce|pe|f&o/.test(q)?"india_derivatives":/portfolio|sip|mutual fund|stock|etf|gold|asset allocation|investment/.test(q)?"investment_research":"financial_education";
      const system="You are MarketPilot AI, an educational Indian-market and personal-finance research assistant. Prioritise NSE cash equities and NIFTY, BANKNIFTY and FINNIFTY derivatives, while also helping users understand income, expenses, budgets, savings goals, portfolio exposure and long-term wealth planning. Be precise, explain your reasoning, separate observed data from assumptions, and teach the user. Never invent current prices, option strikes, expiries, lot sizes, quotes, OI, news, bank transactions, account balances, tax rules or probabilities. The platform has no connected authorised live NSE feed. User-imported option-chain data is unverified and must be described as user-supplied, with its source and timestamp caveats. Personal finance summaries are user-entered local browser records and may be incomplete; never claim bank verification. PCR, OI concentrations and max pain are descriptive context, not standalone directional predictors. Do not provide a direct buy/sell instruction or claim a best CE/PE entry. For a trade review, explain what evidence is missing and use NO TRADE if live, fresh, verified data and a tested rule are absent. Always discuss invalidation, position sizing, liquidity, fees, slippage and loss risk. No broker orders or execution. For personal finance, explain cash flow and budget arithmetic transparently, ask before assuming missing income or obligations, and do not promise investment outcomes. If asked for best time, distinguish historical time-of-day analysis from a live timing signal. Keep answers structured and practical for a learner. No external research sources are fetched in this request; never invent citations. Detected request category: "+intent+". Use the available local context only when it is relevant.";
      try {
        const result=await env.AI.run("@cf/google/gemma-4-26b-a4b-it",{
          messages:[{role:"system",content:system},...(context?[{role:"user",content:"Additional user-supplied context (unverified): "+context}]:[]),...messages],
          max_tokens:900,
          temperature:0.2,
          stream:false,
          chat_template_kwargs:{enable_thinking:false}
        });
        const answer=result?.response??result?.choices?.[0]?.message?.content??result?.output_text??"";
        if(typeof answer!=="string"||!answer.trim()) throw Error("The model returned an empty response.");
        return json({answer,model:"@cf/google/gemma-4-26b-a4b-it",provider:"cloudflare_workers_ai",data_mode:"user_context_only",workflow:{understand:{intent},retrieve:{local_context_supplied:Boolean(context),external_sources_searched:false},research:{live_market_data_available:false,deterministic_market_calculations_performed:false},explain:{model:"@cf/google/gemma-4-26b-a4b-it",human_review_required:true}},disclaimer:"AI-generated educational research. No external source retrieval or live market data in this request. Not a validated trading signal or investment advice."});
      } catch(e) {
        return error("AI request failed or free daily inference allowance is unavailable. No paid upgrade is enabled. "+(e instanceof Error?e.message:""),503);
      }
    }
    if(path==="/api/v1/options/greeks"){
      if(!["call","put"].includes(p.side)) throw Error("side must be call or put");
      const result=bs(p.side,p.spot,p.strike,p.years_to_expiry,p.risk_free_rate,p.volatility);
      return json({model:"black_scholes_european",inputs:p,...Object.fromEntries(Object.entries(result).map(([k,v])=>[k,Number(v.toFixed(8))])),data_mode:"modelled_assumptions",disclaimer:"Theoretical model from user inputs, not an exchange quote or trading signal. European assumptions; dividends and costs omitted."});
    }
    if(path==="/api/v1/options/implied-volatility"){
      if(!["call","put"].includes(p.side) || !finite(p.option_price) || p.option_price<=0) throw Error("Invalid side or option_price.");
      let lo=1e-6,hi=5;
      const f=(v)=>bs(p.side,p.spot,p.strike,p.years_to_expiry,p.risk_free_rate,v).theoretical_price;
      if(p.option_price<f(lo)-1e-6 || p.option_price>f(hi)+1e-6) throw Error("Premium is outside the supported model price range.");
      for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(Math.abs(f(mid)-p.option_price)<1e-8){lo=hi=mid;break;}if(f(mid)<p.option_price)lo=mid;else hi=mid;}
      const iv=(lo+hi)/2;return json({model:"black_scholes_european_bisection",implied_volatility:iv,implied_volatility_percent:Number((iv*100).toFixed(4)),data_mode:"modelled_from_user_supplied_option_price",disclaimer:"Not an exchange IV quote."});
    }
    if(path==="/api/v1/options/expiry-payoff"){
      const {positions,spot_min,spot_max,steps=21}=p;
      if(!Array.isArray(positions)||!positions.length||positions.length>20||!finite(spot_min)||!finite(spot_max)||spot_min<0||spot_max<=spot_min||!Number.isInteger(steps)||steps<2||steps>201) throw Error("Invalid payoff request.");
      for(const x of positions) if(!["call","put"].includes(x.side)||!finite(x.quantity)||!x.quantity||!finite(x.strike)||x.strike<=0||!finite(x.premium)||x.premium<0||!Number.isInteger(x.lot_size)||x.lot_size<=0) throw Error("Invalid option position.");
      const points=Array.from({length:steps},(_,i)=>{const spot=spot_min+(spot_max-spot_min)*i/(steps-1);const gross=positions.reduce((sum,x)=>sum+(x.side==="call"?Math.max(spot-x.strike,0):Math.max(x.strike-spot,0)-0)*(x.quantity>0?1:1)*x.quantity*x.lot_size-x.premium*x.quantity*x.lot_size,0);return {underlying_at_expiry:Number(spot.toFixed(4)),gross_pnl:Number(gross.toFixed(2))};});
      return json({calculation:"expiry_payoff",data_mode:"calculation_only",includes_fees:false,includes_slippage:false,points,disclaimer:"Gross expiry payoff only; not a live option value, margin calculation or recommendation."});
    }
    if(path==="/api/v1/backtest/sma-crossover"){
      const {closes,fast_window=5,slow_window=20,fee_bps=5,slippage_bps=5}=p;
      if(!Array.isArray(closes)||closes.length<22||closes.length>10000||!closes.every(x=>finite(x)&&x>0)) throw Error("Provide 22 to 10000 positive closing prices.");
      if(!Number.isInteger(fast_window)||!Number.isInteger(slow_window)||fast_window<2||slow_window<=fast_window||slow_window>500||!finite(fee_bps)||!finite(slippage_bps)||fee_bps<0||slippage_bps<0||fee_bps>500||slippage_bps>500) throw Error("Invalid windows or cost assumptions.");
      const fast=sma(closes,fast_window),slow=sma(closes,slow_window);let equity=1,peak=1,maxDD=0,pos=0,changes=0;
      for(let i=1;i<closes.length;i++){if(fast[i-1]!==null&&slow[i-1]!==null){const next=fast[i-1]>slow[i-1]?1:0;if(next!==pos){equity*=1-(fee_bps+slippage_bps)/10000;pos=next;changes++;}}if(pos)equity*=closes[i]/closes[i-1];peak=Math.max(peak,equity);maxDD=Math.min(maxDD,equity/peak-1);}
      return json({strategy:"long_only_sma_crossover",fast_window,slow_window,final_equity:Number(equity.toFixed(6)),total_return_pct:Number(((equity-1)*100).toFixed(4)),max_drawdown_pct:Number((maxDD*100).toFixed(4)),position_changes:changes,bars_evaluated:closes.length,fee_bps_per_change:fee_bps,slippage_bps_per_change:slippage_bps,warning:"Educational baseline only. No out-of-sample validation, corporate actions, taxes, borrow costs or survivorship controls."});
    }
    if(path==="/api/v1/analytics/option-chain"){
      if(!Array.isArray(p.rows)||!p.rows.length||p.rows.length>5000) throw Error("Provide 1 to 5000 option-chain rows.");
      let callOI=0,putOI=0,callVol=0,putVol=0,callChange=0,putChange=0;
      const strikes=[...new Set(p.rows.map(r=>r.strike))].sort((a,b)=>a-b);
      const oiByStrike={};
      for(const r of p.rows){
        if(!finite(r.strike)||r.strike<=0||!Number.isInteger(r.open_interest)||r.open_interest<0||!Number.isInteger(r.volume)||r.volume<0) throw Error("Invalid option-chain row.");
        if(r.change_oi!==undefined&&(!Number.isInteger(r.change_oi))) throw Error("change_oi must be an integer when supplied.");
        const isCall=r.option_type==="CE"||r.option_type==="call",isPut=r.option_type==="PE"||r.option_type==="put";
        if(!isCall&&!isPut) throw Error("option_type must be CE or PE.");
        if(isCall){callOI+=r.open_interest;callVol+=r.volume;callChange+=r.change_oi||0;}else{putOI+=r.open_interest;putVol+=r.volume;putChange+=r.change_oi||0;}
        oiByStrike[r.strike]??={call:0,put:0};oiByStrike[r.strike][isCall?"call":"put"]+=r.open_interest;
      }
      const maxPain=strikes.map(candidate=>({strike:candidate,payout:p.rows.reduce((total,r)=>total+(r.option_type==="CE"||r.option_type==="call"?Math.max(candidate-r.strike,0):Math.max(r.strike-candidate,0))*r.open_interest,0)})).sort((a,b)=>a.payout-b.payout)[0]?.strike??null;
      const topCall=Object.entries(oiByStrike).sort((a,b)=>b[1].call-a[1].call)[0]?.[0]??null;
      const topPut=Object.entries(oiByStrike).sort((a,b)=>b[1].put-a[1].put)[0]?.[0]??null;
      return json({call_open_interest:callOI,put_open_interest:putOI,pcr_oi:callOI?putOI/callOI:null,call_volume:callVol,put_volume:putVol,pcr_volume:callVol?putVol/callVol:null,call_change_oi:callChange,put_change_oi:putChange,pcr_change_oi:callChange?putChange/callChange:null,max_pain_strike:maxPain,highest_call_oi_strike:topCall===null?null:Number(topCall),highest_put_oi_strike:topPut===null?null:Number(topPut),strike_count:strikes.length,rows:p.rows.length,data_mode:"caller_supplied_unverified",disclaimer:"Descriptive calculations only. The caller must verify source, exchange, timestamp and contract mapping. Max pain is not a prediction or trading signal."});
    }
    if(path==="/api/v1/research/candidate"){
      const reasons=[];if(p.data_mode==="demo"||p.data_mode==="historical"||p.data_mode==="unavailable"||p.data_mode==="eod")reasons.push("Data mode is not suitable for an intraday candidate.");
      if(!p.source||!p.exchange||!p.observed_at)reasons.push("Source, exchange and timestamp are required.");
      if(!Array.isArray(p.evidence)||!p.evidence.length)reasons.push("Evidence is required.");
      if(!p.invalidation||!p.risk_notes||!p.rule_id)reasons.push("Invalidation, risk notes and reviewed rule ID are required.");
      const age=p.observed_at?Date.now()-Date.parse(p.observed_at):Infinity;if(!Number.isFinite(age)||age< -60000||age>300000)reasons.push("Timestamp missing, invalid, future-dated or stale.");
      return json({decision:reasons.length?"NO_TRADE":"ELIGIBLE_FOR_HUMAN_REVIEW",reasons,is_trade_recommendation:false,message:"Data readiness gate only; passing is not a trade signal."});
    }
    return error("Route not found.",404);
  } catch(e){return error(e instanceof Error?e.message:"Invalid request.");}
}
export default { fetch: route, scheduled: (event, env, ctx) => { ctx.waitUntil(scheduledPaperBot(event, env)); } };
