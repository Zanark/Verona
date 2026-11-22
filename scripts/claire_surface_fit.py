"""Regularized reference-surface correction sampled once into a fast XYZ lattice."""

import numpy as np

from scripts.claire_reference_study import EYES, _positions, _smooth


def closest_surface(points, vertices, faces, *, return_faces=False):
    a, b, c = np.moveaxis(vertices[faces], 1, 0)
    ab, ac = b - a, c - a
    aa, bb, cc = (np.sum(ab * ab, axis=1), np.sum(ab * ac, axis=1),
                  np.sum(ac * ac, axis=1))
    denominator = aa * cc - bb * bb
    result, selected = [], []
    for start in range(0, len(points), 16):
        p = points[start:start + 16, None]
        ap = p - a
        pa, pc = np.sum(ap * ab, axis=-1), np.sum(ap * ac, axis=-1)
        u = np.divide(cc * pa - bb * pc, denominator,
                      out=np.zeros_like(pa), where=denominator > 1e-12)
        v = np.divide(aa * pc - bb * pa, denominator,
                      out=np.zeros_like(pc), where=denominator > 1e-12)
        best = a + u[..., None] * ab + v[..., None] * ac
        inside = (denominator > 1e-12) & (u >= 0) & (v >= 0) & (u + v <= 1)
        distance = np.where(inside, np.sum((best - p) ** 2, axis=-1), np.inf)
        for first, last in ((a, b), (b, c), (c, a)):
            edge = last - first
            length = np.sum(edge * edge, axis=-1)
            along = np.divide(np.sum((p - first) * edge, axis=-1), length,
                              out=np.zeros_like(distance), where=length > 1e-12)
            candidate = first + np.clip(along, 0, 1)[..., None] * edge
            square = np.sum((candidate - p) ** 2, axis=-1)
            better = square < distance
            best = np.where(better[..., None], candidate, best)
            distance = np.minimum(distance, square)
        indices = np.argmin(distance, axis=1)
        result.append(best[np.arange(len(p)), indices])
        selected.append(indices)
    positions = np.concatenate(result)
    return (positions, np.concatenate(selected)) if return_faces else positions


def refine_surface(base_warp, rest, reference, faces, *, closest=closest_surface,
                   minimum_controls=None):
    if minimum_controls is not None and (type(minimum_controls) is not int or not 3 <= minimum_controls <= 256):
        raise ValueError("Partial surface fitting needs 3 to 256 required controls.")
    fitted = base_warp(rest)
    candidates = fitted[(abs(fitted[:, 0]) < 6.8) & (fitted[:, 1] > 137)
                        & (fitted[:, 1] < 152.5) & (fitted[:, 2] > .5)]
    if len(candidates) < 256:
        raise ValueError("Surface registration lacks enough front-head samples.")
    indices = [int(np.argmin(np.sum((candidates - [0, 141, 5]) ** 2, axis=1)))]
    nearest = np.full(len(candidates), np.inf)
    for _ in range(255):
        nearest = np.minimum(nearest, np.sum((candidates - candidates[indices[-1]]) ** 2, axis=1))
        indices.append(int(np.argmax(nearest)))
    controls = candidates[indices]
    target = closest(controls, reference, faces)
    offsets = target - controls
    supported = np.linalg.norm(offsets, axis=1) <= 2
    rejected = int(np.count_nonzero(~supported))
    if rejected and minimum_controls is None:
        raise ValueError("Reference correspondence exceeds the two-centimeter surface-fit bound.")
    if minimum_controls is not None:
        if np.count_nonzero(supported) < minimum_controls:
            raise ValueError("Partial reference lacks the required bounded surface support.")
        controls, offsets = controls[supported], offsets[supported]
    controls = np.vstack((controls, EYES))
    offsets = np.vstack((offsets, np.zeros((2, 3))))

    def kernel(points):
        difference = (points[:, None] - controls) / 1.3
        return np.exp(-.5 * np.sum(difference * difference, axis=-1))

    weights = np.linalg.solve(kernel(controls) + .05 * np.eye(len(controls)), offsets)
    low, high = np.array([-9, 134, -4]), np.array([9, 156, 15])
    shape = np.array([37, 45, 39])
    grid_points = np.stack(np.meshgrid(*(np.linspace(a, b, n) for a, b, n in
                                        zip(low, high, shape)), indexing="ij"), axis=-1)
    flat = grid_points.reshape(-1, 3)
    values = np.empty_like(flat)
    for start in range(0, len(flat), 1024):
        values[start:start + 1024] = kernel(flat[start:start + 1024]) @ weights
    values = values.reshape(*shape, 3)

    def sample(points):
        x, y, z = points.T
        fade = ((1 - _smooth(5.5, 7.5, abs(x))) * _smooth(135.5, 137, y)
                * (1 - _smooth(152.5, 154, y)) * _smooth(-1, 1, z))
        active = np.flatnonzero(fade != 0)
        result = np.zeros_like(points)
        if not len(active):
            return result
        query = points[active]
        if np.any(query < low) or np.any(query > high):
            raise ValueError("Active face positions exceed the surface lattice bounds.")
        coordinate = (query - low) / (high - low) * (shape - 1)
        first = np.minimum(np.floor(coordinate).astype(np.int64), shape - 2)
        fraction = coordinate - first
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    corner = np.array([dx, dy, dz])
                    weight = np.prod(np.where(corner, fraction, 1 - fraction), axis=1)
                    index = (first + corner).T
                    result[active] += values[index[0], index[1], index[2]] * weight[:, None]
        return result * fade[:, None]

    def eye_kernel(points):
        difference = (points[:, None] - EYES) / [2.2, 1.3, 3.0]
        return np.exp(-.5 * np.sum(difference * difference, axis=-1))

    eye_weights = np.linalg.solve(eye_kernel(EYES), sample(EYES))

    def warp(positions):
        points = base_warp(positions)
        correction = sample(points) - eye_kernel(points) @ eye_weights
        if not np.isfinite(correction).all() or np.linalg.norm(correction, axis=1).max() > 2:
            raise ValueError("Surface registration exceeds its finite two-centimeter correction bound.")
        return points + correction

    actual = sample(controls) - eye_kernel(controls) @ eye_weights
    return warp, {
        "surfaceControls": len(controls) - 2, "surfaceKernelWidthCm": 1.3,
        "rejectedSurfaceControls": rejected, "minimumSurfaceControls": minimum_controls,
        "surfaceLattice": shape.tolist(), "surfaceLatticeBoundsCm": [low.tolist(), high.tolist()],
        "surfaceConstraintRmsBeforeCm": float(np.sqrt(np.mean(np.sum(offsets[:-2] ** 2, axis=1)))),
        "surfaceConstraintRmsAfterCm": float(np.sqrt(np.mean(np.sum((actual - offsets)[:-2] ** 2, axis=1)))),
        "surfaceLimit": "Nearest geometric triangles, not semantic/anatomical correspondence or contact acceptance.",
    }
