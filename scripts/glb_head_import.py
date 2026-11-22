"""Bounded offline GLB geometry import; never resolves files, URLs or scripts."""

import hashlib
import json
from pathlib import Path
import struct

import numpy as np


MAX_BYTES = 64 * 1024 * 1024
MAX_VERTICES = 1_000_000
MAX_TRIANGLES = 2_000_000
DTYPES = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_head(path):
    path = Path(path)
    if not 20 <= path.stat().st_size <= MAX_BYTES:
        raise ValueError("GLB file exceeds the bounded review size.")
    with path.open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("GLB file grew beyond the bounded review size.")
    magic, version, length = struct.unpack_from("<4sII", raw)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError("Expected a complete GLB version 2 container.")
    chunks, offset = [], 12
    while offset < length:
        if offset + 8 > length:
            raise ValueError("Truncated GLB chunk header.")
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        if size % 4 or size > length - offset:
            raise ValueError("Invalid GLB chunk length/alignment.")
        chunks.append((kind, raw[offset:offset + size]))
        offset += size
    if len(chunks) != 2 or [c[0] for c in chunks] != [0x4E4F534A, 0x004E4942]:
        raise ValueError("Expected exactly embedded JSON and BIN chunks.")
    doc, binary = json.loads(chunks[0][1]), chunks[1][1]
    buffers = doc.get("buffers", [])
    if (len(buffers) != 1 or "uri" in buffers[0]
            or not len(binary) - 3 <= buffers[0].get("byteLength", -1) <= len(binary)):
        raise ValueError("Only one complete embedded geometry buffer is supported.")
    if doc.get("extensionsRequired") or doc.get("skins") or doc.get("animations"):
        raise ValueError("Rigged, animated or extension-dependent GLBs require a separate importer.")

    def item(values, index, label):
        if type(index) is not int or not 0 <= index < len(values):
            raise ValueError(f"Invalid {label} index.")
        return values[index]

    def accessor(index):
        a = item(doc.get("accessors", []), index, "geometry accessor")
        if "sparse" in a or a.get("componentType") not in DTYPES or a.get("type") not in WIDTHS:
            raise ValueError("Unsupported sparse/accessor encoding.")
        view = item(doc["bufferViews"], a["bufferView"], "buffer view")
        if view.get("buffer", 0) != 0:
            raise ValueError("External geometry buffers are not supported.")
        count, width = a["count"], WIDTHS[a["type"]]
        dtype = np.dtype(DTYPES[a["componentType"]])
        packed = dtype.itemsize * width
        stride = view.get("byteStride", packed)
        start = view.get("byteOffset", 0)
        local = a.get("byteOffset", 0)
        if (not isinstance(count, int) or not 1 <= count <= MAX_TRIANGLES * 3
                or stride < packed or stride % dtype.itemsize or local < 0 or start < 0
                or local + (count - 1) * stride + packed > view["byteLength"]
                or start + view["byteLength"] > buffers[0]["byteLength"]):
            raise ValueError("Accessor exceeds its declared embedded view.")
        result = np.ndarray((count, width), dtype=dtype, buffer=binary,
                            offset=start + local, strides=(stride, dtype.itemsize)).copy()
        if a.get("normalized"):
            if dtype.kind not in "iu":
                raise ValueError("Only integer attributes can be normalized.")
            result = np.maximum(result.astype(float) / np.iinfo(dtype).max, -1)
        if not np.isfinite(result).all():
            raise ValueError("GLB attributes must be finite.")
        return result

    def transform(node):
        if "matrix" in node:
            if any(k in node for k in ("translation", "rotation", "scale")):
                raise ValueError("A node cannot mix matrix and TRS transforms.")
            matrix = np.asarray(node["matrix"], dtype=float).reshape(4, 4, order="F")
        else:
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            if abs(x*x + y*y + z*z + w*w - 1) > 1e-4:
                raise ValueError("Node rotation must be a unit quaternion.")
            matrix = np.eye(4)
            matrix[:3, :3] = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
            ]) @ np.diag(node.get("scale", [1, 1, 1]))
            matrix[:3, 3] = node.get("translation", [0, 0, 0])
        if (not np.isfinite(matrix).all() or not np.allclose(matrix[3], [0, 0, 0, 1])
                or abs(np.linalg.det(matrix[:3, :3])) < 1e-12):
            raise ValueError("Node transform must be finite, affine and nonsingular.")
        return matrix

    positions, faces, colors, parts = [], [], [], []
    vertex_count = triangle_count = 0
    nodes = doc.get("nodes", [])
    visited = set()
    if len(nodes) > 512:
        raise ValueError("Scene exceeds the bounded node inventory.")

    def visit(index, parent, ancestors):
        nonlocal vertex_count, triangle_count
        if type(index) is not int or not 0 <= index < len(nodes):
            raise ValueError("Invalid scene node index.")
        if index in ancestors or len(ancestors) >= 64:
            raise ValueError("Scene contains a cycle or excessive depth.")
        if index in visited:
            raise ValueError("Scene repeats a node in multiple branches.")
        visited.add(index)
        node = nodes[index]
        world = parent @ transform(node)
        if "mesh" in node:
            for primitive in item(doc["meshes"], node["mesh"], "mesh")["primitives"]:
                if primitive.get("mode", 4) != 4 or primitive.get("targets") or primitive.get("extensions"):
                    raise ValueError("Only static uncompressed triangle primitives are supported.")
                attrs = primitive["attributes"]
                position_accessor = item(doc["accessors"], attrs["POSITION"], "position accessor")
                if position_accessor.get("componentType") != 5126:
                    raise ValueError("Positions require standard float32 geometry.")
                p = accessor(attrs["POSITION"])
                if p.shape[1] != 3:
                    raise ValueError("Positions must have three components.")
                f = (accessor(primitive["indices"]).reshape(-1) if "indices" in primitive
                     else np.arange(len(p), dtype=np.uint32))
                if f.dtype.kind not in "iu" or len(f) % 3 or f.min() < 0 or f.max() >= len(p):
                    raise ValueError("Triangle indices must address their own primitive.")
                f = f.reshape(-1, 3).astype(np.int64)
                if np.linalg.det(world[:3, :3]) < 0:
                    f = f[:, [0, 2, 1]]
                material = item(doc["materials"], primitive["material"], "material") if "material" in primitive else {}
                factor = np.array(material.get("pbrMetallicRoughness", {}).get(
                    "baseColorFactor", [1, 1, 1, 1]))[:3]
                color = accessor(attrs["COLOR_0"])[:, :3] if "COLOR_0" in attrs else np.ones_like(p)
                if color.shape != p.shape or factor.shape != (3,) or not np.isfinite(factor).all():
                    raise ValueError("Vertex/material color shape is invalid.")
                positions.append(p @ world[:3, :3].T + world[:3, 3])
                faces.append(f + vertex_count)
                colors.append(np.clip(color * factor, 0, 1))
                parts.append({"name": node.get("name", ""), "start": vertex_count,
                              "vertices": len(p), "triangles": len(f)})
                vertex_count += len(p)
                triangle_count += len(f)
                if vertex_count > MAX_VERTICES or triangle_count > MAX_TRIANGLES:
                    raise ValueError("Geometry exceeds the bounded review inventory.")
        for child in node.get("children", []):
            visit(child, world, ancestors | {index})

    try:
        for root in item(doc["scenes"], doc.get("scene", 0), "scene")["nodes"]:
            visit(root, np.eye(4), set())
    except (IndexError, KeyError, TypeError, struct.error) as error:
        raise ValueError("Malformed embedded GLB scene.") from error
    if not positions:
        raise ValueError("Scene contains no reviewable triangle geometry.")
    return {
        "positions": np.concatenate(positions), "faces": np.concatenate(faces),
        "colors": np.concatenate(colors), "parts": parts,
        "receipt": {"sourceFile": path.name, "sourceSha256": hashlib.sha256(raw).hexdigest(),
                    "sourceBytes": len(raw), "vertices": vertex_count, "triangles": triangle_count,
                    "asset": doc.get("asset", {}), "embeddedImages": len(doc.get("images", [])),
                    "texturesRendered": False, "externalResourcesLoaded": False,
                    "limits": "Static scene geometry only; imported normals/textures/rigs are not transferred."},
    }
