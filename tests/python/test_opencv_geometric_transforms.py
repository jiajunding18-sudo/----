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


def signed_twice_area(points: np.ndarray) -> float:
    p0, p1, p2 = points.astype(np.float64)
    edge_1 = p1 - p0
    edge_2 = p2 - p0
    return float(edge_1[0] * edge_2[1] - edge_1[1] * edge_2[0])


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

    def test_non_integer_resize_scale_uses_explicit_rounding_contract(self) -> None:
        source = np.zeros((7, 10), dtype=np.uint8)
        scale_x, scale_y = 1.25, 1.5
        new_width = round(source.shape[1] * scale_x)
        new_height = round(source.shape[0] * scale_y)
        explicit = cv2.resize(
            source,
            (new_width, new_height),
            interpolation=cv2.INTER_NEAREST,
        )
        implicit = cv2.resize(
            source,
            None,
            fx=scale_x,
            fy=scale_y,
            interpolation=cv2.INTER_NEAREST,
        )

        self.assertEqual((new_width, new_height), (12, 10))
        self.assertEqual(explicit.shape, (10, 12))
        self.assertEqual(implicit.shape, explicit.shape)

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
        self.assertEqual(int(nearest[1, 1]), 0)
        self.assertEqual(int(linear[1, 1]), 46)
        self.assertEqual(int(np.count_nonzero(nearest != linear)), 21)
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
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0),
        )

        self.assertEqual(matrix.shape, (2, 3))
        self.assertTrue(np.allclose(transform_point(matrix, center), center))
        self.assertTrue(np.allclose(prediction, [4.0, 5.0]))
        self.assertEqual(rotated[y_out, x_out].tolist(), [0, 0, 255])
        self.assertEqual(rotated[0, 0].tolist(), [0, 0, 0])

    def test_rotation_scale_changes_geometry_but_dsize_controls_output_shape(self) -> None:
        source = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        source[3, 3] = [0, 0, 255]
        center = ((self.width - 1) / 2.0, (self.height - 1) / 2.0)
        matrix = cv2.getRotationMatrix2D(center, 90.0, 0.5)
        prediction = transform_point(matrix, (3.0, 3.0))
        result = cv2.warpAffine(
            source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )

        self.assertTrue(np.allclose(prediction, [5.0, 4.0]))
        self.assertEqual(result.shape, (self.height, self.width, 3))
        self.assertEqual(result[4, 5].tolist(), [0, 0, 255])

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
        inverse_flag_result = cv2.warpAffine(
            self.source,
            cv2.invertAffineTransform(matrix),
            (self.width, self.height),
            flags=cv2.INTER_NEAREST | cv2.WARP_INVERSE_MAP,
        )

        self.assertTrue(np.allclose(prediction, [7.0, 3.0]))
        self.assertEqual(same_canvas.shape, (7, 11, 3))
        self.assertEqual(larger_canvas.shape, (8, 15, 3))
        self.assertEqual(same_canvas[3, 7].tolist(), [0, 0, 255])
        self.assertEqual(larger_canvas[6, 12].tolist(), [0, 255, 0])
        self.assertFalse(0 <= 12 < same_canvas.shape[1])
        self.assertTrue(0 <= 12 < larger_canvas.shape[1])
        self.assertTrue(np.array_equal(inverse_flag_result, same_canvas))

    def test_larger_canvas_does_not_recover_negative_coordinates_without_offset(self) -> None:
        source = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        marker = np.array([255, 255, 255], dtype=np.uint8)
        source[1, 1] = marker
        matrix = np.float32([[1, 0, -3], [0, 1, 0]])
        prediction = transform_point(matrix, (1.0, 1.0))
        same_canvas = cv2.warpAffine(
            source,
            matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )
        larger_canvas = cv2.warpAffine(
            source,
            matrix,
            (self.width + 10, self.height + 5),
            flags=cv2.INTER_NEAREST,
        )

        adjusted_matrix = matrix.copy()
        adjusted_matrix[0, 2] += 2
        adjusted_prediction = transform_point(adjusted_matrix, (1.0, 1.0))
        adjusted_result = cv2.warpAffine(
            source,
            adjusted_matrix,
            (self.width, self.height),
            flags=cv2.INTER_NEAREST,
        )

        self.assertTrue(np.allclose(prediction, [-2.0, 1.0]))
        self.assertFalse(bool(np.any(np.all(same_canvas == marker, axis=2))))
        self.assertFalse(bool(np.any(np.all(larger_canvas == marker, axis=2))))
        self.assertTrue(np.allclose(adjusted_prediction, [0.0, 1.0]))
        self.assertEqual(adjusted_result[1, 0].tolist(), marker.tolist())

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

    def test_collinear_affine_triplet_is_degenerate_and_valid_triangle_is_not(self) -> None:
        collinear = np.array([[0, 0], [1, 1], [2, 2]], dtype=np.float32)
        valid_triangle = np.array([[0, 0], [2, 0], [0, 2]], dtype=np.float32)
        degenerate_matrix = cv2.getAffineTransform(collinear, valid_triangle)

        self.assertEqual(signed_twice_area(collinear), 0.0)
        self.assertNotEqual(signed_twice_area(valid_triangle), 0.0)
        self.assertTrue(np.allclose(degenerate_matrix, 0.0))

    def test_affine_linear_part_preserves_parallel_directions(self) -> None:
        linear_part = np.array([[2.0, 1.0], [0.0, 1.0]])
        direction_one = np.array([2.0, 0.0])
        direction_two = np.array([4.0, 0.0])
        transformed_one = linear_part @ direction_one
        transformed_two = linear_part @ direction_two

        self.assertTrue(np.allclose(transformed_one, [4.0, 0.0]))
        self.assertTrue(np.allclose(transformed_two, [8.0, 0.0]))
        self.assertTrue(np.allclose(transformed_two, 2.0 * transformed_one))

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
