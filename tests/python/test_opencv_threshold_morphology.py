import unittest

import cv2
import numpy as np


THRESHOLD = 127
MAX_VALUE = 255
KERNEL_3 = np.ones((3, 3), dtype=np.uint8)


def make_threshold_fixture() -> np.ndarray:
    image = np.full((9, 13), 30, dtype=np.uint8)
    image[2:7, 3:10] = 180
    image[4, 6] = 30
    image[1:3, 10:12] = 90
    image[1, 1] = 220
    image[7, 11] = 220
    return image


def shift_intensity_safely(image: np.ndarray, delta: int) -> np.ndarray:
    working = image.astype(np.int16) + delta
    return np.clip(working, 0, 255).astype(np.uint8)


def threshold_binary(image: np.ndarray) -> tuple[float, np.ndarray]:
    return cv2.threshold(
        image,
        THRESHOLD,
        MAX_VALUE,
        cv2.THRESH_BINARY,
    )


class OpenCvThresholdMorphologyBehaviorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.source = make_threshold_fixture()
        self.original = self.source.copy()

    def test_fixed_threshold_matches_hand_calculation_and_equal_boundary(self) -> None:
        gray = np.array(
            [[30, 90, 127, 128, 180], [220, 30, 90, 180, 255]],
            dtype=np.uint8,
        )
        expected = np.array(
            [[0, 0, 0, 255, 255], [255, 0, 0, 255, 255]],
            dtype=np.uint8,
        )

        returned_threshold, binary = threshold_binary(gray)

        self.assertEqual(returned_threshold, 127.0)
        np.testing.assert_array_equal(binary, expected)
        self.assertEqual(int(binary[0, 2]), 0)
        self.assertEqual(binary.shape, gray.shape)
        self.assertEqual(binary.dtype, np.uint8)
        self.assertEqual(set(np.unique(binary).tolist()), {0, 255})
        self.assertEqual(int(np.count_nonzero(binary)), 5)

    def test_binary_inverse_reverses_current_zero_255_contract(self) -> None:
        gray = np.array([[0, 127, 128, 255]], dtype=np.uint8)
        ret_binary, binary = threshold_binary(gray)
        ret_inverse, inverse = cv2.threshold(
            gray,
            THRESHOLD,
            MAX_VALUE,
            cv2.THRESH_BINARY_INV,
        )

        self.assertEqual(ret_binary, ret_inverse)
        np.testing.assert_array_equal(inverse, 255 - binary)
        np.testing.assert_array_equal(inverse, [[255, 255, 0, 0]])

    def test_bool_and_uint8_binary_contract_round_trip(self) -> None:
        mask_bool = np.array([[False, True], [True, False]], dtype=bool)
        mask_u8 = mask_bool.astype(np.uint8) * 255

        self.assertEqual(mask_u8.dtype, np.uint8)
        self.assertTrue(set(np.unique(mask_u8).tolist()).issubset({0, 255}))
        np.testing.assert_array_equal(mask_u8 > 0, mask_bool)

    def test_bgr_threshold_can_succeed_but_violates_spatial_mask_contract(self) -> None:
        bgr = np.array([[[10, 200, 30], [250, 20, 220]]], dtype=np.uint8)
        returned_threshold, output = threshold_binary(bgr)

        self.assertEqual(returned_threshold, 127.0)
        self.assertEqual(output.shape, bgr.shape)
        self.assertEqual(output.ndim, 3)
        self.assertNotEqual(output.shape, bgr.shape[:2])
        self.assertEqual(set(np.unique(output).tolist()), {0, 255})

    def test_float_zero_one_with_uint8_threshold_is_a_range_mismatch(self) -> None:
        float_image = np.array([[0.1, 0.4, 0.9]], dtype=np.float32)
        returned_threshold, wrong_scale = threshold_binary(float_image)
        correct_threshold, correct_scale = cv2.threshold(
            float_image,
            0.5,
            1.0,
            cv2.THRESH_BINARY,
        )

        self.assertEqual(returned_threshold, 127.0)
        self.assertEqual(wrong_scale.dtype, np.float32)
        self.assertEqual(int(np.count_nonzero(wrong_scale)), 0)
        self.assertEqual(correct_threshold, 0.5)
        np.testing.assert_array_equal(correct_scale, [[0.0, 0.0, 1.0]])

    def test_three_illumination_conditions_have_reproducible_failures(self) -> None:
        expected = {
            "dark": (2, 0),
            "nominal": (36, 34),
            "bright": (117, 35),
        }

        for label, delta in (("dark", -70), ("nominal", 0), ("bright", 110)):
            shifted = shift_intensity_safely(self.source, delta)
            returned_threshold, mask = threshold_binary(shifted)
            actual = (
                int(np.count_nonzero(mask)),
                int(np.count_nonzero(mask[2:7, 3:10])),
            )
            self.assertEqual(returned_threshold, 127.0)
            self.assertEqual(actual, expected[label])
            self.assertEqual(mask.shape, self.source.shape)
            self.assertEqual(mask.dtype, np.uint8)

    def test_too_low_and_too_high_thresholds_are_diagnosable(self) -> None:
        too_low = cv2.threshold(
            self.source,
            20,
            MAX_VALUE,
            cv2.THRESH_BINARY,
        )[1]
        too_high = cv2.threshold(
            self.source,
            200,
            MAX_VALUE,
            cv2.THRESH_BINARY,
        )[1]

        self.assertEqual(int(np.count_nonzero(too_low)), 117)
        self.assertEqual(int(np.count_nonzero(too_low[2:7, 3:10])), 35)
        self.assertEqual(int(np.count_nonzero(too_high)), 2)
        self.assertEqual(int(np.count_nonzero(too_high[2:7, 3:10])), 0)

    def test_three_by_three_erosion_matches_hand_case(self) -> None:
        mask = np.zeros((5, 5), dtype=np.uint8)
        mask[1:4, 1:4] = 255
        original = mask.copy()
        eroded = cv2.erode(
            mask,
            KERNEL_3,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )

        self.assertEqual(eroded.shape, mask.shape)
        self.assertEqual(eroded.dtype, np.uint8)
        self.assertEqual(set(np.unique(eroded).tolist()), {0, 255})
        self.assertEqual(int(np.count_nonzero(eroded)), 1)
        self.assertEqual(int(eroded[2, 2]), 255)
        self.assertEqual(int(eroded[1, 1]), 0)
        np.testing.assert_array_equal(mask, original)

    def test_three_by_three_dilation_matches_hand_case(self) -> None:
        mask = np.zeros((5, 5), dtype=np.uint8)
        mask[2, 2] = 255
        original = mask.copy()
        dilated = cv2.dilate(
            mask,
            KERNEL_3,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )

        self.assertEqual(dilated.shape, mask.shape)
        self.assertEqual(dilated.dtype, np.uint8)
        self.assertEqual(set(np.unique(dilated).tolist()), {0, 255})
        self.assertEqual(int(np.count_nonzero(dilated)), 9)
        self.assertTrue(np.all(dilated[1:4, 1:4] == 255))
        self.assertEqual(int(dilated[0, 0]), 0)
        np.testing.assert_array_equal(mask, original)

    def test_bool_morphology_is_rejected_without_binding_error_text(self) -> None:
        bool_mask = self.source > THRESHOLD

        with self.assertRaises(cv2.error):
            cv2.erode(bool_mask, KERNEL_3)
        with self.assertRaises(cv2.error):
            cv2.dilate(bool_mask, KERNEL_3)

    def test_opening_and_closing_have_reproducible_cleanup_counts(self) -> None:
        _, raw = threshold_binary(self.source)
        opened = cv2.morphologyEx(
            raw,
            cv2.MORPH_OPEN,
            KERNEL_3,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )
        cleaned = cv2.morphologyEx(
            opened,
            cv2.MORPH_CLOSE,
            KERNEL_3,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )

        self.assertEqual(
            [int(np.count_nonzero(mask)) for mask in (raw, opened, cleaned)],
            [36, 30, 35],
        )
        self.assertEqual(
            [
                int(np.count_nonzero(mask[2:7, 3:10]))
                for mask in (raw, opened, cleaned)
            ],
            [34, 30, 35],
        )
        self.assertEqual((int(opened[1, 1]), int(opened[7, 11])), (0, 0))
        self.assertEqual((int(cleaned[1, 1]), int(cleaned[7, 11])), (0, 0))
        self.assertEqual(int(raw[4, 6]), 0)
        self.assertEqual(int(opened[4, 6]), 0)
        self.assertEqual(int(cleaned[4, 6]), 255)

    def test_five_by_five_opening_deletes_current_target(self) -> None:
        _, raw = threshold_binary(self.source)
        kernel_5 = np.ones((5, 5), dtype=np.uint8)
        aggressive = cv2.morphologyEx(
            raw,
            cv2.MORPH_OPEN,
            kernel_5,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )

        self.assertEqual(int(np.count_nonzero(aggressive)), 0)
        self.assertEqual(int(np.count_nonzero(aggressive[2:7, 3:10])), 0)

    def test_default_and_explicit_morphology_borders_are_distinct(self) -> None:
        full_foreground = np.full((3, 3), 255, dtype=np.uint8)
        erode_default = cv2.erode(full_foreground, KERNEL_3)
        erode_explicit_zero = cv2.erode(
            full_foreground,
            KERNEL_3,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        )

        corner_point = np.zeros((3, 3), dtype=np.uint8)
        corner_point[0, 0] = 255
        dilate_default = cv2.dilate(corner_point, KERNEL_3)
        dilate_explicit_foreground = cv2.dilate(
            corner_point,
            KERNEL_3,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=255,
        )

        self.assertEqual(int(np.count_nonzero(erode_default)), 9)
        self.assertEqual(int(np.count_nonzero(erode_explicit_zero)), 1)
        self.assertEqual(int(np.count_nonzero(dilate_default)), 4)
        self.assertEqual(int(np.count_nonzero(dilate_explicit_foreground)), 9)

    def test_rectangular_structuring_element_and_iterations_one_are_explicit(self) -> None:
        generated = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        np.testing.assert_array_equal(generated, KERNEL_3)

        point = np.zeros((7, 7), dtype=np.uint8)
        point[3, 3] = 255
        implicit_once = cv2.dilate(point, KERNEL_3)
        explicit_once = cv2.dilate(point, KERNEL_3, iterations=1)

        np.testing.assert_array_equal(implicit_once, explicit_once)
        self.assertEqual(int(np.count_nonzero(explicit_once)), 9)

    def test_all_operations_leave_source_unchanged(self) -> None:
        _, raw = threshold_binary(self.source)
        cv2.erode(raw, KERNEL_3)
        cv2.dilate(raw, KERNEL_3)
        cv2.morphologyEx(raw, cv2.MORPH_OPEN, KERNEL_3)
        cv2.morphologyEx(raw, cv2.MORPH_CLOSE, KERNEL_3)

        np.testing.assert_array_equal(self.source, self.original)


if __name__ == "__main__":
    unittest.main()
