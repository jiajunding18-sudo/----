import unittest

import cv2
import numpy as np


def make_step(left: int, right: int) -> np.ndarray:
    image = np.full((7, 11), left, dtype=np.uint8)
    image[:, 5:] = right
    return image


def make_rectangle_mask() -> np.ndarray:
    mask = np.zeros((10, 16), dtype=np.uint8)
    mask[2:7, 3:11] = 255
    return mask


class OpenCvEdgesContoursBehaviorTest(unittest.TestCase):
    def test_signed_sobel_preserves_direction_and_flat_response(self) -> None:
        positive = cv2.Sobel(make_step(30, 220), cv2.CV_32F, 1, 0, ksize=3)
        negative = cv2.Sobel(make_step(220, 30), cv2.CV_32F, 1, 0, ksize=3)
        vertical = cv2.Sobel(make_step(30, 220), cv2.CV_32F, 0, 1, ksize=3)

        self.assertEqual(positive.dtype, np.float32)
        self.assertEqual((float(positive[3, 4]), float(positive[3, 5])), (760.0, 760.0))
        self.assertEqual((float(negative[3, 4]), float(negative[3, 5])), (-760.0, -760.0))
        self.assertEqual(float(np.max(np.abs(positive[:, :4]))), 0.0)
        self.assertEqual(float(np.max(np.abs(vertical))), 0.0)
        self.assertEqual(4 * (220 - 30), 760)

    def test_unsigned_sobel_loses_negative_direction_information(self) -> None:
        source = make_step(220, 30)
        signed = cv2.Sobel(source, cv2.CV_32F, 1, 0, ksize=3)
        unsigned = cv2.Sobel(source, cv2.CV_8U, 1, 0, ksize=3)

        self.assertEqual(float(signed[3, 4]), -760.0)
        self.assertEqual(int(unsigned[3, 4]), 0)
        self.assertEqual(unsigned.dtype, np.uint8)

    def test_canny_step_has_stable_contract_and_known_column(self) -> None:
        source = make_step(30, 220)
        source_snapshot = source.copy()
        edges = cv2.Canny(source, 50, 150)

        self.assertEqual(edges.shape, (7, 11))
        self.assertEqual(edges.dtype, np.uint8)
        self.assertEqual(set(np.unique(edges).tolist()), {0, 255})
        self.assertEqual(int(np.count_nonzero(edges)), 7)
        self.assertEqual(np.flatnonzero(np.any(edges > 0, axis=0)).tolist(), [4])
        np.testing.assert_array_equal(source, source_snapshot)

    def test_seeded_noisy_canny_thresholds_and_gaussian_are_reproducible(self) -> None:
        rng = np.random.default_rng(7)
        noisy = np.full((25, 41), 80, dtype=np.float64)
        noisy[:, 20:] = 180
        noisy = np.clip(
            noisy + rng.normal(0.0, 8.0, noisy.shape),
            0,
            255,
        ).astype(np.uint8)

        def counts(edge_map: np.ndarray) -> tuple[int, int, int]:
            known_main = int(np.count_nonzero(edge_map[:, 19:21]))
            total = int(np.count_nonzero(edge_map))
            off = total - int(np.count_nonzero(edge_map[:, 17:23]))
            return total, known_main, off

        low = cv2.Canny(noisy, 10, 30)
        middle = cv2.Canny(noisy, 50, 150)
        high = cv2.Canny(noisy, 900, 1000)
        smoothed = cv2.GaussianBlur(noisy, (3, 3), 0)
        smooth_middle = cv2.Canny(smoothed, 50, 150)

        self.assertEqual((int(noisy.min()), int(noisy.max())), (53, 200))
        self.assertEqual(counts(low), (403, 25, 359))
        self.assertEqual(counts(middle), (26, 25, 0))
        self.assertEqual(counts(high), (0, 0, 0))
        self.assertEqual(counts(smooth_middle), (25, 25, 0))

    def test_find_contours_known_rectangle_contract_and_measurements(self) -> None:
        mask = make_rectangle_mask()
        snapshot = mask.copy()
        result = cv2.findContours(
            mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )
        self.assertEqual(len(result), 2)
        contours, hierarchy = result

        self.assertEqual(len(contours), 1)
        self.assertEqual(hierarchy.shape, (1, 1, 4))
        contour = contours[0]
        self.assertEqual(contour.shape, (4, 1, 2))
        self.assertEqual(
            {tuple(point) for point in contour.reshape(-1, 2).tolist()},
            {(3, 2), (3, 6), (10, 6), (10, 2)},
        )
        self.assertEqual(int(np.count_nonzero(mask)), 40)
        self.assertEqual(float(cv2.contourArea(contour)), 28.0)
        self.assertEqual(float(cv2.arcLength(contour, True)), 22.0)
        self.assertEqual(cv2.boundingRect(contour), (3, 2, 8, 5))
        x, y, width, height = cv2.boundingRect(contour)
        self.assertEqual(mask[y : y + height, x : x + width].shape, (5, 8))
        raster_boundary = np.zeros_like(mask, dtype=bool)
        raster_boundary[2, 3:11] = True
        raster_boundary[6, 3:11] = True
        raster_boundary[3:6, 3] = True
        raster_boundary[3:6, 10] = True
        self.assertEqual(contour.shape[0], 4)
        self.assertEqual(int(np.count_nonzero(raster_boundary)), 22)
        np.testing.assert_array_equal(mask, snapshot)

    def test_contour_xy_maps_to_image_yx(self) -> None:
        mask = make_rectangle_mask()
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        point_x, point_y = contours[0].reshape(-1, 2)[0]

        self.assertEqual((int(point_x), int(point_y)), (3, 2))
        self.assertEqual(int(mask[point_y, point_x]), 255)
        self.assertEqual(int(mask[point_x, point_y]), 0)

    def test_nonzero_uint8_is_accepted_but_not_formal_binary_contract(self) -> None:
        nonbinary = np.zeros((5, 7), dtype=np.uint8)
        nonbinary[1:3, 2:5] = 7
        contours, _ = cv2.findContours(
            nonbinary,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        self.assertEqual(len(contours), 1)
        self.assertEqual(cv2.boundingRect(contours[0]), (2, 1, 3, 2))
        self.assertEqual(set(np.unique(nonbinary).tolist()), {0, 7})

    def test_float_and_three_channel_contour_inputs_are_rejected(self) -> None:
        mask = make_rectangle_mask()

        with self.assertRaises(cv2.error):
            cv2.findContours(mask.astype(np.float32), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        with self.assertRaises(cv2.error):
            cv2.findContours(
                np.repeat(mask[:, :, None], 3, axis=2),
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE,
            )

    def test_tiny_contour_filtering_is_transparent_and_keeps_rectangle(self) -> None:
        mask = make_rectangle_mask()
        mask[8, 14] = 255
        snapshot = mask.copy()
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        records = sorted(
            [(float(cv2.contourArea(item)), cv2.boundingRect(item)) for item in contours]
        )

        self.assertEqual(records, [(0.0, (14, 8, 1, 1)), (28.0, (3, 2, 8, 5))])
        self.assertEqual(int(np.count_nonzero(mask[8:9, 14:15])), 1)
        self.assertEqual([record for record in records if record[0] >= 1.0], [(28.0, (3, 2, 8, 5))])
        np.testing.assert_array_equal(mask, snapshot)

    def test_retr_external_ignores_internal_hole_boundary(self) -> None:
        mask = make_rectangle_mask()
        mask[4, 6] = 0
        snapshot = mask.copy()
        external, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        tree, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        self.assertEqual(len(external), 1)
        self.assertEqual(len(tree), 2)
        self.assertEqual(int(mask[4, 6]), 0)
        np.testing.assert_array_equal(mask, snapshot)

    def test_edge_map_is_not_equivalent_to_region_interior(self) -> None:
        mask = make_rectangle_mask()
        edge_map = cv2.Canny(mask, 50, 150)

        self.assertEqual(edge_map.shape, mask.shape)
        self.assertEqual(edge_map.dtype, mask.dtype)
        self.assertEqual(set(np.unique(edge_map).tolist()), {0, 255})
        self.assertNotEqual(int(np.count_nonzero(edge_map)), int(np.count_nonzero(mask)))
        self.assertEqual(int(edge_map[4, 6]), 0)
        self.assertEqual(int(mask[4, 6]), 255)

    def test_draw_contours_uses_result_copy_and_protects_source(self) -> None:
        mask = make_rectangle_mask()
        contour = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0][0]
        source = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        snapshot = source.copy()
        result = source.copy()
        cv2.drawContours(result, [contour], -1, (0, 0, 255), 1)

        np.testing.assert_array_equal(source, snapshot)
        self.assertFalse(np.array_equal(result, source))
        self.assertEqual(result.shape, source.shape)


if __name__ == "__main__":
    unittest.main()
