"""Offline Blender authoring/export; never imported by the application.

Run with portable Blender in background/factory/offline/no-autoexec mode and
fresh BLENDER_USER_CONFIG/SCRIPTS/EXTENSIONS/DATAFILES directories. Set the
working directory inside that owned profile to contain early add-on logs.
"""

import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import sys


MPFB_COMMIT = "d0a32e57a7f915cb2f2b95410e2117648c7bbb7e"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mpfb-source", type=Path, required=True)
    parser.add_argument("--faceunits", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    import addon_utils
    import bpy
    import numpy as np

    profile = args.profile.resolve(strict=True)
    if not Path.cwd().resolve().is_relative_to(profile):
        raise RuntimeError("Run from inside the owned profile to contain MPFB bootstrap logs.")
    for key in ("CONFIG", "SCRIPTS", "EXTENSIONS", "DATAFILES"):
        value = Path(os.environ["BLENDER_USER_" + key]).resolve(strict=True)
        if not value.is_relative_to(profile):
            raise RuntimeError("Blender requires an isolated, owned study profile.")
    if bpy.app.online_access or bpy.app.autoexec_fail:
        raise RuntimeError("Use offline mode and a clean, trusted factory scene.")
    if args.output.exists():
        raise FileExistsError("Use a new output directory; keep earlier receipts.")
    args.output.mkdir(parents=True)

    source = args.mpfb_source.resolve(strict=True)
    pack = json.loads((args.faceunits / "packs" / "faceunits01.json").read_text())
    target_paths = sorted((args.faceunits / "targets" / "faceunits").glob("*.target"))
    if len(target_paths) != 52 or set(pack) != {p.stem for p in target_paths}:
        raise ValueError("Expected the complete, individually licensed 52-target pack.")
    if any(v["license"] != "CC0" or v["author"] != "Mika Suominen" for v in pack.values()):
        raise ValueError("Unreviewed faceunit rights; stop before importing assets.")

    bpy.context.preferences.extensions.repos.new(
        name="Verona offline study", module="veronastudy",
        custom_directory=str(source.parent))
    name = "bl_ext.veronastudy.mpfb"
    module = addon_utils.enable(name, default_set=True, persistent=False)
    if module is None or module.VERSION != (2, 0, 18):
        raise RuntimeError("Pinned MPFB 2.0.18 did not initialize.")
    human_service = importlib.import_module(name + ".services.humanservice").HumanService
    target_service = importlib.import_module(name + ".services.targetservice").TargetService
    object_service = importlib.import_module(name + ".services.objectservice").ObjectService
    macro = target_service.get_default_macro_info_dict()
    macro.update(gender=0.0, age=0.5)
    macro["race"] = {key: 1 / 3 for key in macro["race"]}
    stack = target_service.calculate_target_stack_from_macro_info_dict(macro)
    gender_components = target_service._interpolate_macro_components("gender", 0.0)
    if dict(gender_components).get("female", 0) < .98:
        raise RuntimeError("The actual macro stack did not select the female endpoint.")

    human = human_service.create_human(
        mask_helpers=False, feet_on_ground=False, scale=.1, macro_detail_dict=macro)
    sculpt = {"head/head-oval.target.gz": .22,
              "chin/chin-bones-decr.target.gz": .20,
              "chin/chin-width-decr.target.gz": .18}
    for relative, weight in sculpt.items():
        target_service.load_target(human, str(source / "data" / "targets" / relative),
                                   weight=weight, name="study-" + Path(relative).name)
    groups = object_service.get_base_mesh_vertex_group_definition()
    graph = bpy.context.evaluated_depsgraph_get()

    def positions():
        graph.update()
        evaluated = human.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            result = np.empty((len(mesh.vertices), 3), dtype=np.float64)
            mesh.vertices.foreach_get("co", result.ravel())
        finally:
            evaluated.to_mesh_clear()
        if not np.isfinite(result).all():
            raise ValueError("Nonfinite authored mesh.")
        return result

    rest = positions()
    neck = rest[groups["joint-neck"]].mean(axis=0)
    body = set(groups["body"])
    polygons = [list(p.vertices) for p in human.data.polygons
                if all(i in body and rest[i, 2] > neck[2] - .035 for i in p.vertices)]
    indices = sorted({i for face in polygons for i in face})
    remap = {old: new for new, old in enumerate(indices)}
    polygons = [[remap[i] for i in face] for face in polygons]
    if len(indices) < 500 or len(indices) >= len(body):
        raise ValueError("Unexpected anatomical head extraction.")

    def coordinates(value):
        return np.round(value[..., [0, 2, 1]] * [100, 100, -100], 6)

    basis = {}
    effects = {}
    for path in target_paths:
        key = target_service.load_target(human, str(path), weight=1, name="unit-" + path.stem)
        posed = positions()
        delta = coordinates(posed[indices] - rest[indices])
        basis[path.stem] = delta.ravel().tolist()
        effects[path.stem] = float(np.max(np.linalg.norm(delta, axis=1)))
        key.value = 0
    eye_centers = [coordinates(rest[groups[group]].mean(axis=0)).tolist()
                   for group in ("joint-l-eye", "joint-r-eye")]
    eye_radii = [(np.ptp(coordinates(rest[groups[group]]), axis=0) / 2).tolist()
                 for group in ("helper-l-eye", "helper-r-eye")]
    model = {
        "revision": "mpfb-female-head-1", "units": "centimeters",
        "sourceCommit": MPFB_COMMIT, "macro": macro,
        "sculptTargets": sculpt, "genderComponents": gender_components,
        "rest": coordinates(rest[indices]).ravel().tolist(),
        "polygons": polygons, "basis": basis, "eyeCenters": eye_centers,
        "eyeRadii": eye_radii,
        "sourceIndices": indices,
        "limits": "Offline candidate. Native faceunit deltas, not Claire/PCA retargeting. "
                  "No hair, independent eye joints, teeth/tongue rig or accepted contacts.",
    }
    model_json = json.dumps(model, separators=(",", ":"))
    (args.output / "head.json").write_text(model_json)
    template = Path(__file__).with_name("mpfb_head_viewer.html").read_text()
    viewer = template.replace("__MODEL__", model_json.replace("<", "\\u003c"))
    for marker, filename in (("__POSES__", "mpfb_face_poses.mjs"),
                             ("__RENDERER__", "mpfb_head_renderer.mjs")):
        viewer = viewer.replace(marker, Path(__file__).with_name(filename).read_text())
    (args.output / "viewer.html").write_text(viewer, encoding="utf-8")
    files = [source / "__init__.py", source / "data" / "3dobjs" / "base.obj",
             source / "data" / "targets" / "macrodetails" / "macro.json",
             args.faceunits / "packs" / "faceunits01.json", *target_paths]
    files.extend(source / "data" / "targets" / p for p in sculpt)
    files.extend(source / "data" / "targets" / (p + ".target.gz") for p, _ in stack)
    (args.output / "authoring.json").write_text(json.dumps({
        "blender": bpy.app.version_string, "mpfbVersion": module.VERSION,
        "mpfbCommit": MPFB_COMMIT, "onlineAccess": bpy.app.online_access,
        "macro": macro, "appliedMacroStack": stack, "genderComponents": gender_components,
        "vertices": len(indices), "polygons": len(polygons),
        "faceunitMaxDisplacementCm": effects, "eyeCenters": eye_centers,
        "sourceSha256": {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        "modelSha256": hashlib.sha256((args.output / "head.json").read_bytes()).hexdigest(),
        "limits": model["limits"],
    }, indent=2))
    print(json.dumps({"vertices": len(indices), "polygons": len(polygons),
                      "faceunits": len(basis), "output": str(args.output)}))


if __name__ == "__main__":
    main()
