from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    sam2_checkpoint: str = os.getenv("SAM2_CHECKPOINT", "")
    sam2_model_cfg: str = os.getenv("SAM2_MODEL_CFG", "configs/sam2.1/sam2.1_hiera_s.yaml")
    sam2_device: str = os.getenv("SAM2_DEVICE", "cpu")


settings = Settings()
