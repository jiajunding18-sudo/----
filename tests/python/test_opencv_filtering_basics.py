import unittest

import cv2
import numpy as np


MEAN_BORDER = cv2.BORDER_REPLICATE
SHARPEN_KERNEL = np.array(
    [
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0],
    ],
    dtype=np.float32,
)
FLAT_ROWS = slice(2, 7)
FLAT_COLUMNS = slice(2, 5)


def make_filtering_image() -> np.ndarray:
    rng = np.random.default_rng(20260901)
    base = np.full((9, 15), 40, dtype=np.int16)
    base[:, 7:] = 180
    noise = rng.integers(-8, 9, size=base.shape, dtype=np.int16)
    image = np.clip(base + noise, 0, 255).astype(np.uint8)
    image[1, 12] = 255
    image[7, 13] = 180
    return image


def flat_region_variation(image: np.ndarray) -> float:
    region = image[FLAT_ROWS, FLAT_COLUMNS].astype(np.float32)
    return float(np.std(region))


def edge_contrast(image: np.ndarray) -> float:
    left_band = image[2:7, 5:7].astype(np.float32)
    right_band = image[2:7, 7:9].astype(np.float32)
    return float(np.mean(right_band) - np.mean(left_band))


class OpenCvFilteringBasicsBehaviorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.source = make_filtering_image()
        self.original = self.source.copy()

    def test_three_by_three_mean_matches_hand_calculation(self) -> None:
        patch = np.arange(1, 10, dtype=np.float32).reshape(3, 3)
        expected_center = float(np.sum(patch) / 9.0)
        filtered = cv2.blur(
            patch,
            (3, 3),
            borderType=cv2.BORDER_CONSTANT,
        )

        self.assertEqual(expected_center, 5.0)
        self.assertEqual(float(filtered[1, 1]), expected_center)

    def test_flat_region_support_stays_inside_image_and_left_plateau(self) -> None:
        height, width = self.source.shape
        five_by_five_radius = 2
        step_column = 7

        self.assertGreaterEqual(FLAT_ROWS.start, five_by_five_radius)
        self.assertLessEqual(FLAT_ROWS.stop, height - five_by_five_radius)
        self.assertGreaterEqual(FLAT_COLUMNS.start, five_by_five_radius)
        self.assertLessEqual(
            FLAT_COLUMNS.stop - 1 + five_by_five_radius,
            step_column - 1,
        )
        self.assertLess(FLAT_COLUMNS.stop, width)

    def test_three_and_five_pixel_mean_have_reproducible_tradeoffs(self) -> None:
        mean_3 = cv2.blur(self.source, (3, 3), borderType=MEAN_BORDER)
        mean_5 = cv2.blur(self.source, (5, 5), borderType=MEAN_BORDER)

        self.assertEqual(mean_3.shape, self.source.shape)
        self.assertEqual(mean_5.shape, self.source.shape)
        self.assertFalse(np.array_equal(mean_3, mean_5))
        self.assertEqual(int(mean_3[4, 6]), 88)
        self.assertEqual(int(mean_5[4, 6]), 95)
        self.assertAlmostEqual(flat_region_variation(self.source), 4.2531, places=4)
        self.assertAlmostEqual(flat_region_variation(mean_3), 1.6193, places=4)
        self.assertAlmostEqual(flat_region_variation(mean_5), 0.7180, places=4)
        self.assertLess(flat_region_variation(mean_5), flat_region_variation(mean_3))
        self.assertLess(edge_contrast(mean_5), edge_contrast(mean_3))

    def test_gaussian_parameters_produce_reproducible_output(self) -> None:
        first = cv2.GaussianBlur(
            self.source,
            (3, 3),
            sigmaX=1.0,
            sigmaY=1.0,
            borderType=cv2.BORDER_REPLICATE,
        )
        second = cv2.GaussianBlur(
            self.source,
            (3, 3),
            sigmaX=1.0,
            sigmaY=1.0,
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertTrue(np.array_equal(first, second))
        self.assertEqual(first.shape, self.source.shape)
        self.assertEqual(first.dtype, self.source.dtype)
        self.assertEqual(int(first[4, 6]), 79)
        self.assertEqual(int(first[4, 7]), 142)
        self.assertAlmostEqual(flat_region_variation(first), 1.8427, places=4)

    def test_mean_and_gaussian_are_numerically_distinct(self) -> None:
        mean_3 = cv2.blur(self.source, (3, 3), borderType=MEAN_BORDER)
        gaussian = cv2.GaussianBlur(
            self.source,
            (3, 3),
            sigmaX=1.0,
            sigmaY=1.0,
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertGreater(int(np.count_nonzero(mean_3 != gaussian)), 0)
        self.assertEqual(int(mean_3[1, 12]), 191)
        self.assertEqual(int(gaussian[1, 12]), 198)
        self.assertNotEqual(
            flat_region_variation(mean_3),
            flat_region_variation(gaussian),
        )
        self.assertNotEqual(edge_contrast(mean_3), edge_contrast(gaussian))

    def test_invalid_gaussian_kernel_is_diagnosable(self) -> None:
        with self.assertRaises(cv2.error):
            cv2.GaussianBlur(
                self.source,
                (4, 4),
                sigmaX=1.0,
                sigmaY=1.0,
            )

    def test_sharpening_float_output_preserves_out_of_range_responses(self) -> None:
        working = self.source.astype(np.float32)
        sharpened = cv2.filter2D(
            working,
            cv2.CV_32F,
            SHARPEN_KERNEL,
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertEqual(sharpened.dtype, np.float32)
        self.assertEqual(float(sharpened.min()), -116.0)
        self.assertEqual(float(sharpened.max()), 542.0)
        self.assertEqual(float(sharpened[4, 6]), -102.0)
        self.assertEqual(float(sharpened[4, 7]), 338.0)
        dark_response = (
            5 * int(self.source[4, 6])
            - int(self.source[3, 6])
            - int(self.source[5, 6])
            - int(self.source[4, 5])
            - int(self.source[4, 7])
        )
        bright_response = (
            5 * int(self.source[4, 7])
            - int(self.source[3, 7])
            - int(self.source[5, 7])
            - int(self.source[4, 6])
            - int(self.source[4, 8])
        )
        self.assertEqual(dark_response, -102)
        self.assertEqual(bright_response, 338)
        self.assertGreater(edge_contrast(sharpened), edge_contrast(self.source))
        self.assertGreater(
            flat_region_variation(sharpened),
            flat_region_variation(self.source),
        )

    def test_uint8_path_saturates_while_float_path_preserves_response(self) -> None:
        direct_uint8 = cv2.filter2D(
            self.source,
            -1,
            SHARPEN_KERNEL,
            borderType=cv2.BORDER_REPLICATE,
        )
        float_response = cv2.filter2D(
            self.source.astype(np.float32),
            cv2.CV_32F,
            SHARPEN_KERNEL,
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertEqual(direct_uint8.dtype, np.uint8)
        self.assertEqual(int(direct_uint8.min()), 0)
        self.assertEqual(int(direct_uint8.max()), 255)
        self.assertEqual(int(direct_uint8[4, 6]), 0)
        self.assertEqual(int(direct_uint8[4, 7]), 255)
        self.assertEqual(float(float_response[4, 6]), -102.0)
        self.assertEqual(float(float_response[4, 7]), 338.0)

    def test_current_sharpening_kernel_is_symmetric(self) -> None:
        self.assertTrue(np.array_equal(SHARPEN_KERNEL, np.flip(SHARPEN_KERNEL)))

    def test_asymmetric_kernel_confirms_filter2d_correlation_orientation(self) -> None:
        impulse = np.zeros((5, 5), dtype=np.float32)
        impulse[2, 2] = 1.0
        asymmetric_kernel = np.array(
            [
                [0, 0, 0],
                [0, 0, 1],
                [0, 0, 0],
            ],
            dtype=np.float32,
        )
        response = cv2.filter2D(
            impulse,
            cv2.CV_32F,
            asymmetric_kernel,
            borderType=cv2.BORDER_CONSTANT,
        )

        self.assertEqual(np.argwhere(response > 0).tolist(), [[2, 1]])

    def test_constant_border_has_expected_corner_value(self) -> None:
        patch = np.arange(1, 10, dtype=np.float32).reshape(3, 3)
        filtered = cv2.blur(
            patch,
            (3, 3),
            borderType=cv2.BORDER_CONSTANT,
        )

        self.assertAlmostEqual(float(filtered[0, 0]), 12.0 / 9.0, places=6)
        self.assertEqual(float(filtered[1, 1]), 5.0)

    def test_replicate_border_has_expected_corner_value(self) -> None:
        patch = np.arange(1, 10, dtype=np.float32).reshape(3, 3)
        filtered = cv2.blur(
            patch,
            (3, 3),
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertAlmostEqual(float(filtered[0, 0]), 21.0 / 9.0, places=6)
        self.assertEqual(float(filtered[1, 1]), 5.0)

    def test_filtering_calls_do_not_modify_source(self) -> None:
        cv2.blur(self.source, (3, 3), borderType=MEAN_BORDER)
        cv2.GaussianBlur(
            self.source,
            (3, 3),
            sigmaX=1.0,
            sigmaY=1.0,
            borderType=cv2.BORDER_REPLICATE,
        )
        cv2.filter2D(
            self.source.astype(np.float32),
            cv2.CV_32F,
            SHARPEN_KERNEL,
            borderType=cv2.BORDER_REPLICATE,
        )

        self.assertTrue(np.array_equal(self.source, self.original))


if __name__ == "__main__":
    unittest.main()
