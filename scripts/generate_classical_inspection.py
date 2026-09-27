"""Generate the small, deterministic Classical Inspection teaching dataset.

Usage: python scripts/generate_classical_inspection.py OUTPUT_DIR --seed 917
The output directory must not already exist. Truth is deliberately separate
from the image-only inference listings; this is a teaching boundary, not DRM.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import cv2
import numpy as np


GENERATOR_VERSION = "classical-inspection-v1"
IMAGE_SHAPE = (192, 192)
DEFAULT_SEED = 917


def shuffled_labels(seed: int, split: str, count: int) -> list[str]:
    """Balance each split, then shuffle truth independently of sample identity."""
    if count % 2:
        raise ValueError("Each split needs an even number of balanced samples")
    split_code = 11 if split == "dev" else 29
    labels = ["normal"] * (count // 2) + ["notched"] * (count // 2)
    random.Random(seed * 100_003 + split_code * 10_007 + 73).shuffle(labels)
    return labels


def sample_spec(seed: int, split: str, index: int, label: str) -> dict[str, int | str]:
    """Use independent streams so dev and unseen never share a sample spec."""
    split_code = 11 if split == "dev" else 29
    rng = random.Random(seed * 100_003 + split_code * 10_007 + index)
    return {
        "id": f"{split}-{index:04d}",
        "label": label,
        "width": rng.randint(92, 100),
        "height": rng.randint(60, 68),
        "center_x": 96 + rng.randint(-7, 7),
        "center_y": 96 + rng.randint(-7, 7),
        "foreground": rng.randint(40, 70),
        "background": rng.randint(190, 220),
        "gradient": rng.randint(-4, 4),
        "speckle_x": rng.randint(29, 44),
        "speckle_y": rng.randint(36, 49),
    }


def render_sample(spec: dict[str, int | str]) -> tuple[np.ndarray, np.ndarray]:
    """Return an image and its independent ideal part mask for evaluation."""
    h, w = IMAGE_SHAPE
    x0 = int(spec["center_x"]) - int(spec["width"]) // 2
    y0 = int(spec["center_y"]) - int(spec["height"]) // 2
    x1, y1 = x0 + int(spec["width"]), y0 + int(spec["height"])
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[y0:y1, x0:x1] = 255
    if spec["label"] == "notched":
        notch_x = x0 + (int(spec["width"]) - 16) // 2
        mask[y0:y0 + 16, notch_x:notch_x + 16] = 0

    # A low-amplitude horizontal illumination change, not another defect.
    column_offset = np.rint(np.linspace(-int(spec["gradient"]), int(spec["gradient"]), w))
    image = np.broadcast_to(int(spec["background"]) + column_offset, (h, w)).copy()
    image[mask != 0] = int(spec["foreground"])
    # One isolated 1-2 px dark artefact far from the part, inside the fixed ROI.
    sx, sy = int(spec["speckle_x"]), int(spec["speckle_y"])
    image[sy:sy + 2, sx:sx + 2] = int(spec["foreground"])
    return image.astype(np.uint8), mask


def generate(output_dir: Path, seed: int = DEFAULT_SEED) -> dict[str, object]:
    if output_dir.exists():
        raise FileExistsError(f"Refusing to overwrite existing dataset: {output_dir}")
    output_dir.mkdir(parents=True)
    truth: dict[str, object] = {"generatorVersion": GENERATOR_VERSION, "seed": seed, "samples": {}}
    for split, count in (("dev", 24), ("unseen", 16)):
        images_dir = output_dir / split / "images"
        images_dir.mkdir(parents=True)
        listing: list[str] = []
        labels = shuffled_labels(seed, split, count)
        for index in range(1, count + 1):
            spec = sample_spec(seed, split, index, labels[index - 1])
            image, mask = render_sample(spec)
            filename = f"{spec['id']}.png"
            if not cv2.imwrite(str(images_dir / filename), image):
                raise OSError(f"Could not write {images_dir / filename}")
            listing.append(filename)
            ys, xs = np.where(mask != 0)
            bbox = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
            truth["samples"][str(spec["id"])] = {
                "split": split,
                "label": spec["label"],
                "spec": spec,
                "bbox": bbox,
                "foregroundPixels": int(np.count_nonzero(mask)),
                "occupancy": float(np.count_nonzero(mask) / (bbox[2] * bbox[3])),
            }
        if split == "dev":
            (images_dir / "dev-broken.png").write_bytes(b"not a PNG")
            (images_dir / "dev-unsupported.txt").write_text("unsupported image extension\n", encoding="utf-8")
            listing.extend(("dev-broken.png", "dev-unsupported.txt"))
        (output_dir / split / "inference-list.json").write_text(
            json.dumps({"generatorVersion": GENERATOR_VERSION, "seed": seed, "files": sorted(listing)}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    evaluation_dir = output_dir / "evaluation"
    evaluation_dir.mkdir()
    (evaluation_dir / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return truth


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    result = generate(args.output_dir, args.seed)
    print(f"Generated {len(result['samples'])} valid images in {args.output_dir}")
