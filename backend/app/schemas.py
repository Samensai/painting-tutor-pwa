from pydantic import BaseModel, Field


class PaletteTube(BaseModel):
    name: str
    pigment: str | None = None
    color: str | None = None


class SegmentRequest(BaseModel):
    imageDataUrl: str = Field(..., min_length=32)
    medium: str = Field(default="oil")
    palette: list[PaletteTube] = Field(default_factory=list)


class SubjectBox(BaseModel):
    x: float
    y: float
    rx: float
    ry: float


class RegionMasks(BaseModel):
    background: str | None = None
    subject: str | None = None
    secondary: str | None = None
    shadows: str | None = None
    details: str | None = None
    midtones: str | None = None


class AnalysisResponse(BaseModel):
    backgroundSummary: str
    backgroundCoverage: str
    subjectSummary: str
    subjectCoverage: str
    secondarySummary: str
    secondaryCoverage: str
    shadowSummary: str
    shadowCoverage: str
    detailSummary: str
    detailCoverage: str
    secondaryLabel: str
    midtoneLabel: str
    detailLabel: str
    secondaryColorHex: str
    midtoneHex: str
    detailColorHex: str
    subjectBox: SubjectBox
    regionMasks: RegionMasks | None = None


class SegmentResponse(BaseModel):
    provider: str
    analysis: AnalysisResponse
