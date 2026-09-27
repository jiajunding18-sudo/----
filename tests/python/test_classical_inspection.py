"""Numerical contract checks for the Classical Inspection teaching dataset.

This small reference processor is test-only, not a learner solution or a
second batch engine. It receives pixels plus frozen configuration, never truth.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from generate_classical_inspection import (  # noqa: E402
    DEFAULT_SEED, GENERATOR_VERSION, generate, render_sample, sample_spec, shuffled_labels,
)

ROI = (24, 32, 144, 128)  # x, y, width, height
R_THRESHOLD = .98
OPENING = np.ones((3, 3), dtype=np.uint8)


def inspect(image: np.ndarray, scheme: str = "fixed") -> dict[str, object]:
    if image is None or image.shape != (192, 192) or image.dtype != np.uint8:
        raise ValueError("Expected decoded 192x192 grayscale uint8 image")
    x, y, width, height = ROI
    crop = image[y:y + height, x:x + width]
    flag = cv2.THRESH_BINARY_INV
    threshold = 120 if scheme == "fixed" else 0
    if scheme == "otsu":
        flag |= cv2.THRESH_OTSU
    elif scheme != "fixed":
        raise ValueError("Unknown scheme")
    used_threshold, before = cv2.threshold(crop, threshold, 255, flag)
    after = cv2.morphologyEx(before, cv2.MORPH_OPEN, OPENING)
    contours, _ = cv2.findContours(after, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        bx, by, bw, bh = cv2.boundingRect(contour)
        if 90 <= bw <= 102 and 58 <= bh <= 70:
            candidates.append((cv2.contourArea(contour), bx, by, bw, bh))
    if not candidates:
        raise ValueError("No valid part: inspect threshold, polarity and bbox")
    _, bx, by, bw, bh = max(candidates)
    count = int(np.count_nonzero(after[by:by + bh, bx:bx + bw]))
    ratio = count / (bw * bh)
    return {
        "threshold": float(used_threshold), "bbox": [bx + x, by + y, bw, bh],
        "beforePixels": int(np.count_nonzero(before)),
        "afterPixels": int(np.count_nonzero(after)),
        "foregroundPixels": count, "R": ratio,
        "decision": "notched" if ratio < R_THRESHOLD else "normal",
        "candidateCount": len(contours),
        "maskValues": set(np.unique(after).tolist()),
    }


def degrade(image: np.ndarray, kind: str, amount: float) -> np.ndarray:
    if kind == "brightness":
        return np.clip(image.astype(np.int16) + int(amount), 0, 255).astype(np.uint8)
    if kind == "blur":
        return cv2.GaussianBlur(image, (7, 7), amount, borderType=cv2.BORDER_REFLECT_101)
    raise ValueError("Unknown stress")


class ClassicalInspectionContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="classical-inspection-")
        cls.root = Path(cls.temp.name) / "dataset"
        cls.truth = generate(cls.root, DEFAULT_SEED)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def image(self, sample_id: str) -> np.ndarray:
        split = sample_id.split("-")[0]
        image = cv2.imread(str(self.root / split / "images" / f"{sample_id}.png"), cv2.IMREAD_GRAYSCALE)
        self.assertIsNotNone(image)
        return image

    def test_generator_identity_balance_and_truth_separation(self):
        samples = self.truth["samples"]
        self.assertEqual(self.truth["generatorVersion"], GENERATOR_VERSION)
        self.assertEqual(len(samples), 40)
        for split, count in (("dev", 24), ("unseen", 16)):
            members = {key: value for key, value in samples.items() if value["split"] == split}
            self.assertEqual(len(members), count)
            self.assertEqual(sum(value["label"] == "normal" for value in members.values()), count // 2)
            labels_by_id = [members[f"{split}-{index:04d}"]["label"] for index in range(1, count + 1)]
            self.assertEqual(labels_by_id, shuffled_labels(DEFAULT_SEED, split, count))
            self.assertNotEqual(labels_by_id, shuffled_labels(DEFAULT_SEED + 1, split, count))
            self.assertEqual(set(labels_by_id[::2]), {"normal", "notched"})
            self.assertEqual(set(labels_by_id[1::2]), {"normal", "notched"})
            self.assertNotEqual(labels_by_id, ["normal"] * (count // 2) + ["notched"] * (count // 2))
            listing = json.loads((self.root / split / "inference-list.json").read_text(encoding="utf-8"))
            self.assertEqual(listing["files"], sorted(listing["files"]))
            self.assertNotIn("label", listing)
            self.assertNotIn("notched", json.dumps(listing))
            self.assertFalse(any("normal" in name for name in listing["files"]))
            for sample_id in members:
                image = self.image(sample_id)
                self.assertEqual(image.shape, (192, 192))
                self.assertEqual(image.dtype, np.uint8)
        self.assertNotEqual(sample_spec(DEFAULT_SEED, "dev", 1, "normal"), sample_spec(DEFAULT_SEED, "unseen", 1, "normal"))

    def test_generation_reproducible_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            second = Path(temp) / "same"
            another = generate(second, DEFAULT_SEED)
            self.assertEqual(another, self.truth)
            for sample_id in self.truth["samples"]:
                split = sample_id.split("-")[0]
                name = f"{sample_id}.png"
                self.assertEqual((self.root / split / "images" / name).read_bytes(), (second / split / "images" / name).read_bytes())
            with self.assertRaises(FileExistsError):
                generate(second, DEFAULT_SEED)

    def test_geometry_and_ratio_separation(self):
        ranges = {"normal": [], "notched": []}
        for sample_id, entry in self.truth["samples"].items():
            spec = entry["spec"]
            image, ideal = render_sample(spec)
            np.testing.assert_array_equal(image, self.image(sample_id))
            x, y, w, h = entry["bbox"]
            self.assertEqual((w, h), (spec["width"], spec["height"]))
            self.assertTrue(24 <= x and 32 <= y and x + w <= 168 and y + h <= 160)
            self.assertEqual(int(np.count_nonzero(ideal)), entry["foregroundPixels"])
            self.assertEqual(entry["foregroundPixels"], w * h - (256 if entry["label"] == "notched" else 0))
            ranges[entry["label"]].append(entry["occupancy"])
        self.assertEqual(set(ranges["normal"]), {1.0})
        self.assertLess(max(ranges["notched"]), R_THRESHOLD)
        self.assertGreater(min(ranges["notched"]), .95)

    def test_fixed_and_otsu_independent_nontrivial_baselines(self):
        for scheme in ("fixed", "otsu"):
            seen = {"normal": 0, "notched": 0}
            for sample_id, entry in self.truth["samples"].items():
                result = inspect(self.image(sample_id), scheme)
                self.assertTrue(result["maskValues"].issubset({0, 255}))
                self.assertEqual(result["decision"], entry["label"], (scheme, sample_id, result))
                seen[entry["label"]] += 1
            self.assertEqual(seen, {"normal": 20, "notched": 20})

    def test_opening_speckles_and_geometry(self):
        for sample_id, entry in self.truth["samples"].items():
            result = inspect(self.image(sample_id))
            self.assertLess(result["afterPixels"], result["beforePixels"])
            self.assertLessEqual(abs(result["R"] - entry["occupancy"]), .005)
            self.assertEqual(result["bbox"], entry["bbox"])

    def test_truth_free_processing_and_no_target(self):
        image = self.image("dev-0001")
        snapshot = image.copy()
        result = inspect(image)
        self.assertIn(result["decision"], ("normal", "notched"))
        np.testing.assert_array_equal(image, snapshot)
        with self.assertRaisesRegex(ValueError, "No valid part"):
            inspect(np.full((192, 192), 210, dtype=np.uint8))
        with self.assertRaisesRegex(ValueError, "Expected decoded"):
            inspect(None)

    def test_generated_batch_negatives_have_distinct_item_statuses(self):
        images = self.root / "dev" / "images"
        discovered = sorted(path for path in images.iterdir() if path.is_file())
        records = []
        for path in discovered:
            if path.suffix.lower() != ".png":
                status = "skipped"
            else:
                decoded = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
                status = "failed" if decoded is None else "succeeded"
            records.append((path.name, status))
        self.assertEqual(len(records), 26)
        self.assertEqual(len({name for name, _ in records}), 26)
        self.assertEqual([status for _, status in records].count("succeeded"), 24)
        self.assertIn(("dev-broken.png", "failed"), records)
        self.assertIn(("dev-unsupported.txt", "skipped"), records)
        self.assertEqual(sum(status != "skipped" for _, status in records), 25)

    def test_declared_stress_is_independent_and_safe(self):
        image = self.image("dev-0001")
        snapshot = image.copy()
        for kind, levels in (("brightness", (-40, -80)), ("blur", (.8, 1.6))):
            for level in levels:
                stressed = degrade(image, kind, level)
                self.assertEqual(stressed.dtype, np.uint8)
                self.assertEqual(stressed.shape, image.shape)
                np.testing.assert_array_equal(stressed, degrade(snapshot, kind, level))
        np.testing.assert_array_equal(image, snapshot)
        self.assertEqual(int(degrade(np.array([[40, 190]], dtype=np.uint8), "brightness", -80)[0, 0]), 0)
        self.assertEqual(int(degrade(np.array([[40, 190]], dtype=np.uint8), "brightness", -80)[0, 1]), 110)

    def test_stress_preserves_meaningful_task_and_exposes_boundary(self):
        summaries = {}
        for kind, levels in (("brightness", (-40, -80)), ("blur", (.8, 1.6))):
            for level in levels:
                for scheme in ("fixed", "otsu"):
                    succeeded = correct = 0
                    ratios = []
                    for sample_id, entry in self.truth["samples"].items():
                        stressed = degrade(self.image(sample_id), kind, level)
                        try:
                            result = inspect(stressed, scheme)
                        except ValueError:
                            continue
                        succeeded += 1
                        correct += result["decision"] == entry["label"]
                        ratios.append(result["R"])
                    summaries[(kind, level, scheme)] = (succeeded, correct, min(ratios, default=None), max(ratios, default=None))
        print("\nClassical Inspection stress prevalidation:", summaries)
        self.assertTrue(any(0 < count < 40 or correct < count for count, correct, _, _ in summaries.values()))
        self.assertTrue(any(count > 0 for count, _, _, _ in summaries.values()))


if __name__ == "__main__":
    unittest.main()
