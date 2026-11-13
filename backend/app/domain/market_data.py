"""Provider-neutral market data contracts.

Production adapters must enforce their provider's entitlement and redistribution terms.
The starter implementation intentionally has no configured market-data provider.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol


class DataMode(StrEnum):
    LIVE = "live"
    DELAYED = "delayed"
    END_OF_DAY = "eod"
    HISTORICAL = "historical"
    DEMO = "demo"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class DataProvenance:
    provider: str
    exchange: str
    instrument_id: str
    mode: DataMode
    observed_at: datetime
    received_at: datetime


@dataclass(frozen=True)
class MarketQuote:
    symbol: str
    last_price: float
    provenance: DataProvenance


@dataclass(frozen=True)
class OptionContract:
    expiry: str
    strike: float
    option_type: str
    last_price: float | None
    volume: int | None
    open_interest: int | None
    change_in_open_interest: int | None
    implied_volatility: float | None
    provenance: DataProvenance


class MarketDataProvider(Protocol):
    """Minimum adapter contract for a licensed market-data provider."""

    @property
    def provider_name(self) -> str: ...

    async def get_quote(self, symbol: str) -> MarketQuote: ...

    async def get_option_chain(self, symbol: str, expiry: str) -> list[OptionContract]: ...


class UnconfiguredMarketDataProvider:
    """Safe default: fail closed until a real authorised adapter is configured."""

    provider_name = "none"

    async def get_quote(self, symbol: str) -> MarketQuote:
        raise RuntimeError("No authorised market-data provider is configured")

    async def get_option_chain(self, symbol: str, expiry: str) -> list[OptionContract]:
        raise RuntimeError("No authorised market-data provider is configured")
