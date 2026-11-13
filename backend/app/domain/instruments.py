"""Provider-neutral instrument catalogue. Contract metadata is deliberately not guessed."""
INSTRUMENTS = [
    {"symbol": "NIFTY", "display_name": "NIFTY 50", "exchange": "NSE", "asset_class": "index",
     "derivatives_enabled": True, "lot_size": None, "lot_size_status": "requires_verified_master",
     "expiry_calendar": None, "source": None},
    {"symbol": "BANKNIFTY", "display_name": "NIFTY BANK", "exchange": "NSE", "asset_class": "index",
     "derivatives_enabled": True, "lot_size": None, "lot_size_status": "requires_verified_master",
     "expiry_calendar": None, "source": None},
    {"symbol": "FINNIFTY", "display_name": "NIFTY FINANCIAL SERVICES", "exchange": "NSE", "asset_class": "index",
     "derivatives_enabled": True, "lot_size": None, "lot_size_status": "requires_verified_master",
     "expiry_calendar": None, "source": None},
    {"symbol": "INDIAVIX", "display_name": "INDIA VIX", "exchange": "NSE", "asset_class": "volatility_index",
     "derivatives_enabled": False, "lot_size": None, "lot_size_status": "not_applicable",
     "expiry_calendar": None, "source": None},
]


def list_instruments() -> dict:
    return {"status": "catalogue_only", "version": "unverified-bootstrap-v1",
            "warning": "Lot sizes and expiries are intentionally blank until loaded from an authorised, dated instrument master.",
            "instruments": INSTRUMENTS}
