# FinPilot-inspired product mapping

MarketPilot uses product patterns from the public FinPilot AI personal-finance page at https://finpilot.kleap.io/ and adapts them to an India-first market research and wealth workspace. It does not copy proprietary source code or claim a partnership.

## Product pattern → MarketPilot implementation

| FinPilot AI pattern | MarketPilot implementation | Current boundary |
|---|---|---|
| Conversational financial decisions | AI Copilot with local market/finance context | Optional Cloudflare Workers AI binding; no live quote/news retrieval |
| Expense tracking | Money Manager income/expense ledger | Manual entry and CSV import only; no bank/UPI sync |
| Goal planning | Savings goals and SIP/lump-sum/goal calculators | User assumptions, local browser storage |
| Investment research | India Market Lab, F&O Workbench, Investment Hub, historical CSV lab | No authorised live NSE feed |
| Real-time alerts | Budget-overrun and goal-progress indicators in the workspace | In-app/local only; no push/background alert scheduler |
| Financial health | Cash-flow summary and simple educational checklist score | Not a credit score or regulated financial assessment |
| Understand → retrieve → research → explain | Copilot receives recent conversation plus locally stored user-supplied finance/option context, then asks the LLM to explain | It is not yet a multi-agent autonomous research system and does not independently fetch external sources |
| Sources, timestamps and uncertainty | Imported option-chain source/time fields and explicit demo/unverified labels | User-entered provenance is not independently verified |
| Human approval | No broker execution; paper journal and explicit risk gates | No broker integration or live orders |

## What should be added before calling it a full FinPilot-class platform

1. User accounts and encrypted per-user storage with export/delete controls.
2. A proper transaction import pipeline with bank statement CSV/PDF parsing and duplicate detection; keep bank connectivity opt-in.
3. A source-backed research retrieval layer with citations and timestamp validation.
4. A scheduled alert service with notification preferences, quiet hours, deduplication and audit history.
5. A multi-step agent orchestrator with typed tool outputs, deterministic calculations, approval checkpoints and trace logs.
6. Data-provider contracts for NSE cash/index/derivatives and historical data, including exchange redistribution rights.
7. Portfolio reconciliation, taxes/fees, realised P&L and asset allocation.
8. Security review, per-user authorization, rate limits and backup/restore tests.

## References

- FinPilot AI personal finance product: https://finpilot.kleap.io/
- Finpilot institutional investment-office platform: https://finpilot.ai/
- GitHub Pages is a static publishing service; backend APIs and data access must be hosted separately.
