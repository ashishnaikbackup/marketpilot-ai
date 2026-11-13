from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health", summary="Service health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "marketpilot-ai-api"}
