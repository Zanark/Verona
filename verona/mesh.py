"""Read fixed Maya numerical arrays without executing any scene commands."""

from pathlib import Path
import re

import numpy as np


SKIN_NODE = "c_headWatertight_hiShape"


def numeric_array(body: str, attribute: str, dtype: str) -> np.ndarray:
    pattern = (
        rf'setAttr\s+(?:-s\s+\d+\s+)?"\.{attribute}'
        r'\[(\d+):(\d+)\]"\s+([^;]*);'
    )
    chunks = []
    expected = 0
    for match in re.finditer(pattern, body):
        start, end = int(match[1]), int(match[2])
        payload = match[3]
        if start != expected or end < start or not re.fullmatch(r"[\d.eE+\-\s]+", payload):
            raise ValueError(f"Invalid or noncontiguous Maya {attribute} array.")
        values = np.fromstring(payload, sep=" ", dtype=dtype)
        if len(values) != (end - start + 1) * 3 or not np.isfinite(values).all():
            raise ValueError(f"Incorrect Maya {attribute} array size/values.")
        chunks.append(values.reshape(-1, 3))
        expected = end + 1
    if not chunks:
        raise ValueError(f"Missing Maya {attribute} array.")
    return np.concatenate(chunks)


def read_mesh(path: Path, node: str = SKIN_NODE) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    text = path.read_text(encoding="utf-8")
    match = re.search(
        rf'^createNode mesh -n "{re.escape(node)}"[^;]*;', text, re.MULTILINE
    )
    if match is None:
        raise ValueError(f"Missing pinned Maya mesh: {node}.")
    end = text.find("\ncreateNode ", match.end())
    body = text[match.end() : end if end >= 0 else len(text)]
    vertices = numeric_array(body, "vt", "<f4")
    edges = numeric_array(body, "ed", "<i4")[:, :2]
    if edges.min() < 0 or edges.max() >= len(vertices):
        raise ValueError("Maya edge references a missing vertex.")

    triangles = []
    expected_face = 0
    for faces in re.finditer(
        r'setAttr\s+(?:-s\s+\d+\s+)?"\.fc\[(\d+):(\d+)\]"'
        r'(?:\s+-type "polyFaces")?\s+([^;]*);',
        body,
    ):
        if int(faces[1]) != expected_face:
            raise ValueError("Noncontiguous Maya polygon array.")
        parsed_faces = 0
        for face in re.finditer(r"(?:^|\s)f\s+(\d+)((?:\s+-?\d+)+)", faces[3]):
            count = int(face[1])
            signed = np.fromstring(face[2], sep=" ", dtype=np.int32)
            if not 3 <= count <= 16 or len(signed) != count:
                raise ValueError("Unsupported or malformed Maya polygon.")
            indices = np.where(signed >= 0, signed, -signed - 1)
            if indices.max() >= len(edges):
                raise ValueError("Maya polygon references a missing edge.")
            loop = edges[indices].copy()
            loop[signed < 0] = loop[signed < 0, ::-1]
            if not np.array_equal(loop[:, 1], np.roll(loop[:, 0], -1)):
                raise ValueError("Maya polygon edges do not form an oriented loop.")
            points = loop[:, 0]
            triangles.extend((int(points[0]), int(points[i]), int(points[i + 1]))
                             for i in range(1, count - 1))
            parsed_faces += 1
        expected_face = int(faces[2]) + 1
        if parsed_faces != int(faces[2]) - int(faces[1]) + 1:
            raise ValueError("Incorrect Maya polygon count.")
    if not triangles:
        raise ValueError("Missing Maya polygon connectivity.")
    return vertices, edges, np.asarray(triangles, dtype=np.int32)


def reduced_mesh(
    vertices: np.ndarray, edges: np.ndarray, triangles: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Contract native edges inside cells; never join spatially adjacent lips."""
    steps = np.full(len(vertices), 0.85, dtype=np.float32)
    mouth = (
        (np.abs(vertices[:, 0]) < 5.2)
        & (vertices[:, 1] > 149.5)
        & (vertices[:, 1] < 156)
        & (vertices[:, 2] > 2.5)
    )
    steps[mouth] = 0.15
    cells = np.floor(vertices / steps[:, None]).astype(np.int32)
    same = (
        (steps[edges[:, 0]] == steps[edges[:, 1]])
        & np.all(cells[edges[:, 0]] == cells[edges[:, 1]], axis=1)
    )
    parents = np.arange(len(vertices), dtype=np.int32)

    def root(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = int(parents[index])
        return index

    for left, right in edges[same]:
        a, b = root(int(left)), root(int(right))
        if a != b:
            parents[b] = a
    groups = np.asarray([root(i) for i in range(len(vertices))], dtype=np.int32)
    _, mapping = np.unique(groups, return_inverse=True)
    count = int(mapping.max()) + 1
    centroids = np.zeros((count, 3), dtype=np.float64)
    np.add.at(centroids, mapping, vertices)
    centroids /= np.bincount(mapping)[:, None]
    distances = np.sum((vertices - centroids[mapping]) ** 2, axis=1)
    order = np.lexsort((np.arange(len(vertices)), distances, mapping))
    _, first = np.unique(mapping[order], return_index=True)
    selected = order[first].astype(np.int32)
    compact_edges = np.sort(mapping[edges], axis=1)
    compact_edges = np.unique(compact_edges[compact_edges[:, 0] != compact_edges[:, 1]], axis=0)
    compact_triangles = mapping[triangles]
    keep = (
        (compact_triangles[:, 0] != compact_triangles[:, 1])
        & (compact_triangles[:, 1] != compact_triangles[:, 2])
        & (compact_triangles[:, 2] != compact_triangles[:, 0])
    )
    return selected, compact_edges.astype("<u4"), compact_triangles[keep].astype("<u4")
