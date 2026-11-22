"""Review-only structural hybrids and exact batched geometric motion attachment."""

import numpy as np

from scripts.claire_reference_study import EYES, _positions, _smooth
from scripts.claire_structural_fit import _faces, structural_warp
from scripts.claire_surface_fit import refine_surface


HYBRID_WEIGHT = .65


def _nearest(points, corners):
    a, b, c = np.moveaxis(corners, 1, 0)
    ab, ac = b - a, c - a
    aa, bb, cc = (np.sum(ab * ab, axis=1), np.sum(ab * ac, axis=1),
                  np.sum(ac * ac, axis=1))
    denominator = aa * cc - bb * bb
    ap = points[:, None] - a
    pa, pc = np.sum(ap * ab, axis=-1), np.sum(ap * ac, axis=-1)
    u = np.divide(cc * pa - bb * pc, denominator,
                  out=np.zeros_like(pa), where=denominator > 1e-12)
    v = np.divide(aa * pc - bb * pa, denominator,
                  out=np.zeros_like(pc), where=denominator > 1e-12)
    best = a + u[..., None] * ab + v[..., None] * ac
    inside = (denominator > 1e-12) & (u >= 0) & (v >= 0) & (u + v <= 1)
    distance = np.where(inside, np.sum((best - points[:, None]) ** 2, axis=-1), np.inf)
    for first, last in ((a, b), (b, c), (c, a)):
        edge = last - first
        length = np.sum(edge * edge, axis=-1)
        along = np.divide(np.sum((points[:, None] - first) * edge, axis=-1), length,
                          out=np.zeros_like(distance), where=length > 1e-12)
        candidate = first + np.clip(along, 0, 1)[..., None] * edge
        square = np.sum((candidate - points[:, None]) ** 2, axis=-1)
        better = square < distance
        best = np.where(better[..., None], candidate, best)
        distance = np.minimum(distance, square)
    selected = np.argmin(distance, axis=1)
    rows = np.arange(len(points))
    return best[rows, selected], selected, distance[rows, selected]


def batch_surface_binding(source, faces, target):
    """Exact triangle interiors/edges; vectorized AABB traversal, not vertex KNN."""
    source, target = map(_positions, (source, target))
    faces = _faces(faces, len(source))
    corners = source[faces]
    area = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0],
                                   corners[:, 2] - corners[:, 0]), axis=1)
    valid = np.flatnonzero(area > 1e-8)
    if not len(valid):
        raise ValueError("Attachment needs nondegenerate source triangles.")
    low, high = corners.min(1), corners.max(1)
    centers = (low + high) / 2
    nodes = []

    def build(ids):
        index = len(nodes)
        node = [low[ids].min(0), high[ids].max(0), None, None]
        nodes.append(node)
        if len(ids) <= 16:
            node[2] = ids
        else:
            axis = int(np.argmax(np.ptp(centers[ids], axis=0)))
            ids = ids[np.argsort(centers[ids, axis], kind="stable")]
            middle = len(ids) // 2
            node[3] = (build(ids[:middle]), build(ids[middle:]))
        return index

    build(valid)
    best = np.full(len(target), np.inf)
    chosen = np.full(len(target), -1, dtype=np.int64)
    nearest = np.zeros_like(target)

    def bound(index, ids):
        node = nodes[index]
        gap = np.maximum(np.maximum(node[0] - target[ids], target[ids] - node[1]), 0)
        return np.sum(gap * gap, axis=1)

    def visit(index, ids):
        ids = ids[bound(index, ids) <= best[ids]]
        if not len(ids):
            return
        node = nodes[index]
        if node[2] is not None:
            triangles = node[2]
            for start in range(0, len(ids), 2048):
                group = ids[start:start + 2048]
                points, face, square = _nearest(target[group], corners[triangles])
                improve = square < best[group]
                use = group[improve]
                best[use] = square[improve]
                chosen[use] = triangles[face[improve]]
                nearest[use] = points[improve]
        else:
            left, right = node[3]
            first = bound(left, ids) <= bound(right, ids)
            for group, a, b in ((ids[first], left, right), (ids[~first], right, left)):
                if len(group):
                    visit(a, group)
                    visit(b, group)

    visit(0, np.arange(len(target)))
    if np.any(chosen < 0) or not np.isfinite(best).all():
        raise ValueError("Attachment found no finite source triangle.")
    a, b, c = np.moveaxis(corners[chosen], 1, 0)
    ab, ac, ap = b - a, c - a, nearest - a
    aa, bb, cc = np.sum(ab * ab, axis=1), np.sum(ab * ac, axis=1), np.sum(ac * ac, axis=1)
    denominator = aa * cc - bb * bb
    u = (cc * np.sum(ap * ab, axis=1) - bb * np.sum(ap * ac, axis=1)) / denominator
    v = (aa * np.sum(ap * ac, axis=1) - bb * np.sum(ap * ab, axis=1)) / denominator
    bary = np.column_stack((1 - u - v, u, v))
    if not np.isfinite(bary).all() or bary.min() < -1e-5:
        raise ValueError("Attachment produced invalid convex coordinates.")
    bary = np.clip(bary, 0, 1)
    bary /= bary.sum(axis=1, keepdims=True)
    return faces[chosen], bary, np.sqrt(best)


def registration_surface(reference, faces, mouth_y):
    _, first, inverse = np.unique(np.round(reference / 1e-5).astype(np.int64),
                                  axis=0, return_index=True, return_inverse=True)
    points, faces = reference[first].copy(), inverse[faces]
    edges = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1)
    edges, counts = np.unique(edges, axis=0, return_counts=True)
    boundary = edges[counts == 1]
    adjacency = {}
    for a, b in boundary:
        adjacency.setdefault(int(a), set()).add(int(b))
        adjacency.setdefault(int(b), set()).add(int(a))
    additions, polygons, skirts = [], [], 0
    while adjacency:
        stack, component, degrees = [next(iter(adjacency))], set(), []
        while stack:
            index = stack.pop()
            if index in component:
                continue
            component.add(index)
            neighbors = adjacency.pop(index, set())
            degrees.append(len(neighbors))
            stack.extend(neighbors - component)
        ids = np.array(sorted(component))
        if points[ids, 1].max() >= mouth_y - 3:
            continue
        if any(degree != 2 for degree in degrees):
            raise ValueError("Registration neck boundary is not a closed manifold loop.")
        lower = points[ids].copy()
        lower[:, 1] = reference[:, 1].min() - 4
        offset = len(points) + sum(len(p) for p in additions)
        lookup = dict(zip(ids.tolist(), range(offset, offset + len(ids))))
        for a, b in boundary:
            if a in lookup and b in lookup:
                polygons.extend(((a, b, lookup[b]), (a, lookup[b], lookup[a])))
        additions.append(lower)
        skirts += 1
    if additions:
        points = np.vstack((points, *additions))
        faces = np.vstack((faces, polygons))
    return points, faces, {
        "weldToleranceCm": 1e-5, "neckSkirts": skirts,
        "scope": "Registration sections only. UV/normal seams welded and low open neck loops extended down; output rest/topology unchanged."}


def register(rest, faces, reference, reference_faces, eyes, mouth_y):
    eyes = _positions(eyes)
    scale = abs(EYES[1, 0] - EYES[0, 0]) / abs(eyes[1, 0] - eyes[0, 0])
    target_mouth = (mouth_y - eyes[:, 1].mean()) * scale + EYES[:, 1].mean()
    fitting_points, fitting_faces, closure = registration_surface(reference, reference_faces, mouth_y)
    warp, receipt = structural_warp(
        rest, faces, fitting_points, fitting_faces, eyes, np.array([[1, .6, .7]] * 2),
        target_mouth, shape_weight=.8)
    aligned = (reference - eyes.mean(0)) * scale + EYES.mean(0)
    aligned[:, 2] += receipt["orbitalDepthAlignmentCm"]
    def closest(points, vertices, triangles):
        indices, weights, _ = batch_surface_binding(vertices, triangles, points)
        return np.sum(vertices[indices] * weights[..., None], axis=1)

    warp, refinement = refine_surface(warp, rest, aligned, reference_faces,
                                      closest=closest, minimum_controls=192)
    receipt.update(refinement)

    def hybrid(points):
        return points + HYBRID_WEIGHT * (warp(points) - points)

    receipt.update(hybridWeight=HYBRID_WEIGHT, sectionClosure=closure,
                   landmarkProvenance="Authored on calibrated, rendered source geometry; approximate, not anatomical ground truth.")
    return aligned, warp, hybrid, receipt


def attach(rest, faces, native, warp):
    influence = _smooth(135, 138, native[:, 1])
    active = np.flatnonzero(influence > 0)
    fitted = warp(rest)
    indices, weights, distances = batch_surface_binding(fitted, faces, native[active])
    if distances.max() > 3:
        raise ValueError("Native attachment exceeds the existing three-centimeter bound.")
    samples = np.sum(fitted[indices] * weights[..., None], axis=1)

    def transfer(points):
        points = _positions(points)
        if points.shape != rest.shape:
            raise ValueError("Motion must retain complete Claire vertex correspondence.")
        mapped = warp(points)
        delta = np.sum(mapped[indices] * weights[..., None], axis=1) - samples
        if not np.isfinite(delta).all() or np.linalg.norm(delta, axis=1).max() > 8:
            raise ValueError("Native motion exceeds the existing eight-centimeter bound.")
        result = native.copy()
        result[active] += delta * influence[active, None]
        return result

    return transfer, {
        "binding": "Exact triangle-interior/edge AABB traversal, vectorized in bounded 2048-by-16 leaves.",
        "attachmentMaximumCm": float(distances.max()), "attachmentMedianCm": float(np.median(distances)),
        "activeVertices": len(active), "fixedVertices": len(native) - len(active),
        "restPreservation": "Original world geometry after one uniform eye-frame alignment; original triangle indices retained.",
        "limits": "Unrigged geometric motion transfer; no independent teeth, tongue, eye joints or contact solving."}
