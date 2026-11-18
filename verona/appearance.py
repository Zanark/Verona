"""Small original procedural bob; independent of the learned facial skin."""

import numpy as np


def claire_hair() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    strands, rows = 80, 28
    vertices = []
    for row in range(rows):
        t = row / (rows - 1)
        for strand in range(strands):
            angle = 2 * np.pi * strand / strands
            front = float(np.clip(np.cos(angle) / .55, 0, 1))
            front = front * front * (3 - 2 * front)
            theta = t * (2.12 - 1.03 * front)
            x = 9.3 * np.sin(theta) * np.sin(angle)
            y = 148.2 + 11.0 * np.cos(theta)
            z = -5.7 + 11.3 * np.sin(theta) * np.cos(angle)
            side = 1 - front
            y -= 5.0 * t ** 4 * side
            x += .13 * np.sin(12 * t + angle * 3) * t * side
            vertices.append((x, y, z))
    edges, triangles = [], []
    for row in range(rows - 1):
        for strand in range(strands):
            a, b = row * strands + strand, row * strands + (strand + 1) % strands
            c, d = a + strands, b + strands
            edges.append((a, c))
            triangles.extend(((a, c, b), (b, c, d)))
    return (np.asarray(vertices, dtype=np.float32), np.asarray(edges, dtype="<u4"),
            np.asarray(triangles, dtype="<u4"))
