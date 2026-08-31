import unittest

import cv2
import numpy as np


def make_marker_image() -> np.ndarray:
    image = np.full((7, 11, 3), 24, dtype=np.uint8)
    image[:, ::2] = [48, 48, 48]
    image[2, 3] = [0, 0, 255]
    image[5, 8] = [0, 255, 0]
    image[1, 1] = [255, 0, 0]
    image[1, 9] = [0, 255, 255]
    image[5, 1] = [255, 0, 255]
    return image


def transform_point(matrix: np.ndarray, point_xy: tuple[float, float]) -> np.ndarray:
    point_h = np.array([point_xy[0], point_xy[1], 1.0], dtype=np.float64)
    return matrix @ point_h


class OpenCvGeometricTransformsBehaviorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.source = make_marker_image()
        self.original = self.source.copy()
        self.height, self.width = self.source.shape[:2]

    def test_resize_uses_width_height_and_swapped_size_is_detectable(self) -> None:
        new_width, new_height = 22, 14
        resized = cv2.resize(self.source, (new_width, new_height))
        swapped = cv2.resize(self.source, (new_height, new_width))

        self.assertEqual(resized.shape, (new_height, new_width, 3))
        self.assertEqual(swapped.shape, (new_width, new_height, 3))
        self.assertNotEqual(swapped.shape, resized.shape)
        self.assertEqual(new_width / self.width, 2.0)
        self.assertEqual(new_height / self.height, 2.0)

    def test_nearest_linear_and_area_have_minimal_reproducible_behavior(self) -> None:
        two_by_two = np.array([[0, 255], [255, 0]], dtype=np.uint8)
        nearest = cv2.resize(
            two_by_two, (5, 5), interpolation=cv2.INTER_NEAREST
        )
        linear = cv2.resize(two_by_two, (5, 5), interpolation=cv2.INTER_LINEAR)
        checkerboard = np.array(
            [
                [0, 255, 0, 255],
                [255, 0, 255, 0],
                [0, 255, 0, 255],
                [255, 0, 255, 0],
            ],
            dtype=np.uint8,
        )
        area = cv2.resize(checkerboard, (2, 2), interpolation=cv2.INTER_AREA)

        self.assertEqual(nearest.shape, (5, 5))
        self.assertEqual(linear.shape, (5, 5))
        self.assertTrue(np.any(nearest != linear))
        self.assertTrue(np.array_equal(area, np.full((2, 2), 128, dtype=np.uint8)))

    def test_rotation_matrix_and_known_point_prediction_match_warp(self) -> None:
        center = ((self.width - 1) / 2.0, (self.height - 1) / 2.0)
        matrix = cv2.getRotationMatrix2D(center, 90.0, 1.0)
        prediction = transform_point(matrix, (3.0, 2.0))
        x_out, y_out = np.rint(prediction).astype(int)
        rotated = cv2.warpAffine(
            self.source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )

        self.assertEqual(matrix.shape, (2, 3))
        self.assertTrue(np.allclose(transform_point(matrix, center), center))
        self.assertTrue(np.allclose(prediction, [4.0, 5.0]))
        self.assertEqual(rotated[y_out, x_out].tolist(), [0, 0, 255])

    def test_translation_known_point_and_output_canvas_clipping(self) -> None:
        matrix = np.float32([[1, 0, 4], [0, 1, 1]])
        prediction = transform_point(matrix, (3.0, 2.0))
        same_canvas = cv2.warpAffine(
            self.source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )
        larger_canvas = cv2.warpAffine(
            self.source,
            matrix,
            (self.width + 4, self.height + 1),
            flags=cv2.INTER_NEAREST,
        )

        self.assertTrue(np.allclose(prediction, [7.0, 3.0]))
        self.assertEqual(same_canvas.shape, (7, 11, 3))
        self.assertEqual(larger_canvas.shape, (8, 15, 3))
        self.assertEqual(larger_canvas[6, 12].tolist(), [0, 255, 0])
        self.assertFalse(0 <= 12 < same_canvas.shape[1])
        self.assertTrue(0 <= 12 < larger_canvas.shape[1])

    def test_three_float32_point_pairs_define_affine_mapping(self) -> None:
        src_points = np.array([[1, 1], [9, 1], [1, 5]], dtype=np.float32)
        dst_points = np.array([[2, 1], [8, 2], [2, 6]], dtype=np.float32)
        matrix = cv2.getAffineTransform(src_points, dst_points)
        predictions = np.array(
            [transform_point(matrix, tuple(point)) for point in src_points]
        )
        errors = np.linalg.norm(predictions - dst_points, axis=1)
        result = cv2.warpAffine(
            self.source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )

        self.assertEqual(src_points.shape, (3, 2))
        self.assertEqual(dst_points.shape, (3, 2))
        self.assertEqual(src_points.dtype, np.float32)
        self.assertEqual(dst_points.dtype, np.float32)
        self.assertEqual(matrix.shape, (2, 3))
        self.assertLess(float(np.max(errors)), 1e-6)
        for src_point, dst_point in zip(src_points, dst_points):
            src_x, src_y = np.rint(src_point).astype(int)
            dst_x, dst_y = np.rint(dst_point).astype(int)
            self.assertEqual(
                result[dst_y, dst_x].tolist(),
                self.source[src_y, src_x].tolist(),
            )

    def test_bgr_display_contract_and_source_protection(self) -> None:
        source_rgb = cv2.cvtColor(self.source, cv2.COLOR_BGR2RGB)
        matrix = np.float32([[1, 0, 2], [0, 1, 0]])
        result = cv2.warpAffine(
            self.source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )

        self.assertEqual(self.source[2, 3].tolist(), [0, 0, 255])
        self.assertEqual(source_rgb[2, 3].tolist(), [255, 0, 0])
        self.assertEqual(result.shape, self.source.shape)
        self.assertTrue(np.array_equal(self.source, self.original))


if __name__ == "__main__":
    unittest.main()
