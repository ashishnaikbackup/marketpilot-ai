import pytest

from app.domain.market_data import UnconfiguredMarketDataProvider


@pytest.mark.anyio
async def test_unconfigured_provider_fails_closed_for_quotes() -> None:
    provider = UnconfiguredMarketDataProvider()
    with pytest.raises(RuntimeError, match="No authorised market-data provider"):
        await provider.get_quote("NIFTY")


@pytest.mark.anyio
async def test_unconfigured_provider_fails_closed_for_option_chain() -> None:
    provider = UnconfiguredMarketDataProvider()
    with pytest.raises(RuntimeError, match="No authorised market-data provider"):
        await provider.get_option_chain("NIFTY", "2026-12-31")
