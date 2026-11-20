"""Offline same-topology appearance experiment; NOT an application identity."""

import numpy as np


REVISION = "lower-face-study-1"


def sculpt_positions(vertices: np.ndarray) -> np.ndarray:
    """Map complete poses, not just rest positions, in Claire world coordinates."""
    if (not isinstance(vertices, np.ndarray) or vertices.ndim < 2
            or vertices.shape[-1] != 3 or not vertices.size
            or not np.issubdtype(vertices.dtype, np.number)
            or np.iscomplexobj(vertices) or not np.isfinite(vertices).all()):
        raise ValueError("Supply nonempty finite real XYZ positions for the sculpt study.")
    source = vertices.astype(np.float64)
    x, y, z = np.moveaxis(source, -1, 0)
    t = np.clip((y - 144.7) / 1.3, 0, 1)
    lower = 1 - t * t * (3 - 2 * t)
    jaw = np.exp(-((y - 138.3) / 3.2) ** 2)
    chin = np.exp(-((y - 135.9) / 1.6) ** 2)
    cheek = np.exp(-((y - 144.1) / 1.7) ** 2)
    width = 1 + lower * (-.16 * jaw - .065 * chin + .025 * cheek)
    lift = lower * .32 * np.exp(-((y - 135.8) / 1.7) ** 2)
    cheek_plane = (.24 * np.exp(-((np.abs(x) - 3.8) / 1.8) ** 2)
                   * np.exp(-((y - 144.1) / 1.7) ** 2))
    nose_tip = -.18 * np.exp(-(x / 1.8) ** 4 - ((y - 142.6) / 1.0) ** 2)
    lip_plane = .10 * np.exp(-(x / 2.4) ** 4 - ((y - 140.2) / .65) ** 2)
    result = np.stack((x * width, y + lift, z + lower * (cheek_plane + nose_tip + lip_plane)), axis=-1)
    if not np.isfinite(result).all() or np.max(np.abs(result)) > np.finfo(np.float32).max:
        raise ValueError("Sculpt positions exceed finite coordinate bounds.")
    return result.astype(np.float32)
