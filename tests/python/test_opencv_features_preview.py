"""Run the published checkpoints, then verify contracts rather than build-specific counts."""

import contextlib
import io
import re
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt


class FeaturePreviewBehaviorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        article = (
            Path(__file__).resolve().parents[2]
            / "content/concepts/image-processing/opencv-features-preview.mdx"
        ).read_text(encoding="utf-8")
        cls.blocks = re.findall(r"```python\n(.*?)```", article, re.S)
        if len(cls.blocks) != 3:
            raise AssertionError("Expected exactly three runnable checkpoints")
        cls.example = {}
        cls.stdout = io.StringIO()
        with contextlib.redirect_stdout(cls.stdout), patch.object(plt, "show"):
            for code in cls.blocks:
                exec(compile(code, str(article), "exec"), cls.example)
        cls.source = cls.example["source"]
        cls.orb = cls.example["orb"]

    @classmethod
    def tearDownClass(cls):
        plt.close("all")

    def assert_descriptor_contract(self, points, description):
        if description is None:
            self.assertEqual(len(points), 0)
        else:
            self.assertEqual(description.ndim, 2)
            self.assertEqual(description.shape, (len(points), self.orb.descriptorSize()))
            self.assertEqual(description.dtype, np.uint8)

    def test_fixture_has_non_square_shape_range_and_flat_interior(self):
        self.assertEqual(self.source.shape, (192, 288))
        self.assertEqual(self.source.dtype, np.uint8)
        self.assertEqual((self.source.min(), self.source.max()), (30, 220))
        self.assertTrue(np.all(self.source[:, :90] == 90))
        self.assertGreater(len(np.unique(self.source[:, 100:])), 1)
        self.assertEqual(int(self.source[134, 105]), 220)
        self.assertEqual(int(self.source[134, 125]), 90)

    def test_structured_input_produces_points_and_descriptors(self):
        points = self.example["keypoints"]
        description = self.example["descriptors"]
        self.assertGreater(len(points), 0)
        self.assertIsNotNone(description)
        self.assert_descriptor_contract(points, description)

    def test_keypoint_fields_are_finite_xy_within_image(self):
        height, width = self.source.shape
        for point in self.example["keypoints"]:
            x, y = point.pt
            self.assertTrue(np.isfinite([x, y, point.size, point.response]).all())
            self.assertTrue(0 <= x < width and 0 <= y < height)
            self.assertGreater(point.size, 0)
            self.assertIsInstance(x, float)

    def test_flat_input_none_is_handled_by_actual_inspector(self):
        self.assertEqual(len(self.example["flat_keypoints"]), 0)
        self.assertIsNone(self.example["flat_descriptors"])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.example["inspect_descriptors"]([], None)
        self.assertIn("descriptors=None", output.getvalue())

    def test_invalid_inputs_rejected_before_detector(self):
        for invalid in (
            None,
            np.empty((0, 20), dtype=np.uint8),
            np.zeros((30, 40, 3), dtype=np.uint8),
            np.full((30, 40), 0.5, dtype=np.float32),
        ):
            with self.subTest(shape=getattr(invalid, "shape", None)):
                with self.assertRaisesRegex(ValueError, "expected nonempty HxW uint8"):
                    self.example["validate_gray"](invalid)

    def test_inspector_rejects_wrong_rows_width_and_dtype(self):
        points = self.example["keypoints"]
        count, width = len(points), self.orb.descriptorSize()
        for invalid in (
            np.zeros((count + 1, width), dtype=np.uint8),
            np.zeros((count, width + 1), dtype=np.uint8),
            np.zeros((count, width), dtype=np.float32),
        ):
            with self.assertRaises(AssertionError):
                self.example["inspect_descriptors"](points, invalid)

    def test_display_is_independent_bgr_and_rgb_conversion_is_correct(self):
        bgr, rgb = self.example["display_bgr"], self.example["display_rgb"]
        self.assertEqual(bgr.shape, self.source.shape + (3,))
        self.assertEqual(bgr.dtype, np.uint8)
        self.assertFalse(np.shares_memory(bgr, self.source))
        np.testing.assert_array_equal(rgb, bgr[:, :, ::-1])
        self.assertTrue(np.any(bgr[:, :, 2] > bgr[:, :, 0]))
        self.assertTrue(np.any(rgb[:, :, 0] > rgb[:, :, 2]))

    def test_source_snapshot_survives_all_three_checkpoints(self):
        np.testing.assert_array_equal(self.source, self.example["snapshot"])
        np.testing.assert_array_equal(self.source, self.example["make_fixture"]())

    def test_blur_contract_without_monotonic_count_assumption(self):
        image = self.example["blurred"]
        self.assertEqual(image.shape, self.source.shape)
        self.assertFalse(np.array_equal(image, self.source))
        points, description = self.orb.detectAndCompute(image, None)
        self.assert_descriptor_contract(points, description)

    def test_rotation_contract_without_point_correspondence_assumption(self):
        image = self.example["rotated"]
        self.assertEqual(image.shape, self.source.shape)
        self.assertFalse(np.array_equal(image, self.source))
        points, description = self.orb.detectAndCompute(image, None)
        self.assert_descriptor_contract(points, description)
        self.assertEqual(set(self.example["observations"]), {"original", "blur", "rotation"})

    def test_practice_change_can_use_same_framework(self):
        changed = cv2.GaussianBlur(self.source, (5, 5), 1.5)
        self.example["validate_gray"](changed)
        points, description = self.orb.detectAndCompute(changed, None)
        self.assert_descriptor_contract(points, description)

    def test_actual_matplotlib_figures_render_with_correct_display_arrays(self):
        figures = [plt.figure(number) for number in plt.get_fignums()]
        self.assertEqual([len(figure.axes) for figure in figures], [2, 3])
        np.testing.assert_array_equal(figures[0].axes[0].images[0].get_array(), self.source)
        np.testing.assert_array_equal(
            figures[0].axes[1].images[0].get_array(), self.example["display_rgb"]
        )
        self.assertEqual(figures[0].axes[0].images[0].get_clim(), (0, 255))
        for figure in figures:
            figure.canvas.draw()


if __name__ == "__main__":
    print("OpenCV", cv2.__version__, "NumPy", np.__version__)
    unittest.main()
