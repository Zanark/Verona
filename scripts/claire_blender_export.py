"""Export only the existing Claire face; run with trusted local Blender."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ORIGIN_CM = np.array([0, (147.5517 + 147.4944) / 2, 0])


def to_blender(points):
    p = (np.asarray(points, dtype=np.float64) - ORIGIN_CM) * .01
    return p[..., [0, 2, 1]] * [1, -1, 1]


def glb_document(path):
    raw = Path(path).read_bytes()
    if len(raw) < 20 or struct.unpack_from("<4sII", raw) != (b"glTF", 2, len(raw)):
        raise ValueError("Invalid GLB header/length.")
    length, kind = struct.unpack_from("<II", raw, 12)
    if kind != 0x4E4F534A or 20 + length > len(raw):
        raise ValueError("Invalid GLB JSON chunk.")
    doc = json.loads(raw[20:20 + length])
    if any("uri" in entry for key in ("buffers", "images") for entry in doc.get(key, [])):
        raise ValueError("GLB must not depend on external buffers/images.")
    return doc


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def material(name, color, rough=.42):
    rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    linear = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = rough
    return mat


def mesh(name, points, faces, mat, collection, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(np.asarray(points).tolist(), [], [list(face) for face in faces])
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def disc(name, center, radius, depth, mat, collection):
    import bmesh

    points = [[center[0]+radius*math.cos(i*math.tau/32),
               center[1]+radius*math.sin(i*math.tau/32), center[2]+depth*end]
              for end in (-.5, .5) for i in range(32)]
    faces = [list(range(31, -1, -1)), list(range(32, 64))]
    faces += [[i, (i+1)%32, (i+1)%32+32, i+32] for i in range(32)]
    obj = mesh(name, to_blender(points), faces, mat, collection)
    data = bmesh.new()
    data.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(data, faces=list(data.faces))
    data.to_mesh(obj.data)
    data.free()
    return obj


def prepare_claire(collection):
    from scripts.fetch_claire_model import ASSETS, DESTINATION, REVISION
    from scripts.fetch_cpu_model import verify
    from verona.appearance import claire_eyes, claire_hair, verona_rest_shape
    from verona.mesh import native_control_mesh, read_mesh

    for name in ("model_data.npz", "claire_geom_v2_topo1.ma"):
        verify(DESTINATION/name, *ASSETS[name])
    with np.load(DESTINATION/"model_data.npz", allow_pickle=False) as data:
        mean, basis = data["shapes_mean_skin"], data["shapes_matrix_skin"]
    if mean.shape != (61520, 3) or basis.shape != (140, 61520, 3):
        raise ValueError("Pinned Claire dimensions changed.")
    native, edges, faces = read_mesh(DESTINATION/"claire_geom_v2_topo1.ma")
    if np.max(np.linalg.norm(native-mean, axis=1)) > 1.1:
        raise ValueError("Pinned native/PCA correspondence changed.")
    selected, _, faces = native_control_mesh(mean, edges, faces)
    if len(selected) != 15375 or faces.shape != (30746, 3):
        raise ValueError("Pinned control topology changed.")
    rest_cm = verona_rest_shape(mean[selected])
    rest = to_blender(rest_cm)
    skin = mesh("Claire_Skin_PCA140", rest, faces,
                material("Claire / neutral clay", "#C6B3A4"), collection, True)
    skin["source"] = "NVIDIA Claire v2.3.1; Verona rest styling; selected native indices"
    skin["units"] = "meters; source x,-z,y with eye-height origin"
    skin.shape_key_add(name="Basis")
    for i, delta in enumerate(basis[:, selected]):
        key = skin.shape_key_add(name=f"PCA_{i:03d}")
        values = rest + delta[:, [0, 2, 1]] * [.01, -.01, .01]
        key.data.foreach_set("co", values.astype(np.float32).ravel())
        key.slider_min, key.slider_max = -3, 3
    skin["PCA_warning"] = "Modal coefficients, NOT named visemes/bones; all default to zero."
    white = material("Claire / static eye whites", "#E1E9E8", .22)
    iris_mat = material("Claire / static hazel iris", "#667D3A")
    pupil_mat = material("Claire / static pupils", "#162332")
    eyes, eye_faces = claire_eyes()
    for side, start in (("R", 0), ("L", 672)):
        keep = np.all((eye_faces >= start) & (eye_faces < start+672), axis=1)
        mesh(f"Claire_Eyeball.{side}", to_blender(eyes[start:start+672]),
             eye_faces[keep]-start, white, collection, True)
        x = -2.9485 if side == "R" else 3.1021
        y = 147.5517 if side == "R" else 147.4944
        z = (2.2364 if side == "R" else 2.2830)+1.45
        iris = disc(f"Claire_StaticIris.{side}", [x,y,z], .55, .045, iris_mat, collection)
        iris["cosmetic"] = "Static reference iris, not an exported learned eye joint"
        disc(f"Claire_StaticPupil.{side}", [x,y,z+.035], .25, .04, pupil_mat, collection)
    hair, _, hair_faces = claire_hair()
    mesh("Claire_Waves_STATIC", to_blender(hair), hair_faces,
         material("Claire / original espresso waves", "#302422"), collection, True)
    return {
        "revision": REVISION,
        "inputs": {name: {"bytes":ASSETS[name][0], "sha256":ASSETS[name][1]}
                   for name in ("model_data.npz", "claire_geom_v2_topo1.ma")},
        "selectedNativeIndices": selected.tolist(), "sourceOriginCm": ORIGIN_CM.tolist(),
        "blenderTransform": "0.01 * (x, -z, y-eyeHeight)",
        "glTFTransform": "0.01 * (x, y-eyeHeight, z)",
        "skinVertices": len(rest), "skinTriangles": len(faces), "pcaTargets": 140,
    }


def build(output):
    output.mkdir(parents=True, exist_ok=False)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    collection = bpy.data.collections.new("CLAIRE_REFERENCE")
    bpy.context.scene.collection.children.link(collection)
    source = prepare_claire(collection)
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = collection.objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output/"Claire.glb"), export_format="GLB", use_selection=True,
        export_morph=True, export_morph_normal=False, export_animations=False,
        export_extras=True, export_yup=True, export_skins=False,
        export_cameras=False, export_lights=False)
    glb_document(output/"Claire.glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(output/"Claire.blend"))
    write_json(output/"source-map.json", source)
    (output/"ASSET-RIGHTS.md").write_text((ROOT/"THIRD_PARTY.md").read_text(encoding="utf-8"),
                                        encoding="utf-8")
    print("CLAIRE_EXPORT_OK", output)


def verify_export(output):
    from scripts.fetch_claire_model import ASSETS, DESTINATION
    from scripts.fetch_cpu_model import verify
    from verona.appearance import verona_rest_shape

    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = output/"Claire.glb"
    doc = glb_document(path)
    if doc.get("skins") or doc.get("animations"):
        raise ValueError("Claire-only export must not contain an armature or animation.")
    bpy.ops.import_scene.gltf(filepath=str(path))
    expected = {"Claire_Skin_PCA140", "Claire_Waves_STATIC"}
    expected.update(f"Claire_{part}.{side}" for side in ("L","R")
                    for part in ("Eyeball","StaticIris","StaticPupil"))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if {obj.name for obj in meshes} != expected or len(meshes) != 8:
        raise ValueError("Claire-only import lost parts or contains unexpected geometry.")
    if any(not all(math.isfinite(v) for v in vertex.co)
           for obj in meshes for vertex in obj.data.vertices):
        raise ValueError("Imported nonfinite geometry.")
    skin = bpy.data.objects["Claire_Skin_PCA140"]
    if len(skin.data.vertices) != 15375 or len(skin.data.shape_keys.key_blocks) != 141:
        raise ValueError("Claire vertex/shape-key counts changed.")
    keys = skin.data.shape_keys.key_blocks
    if {key.name for key in keys[1:]} != {f"PCA_{i:03d}" for i in range(140)}:
        raise ValueError("Claire modal target names lost.")
    verify(DESTINATION/"model_data.npz", *ASSETS["model_data.npz"])
    selected = np.asarray(json.loads((output/"source-map.json").read_text())["selectedNativeIndices"])
    with np.load(DESTINATION/"model_data.npz", allow_pickle=False) as data:
        rest = to_blender(verona_rest_shape(data["shapes_mean_skin"][selected]))
        basis = data["shapes_matrix_skin"][:,selected]
    actual = np.empty((15375,3), dtype=np.float32)
    maximum = 0.0
    for i, key in enumerate(keys):
        key.data.foreach_get("co", actual.ravel())
        target = rest if i == 0 else rest+basis[int(key.name[4:])][:,[0,2,1]]*[.01,-.01,.01]
        maximum = max(maximum, float(np.max(np.abs(actual-target))))
    if maximum > 2e-7:
        raise ValueError(f"Imported Claire rest/PCA coordinates changed: {maximum}m")
    write_json(output/"roundtrip.json", {
        "passed": True, "meshes":8, "pcaTargets":140,
        "all141NativeKeyMaximumErrorMeters":maximum,
        "bytes":path.stat().st_size, "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "limits":"Claire asset correspondence, not speech/likeness or automatic app reimport.",
    })
    print("CLAIRE_ROUNDTRIP_OK", maximum)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    output = args.output.resolve()
    if not output.is_relative_to(ROOT/".local"/"exports"):
        parser.error("Use a named directory under .local\\exports.")
    global bpy
    import bpy
    sys.path.insert(0,str(ROOT))
    if args.verify:
        verify_export(output)
    else:
        build(output)


if __name__ == "__main__":
    main()
