"""Execute the published framework; check contracts, not detector point counts."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


class FeatureRepresentation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-feature-representation.mdx").read_text(encoding="utf-8")
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 4
        cls.s = {}
        for block in blocks:
            exec(compile(block, "dip-feature-representation", "exec"), cls.s)
        plt.close("all")

    def test_flatten_is_reversible(self):
        s = self.s
        self.assertEqual(s["raw"].shape, (25,))
        self.assertEqual(s["raw"].dtype, np.float32)
        np.testing.assert_array_equal(s["raw"].reshape(5, 5), s["patch"])

    def test_shift_changes_six_positions(self):
        s = self.s
        self.assertEqual(np.count_nonzero(s["raw"] != s["shifted_raw"]), 6)
        self.assertAlmostEqual(s["translation_change"], np.sqrt(6 * 120**2), places=4)

    def test_brightness_control(self):
        s = self.s
        np.testing.assert_array_equal(s["brighter"] - s["patch"], np.full((5, 5), 20))
        self.assertEqual(s["patch"].mean(), 64)
        self.assertEqual(s["brighter"].mean(), 84)
        self.assertEqual(s["raw_brightness_change"], 100)

    def test_collision_and_dimension(self):
        s = self.s
        self.assertFalse(np.array_equal(s["patch"], s["brighter"]))
        np.testing.assert_array_equal(s["centered"], s["brighter_centered"])
        self.assertEqual(s["centered"].shape, (25,))
        self.assertEqual(s["centered_brightness_change"], 0)

    def test_practice_offset(self):
        s = self.s
        changed = s["patch"] + np.float32(10)
        self.assertEqual(s["vector_change"](s["raw"], changed.reshape(-1)), 50)
        np.testing.assert_allclose(s["centered_vector"](changed), s["centered"], atol=1e-5)

    def test_centering_not_general_invariance(self):
        s = self.s
        self.assertGreater(s["vector_change"](s["centered"], s["centered_vector"](s["shifted_patch"])), 0)
        np.testing.assert_allclose(s["centered_vector"](2*s["patch"]), 2*s["centered"])
        self.assertFalse(np.array_equal(s["centered_vector"](2*s["patch"]), s["centered"]))

    def test_flat_none_safe(self):
        self.assertIsNone(self.s["flat_descriptors"])
        self.assertFalse(self.s["flat_record"]["available"])
        self.assertIsNone(self.s["flat_record"]["shape"])

    def test_structured_descriptor_storage(self):
        s = self.s
        d = s["descriptors"]
        self.assertIsNotNone(d)
        self.assertEqual(d.shape, (len(s["points"]), s["orb"].descriptorSize()))
        self.assertEqual(d.dtype, np.uint8)
        self.assertEqual(d[0].nbytes, 32)
        self.assertEqual(d[0].nbytes * 8, 256)

    def test_separate_compute_pairs_returned_points(self):
        s = self.s
        candidates = s["orb"].detect(s["source"], None)
        returned, d = s["orb"].compute(s["source"], candidates)
        self.assertIsNotNone(d)
        self.assertEqual(d.shape, (len(returned), s["orb"].descriptorSize()))

    def test_perturbation_contracts_not_counts(self):
        s = self.s
        for name in ["blur", "rotation"]:
            image = s["variants"][name]
            self.assertEqual(image.shape, s["source"].shape)
            self.assertEqual(image.dtype, np.uint8)
            self.assertFalse(np.array_equal(image, s["source"]))
            record = s["observations"][name]
            if record["available"]:
                self.assertEqual(record["shape"], (record["count"], s["orb"].descriptorSize()))
                self.assertEqual(record["dtype"], "uint8")
            else:
                self.assertIsNone(record["shape"])

    def test_source_protection(self):
        s = self.s
        np.testing.assert_array_equal(s["source"], s["source_snapshot"])
        np.testing.assert_array_equal(s["canvas"], s["canvas_snapshot"])

    def test_invalid_inputs(self):
        for image in [None, np.zeros((0, 2), np.uint8), np.zeros((4, 4, 3), np.uint8), np.zeros((4, 4), np.float32)]:
            with self.assertRaises(ValueError):
                self.s["observe"](image)
        with self.assertRaises(ValueError):
            self.s["vector_change"](np.zeros(3), np.zeros(4))
        with self.assertRaises(ValueError):
            self.s["centered_vector"](np.full((2, 2), np.nan))


if __name__ == "__main__":
    unittest.main(verbosity=2)
