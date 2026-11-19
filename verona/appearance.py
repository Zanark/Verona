"""Original Verona rest styling and static, swept wavy hair; no new model."""

import numpy as np


def _smoothstep(low, high, value):
    value = np.clip((value - low) / (high - low), 0, 1)
    return value * value * (3 - 2 * value)


def verona_rest_shape(vertices: np.ndarray) -> np.ndarray:
    """Style only the rest surface; the engine retains the learned PCA deltas."""
    result = vertices.astype(np.float32, copy=True)
    x, y, z = vertices.T
    front = _smoothstep(-4, 2, z)
    mouth = ((1 - _smoothstep(2.8, 3.8, np.abs(x - .08)))
             * (1 - _smoothstep(1.0, 1.8, np.abs(y - 140.15))))
    eyes = ((1 - _smoothstep(1.0, 1.7, np.abs(y - 147.55)))
            * (1 - _smoothstep(1.6, 2.1, np.abs(np.abs(x) - 3.0))))
    weight = front * (1 - mouth) * (1 - eyes)
    cheek = np.exp(-((np.abs(x) - 4.1) / 2.0) ** 2 - ((y - 144.3) / 1.9) ** 2)
    jaw = np.exp(-((y - 138.0) / 4.1) ** 2)
    bridge = np.exp(-(x / 1.65) ** 4 - ((y - 144.1) / 2.8) ** 4)
    chin = np.exp(-(x / 2.8) ** 2 - ((y - 135.9) / 1.6) ** 2)
    tip = np.exp(-(x / 1.8) ** 2 - ((y - 142.6) / 1.1) ** 2)
    hollow = np.exp(-((np.abs(x) - 4.8) / 1.8) ** 2 - ((y - 141.8) / 1.5) ** 2)
    result[:, 0] += weight * (-.115 * x * jaw - .12 * x * bridge + .025 * x * cheek)
    result[:, 1] += weight * (.26 * cheek + .45 * chin)
    result[:, 2] += weight * (.34 * cheek + .10 * chin + .16 * bridge - .08 * tip - .08 * hollow)
    eye_y = y - 147.55
    lid = (np.exp(-((np.abs(x) - 3.02) / 1.7) ** 6 - (eye_y / 1.1) ** 4)
           * _smoothstep(2.4, 3.0, z))
    result[:, 1] += .22 * np.tanh(eye_y / .25) * lid
    return result


def claire_eyes() -> tuple[np.ndarray, np.ndarray]:
    """Original static ellipsoids within the matching native cornea bounds."""
    vertices, triangles = [], []
    columns, rows = 32, 20
    for x, y, z in ((-2.9485, 147.5517, 2.2364), (3.1021, 147.4944, 2.2830)):
        offset = len(vertices)
        for row in range(rows + 1):
            latitude = np.pi * row / rows
            for column in range(columns):
                angle = 2 * np.pi * column / columns
                vertices.append((x + 1.35 * np.sin(latitude) * np.sin(angle),
                                 y + 1.32 * np.cos(latitude),
                                 z + 1.40 * np.sin(latitude) * np.cos(angle)))
        for row in range(rows):
            for column in range(columns):
                a = offset + row * columns + column
                b = offset + row * columns + (column + 1) % columns
                c, d = a + columns, b + columns
                if row:
                    triangles.append((a, c, b))
                if row < rows - 1:
                    triangles.append((b, c, d))
    return np.asarray(vertices, dtype=np.float32), np.asarray(triangles, dtype="<u4")


def claire_hair() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    columns, rows = 72, 18
    vertices, edges, triangles = [], [], []
    for row in range(rows):
        t = row / (rows - 1)
        for column in range(columns):
            angle = 2 * np.pi * column / columns
            front = float(_smoothstep(0, 1, max(0, np.cos(angle))))
            limit = 1.63 - .58 * front + .18 * np.sin(angle) * front
            theta = t * limit
            x = 9.5 * np.sin(theta) * np.sin(angle) - .8 * (1 - t) ** 2
            y = 148.2 + 11.0 * np.cos(theta)
            z = -5.7 + 11.6 * np.sin(theta) * np.cos(angle)
            vertices.append(np.array((x, y, z)))
    for row in range(rows - 1):
        for column in range(columns):
            a, b = row * columns + column, row * columns + (column + 1) % columns
            c, d = a + columns, b + columns
            if column % 3 == 0:
                edges.append((a, c))
            triangles.extend(((a, c, b), (b, c, d)))

    sections, sides = 38, 8
    for lock, angle in enumerate(np.linspace(.86, 2 * np.pi - .86, 26)):
        offset = len(vertices)
        tangent = np.array((np.cos(angle), 0, -np.sin(angle)))
        radial = np.array((np.sin(angle), 0, np.cos(angle)))
        for row in range(sections):
            t = row / (sections - 1)
            theta = min(1.55, .55 + 4 * t)
            fall = max(0, (t - .25) / .75)
            wave = _smoothstep(.12, .40, t) * (
                1.24 * np.sin(3.8 * np.pi * t + .8 * angle)
                + .20 * np.sin(7.6 * np.pi * t + angle))
            center = np.array((9.6 * np.sin(theta) * np.sin(angle),
                               148.2 + 11.0 * np.cos(theta) - (16.0 + 1.6 * np.cos(angle)) * fall,
                               -5.7 + 11.7 * np.sin(theta) * np.cos(angle)))
            center += tangent * wave + radial * (
                .18 + .65 * fall + .35 * np.sin(3.8 * np.pi * t + .8 * angle) * fall)
            center[0] -= .8 * (1 - t) ** 3
            width = (1.18 + .12 * np.sin(lock * 1.7)) * (
                .16 + .84 * _smoothstep(0, .19, t)) * (1 - .62 * _smoothstep(.85, 1, t))
            depth = .50 * (.30 + .70 * np.sin(np.pi * t))
            for side in range(sides):
                turn = 2 * np.pi * side / sides
                vertices.append(center + tangent * (width * np.cos(turn))
                                + radial * (depth * np.sin(turn)))
        for row in range(sections - 1):
            for side in range(sides):
                a = offset + row * sides + side
                b = offset + row * sides + (side + 1) % sides
                c, d = a + sides, b + sides
                triangles.extend(((a, b, c), (b, d, c)))
                if side in (1, 5):
                    edges.append((a, c))
    return (np.asarray(vertices, dtype=np.float32), np.asarray(edges, dtype="<u4"),
            np.asarray(triangles, dtype="<u4"))
