"""Full-head section mapping onto the pinned reference, not a front-shell offset."""

import numpy as np

from scripts.claire_reference_study import EYES, _positions, _smooth


REVISION = "claire-mpfb-structure-1"
ANGLE_COUNT = 96


def _faces(value, count):
    faces = np.asarray(value)
    if (faces.ndim != 2 or faces.shape[1] != 3 or not len(faces)
            or faces.dtype.kind not in "iu" or faces.min() < 0 or faces.max() >= count):
        raise ValueError("Structural fitting requires valid indexed triangle faces.")
    return faces


def _profiles(points, triangles, levels):
    vertices = points[triangles]
    a, b = vertices, np.roll(vertices, -1, axis=1)
    segments, centers = [], []
    cx = float(EYES[:, 0].mean())
    for level in levels:
        crossing = (((a[..., 1] <= level) & (b[..., 1] > level))
                    | ((b[..., 1] <= level) & (a[..., 1] > level)))
        counts = crossing.sum(axis=1)
        if np.any((counts != 0) & (counts != 2)) or not np.any(counts):
            raise ValueError("Head section has no supported triangle intersection.")
        first, second = a[crossing], b[crossing]
        t = (level - first[:, 1]) / (second[:, 1] - first[:, 1])
        cuts = (first + t[:, None] * (second - first)).reshape(-1, 2, 3)
        section = cuts[..., [0, 2]]
        segments.append(section)
        centers.append(float((section[..., 1].min() + section[..., 1].max()) / 2))
    height_weights = np.exp(-.5 * ((levels[:, None] - levels) / .65) ** 2)
    height_weights /= height_weights.sum(axis=1, keepdims=True)
    centers = height_weights @ np.array(centers)
    angles = np.linspace(-np.pi, np.pi, ANGLE_COUNT, endpoint=False)
    directions = np.column_stack((np.cos(angles), np.sin(angles)))
    radii, filled = [], 0
    for section, cz in zip(segments, centers, strict=True):
        p = section[:, 0] - [cx, cz]
        s = section[:, 1] - section[:, 0]
        denominator = directions[:, None, 0] * s[:, 1] - directions[:, None, 1] * s[:, 0]
        usable = abs(denominator) > 1e-10
        distance = np.divide(p[:, 0] * s[:, 1] - p[:, 1] * s[:, 0],
                             denominator, out=np.zeros_like(denominator), where=usable)
        along = np.divide(p[None, :, 0] * directions[:, None, 1]
                          - p[None, :, 1] * directions[:, None, 0],
                          denominator, out=np.zeros_like(denominator), where=usable)
        valid = usable & (distance > 0) & (along >= 0) & (along <= 1)
        radius = np.max(np.where(valid, distance, 0), axis=1)
        supported = radius > .01
        if np.count_nonzero(supported) < ANGLE_COUNT * .85:
            raise ValueError("Head section lacks enough angular surface support.")
        if not supported.all():
            radius[~supported] = np.interp(angles[~supported], angles[supported],
                                            radius[supported], period=2 * np.pi)
            filled += int(np.count_nonzero(~supported))
        radii.append(radius)
    radii = np.array(radii)
    for _ in range(2):
        radii = sum(weight * np.roll(radii, shift, axis=1)
                    for shift, weight in zip(range(-2, 3), (1, 4, 6, 4, 1))) / 16
    return height_weights @ radii, centers, filled


def _sample(grid, levels, y, angle):
    band = np.clip(np.searchsorted(levels, y) - 1, 0, len(levels) - 2)
    fy = np.clip((y - levels[band]) / (levels[band + 1] - levels[band]), 0, 1)
    column = (angle + np.pi) * ANGLE_COUNT / (2 * np.pi)
    left = np.floor(column).astype(np.int64)
    fa = column - left
    left, right = left % ANGLE_COUNT, (left + 1) % ANGLE_COUNT
    lower = grid[band, left] * (1 - fa) + grid[band, right] * fa
    upper = grid[band + 1, left] * (1 - fa) + grid[band + 1, right] * fa
    return lower * (1 - fy) + upper * fy


def structural_warp(rest, triangles, reference, reference_triangles, reference_eyes,
                    reference_eye_radii, target_mouth_y):
    source, target, eyes = map(_positions, (rest, reference, reference_eyes))
    faces = _faces(triangles, len(source))
    target_faces = _faces(reference_triangles, len(target))
    if eyes.shape != (2, 3) or abs(eyes[1, 0] - eyes[0, 0]) < 1:
        raise ValueError("Structural reference requires two separated eye anchors.")
    scale = abs(EYES[1, 0] - EYES[0, 0]) / abs(eyes[1, 0] - eyes[0, 0])
    target = (target - eyes.mean(0)) * scale + EYES.mean(0)
    cx, ey, _ = EYES.mean(0)

    def orbital_front(p):
        samples = p[(abs(abs(p[:, 0] - cx) - 3) < 1)
                    & (abs(p[:, 1] - ey) < .7) & (p[:, 2] > 0)]
        if len(samples) < 8:
            raise ValueError("Structural reference lacks orbital surface support.")
        return float(np.percentile(samples[:, 2], 90))

    depth = orbital_front(source) - orbital_front(target)
    target[:, 2] += depth
    radii = _positions(reference_eye_radii)
    if radii.shape != (2, 3) or np.any(radii <= 0):
        raise ValueError("Reference eye dimensions must be two positive XYZ radii.")

    def chin(p):
        samples = p[(abs(p[:, 0] - cx) < 2.5) & (p[:, 2] > 1)
                    & (p[:, 1] > 134) & (p[:, 1] < ey - 4)]
        if not len(samples):
            raise ValueError("Structural reference lacks a supported front chin.")
        return float(samples[:, 1].min())

    heights = np.array([132, 134, chin(source), 140.15, ey, source[:, 1].max()])
    destinations = np.array([132, 134, chin(target), target_mouth_y, ey, target[:, 1].max()])
    if (not np.isfinite(destinations).all() or np.any(np.diff(heights) <= .1)
            or np.any(np.diff(destinations) <= .1)):
        raise ValueError("Structural head landmarks must be finite and vertically ordered.")

    def map_y(y):
        result = np.interp(y, heights, destinations)
        return (result + np.minimum(y - heights[0], 0)
                + np.maximum(y - heights[-1], 0))

    levels = np.linspace(134, heights[-1] - .08, 65)
    target_levels = map_y(levels)
    from verona.appearance import claire_eyes

    eye_points, eye_faces = claire_eyes()
    unit_eyes = (eye_points.reshape(2, -1, 3) - EYES[:, None]) / [1.35, 1.32, 1.40]
    target_eyes = (eyes - eyes.mean(0)) * scale + EYES.mean(0)
    target_eyes[:, 2] += depth
    target_eye_points = (unit_eyes * radii[:, None] * scale + target_eyes[:, None]).reshape(-1, 3)
    old_radii, old_centers, old_filled = _profiles(
        np.vstack((source, eye_points)), np.vstack((faces, eye_faces + len(source))), levels)
    new_radii, new_centers, new_filled = _profiles(
        np.vstack((target, target_eye_points)),
        np.vstack((target_faces, eye_faces + len(target))), target_levels)

    def raw_map(points):
        x, y, z = points.T
        old_z = np.interp(y, levels, old_centers)
        angle = np.arctan2(z - old_z, x - cx)
        ratio = _sample(new_radii, levels, y, angle) / _sample(old_radii, levels, y, angle)
        return np.column_stack((cx + (x - cx) * ratio, map_y(y),
                                np.interp(y, levels, new_centers) + (z - old_z) * ratio))

    def eye_kernel(points):
        difference = (points[:, None] - EYES) / [2.2, 1.3, 3.0]
        return np.exp(-.5 * np.sum(difference * difference, axis=-1))

    eye_weights = np.linalg.solve(eye_kernel(EYES), raw_map(EYES) - EYES)

    def warp(positions):
        points = _positions(positions)
        mapped = raw_map(points) - eye_kernel(points) @ eye_weights
        delta = (mapped - points) * _smooth(132, 136, points[:, 1, None])
        if not np.isfinite(delta).all() or np.max(np.linalg.norm(delta, axis=1)) > 5:
            raise ValueError("Structural map exceeds its finite five-centimeter bound.")
        return points + delta

    fitted = warp(source)
    return warp, {
        "revision": REVISION, "vertices": len(source), "shapeWeight": 1.0,
        "sectionLevels": len(levels), "angularSamples": ANGLE_COUNT,
        "referenceEyeScale": float(scale), "orbitalDepthAlignmentCm": depth,
        "heightCorrespondencesCm": list(zip(heights.tolist(), destinations.tolist())),
        "sourceInterpolatedRays": old_filled, "referenceInterpolatedRays": new_filled,
        "profileEyeClosure": "Matching static ellipsoids close orbital holes for section fitting only.",
        "profileRegularization": "Two circular binomial passes and 0.65cm Gaussian height smoothing.",
        "maximumRestOffsetCm": float(np.linalg.norm(fitted - source, axis=1).max()),
        "limits": "Full-head radial section correspondence with two eye-center constraints; "
                  "not exact anatomical registration, contact or accepted identity.",
    }


def fit_model(rest, triangles, model):
    reference = np.array(model["rest"]).reshape(-1, 3)
    faces = []
    for polygon in model["polygons"]:
        if len(polygon) < 3:
            raise ValueError("Reference contains an unsupported face polygon.")
        faces.extend((polygon[0], polygon[i], polygon[i + 1]) for i in range(1, len(polygon) - 1))
    delta = np.array(model["basis"]["mouthPucker"]).reshape(-1, 3)
    if delta.shape != reference.shape or not np.isfinite(delta).all():
        raise ValueError("Reference mouth control must match its finite head surface.")
    amplitude = np.linalg.norm(delta, axis=1)
    ids = np.argsort(amplitude)[-30:]
    if not amplitude[ids].sum() > 0:
        raise ValueError("Reference mouth control lacks an active surface region.")
    mouth_y = float(np.average(reference[ids, 1], weights=amplitude[ids]))
    eyes = _positions(np.array(model["eyeCenters"]))
    if eyes.shape != (2, 3) or abs(eyes[1, 0] - eyes[0, 0]) < 1:
        raise ValueError("Reference mouth alignment requires two separated eye anchors.")
    scale = abs(EYES[1, 0] - EYES[0, 0]) / abs(eyes[1, 0] - eyes[0, 0])
    mouth_y = (mouth_y - eyes[:, 1].mean()) * scale + EYES[:, 1].mean()
    warp, receipt = structural_warp(rest, triangles, reference, np.array(faces), eyes,
                                    np.array(model["eyeRadii"]), mouth_y)
    from scripts.claire_surface_fit import refine_surface

    aligned = (reference - eyes.mean(0)) * scale + EYES.mean(0)
    aligned[:, 2] += receipt["orbitalDepthAlignmentCm"]
    warp, refinement = refine_surface(warp, rest, aligned, np.array(faces))
    receipt.update(refinement)
    receipt["maximumRestOffsetCm"] = float(np.linalg.norm(warp(rest) - rest, axis=1).max())
    return warp, receipt
