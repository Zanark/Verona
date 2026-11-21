"""Local Blender authoring kit. Run with the installed Blender, never Maya."""

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
ANCHORS = {
    "UpperLip": [0, 140.65, 3.8], "LowerLip": [0, 139.55, 3.8],
    "Mouth.R": [-2.4, 140.1, 3.6], "Mouth.L": [2.4, 140.1, 3.6],
    "Brow.R": [-3, 149.4, 2.6], "Brow.L": [3, 149.4, 2.6],
    "Chin": [0, 136.1, 1.8],
}
REGIONS = [
    ("Neck", "#FF9F1C"), ("Jaw", "#73D13D"), ("Cheeks", "#EF476F"),
    ("Nose", "#168BFF"), ("Lips", "#D724CF"), ("Eye surrounds", "#00D5D5"),
    ("Forehead", "#FFE044"), ("Temples / rear skull", "#8954E8"),
]


def to_blender(points):
    p = (np.asarray(points, dtype=np.float64) - ORIGIN_CM) * .01
    return p[..., [0, 2, 1]] * [1, -1, 1]


def region_ids(points):
    x, y, z = np.asarray(points).T
    out = np.full(len(x), 7, dtype=np.int32)
    front = z > -.2
    out[y < 135] = 0
    out[(y >= 135) & (y < 140) & front] = 1
    out[(y >= 140) & (y < 148) & front] = 2
    out[(np.abs(x) < 1.5) & (y > 141.5) & (y < 148.8) & (z > 2)] = 3
    out[(np.abs(x) < 3.1) & (y > 138.9) & (y < 141.6) & (z > 2.5)] = 4
    out[(np.abs(np.abs(x) - 3) < 2) & (y > 146) & (y < 149.3) & front] = 5
    out[(y >= 149.3) & (np.abs(x) < 6.5) & front] = 6
    return out


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


def material(name, color, metallic=0, rough=.42, emission=0, unlit=False):
    rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    linear = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Emission Color"].default_value = (*linear, 1)
    shader.inputs["Emission Strength"].default_value = emission
    if unlit:
        nodes = mat.node_tree.nodes
        nodes.clear()
        emit, output = nodes.new("ShaderNodeEmission"), nodes.new("ShaderNodeOutputMaterial")
        emit.inputs["Color"].default_value = (*linear, 1)
        mat.node_tree.links.new(emit.outputs["Emission"], output.inputs["Surface"])
    return mat


def mesh(name, points, faces, mat, collection, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(np.asarray(points).tolist(), [], [list(face) for face in faces])
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    if mat:
        data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def prepare_claire(collection):
    from scripts.fetch_claire_model import ASSETS, DESTINATION, REVISION
    from scripts.fetch_cpu_model import verify
    from verona.appearance import claire_eyes, claire_hair, verona_rest_shape
    from verona.mesh import native_control_mesh, read_mesh

    for name in ("model_data.npz", "claire_geom_v2_topo1.ma"):
        verify(DESTINATION / name, *ASSETS[name])
    with np.load(DESTINATION / "model_data.npz", allow_pickle=False) as data:
        mean = data["shapes_mean_skin"]
        basis = data["shapes_matrix_skin"]
    if mean.shape != (61520, 3) or basis.shape != (140, 61520, 3):
        raise ValueError("Pinned Claire dimensions changed.")
    native, edges, faces = read_mesh(DESTINATION / "claire_geom_v2_topo1.ma")
    if np.max(np.linalg.norm(native - mean, axis=1)) > 1.1:
        raise ValueError("Pinned native/PCA correspondence changed.")
    selected, _, faces = native_control_mesh(mean, edges, faces)
    if len(selected) != 15375 or faces.shape != (30746, 3):
        raise ValueError("Pinned control topology changed.")
    rest_cm = verona_rest_shape(mean[selected])
    rest = to_blender(rest_cm)
    skin = mesh("Claire_Skin_PCA140", rest, faces, MATS["skin"], collection, True)
    skin["source"] = "NVIDIA Claire v2.3.1; Verona rest styling; selected native indices"
    skin["units"] = "meters; source x,-z,y with eye-height origin"
    skin.shape_key_add(name="Basis")
    for i, delta in enumerate(basis[:, selected]):
        key = skin.shape_key_add(name=f"PCA_{i:03d}")
        values = rest + delta[:, [0, 2, 1]] * [.01, -.01, .01]
        key.data.foreach_set("co", values.astype(np.float32).ravel())
        key.slider_min, key.slider_max = -3, 3
    skin["PCA_warning"] = "Modal coefficients, NOT named visemes/bones; all default to zero."
    eyes, eye_faces = claire_eyes()
    for side, start in (("R", 0), ("L", 672)):
        keep = np.all((eye_faces >= start) & (eye_faces < start + 672), axis=1)
        mesh(f"Claire_Eyeball.{side}", to_blender(eyes[start:start + 672]),
             eye_faces[keep] - start, MATS["white"], collection, True)
        x = -2.9485 if side == "R" else 3.1021
        y = 147.5517 if side == "R" else 147.4944
        z = (2.2364 if side == "R" else 2.2830) + 1.45
        iris = cylinder(f"Claire_StaticIris.{side}", [x, y, z], .55, .045,
                        "Z", MATS["iris"], collection)
        iris["cosmetic"] = "Static reference iris, not an exported learned eye joint"
        cylinder(f"Claire_StaticPupil.{side}", [x, y, z + .035], .25, .04,
                 "Z", MATS["dark"], collection)
    hair, _, hair_faces = claire_hair()
    mesh("Claire_Waves_STATIC", to_blender(hair), hair_faces, MATS["hair"], collection, True)
    points = {}
    for name, target in ANCHORS.items():
        index = int(np.argmin(np.sum((rest_cm - target) ** 2, axis=1)))
        points[name] = {"selectedIndex": index, "nativeIndex": int(selected[index]),
                        "sourceCm": rest_cm[index].tolist(), "blenderMeters": rest[index].tolist()}
    return skin, rest_cm, faces, {
        "revision": REVISION, "inputs": {n: {"bytes": ASSETS[n][0], "sha256": ASSETS[n][1]}
                                        for n in ("model_data.npz", "claire_geom_v2_topo1.ma")},
        "selectedNativeIndices": selected.tolist(), "anchors": points,
        "sourceOriginCm": ORIGIN_CM.tolist(), "blenderTransform": "0.01 * (x, -z, y-eyeHeight)",
        "glTFTransform": "0.01 * (x, y-eyeHeight, z)",
        "skinVertices": len(rest), "skinTriangles": len(faces), "pcaTargets": 140,
    }


def cylinder(name, center, radius, depth, axis, mat, collection):
    points = []
    for end in (-.5, .5):
        for i in range(32):
            a = i * 2 * math.pi / 32
            offset = [depth * end, radius * math.cos(a), radius * math.sin(a)]
            if axis == "Z":
                offset = [offset[1], offset[2], offset[0]]
            elif axis == "Y":
                offset = [offset[1], offset[0], offset[2]]
            points.append(np.asarray(center) + offset)
    faces = [list(range(31, -1, -1)), list(range(32, 64))]
    faces += [[i, (i + 1) % 32, (i + 1) % 32 + 32, i + 32] for i in range(32)]
    obj = mesh(name, to_blender(points), faces, mat, collection)
    recalc(obj)
    return obj


def recalc(obj):
    import bmesh
    data = bmesh.new()
    data.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(data, faces=list(data.faces))
    data.to_mesh(obj.data)
    data.free()


def armor_panel(name, outline, mat, collection, depth=.7, ridge=.08, bone="Head", category="helmet"):
    outline = [list(p) for p in outline]
    area = sum(p[0] * q[1] - q[0] * p[1]
               for p, q in zip(outline, outline[1:] + outline[:1]))
    if area < 0:
        outline.reverse()
    center = np.mean(outline, axis=0)
    n = len(outline)
    points = outline + [(np.asarray(p) - [0, 0, depth]).tolist() for p in outline]
    points += [(center + [0, 0, ridge]).tolist()]
    faces = [[2 * n, i, (i + 1) % n] for i in range(n)]
    faces += [list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, i + n, (i + 1) % n + n, (i + 1) % n] for i in range(n)]
    obj = mesh(name, to_blender(points), faces, mat, collection)
    recalc(obj)
    obj["armorRegion"], obj["rigidBone"] = category, bone
    bevel = obj.modifiers.new("Small manufactured edge", "BEVEL")
    bevel.width, bevel.segments = .00065, 2
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    return obj


def build_robot(collection):
    def panel(name, pts, material_key="blue", **kw):
        return armor_panel(name, pts, MATS[material_key], collection, **kw)

    points, faces = [], []
    heights = [135, 141, 148, 155, 160, 163]
    widths = [4.5, 7.3, 8.5, 8.7, 6.7, 2]
    depths = [4.5, 7.5, 9.3, 9.5, 7.4, 2]
    for row, y in enumerate(heights):
        for i in range(32):
            a = 2 * math.pi * i / 32
            points.append([widths[row] * math.sin(a), y, -4.4 + depths[row] * math.cos(a)])
    for row in range(len(heights) - 1):
        for i in range(32):
            angle = 2 * math.pi * (i + .5) / 32
            if row < 3 and (angle < 1.0 or angle > 2 * math.pi - 1.0):
                continue
            a, b = row * 32 + i, row * 32 + (i + 1) % 32
            faces.append([a, b, b + 32, a + 32])
    faces.append(list(range(160, 192)))
    shell = mesh("HELMET_01_WrappedCrown", to_blender(points), faces, MATS["blue"], collection)
    recalc(shell)
    shell["armorRegion"], shell["rigidBone"] = "helmet", "Head"
    for side, suffix in ((1, "L"), (-1, "R")):
        def mirrored(name, pts, material_key="blue", **kw):
            return panel(f"{name}.{suffix}", [[side * x, y, z] for x, y, z in pts],
                         material_key, **kw)
        mirrored("HELMET_02_Forehead", [[1.1,150.5,5],[6.4,151,3.8],[7.5,156,1.9],
                                       [4.8,162,1.6],[1.3,160.5,3.6]], ridge=.18)
        mirrored("HELMET_03_Temple", [[6.2,151.2,3.7],[8.7,153,1.6],[8.4,144.1,2.1],
                                     [6,140,4.7]], depth=2)
        mirrored("HELMET_04_Antenna", [[7.4,151,0],[9.4,151,-.9],[9.0,170,-2.4],
                                      [7.6,168.5,-1.2]], depth=1.5, ridge=.18)
        mirrored("HELMET_05_AntennaChannel", [[8.0,153,.3],[8.5,153,-.05],
                                              [8.4,167,-1.1],[8.05,166.5,-.7]],
                 "silver", depth=.18)
        mirrored("HELMET_06_CheekGuard", [[6.1,146,4.4],[8.1,147,2.5],[7.0,137.4,3.3],
                                          [4.1,134.5,5.1],[4.4,139.5,5.5]], depth=1)
        mirrored("BROW_01_HeavyRidge", [[.7,149.2,5.6],[5.8,150.0,4.7],[6.4,149,4.8],
                                         [1,148.4,5.8]], bone=f"Brow.{suffix}", ridge=.15,
                 category="brows")
        mirrored("OPTIC_01_DarkSocket", [[.95,148.4,5.4],[6,149,4.3],[5.9,146.6,4.8],
                                         [1.4,146.6,5.6]], "dark", depth=.5, category="optics")
        mirrored("OPTIC_02_CyanLens", [[1.35,148.0,5.55],[5.6,148.55,4.65],
                                       [5.35,147.2,5.02],[1.65,147.1,5.7]],
                 "cyan", depth=.12, category="optics")
        mirrored("FACE_01_UnderEyeRail", [[1.3,146.5,5.6],[5.8,146.8,4.8],
                                           [5.1,145.7,5.4],[2,145.3,6.2]],
                 "silver", category="faceplate")
        mirrored("FACE_02_CheekPillar", [[4.7,145.2,5.6],[6.1,145.6,4.7],
                                          [5.8,140.4,5.3],[4,140.4,6.5]], "silver",
                 category="faceplate")
        for i in range(4):
            y = 144.1 - i * .85
            mirrored(f"VENT_0{i+1}_CheekRecess", [[5.0,y,5.9],[5.7,y+.25,5.5],
                                                  [5.65,y-.07,5.65],[4.9,y-.36,6.0]],
                     "dark", depth=.1, category="vents")
        for name, r, depth, x, key in [
            ("EAR_01_Housing", 2.5, 1.8, 8.7, "blue"),
            ("EAR_02_SteelRing", 1.95, 1.9, 8.9, "silver"),
            ("EAR_03_Hub", 1.48, 2.0, 9.0, "dark"),
            ("EAR_04_Core", .82, 2.1, 9.1, "blue"),
        ]:
            obj = cylinder(f"{name}.{suffix}", [side*x,149,-3.3], r, depth, "X", MATS[key], collection)
            obj["armorRegion"], obj["rigidBone"] = "ears", "Head"
        mirrored("JAW_02_SideRail", [[3.8,140,6],[5.8,140,4.8],[4.1,134.2,4.7],
                                      [2.6,133.7,6]], "blue", bone="Jaw", category="jaw")
    panel("HELMET_07_CentralCrest", [[-1.5,150,5.5],[1.5,150,5.5],[1.8,161,4.4],
                                      [0,164,2.7],[-1.8,161,4.4]], ridge=.22, depth=1)
    panel("HELMET_08_CrestInset", [[-.45,153,5.86],[.45,153,5.86],[.65,160.3,4.95],
                                     [0,161.4,4.25],[-.65,160.3,4.95]], "dark", depth=.1)
    panel("FACE_03_Bridge", [[-.8,149,5.9],[.8,149,5.9],[1.15,145,7.0],
                              [0,144.3,7.6],[-1.15,145,7.0]], "silver", ridge=.18, category="faceplate")
    panel("FACE_04_UpperMask", [[-3.8,145.2,6.3],[0,144.5,7.55],[3.8,145.2,6.3],
                                 [4.4,140.5,6.4],[-4.4,140.5,6.4]], "silver",
          ridge=.5, depth=.9, category="faceplate")
    panel("JAW_01_LowerFaceplate", [[-4.4,140.12,6.45],[4.4,140.12,6.45],
                                     [3.3,135.2,6.1],[0,133.6,6.5],[-3.3,135.2,6.1]],
          "silver", ridge=.7, bone="Jaw", depth=1, category="jaw")
    for side in (-1, 1):
        for i in range(3):
            x = side * (1.1 + i * .88)
            panel(f"MASK_Seam_{side}_{i}", [[x-.055,143.7,6.85],[x+.055,143.7,6.85],
                                             [x+.055,141,7.0],[x-.055,141,7.0]],
                  "dark", depth=.035, category="faceplate")
    cylinder("NECK_01_Core", [0,130,-4], 3.1, 7, "Y", MATS["dark"], collection)
    for i in range(4):
        panel(f"NECK_02_CollarRib_{i}", [[-3.6,132.5-i*1.35,-.3],[3.6,132.5-i*1.35,-.3],
                                         [3.3,131.7-i*1.35,.2],[-3.3,131.7-i*1.35,.2]],
              "silver", depth=4, category="neck")
    for obj in collection.objects:
        if obj.type == "MESH":
            if "rigidBone" not in obj:
                obj["rigidBone"], obj["armorRegion"] = "Head", "neck"
    return create_rig(collection)


def create_rig(collection):
    data = bpy.data.armatures.new("Optimus_Inspired_MechanicalRig")
    rig = bpy.data.objects.new("RIG_Head_Jaw_Brows", data)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail in [
        ("Head", [0,148,-3], [0,158,-3]),
        ("Jaw", [0,140,-2], [0,136,2]),
        ("Brow.L", [3,149,4], [5,149,4]),
        ("Brow.R", [-3,149,4], [-5,149,4]),
    ]:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = to_blender(head), to_blender(tail)
        if name != "Head":
            bone.parent = data.edit_bones["Head"]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    rig.show_in_front = True
    rig["scope"] = "Rigid manual authoring/demo rig; NOT integrated Claire speech transfer."
    for obj in list(collection.objects):
        if obj.type != "MESH":
            continue
        group = obj.vertex_groups.new(name=obj["rigidBone"])
        group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
        modifier = obj.modifiers.new("Rigid mechanical attachment", "ARMATURE")
        modifier.object = rig
        obj.parent = rig
    jaw = rig.pose.bones["Jaw"]
    jaw.rotation_mode = "XYZ"
    for frame, angle in ((1,0),(25,math.radians(9)),(49,0)):
        jaw.rotation_euler[0] = angle
        jaw.keyframe_insert(data_path="rotation_euler", frame=frame, group="Jaw")
    rig.animation_data.action.name = "MANUAL_JawInspection_NOT_Speech"
    bpy.context.scene.frame_set(1)
    return rig


def setup_scene():
    from mathutils import Vector
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device, scene.cycles.samples = "CPU", 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode, scene.render.threads = "FIXED", 2
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps, scene.frame_end = 24, 49
    scene.world.color = (.14, .14, .14)
    scene.view_settings.view_transform = "AgX"
    scene.render.use_file_extension = True
    for name, loc, energy, size in [
        ("LIGHT_Key", (-.5,-.65,.65), 25, .6),
        ("LIGHT_Fill", (.5,-.35,.2), 10, .5),
        ("LIGHT_Rim", (.15,.45,.55), 35, .4),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0,0,.01)) - obj.location).to_track_quat("-Z","Y").to_euler()
    data = bpy.data.cameras.new("CAMERA_Orthographic")
    camera = bpy.data.objects.new("CAMERA_Orthographic", data)
    scene.collection.objects.link(camera)
    data.type, data.ortho_scale, data.lens = "ORTHO", .53, 65
    scene.camera = camera
    return scene


def set_camera(position, target=(0,0,.005), scale=.53):
    from mathutils import Vector
    camera = bpy.context.scene.camera
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale = scale
    bpy.context.view_layer.update()


def export_glb(path, objects, animation=False):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_morph=True, export_morph_normal=False, export_animations=animation,
        export_extras=True, export_yup=True, export_skins=True,
        export_cameras=False, export_lights=False,
    )
    glb_document(path)
    bpy.ops.object.select_all(action="DESELECT")


def build(output):
    output.mkdir(parents=True, exist_ok=False)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    global MATS
    MATS = {
        "skin": material("Claire / neutral clay", "#C6B3A4"),
        "white": material("Claire / static eye whites", "#E1E9E8", rough=.22),
        "iris": material("Claire / static hazel iris", "#667D3A"),
        "hair": material("Claire / original espresso waves", "#302422"),
        "blue": material("Armor / cobalt enamel", "#164DBB", .72, .29),
        "silver": material("Armor / brushed silver", "#C1CCD5", .85, .32),
        "dark": material("Armor / graphite recess", "#162332", .5, .44),
        "cyan": material("Armor / cyan optics", "#00DFFF", .3, .2, 2),
    }
    for name in ("01_CLAIRE_REFERENCE", "02_OPTIMUS_INSPIRED", "03_REGION_GUIDE"):
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    claire, robot, guides = [bpy.data.collections[n] for n in
                              ("01_CLAIRE_REFERENCE","02_OPTIMUS_INSPIRED","03_REGION_GUIDE")]
    skin, rest, faces, source = prepare_claire(claire)
    region = mesh("GUIDE_SkinRegions_NOT_AnatomicalSegmentation", to_blender(rest),
                  faces, None, guides, True)
    for name, color in REGIONS:
        region.data.materials.append(material("Guide / "+name, color, unlit=True))
    ids = region_ids(rest)
    for polygon, face in zip(region.data.polygons, faces):
        polygon.material_index = int(np.bincount(ids[face], minlength=8).argmax())
    rig = build_robot(robot)
    scene = setup_scene()
    set_camera((.6,-.85,.22))
    guides.hide_render, guides.hide_viewport = True, True
    export_glb(output/"Claire.glb", list(claire.objects))
    export_glb(output/"Optimus-inspired.glb", list(robot.objects), True)
    source["robotParts"] = [{"name": o.name, "region": o.get("armorRegion"),
                             "bone": o.get("rigidBone"), "vertices": len(o.data.vertices)}
                            for o in robot.objects if o.type == "MESH"]
    source["blenderVersion"], source["numpyVersion"] = bpy.app.version_string, np.__version__
    source["limitations"] = [
        "Claire is the existing selected native control skin, not all61520 source vertices.",
        "PCA_000..139 are modal coefficients, not phonemes or semantic shape names.",
        "No neural network, sound, teeth/tongue rig, live speech adapter or automatic reimport.",
        "Static original hair/eyes; clay/PBR materials do not reproduce the WebGL shader.",
        "Robot is an original Optimus-inspired editable study, not an official licensed character asset.",
        "Manual jaw-inspection animation is not speech or human likeness approval.",
    ]
    write_json(output/"source-map.json", source)
    (output/"ASSET-RIGHTS.md").write_text((ROOT/"THIRD_PARTY.md").read_text(encoding="utf-8"),
                                       encoding="utf-8")
    claire.hide_render, claire.hide_viewport = True, True
    scene["workshop"] = "Toggle collections01/02; guide03 is false-color reference only."
    scene["runtime"] = "No application integration. Keep the two GLBs aligned at their shared origin."
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_distance = .65
                area.spaces.active.region_3d.view_location = (0,0,.005)
                area.spaces.active.region_3d.view_rotation = scene.camera.rotation_euler.to_quaternion()
                area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(output/"Claire-Optimus-Workshop.blend"))
    write_json(output/"build.json", {
        "blender": bpy.app.version_string, "claireSkinVertices": len(rest),
        "claireTriangles": len(faces), "pcaShapeKeys":140,
        "robotMeshes":len(source["robotParts"]), "rigBones":list(rig.data.bones.keys()),
        "runtimeTouched":False, "inferenceOrSpeechRun":False,
        "files":{p.name:{"bytes":p.stat().st_size,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}
                 for p in output.iterdir() if p.suffix in (".glb",".blend")},
    })
    print("WORKSHOP_BUILD_OK", output)


def render(output, preview):
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=str(output/"Claire-Optimus-Workshop.blend"))
    scene = bpy.context.scene
    claire, robot, guides = [bpy.data.collections[n] for n in
                              ("01_CLAIRE_REFERENCE","02_OPTIMUS_INSPIRED","03_REGION_GUIDE")]
    for c in (claire,robot,guides):
        c.hide_viewport = False
    image_dir = output/("preview" if preview else "images")
    image_dir.mkdir(exist_ok=False)
    shots = [
        ("claire-front","claire",(0,-1,.005),False),
        ("claire-profile","claire",(1,0,.005),False),
        ("claire-three-quarter","claire",(.6,-.85,.22),True),
        ("claire-regions","regions",(0,-1,.005),False),
        ("robot-front","robot",(0,-1,.005),False),
        ("robot-three-quarter","robot",(.6,-.85,.22),False),
        ("robot-profile","robot",(1,0,.005),False),
        ("robot-back","robot",(0,1,.005),False),
        ("robot-exploded","exploded",(.6,-.85,.22),False),
        ("robot-jaw-open","jaw",(0,-1,.005),False),
        ("robot-face-detail","detail",(0,-1,-.025),False),
        ("claire-wire","wire",(0,-1,.005),False),
    ]
    if preview:
        shots = [shots[i] for i in (0,3,4,5)]
    manifest = []
    for name, mode, camera, hair in shots:
        claire.hide_render = mode not in ("claire","wire")
        robot.hide_render = mode not in ("robot","exploded","jaw","detail")
        guides.hide_render = mode != "regions"
        for obj in claire.objects:
            obj.hide_render = obj.name.startswith("Claire_Waves") and not hair
        scene.frame_set(25 if mode == "jaw" else 1)
        scene.view_settings.view_transform = "Standard" if mode == "regions" else "AgX"
        displaced = []
        if mode == "exploded":
            for obj in robot.objects:
                if obj.type != "MESH":
                    continue
                region = obj["armorRegion"]
                shift = {
                    "helmet": (0,.025,.065), "ears": (.065 if obj.name.endswith(".L") else -.065,0,0),
                    "optics":(0,-.07,0), "brows":(0,-.055,.025), "faceplate":(0,-.10,0),
                    "jaw":(0,-.085,-.055), "neck":(0,0,-.055), "vents":(0,-.10,0),
                }[region]
                obj.location += Vector(shift)
                displaced.append((obj,Vector(shift)))
        wire = None
        if mode == "wire":
            skin = bpy.data.objects["Claire_Skin_PCA140"]
            wire = skin.modifiers.new("Inspection topology", "WIREFRAME")
            wire.thickness, wire.use_replace = .00016, True
        set_camera(camera, (0,0,-.025) if mode == "detail" else (0,0,.005),
                   .26 if mode == "detail" else (.68 if mode == "exploded" else .53))
        scene.render.filepath = str(image_dir/(name+".png"))
        bpy.ops.render.render(write_still=True)
        projected = {}
        for key, point in {
            "helmet":[0,156,4.7], "optics":[3,147.8,5.5], "faceplate":[0,143,7.3],
            "jaw":[0,136.7,7.0], "ears":[9.1,149,-3.3], "neck":[0,130,0],
            "brows":[-3,149.2,5.1], "vents":[-5.3,142.8,5.9],
        }.items():
            p = world_to_camera_view(scene, scene.camera, Vector(to_blender(point)))
            projected[key] = [p.x*1000,(1-p.y)*1100]
        manifest.append({"id":name,"file":str(Path(image_dir.name)/(name+".png")),
                         "calloutPixels":projected,"cameraMeters":camera})
        for obj, shift in displaced:
            obj.location -= shift
        if wire:
            skin.modifiers.remove(wire)
    write_json(output/("preview.json" if preview else "renders.json"), manifest)
    print("WORKSHOP_RENDER_OK",len(manifest))


def verify_exports(output):
    checks = []
    for filename in ("Claire.glb","Optimus-inspired.glb"):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(output/filename))
        doc = glb_document(output/filename)
        expected = {n["name"] for n in doc["nodes"] if "mesh" in n}
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name in expected]
        if {o.name for o in meshes} != expected:
            raise ValueError("GLB import lost or renamed asset meshes.")
        widgets = {b.custom_shape for o in bpy.context.scene.objects if o.type == "ARMATURE"
                   for b in o.pose.bones if b.custom_shape}
        extras = [o for o in bpy.context.scene.objects
                  if o.type == "MESH" and o.name not in expected]
        if any(o not in widgets for o in extras):
            raise ValueError("Unexpected non-asset/non-bone-widget imported geometry.")
        if any(not all(math.isfinite(v) for v in vertex.co)
               for obj in meshes for vertex in obj.data.vertices):
            raise ValueError("Imported nonfinite geometry.")
        detail = {}
        if filename == "Claire.glb":
            from scripts.fetch_claire_model import ASSETS, DESTINATION
            from scripts.fetch_cpu_model import verify
            from verona.appearance import verona_rest_shape
            skin = next(o for o in meshes if o.name.startswith("Claire_Skin_PCA140"))
            if len(skin.data.vertices) != 15375 or len(skin.data.shape_keys.key_blocks) != 141:
                raise ValueError("Claire reimport changed vertex/shape-key counts.")
            if {k.name for k in skin.data.shape_keys.key_blocks[1:]} != {f"PCA_{i:03d}" for i in range(140)}:
                raise ValueError("Claire modal target names lost.")
            verify(DESTINATION/"model_data.npz", *ASSETS["model_data.npz"])
            selected = np.asarray(json.loads((output/"source-map.json").read_text())["selectedNativeIndices"])
            with np.load(DESTINATION/"model_data.npz",allow_pickle=False) as data:
                rest = to_blender(verona_rest_shape(data["shapes_mean_skin"][selected]))
                basis = data["shapes_matrix_skin"][:,selected]
            actual = np.empty((15375,3),dtype=np.float32)
            maximum = 0.0
            for i,key in enumerate(skin.data.shape_keys.key_blocks):
                key.data.foreach_get("co",actual.ravel())
                target = rest if i == 0 else rest + basis[int(key.name[4:])][:,[0,2,1]]*[.01,-.01,.01]
                maximum = max(maximum,float(np.max(np.abs(actual-target))))
            if maximum > 2e-7:
                raise ValueError(f"Imported Claire rest/PCA coordinates changed: {maximum}m")
            detail["all141NativeKeyMaximumErrorMeters"] = maximum
        else:
            rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
            if len(rigs) != 1 or len(rigs[0].data.bones) != 4 or not doc.get("animations"):
                raise ValueError("Mechanical rig/demo missing from imported GLB.")
            missing = [o.name for o in meshes if not o.vertex_groups
                       or not any(m.type == "ARMATURE" for m in o.modifiers)]
            if missing:
                raise ValueError(f"Imported meshes without rigid bone attachments: {missing}")
            def sample(name, frame):
                bpy.context.scene.frame_set(frame)
                bpy.context.view_layer.update()
                obj = bpy.data.objects[name].evaluated_get(bpy.context.evaluated_depsgraph_get())
                return np.asarray([obj.matrix_world @ v.co for v in obj.data.vertices])
            jaw_delta = float(np.max(np.linalg.norm(
                sample("JAW_01_LowerFaceplate",25)-sample("JAW_01_LowerFaceplate",1),axis=1)))
            helmet_delta = float(np.max(np.abs(
                sample("HELMET_01_WrappedCrown",25)-sample("HELMET_01_WrappedCrown",1))))
            if jaw_delta < .001 or helmet_delta > 1e-6:
                raise ValueError("Imported manual animation lost independent rigid jaw behavior.")
            detail.update(jawMotionMeters=jaw_delta,helmetMotionMeters=helmet_delta)
        checks.append({"file":filename,"meshes":len(meshes),"skins":len(doc.get("skins",[])),
                       "animations":len(doc.get("animations",[])),"bytes":(output/filename).stat().st_size,
                       "importerBoneWidgets":[o.name for o in extras],**detail})
    write_json(output/"roundtrip.json",{"freshFactoryImports":checks,"passed":True,
                                      "limits":"Numeric asset and manual rig checks; not human likeness or app speech."})
    print("WORKSHOP_ROUNDTRIP_OK",json.dumps(checks))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--render",action="store_true")
    mode.add_argument("--preview",action="store_true")
    mode.add_argument("--verify",action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    output = args.output.resolve()
    if not output.is_relative_to(ROOT/".local"/"exports"):
        parser.error("Use a new named directory under .local\\exports.")
    global bpy
    import bpy
    sys.path.insert(0,str(ROOT))
    if args.render or args.preview:
        render(output,args.preview)
    elif args.verify:
        verify_exports(output)
    else:
        build(output)


if __name__ == "__main__":
    main()
