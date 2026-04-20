from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from PIL import Image

from .config import settings
from .schemas import AnalysisResponse, RegionMasks, SegmentRequest, SubjectBox


class Segmenter(Protocol):
    provider_name: str

    def is_ready(self) -> bool:
        ...

    def status(self) -> dict[str, str | bool]:
        ...

    def analyze(self, payload: SegmentRequest) -> AnalysisResponse:
        ...


@dataclass
class PreparedImage:
    pil: Image.Image
    array: np.ndarray


class FallbackSegmenter:
    """
    Analyse de secours executable immediatement.

    Cette classe donne deja au frontend un contrat backend stable.
    Elle n'est pas un remplacement de SAM 2 : son but est de preparer
    l'architecture et de fournir une premiere sortie serveur exploitable.
    """

    provider_name = "fallback-segmenter"

    def is_ready(self) -> bool:
        return True

    def status(self) -> dict[str, str | bool]:
        return {
            "provider": self.provider_name,
            "ready": True,
            "mode": "heuristic",
        }

    def analyze(self, payload: SegmentRequest) -> AnalysisResponse:
        prepared = self._prepare_image(payload.imageDataUrl, sample_width=96)
        pixels = prepared.pil.load()
        width, height = prepared.pil.size

        total_weight = 0.0
        sum_x = 0.0
        sum_y = 0.0
        subject_pixels = 0
        detail_pixels = 0
        shadow_pixels = 0
        background_pixels = 0
        secondary_pixels = 0

        secondary_rgb = [0, 0, 0]
        secondary_count = 0
        midtone_rgb = [0, 0, 0]
        midtone_count = 0
        detail_rgb = [0, 0, 0]
        detail_count = 0

        for y in range(height):
            for x in range(width):
                red, green, blue = pixels[x, y]
                luminance = self._luminance(red, green, blue)
                edge = self._edge_strength(pixels, width, height, x, y)
                centered_x = (x / max(width - 1, 1)) - 0.5
                centered_y = (y / max(height - 1, 1)) - 0.5
                centrality = max(0.0, 1.0 - math.sqrt(centered_x * centered_x + centered_y * centered_y) * 1.65)
                saliency = edge * 0.65 + centrality * 0.35

                total_weight += saliency
                sum_x += (x / width) * saliency
                sum_y += (y / height) * saliency

                if saliency > 0.38:
                    subject_pixels += 1

                if edge > 0.2:
                    detail_pixels += 1
                    self._accumulate(detail_rgb, red, green, blue)
                    detail_count += 1

                if luminance < 0.34:
                    shadow_pixels += 1

                if saliency < 0.24:
                    background_pixels += 1

                if 0.25 <= saliency <= 0.5:
                    secondary_pixels += 1
                    self._accumulate(secondary_rgb, red, green, blue)
                    secondary_count += 1

                if 0.32 <= luminance <= 0.72:
                    self._accumulate(midtone_rgb, red, green, blue)
                    midtone_count += 1

        centroid_x = 0.5 if total_weight == 0 else sum_x / total_weight
        centroid_y = 0.5 if total_weight == 0 else sum_y / total_weight

        subject_box = SubjectBox(
            x=self._clamp(centroid_x, 0.2, 0.8),
            y=self._clamp(centroid_y, 0.2, 0.8),
            rx=0.22,
            ry=0.28,
        )

        total_pixels = max(1, width * height)

        return AnalysisResponse(
            backgroundSummary="Grandes zones lointaines et peu detaillees autour du sujet.",
            backgroundCoverage=self._format_coverage(background_pixels / total_pixels),
            subjectSummary="Forme dominante situee vers la zone la plus saillante de l'image.",
            subjectCoverage=self._format_coverage(subject_pixels / total_pixels),
            secondarySummary="Objets d'accompagnement et plans intermediaires autour du sujet.",
            secondaryCoverage=self._format_coverage(secondary_pixels / total_pixels),
            shadowSummary="Grandes ombres et rapports de recouvrement qui structurent les volumes.",
            shadowCoverage=self._format_coverage(shadow_pixels / total_pixels),
            detailSummary="Petites zones de contraste, aretes et textures a garder pour plus tard.",
            detailCoverage=self._format_coverage(detail_pixels / total_pixels),
            secondaryLabel="Couleur secondaire moyenne",
            midtoneLabel="Valeur moyenne dominante",
            detailLabel="Couleur des details structurants",
            secondaryColorHex=self._average_hex(secondary_rgb, secondary_count, "#7b6e53"),
            midtoneHex=self._average_hex(midtone_rgb, midtone_count, "#a48b62"),
            detailColorHex=self._average_hex(detail_rgb, detail_count, "#34271d"),
            subjectBox=subject_box,
            regionMasks=RegionMasks(
                background=self._mask_to_data_url(self._saliency_mask(prepared.array, mode="background")),
                subject=self._mask_to_data_url(self._saliency_mask(prepared.array, mode="subject")),
                secondary=self._mask_to_data_url(self._saliency_mask(prepared.array, mode="secondary")),
                shadows=self._mask_to_data_url(self._luminance_mask(prepared.array, low=0.0, high=0.34)),
                details=self._mask_to_data_url(self._detail_mask(prepared.array)),
                midtones=self._mask_to_data_url(self._luminance_mask(prepared.array, low=0.32, high=0.72)),
            ),
        )

    def _prepare_image(self, data_url: str, sample_width: int) -> PreparedImage:
        image = self._load_image(data_url)
        width = sample_width
        height = max(72, round(image.height / image.width * width))
        resized = image.resize((width, height)).convert("RGB")
        return PreparedImage(
            pil=resized,
            array=np.asarray(resized),
        )

    def _load_image(self, data_url: str) -> Image.Image:
        _, encoded = data_url.split(",", 1)
        raw = base64.b64decode(encoded)
        return Image.open(io.BytesIO(raw)).convert("RGB")

    def _saliency_mask(self, image: np.ndarray, mode: str) -> np.ndarray:
        height, width = image.shape[:2]
        mask = np.zeros((height, width), dtype=bool)

        for y in range(height):
            for x in range(width):
                red, green, blue = image[y, x]
                edge = self._edge_strength_array(image, width, height, x, y)
                centered_x = (x / max(width - 1, 1)) - 0.5
                centered_y = (y / max(height - 1, 1)) - 0.5
                centrality = max(0.0, 1.0 - math.sqrt(centered_x * centered_x + centered_y * centered_y) * 1.65)
                saliency = edge * 0.65 + centrality * 0.35

                if mode == "background":
                    mask[y, x] = saliency < 0.24
                elif mode == "subject":
                    mask[y, x] = saliency > 0.38
                else:
                    mask[y, x] = 0.25 <= saliency <= 0.5

        return mask

    def _detail_mask(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        mask = np.zeros((height, width), dtype=bool)
        for y in range(height):
            for x in range(width):
                mask[y, x] = self._edge_strength_array(image, width, height, x, y) > 0.2
        return mask

    def _luminance_mask(self, image: np.ndarray, low: float, high: float) -> np.ndarray:
        luminance = (
            0.2126 * image[:, :, 0] +
            0.7152 * image[:, :, 1] +
            0.0722 * image[:, :, 2]
        ) / 255.0
        return (luminance >= low) & (luminance <= high)

    def _edge_strength(self, pixels, width: int, height: int, x: int, y: int) -> float:
        left = pixels[max(0, x - 1), y]
        right = pixels[min(width - 1, x + 1), y]
        top = pixels[x, max(0, y - 1)]
        bottom = pixels[x, min(height - 1, y + 1)]

        horizontal = sum(abs(left[index] - right[index]) for index in range(3))
        vertical = sum(abs(top[index] - bottom[index]) for index in range(3))
        return self._clamp((horizontal + vertical) / (255 * 3 * 2), 0.0, 1.0)

    def _edge_strength_array(self, image: np.ndarray, width: int, height: int, x: int, y: int) -> float:
        left = image[y, max(0, x - 1)]
        right = image[y, min(width - 1, x + 1)]
        top = image[max(0, y - 1), x]
        bottom = image[min(height - 1, y + 1), x]
        horizontal = float(np.abs(left - right).sum())
        vertical = float(np.abs(top - bottom).sum())
        return self._clamp((horizontal + vertical) / (255 * 3 * 2), 0.0, 1.0)

    def _luminance(self, red: int, green: int, blue: int) -> float:
        return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

    def _format_coverage(self, ratio: float) -> str:
        if ratio < 0.1:
            return "moins de 10%"
        rounded = round((ratio * 100) / 5) * 5
        upper = min(100, rounded + 10)
        return f"{rounded}% a {upper}%"

    def _average_hex(self, rgb: list[int], count: int, default: str) -> str:
        if count <= 0:
            return default

        red = round(rgb[0] / count)
        green = round(rgb[1] / count)
        blue = round(rgb[2] / count)
        return f"#{red:02x}{green:02x}{blue:02x}"

    def _accumulate(self, buffer: list[int], red: int, green: int, blue: int) -> None:
        buffer[0] += red
        buffer[1] += green
        buffer[2] += blue

    def _clamp(self, value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    def _mask_to_data_url(self, mask: np.ndarray) -> str:
        image = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), mode="L")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"


class Sam2Segmenter(FallbackSegmenter):
    provider_name = "sam2"

    def __init__(self) -> None:
        self._ready = False
        self._error = ""
        self._generator = None
        self._device = settings.sam2_device
        self._checkpoint = settings.sam2_checkpoint
        self._model_cfg = settings.sam2_model_cfg
        self._setup()

    def is_ready(self) -> bool:
        return self._ready

    def status(self) -> dict[str, str | bool]:
        return {
            "provider": self.provider_name,
            "ready": self._ready,
            "mode": "automatic-mask-generation" if self._ready else "unavailable",
            "device": self._device,
            "checkpoint": self._checkpoint or "missing",
            "model_cfg": self._model_cfg,
            "error": self._error or "",
        }

    def analyze(self, payload: SegmentRequest) -> AnalysisResponse:
        if not self._ready or self._generator is None:
            return super().analyze(payload)

        prepared = self._prepare_image(payload.imageDataUrl, sample_width=256)
        masks = self._generator.generate(prepared.array)
        if not masks:
            return super().analyze(payload)

        return self._analysis_from_masks(prepared.array, masks)

    def _setup(self) -> None:
        if not self._checkpoint:
            self._error = "SAM2_CHECKPOINT absent"
            return

        try:
            import torch
            from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
            from sam2.build_sam import build_sam2
        except Exception as error:  # pragma: no cover - optional dependency path
            self._error = f"dependances manquantes: {error}"
            return

        try:
            model = build_sam2(
                self._model_cfg,
                self._checkpoint,
                device=self._device,
                apply_postprocessing=False,
            )
            self._generator = SAM2AutomaticMaskGenerator(model)
            self._ready = True
            self._error = ""
        except Exception as error:  # pragma: no cover - depends on local install
            self._error = str(error)
            self._ready = False

    def _analysis_from_masks(self, image: np.ndarray, masks: list[dict]) -> AnalysisResponse:
        height, width = image.shape[:2]
        total_pixels = max(1, width * height)

        masks_sorted = sorted(masks, key=lambda item: item.get("area", 0), reverse=True)
        subject = self._pick_subject_mask(masks_sorted, width, height)
        subject_seg = np.asarray(subject["segmentation"], dtype=bool) if subject else np.zeros((height, width), dtype=bool)

        union_mask = np.zeros((height, width), dtype=bool)
        for entry in masks_sorted:
            union_mask |= np.asarray(entry["segmentation"], dtype=bool)

        background_seg = ~union_mask

        small_masks = [
            np.asarray(entry["segmentation"], dtype=bool)
            for entry in masks_sorted
            if 0 < entry.get("area", 0) / total_pixels < 0.03
        ]
        detail_seg = np.logical_or.reduce(small_masks) if small_masks else np.zeros((height, width), dtype=bool)

        secondary_seg = union_mask & ~subject_seg & ~detail_seg

        luminance = (
            0.2126 * image[:, :, 0] +
            0.7152 * image[:, :, 1] +
            0.0722 * image[:, :, 2]
        ) / 255.0
        shadow_seg = union_mask & (luminance < 0.34)
        midtone_seg = union_mask & (luminance >= 0.32) & (luminance <= 0.72)

        bbox = subject.get("bbox") if subject else [width * 0.28, height * 0.2, width * 0.44, height * 0.56]
        subject_box = SubjectBox(
            x=self._clamp((bbox[0] + bbox[2] / 2) / width, 0.2, 0.8),
            y=self._clamp((bbox[1] + bbox[3] / 2) / height, 0.2, 0.8),
            rx=self._clamp((bbox[2] / width) / 2, 0.12, 0.38),
            ry=self._clamp((bbox[3] / height) / 2, 0.16, 0.42),
        )

        return AnalysisResponse(
            backgroundSummary="Zones non segmentees ou arriere-plan global a poser en premier.",
            backgroundCoverage=self._format_coverage(background_seg.mean()),
            subjectSummary="Forme principale extraite depuis le masque le plus central et le plus dominant.",
            subjectCoverage=self._format_coverage(subject_seg.mean()),
            secondarySummary="Objets et volumes relies au sujet sans etre le point focal principal.",
            secondaryCoverage=self._format_coverage(secondary_seg.mean()),
            shadowSummary="Ombres sombres situees dans les regions segmentees.",
            shadowCoverage=self._format_coverage(shadow_seg.mean()),
            detailSummary="Petites regions detectees par la segmentation automatique, a garder pour la fin.",
            detailCoverage=self._format_coverage(detail_seg.mean()),
            secondaryLabel="Couleur secondaire segmentee",
            midtoneLabel="Valeur moyenne des regions segmentees",
            detailLabel="Couleur des petits masques",
            secondaryColorHex=self._masked_average_hex(image, secondary_seg, "#7b6e53"),
            midtoneHex=self._masked_average_hex(image, midtone_seg, "#a48b62"),
            detailColorHex=self._masked_average_hex(image, detail_seg, "#34271d"),
            subjectBox=subject_box,
            regionMasks=RegionMasks(
                background=self._mask_to_data_url(background_seg),
                subject=self._mask_to_data_url(subject_seg),
                secondary=self._mask_to_data_url(secondary_seg),
                shadows=self._mask_to_data_url(shadow_seg),
                details=self._mask_to_data_url(detail_seg),
                midtones=self._mask_to_data_url(midtone_seg),
            ),
        )

    def _pick_subject_mask(self, masks: list[dict], width: int, height: int) -> dict | None:
        if not masks:
            return None

        best_score = -1.0
        best_mask = masks[0]
        center_x = width / 2
        center_y = height / 2

        for entry in masks:
            area = max(1.0, float(entry.get("area", 0)))
            bbox = entry.get("bbox", [0, 0, width, height])
            bbox_center_x = bbox[0] + bbox[2] / 2
            bbox_center_y = bbox[1] + bbox[3] / 2
            centrality = 1.0 - min(
                1.0,
                math.sqrt((bbox_center_x - center_x) ** 2 + (bbox_center_y - center_y) ** 2)
                / max(width, height),
            )
            area_ratio = min(1.0, area / (width * height))
            predicted_iou = float(entry.get("predicted_iou", 0.0))
            score = centrality * 0.5 + area_ratio * 0.3 + predicted_iou * 0.2

            if score > best_score:
                best_score = score
                best_mask = entry

        return best_mask

    def _masked_average_hex(self, image: np.ndarray, mask: np.ndarray, default: str) -> str:
        if not mask.any():
            return default

        pixels = image[mask]
        red = int(np.mean(pixels[:, 0]))
        green = int(np.mean(pixels[:, 1]))
        blue = int(np.mean(pixels[:, 2]))
        return f"#{red:02x}{green:02x}{blue:02x}"


def build_segmenter() -> Segmenter:
    sam2 = Sam2Segmenter()
    if sam2.is_ready():
        return sam2
    return FallbackSegmenter()
