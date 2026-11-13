from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.domain.analytics import ChainRow, option_chain_summary
from app.domain.backtest import sma_crossover_backtest
from app.domain.scanner import evaluate_candidate
from app.main import app


