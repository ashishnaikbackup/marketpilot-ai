# Options model calculations

`POST /api/v1/options/greeks` calculates a European Black-Scholes theoretical price,
delta, gamma, annual theta and vega per one volatility point from user-supplied inputs.

- Time to expiry is expressed in years.
- Risk-free rate and volatility are decimals (e.g. 0.20 means 20%).
- Theta is per year, not per calendar day.
- Vega is scaled to a one-percentage-point volatility move.
- This is a model output, not an exchange quote, implied-volatility observation, signal,
  margin calculation or trade recommendation.

The initial implementation omits dividends, early exercise, jumps, transaction costs and
microstructure. Do not use it as an authoritative valuation for American-style index options.


## Implied-volatility solver

`POST /api/v1/options/implied-volatility` solves for annualised European Black-Scholes
volatility from a user-supplied option premium using bounded bisection. It returns the
volatility as both a decimal and a percentage. Premiums outside the model's supported
price range are rejected.

The browser F&O workbench also provides a local version of this solver. The entered
premium is an assumption or a value the user supplies; it is not fetched from an exchange.
