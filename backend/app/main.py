from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import SegmentRequest, SegmentResponse
from .segmenter import build_segmenter


app = FastAPI(title="Painting Tutor Backend", version="0.1.0")
segmenter = build_segmenter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", **segmenter.status()}


@app.post("/api/v1/segment", response_model=SegmentResponse)
def segment(payload: SegmentRequest) -> SegmentResponse:
    analysis = segmenter.analyze(payload)
    return SegmentResponse(
        provider=segmenter.provider_name,
        analysis=analysis,
    )
