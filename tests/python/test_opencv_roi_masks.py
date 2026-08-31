import os
import unittest
from pathlib import Path

import numpy as np
from PIL import Image


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = Path("public") / "media" / "opencv-io-color-fixture.ppm"


def validate_roi(
    image: np.ndarray,
    x: int,
    y: int,
    roi_width: int,
    roi_height: int,
) -> tuple[tuple[int, int, int, int], np.ndarray]:
    height, width = image.shape[:2]
    x1, y1 = x, y
    x2, y2 = x + roi_width, y + roi_height
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        raise ValueError("ROI bounds are outside the image contract")

    roi = image[y1:y2, x1:x2]
    expected_shape = (y2 - y1, x2 - x1)
    if roi.size == 0 or roi.shape[:2] != expected_shape:
        raise ValueError("ROI shape does not match the coordinate contract")
    return (x1, y1, x2, y2), roi


def validate_boolean_mask(image: np.ndarray, mask: np.ndarray) -> None:
    if mask.shape != image.shape[:2]:
        raise ValueError("mask shape must match image spatial axes")
    if mask.dtype != np.bool_:
        raise ValueError("mask dtype must be boolean")


class OpenCvRoiMasksBehaviorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.original_working_directory = Path.cwd()
        os.chdir(WORKSPACE_ROOT)
        fixture_rgb = np.asarray(Image.open(FIXTURE_PATH).convert("RGB"))
        cls.source = fixture_rgb[:, :, ::-1].copy()

    @classmethod
    def tearDownClass(cls) -> None:
        os.chdir(cls.original_working_directory)

    def test_valid_roi_uses_xy_to_row_column_contract(self) -> None:
        bounds, roi = validate_roi(self.source, x=1, y=0, roi_width=2, roi_height=2)

        self.assertEqual(bounds, (1, 0, 3, 2))
        self.assertEqual(roi.shape, (2, 2, 3))
        self.assertEqual(roi[0, 0].tolist(), self.source[0, 1].tolist())

    def test_fixture_bgr_contract_converts_to_rgb_for_display(self) -> None:
        source_rgb = self.source[:, :, ::-1]

        self.assertEqual(self.source[0, 0].tolist(), [0, 0, 255])
        self.assertEqual(source_rgb[0, 0].tolist(), [255, 0, 0])

    def test_silent_clipping_and_empty_roi_are_detectable(self) -> None:
        clipped = self.source[0:2, 1:5]
        empty = self.source[0:2, 1:1]

        self.assertEqual(clipped.shape[:2], (2, 2))
        self.assertNotEqual(clipped.shape[:2], (2, 4))
        self.assertGreater(clipped.size, 0)
        self.assertEqual(empty.shape[:2], (2, 0))
        self.assertEqual(empty.size, 0)

        with self.assertRaises(ValueError):
            validate_roi(self.source, x=1, y=0, roi_width=4, roi_height=2)
        with self.assertRaises(ValueError):
            validate_roi(self.source, x=1, y=0, roi_width=0, roi_height=2)

    def test_basic_slice_shares_memory_but_copy_does_not(self) -> None:
        working = self.source.copy()
        working_before = working.copy()
        roi_view = working[0:2, 1:3]

        self.assertTrue(np.shares_memory(working, roi_view))
        roi_view[:] = 0
        self.assertFalse(np.array_equal(working, working_before))
        self.assertTrue(np.all(working[0:2, 1:3] == 0))

        clean_working = self.source.copy()
        roi_copy = clean_working[0:2, 1:3].copy()
        self.assertFalse(np.shares_memory(clean_working, roi_copy))
        roi_copy[:] = 255
        self.assertTrue(np.array_equal(clean_working, self.source))

    def test_source_protection_and_shape_preserving_result(self) -> None:
        source = self.source.copy()
        original = source.copy()
        result = source.copy()
        result[0:2, 1:3] = 0

        self.assertTrue(np.array_equal(source, original))
        self.assertEqual(result.shape, source.shape)
        self.assertFalse(np.array_equal(result, source))

    def test_color_and_grayscale_boolean_mask_contracts(self) -> None:
        source = self.source.copy()
        original = source.copy()
        mask = np.zeros(source.shape[:2], dtype=bool)
        mask[0:2, 1:3] = True
        validate_boolean_mask(source, mask)

        selected_count = int(np.count_nonzero(mask))
        selected_color = source[mask]
        gray = source[:, :, 0]
        selected_gray = gray[mask]
        shape_preserving = source.copy()
        shape_preserving[~mask] = 0

        self.assertEqual(selected_count, 4)
        self.assertEqual(selected_color.shape, (selected_count, 3))
        self.assertEqual(selected_gray.shape, (selected_count,))
        self.assertEqual(shape_preserving.shape, source.shape)
        self.assertTrue(np.array_equal(source, original))

    def test_mask_shape_and_dtype_mismatches_fail_before_indexing(self) -> None:
        wrong_shape = np.zeros(
            (self.source.shape[0], self.source.shape[1] + 1), dtype=bool
        )
        wrong_dtype = np.ones(self.source.shape[:2], dtype=np.uint8)

        with self.assertRaisesRegex(ValueError, "spatial axes"):
            validate_boolean_mask(self.source, wrong_shape)
        with self.assertRaisesRegex(ValueError, "boolean"):
            validate_boolean_mask(self.source, wrong_dtype)


if __name__ == "__main__":
    unittest.main()
