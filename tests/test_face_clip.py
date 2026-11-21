import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import wave
import weakref
import xml.etree.ElementTree as ET

from verona import speech
from verona.appearance import claire_eyes, claire_hair, verona_rest_shape
from verona.engine import FaceEngine, expression_condition, pack_positions
from verona.mesh import claire_topology, native_control_mesh, read_mesh, reduced_mesh

import numpy as np


SCENE = """
createNode mesh -n "c_headWatertight_hiShape" -p "head";
setAttr ".vt[0:5]" 0 0 0 1 0 0 1 1 0 0 1 0 2 0 0 2 1 0;
setAttr ".ed[0:6]" 0 1 0 1 2 0 2 3 0 3 0 0 1 4 0 4 5 0 5 2 0;
setAttr ".fc[0:0]" -type "polyFaces" f 4 0 1 2 3;
setAttr ".fc[1:1]" f 4 4 5 6 -2;
createNode transform -n "unrelated";
"""


class MeshTests(unittest.TestCase):
    def test_startup_releases_full_source_pca_before_creating_inference_session(self):
        mean = np.zeros((61520, 3), dtype=np.float32)
        mean[:, 0] = np.linspace(-1, 1, len(mean))
        references = {}

        class Archive:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def __getitem__(self, key):
                if key == "shapes_mean_skin":
                    return mean
                source = np.broadcast_to(np.zeros(1, dtype=np.float32), (140, 61520, 3))
                references["source"] = weakref.ref(source)
                return source

        def create_session(path):
            self.assertIsNone(references["source"]())
            return object()

        empty = np.empty((0, 3), dtype="<u4")
        with (patch("verona.engine.verify"),
              patch("verona.engine.np.load", return_value=Archive()),
              patch("verona.engine.claire_topology", return_value=(
                  np.arange(15375), np.zeros((30759, 2), dtype="<u4"),
                  np.zeros((30746, 3), dtype="<u4"), 0)),
              patch("verona.engine.conditioning", return_value=np.zeros((1, 1, 26))),
              patch("verona.engine.claire_hair", return_value=(np.zeros((1, 3)), empty, empty)),
              patch("verona.engine.claire_eyes", return_value=(np.zeros((1, 3)), empty)),
              patch("verona.engine.create_cpu_session", side_effect=create_session)):
            engine = FaceEngine()
        self.assertEqual(engine.basis.shape, (140, 15375, 3))

    def test_rest_sculpt_changes_contour_but_preserves_lips_eye_centers_and_back(self):
        rest = np.array([[6, 138, 2], [4, 144, 3], [0, 140.15, 4], [2, 140, 3],
                         [3, 147.55, 3], [-3, 147.55, 3], [5, 144, -8]], dtype=np.float32)
        styled = verona_rest_shape(rest)
        self.assertLess(float(styled[0, 0]), float(rest[0, 0]) - .5)
        self.assertGreater(float(styled[0, 0] / rest[0, 0]), .86)
        self.assertGreater(float(styled[1, 2]), float(rest[1, 2]) + .25)
        np.testing.assert_array_equal(styled[2:], rest[2:])
        self.assertLess(float(np.max(np.linalg.norm(styled - rest, axis=1))), 1.3)
        chin = np.array([[0, 135.9, 3]], dtype=np.float32)
        self.assertGreater(float(verona_rest_shape(chin)[0, 1]), float(chin[0, 1]) + .3)

    def test_reference_lids_open_locally_without_translating_the_eye_center(self):
        rest = np.array([[3.02, 147.95, 3.3], [3.02, 147.15, 3.3],
                         [3.02, 147.55, 3.3], [3.02, 147.95, 1.0]], dtype=np.float32)
        delta = verona_rest_shape(rest) - rest
        self.assertGreater(float(delta[0, 1]), .15)
        self.assertLess(float(delta[1, 1]), -.15)
        self.assertAlmostEqual(float(delta[0, 1]), -float(delta[1, 1]), places=3)
        np.testing.assert_array_equal(delta[:, [0, 2]], 0)
        np.testing.assert_array_equal(delta[2:], 0)

    def test_wavy_locks_have_alternating_silhouette_and_bounded_connected_geometry(self):
        vertices, edges, triangles = claire_hair()
        self.assertTrue(np.isfinite(vertices).all())
        self.assertLess(len(vertices), 10000)
        self.assertTrue(np.all(edges < len(vertices)))
        self.assertTrue(np.all(triangles < len(vertices)))
        self.assertGreater(float(vertices[:, 1].min()), 128)
        self.assertLess(float(vertices[:, 1].min()), 134)
        self.assertLess(float(np.abs(vertices[:, 0]).max()), 12)
        hairline = vertices[(18 - 1) * 72:18 * 72]
        curvature = np.roll(hairline, 1, axis=0) + np.roll(hairline, -1, axis=0) - 2 * hairline
        self.assertLess(float(np.linalg.norm(curvature, axis=1).max()), .35)
        lock = vertices[72 * 18:72 * 18 + 38 * 8].reshape(38, 8, 3).mean(axis=1)
        lateral = lock @ np.array([np.cos(.86), 0, -np.sin(.86)])
        gradient = np.diff(lateral[12:])
        self.assertGreaterEqual(int(np.count_nonzero(gradient[1:] * gradient[:-1] < 0)), 2)
        self.assertGreater(float(np.ptp(lateral[12:])), .9)

    def test_native_control_mesh_retains_original_cube_loops_and_winding(self):
        vertices = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
        faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
                 [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]]
        midpoints, quads = {}, []
        for face in faces:
            mids = []
            for a, b in zip(face, face[1:] + face[:1]):
                key = tuple(sorted((a, b)))
                if key not in midpoints:
                    midpoints[key] = len(vertices)
                    vertices.append(((np.array(vertices[a]) + vertices[b]) / 2).tolist())
                mids.append(midpoints[key])
            center = len(vertices)
            vertices.append(np.mean(np.asarray(vertices)[face], axis=0).tolist())
            quads.extend((face[i], mids[i], center, mids[i - 1]) for i in range(4))
        vertices = np.asarray(vertices, dtype=np.float32)
        edges = np.unique(np.sort(np.concatenate(
            [np.asarray(quads)[:, [i, (i + 1) % 4]] for i in range(4)]), axis=1), axis=0)
        triangles = np.asarray([t for a, b, c, d in quads for t in ((a, b, c), (a, c, d))])
        selected, coarse_edges, coarse_triangles = native_control_mesh(vertices, edges, triangles)
        self.assertEqual(len(selected), 8)
        self.assertEqual(len(coarse_edges), 12)
        self.assertEqual(len(coarse_triangles), 12)
        np.testing.assert_array_equal(np.sort(selected), np.arange(8))
        p = vertices[selected][coarse_triangles]
        self.assertTrue(np.all(np.sum(np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
                                     * p.mean(axis=1), axis=1) > 0))
        with self.assertRaisesRegex(ValueError, "paired"):
            native_control_mesh(vertices, edges, triangles[:-1])

    def test_static_eyes_are_bounded_and_have_outward_surface_winding(self):
        vertices, triangles = claire_eyes()
        self.assertTrue(np.isfinite(vertices).all())
        self.assertLess(float(vertices[:, 2].max()), 3.75)
        self.assertGreater(float(vertices[:, 1].min()), 146)
        self.assertLess(float(vertices[:, 1].max()), 149)
        p = vertices[triangles]
        centers = np.where(p.mean(axis=1)[:, 0, None] < 0,
                           [-2.9485, 147.5517, 2.2364], [3.1021, 147.4944, 2.2830])
        outward = np.sum(np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
                         * (p.mean(axis=1) - centers), axis=1)
        self.assertTrue(np.all(outward > 0))

    def test_hair_leaves_the_central_expression_region_uncovered(self):
        vertices, _, _ = claire_hair()
        in_front_of_face = (np.abs(vertices[:, 0]) < 5) & (vertices[:, 2] > 0)
        self.assertTrue(in_front_of_face.any())
        self.assertGreater(float(vertices[in_front_of_face, 1].min()), 152)

    def test_claire_cache_reuses_only_valid_derived_native_topology(self):
        neutral = np.zeros((4, 3), dtype=np.float32)
        derived = (np.array([0, 1, 2], dtype=np.int32),
                   np.array([[0, 1], [1, 2]], dtype="<u4"),
                   np.array([[0, 1, 2]], dtype="<u4"))
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            with (patch("verona.mesh.read_mesh", return_value=(
                    neutral, np.zeros((123036, 2)), np.zeros((123036, 3)))) as read,
                  patch("verona.mesh.native_control_mesh", return_value=derived)):
                cold = claire_topology(neutral, Path("unused.ma"), cache, "fixture-v1")
                warm = claire_topology(neutral, Path("unused.ma"), cache, "fixture-v1")
                self.assertEqual(read.call_count, 1)
            for a, b in zip(cold[:3], warm[:3]):
                np.testing.assert_array_equal(a, b)
            target = next(cache.glob("*.npz"))
            np.savez(target, selected=np.array([999], dtype=np.int32),
                     edges=derived[1], triangles=derived[2], maximum=0)
            with self.assertRaisesRegex(ValueError, "remove only"):
                claire_topology(neutral, Path("unused.ma"), cache, "fixture-v1")
            target.write_bytes(b"not-a-numerical-archive")
            with self.assertRaisesRegex(ValueError, "Unreadable"):
                claire_topology(neutral, Path("unused.ma"), cache, "fixture-v1")

    def test_reads_all_face_chunks_and_reversed_native_edge(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.ma"
            path.write_text(SCENE, encoding="utf-8")
            vertices, edges, triangles = read_mesh(path)
        self.assertEqual(vertices.shape, (6, 3))
        self.assertEqual(edges.shape, (7, 2))
        np.testing.assert_array_equal(
            triangles, [[0, 1, 2], [0, 2, 3], [1, 4, 5], [1, 5, 2]]
        )

    def test_rejects_noncontiguous_face_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.ma"
            path.write_text(SCENE.replace(".fc[1:1]", ".fc[2:2]"), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Noncontiguous"):
                read_mesh(path)

    def test_spatially_touching_disconnected_lips_are_not_joined(self):
        points = np.array([[0, 152, 5], [.01, 152, 5],
                           [0, 152.005, 5], [.01, 152.005, 5]], dtype=np.float32)
        selected, edges, _ = reduced_mesh(
            points, np.array([[0, 1], [2, 3]]), np.empty((0, 3), dtype=np.int32)
        )
        self.assertEqual(len(selected), 2)
        self.assertEqual(len(edges), 0)
        self.assertEqual(len(set(selected // 2)), 2)

    def test_quantization_preserves_signed_positions_and_rejects_overflow(self):
        vertices = np.array([[0.5, -0.5, 1.0]], dtype=np.float32)
        raw = pack_positions(vertices, np.zeros(3), 1.0)
        np.testing.assert_array_equal(np.frombuffer(raw, dtype="<i2"), [4096, -4096, 8192])
        for invalid in (np.array([[10, 0, 0]]), np.array([[np.nan, 0, 0]])):
            with self.assertRaises(ValueError):
                pack_positions(invalid, np.zeros(3), 1.0)


class SpeechTests(unittest.TestCase):
    def test_settings_validate_ranges_and_markup_escapes_text(self):
        for value in (None, [], {"pitch": True}, {"pitch": 9}, {"rate": -6},
                      {"bass": 6.1}, {"treble": float("nan")}, {"emphasis": "unknown"},
                      {"ssml": "<audio src='https://invalid/'/>"}):
            with self.assertRaises(ValueError):
                speech.VoiceSettings.parse(value)
        text = '</emphasis><audio src="https://invalid/"> & hello'
        settings = speech.VoiceSettings.parse({"pitch": 4, "rate": 2, "emphasis": "strong"})
        root = ET.fromstring(speech.speech_markup(text, "en-GB", settings))
        ns = "{http://www.w3.org/2001/10/synthesis}"
        self.assertEqual(root.find(ns + "prosody").get("pitch"), "+4st")
        self.assertEqual(root.find(".//" + ns + "emphasis").text, text)
        self.assertIsNone(root.find(".//" + ns + "audio"))

    def test_tone_changes_frequency_balance_without_time_stretch_or_clipping(self):
        t = np.arange(16000) / 16000
        samples = .1 * np.sin(2 * np.pi * 100 * t) + .1 * np.sin(2 * np.pi * 4000 * t)
        raw = np.rint(samples * 32767).astype("<i2").tobytes()
        shaped = speech.shape_tone(raw, 6, -6)
        self.assertEqual(len(shaped), len(raw))
        spectrum = np.abs(np.fft.rfft(np.frombuffer(shaped, dtype="<i2")))
        self.assertGreater(spectrum[100] / spectrum[4000], 3)
        loud = np.rint(.95 * np.sin(2 * np.pi * 100 * t) * 32767).astype("<i2").tobytes()
        self.assertLessEqual(np.abs(np.frombuffer(speech.shape_tone(loud, 6, 6), dtype="<i2")).max(), 32113)
        self.assertEqual(speech.shape_tone(raw, 0, 0), raw)

    def test_hazel_is_preferred_without_reordering_the_installed_voices(self):
        voices = [{"name": "other"}, {"name": "Microsoft Hazel Desktop"}]
        self.assertEqual(speech.preferred_voice(voices), "Microsoft Hazel Desktop")
        self.assertEqual(speech.preferred_voice(voices[:1]), "other")
        self.assertEqual(voices[0]["name"], "other")

    def test_text_validation_rejects_empty_oversized_and_invalid_unicode(self):
        for value in (None, "", "  ", "x" * 281, "\0hello", "\ud800", "\ufffe"):
            with self.assertRaises(ValueError):
                speech.validate_text(value)
        self.assertEqual(speech.validate_text("  Hey!\nHow are you?  "), "Hey!\nHow are you?")

    def test_user_text_is_json_data_not_powershell_code_or_environment(self):
        text = "'; Write-Output HACKED; # <speak>hello</speak>"
        response = type("Completed", (), {"returncode": 0, "stdout": '{"ok":true}', "stderr": ""})()
        with (
            patch.object(Path, "is_file", return_value=True),
            patch.dict("os.environ", {"GH_TOKEN": "fixture-only-not-a-real-credential"}),
            patch.object(speech.subprocess, "run", return_value=response) as run,
        ):
            speech.speech_command({"text": text})
        args, kwargs = run.call_args
        self.assertEqual(args[0][-1], speech.SCRIPT)
        self.assertNotIn(text, args[0])
        self.assertEqual(json.loads(kwargs["input"])["text"], text)
        self.assertNotIn("GH_TOKEN", kwargs["env"])
        self.assertFalse(kwargs.get("shell", False))

    def test_synthesis_preserves_audio_time_and_adds_explicit_silence(self):
        raw = np.array([1000, -1000] * 800, dtype="<i2").tobytes()

        def fake_speech(request):
            Path(request["output"]).write_bytes(speech.package_pcm(raw))
            return {"ok": True}

        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(speech, "ROOT", Path(directory)),
            patch.object(speech, "speech_command", side_effect=fake_speech),
        ):
            result = speech.synthesize("hello", "fixture", [{"name": "fixture"}])
            self.assertEqual(list((Path(directory) / ".local" / "work").iterdir()), [])
        start = speech.LEAD_SAMPLES * 2
        self.assertEqual(result.pcm[start:start + len(raw)], raw)
        self.assertEqual(result.pcm[:start], bytes(start))
        self.assertEqual(result.pcm[-speech.TAIL_SAMPLES * 2:], bytes(speech.TAIL_SAMPLES * 2))
        with wave.open(io.BytesIO(result.wav)) as wav:
            self.assertEqual(wav.getframerate(), 16000)
            self.assertEqual(wav.readframes(wav.getnframes()), result.pcm)

    def test_unknown_voice_is_not_silently_substituted(self):
        with patch.object(speech, "speech_command") as run:
            with self.assertRaisesRegex(ValueError, "installed"):
                speech.synthesize("hello", "missing", [{"name": "fixture"}])
        run.assert_not_called()


class ClipTests(unittest.TestCase):
    def expression_fixture(self):
        class Session:
            def __init__(self):
                self.calls = []

            def run(self, names, inputs):
                windows, condition = inputs["input"], inputs["emotion"]
                result = np.zeros((len(windows), 1, 31), dtype=np.float32)
                effect = condition[:, 0, 16:] @ np.arange(1, 11, dtype=np.float32)
                result[:, 0, 0] = .125 + windows.mean(axis=(1, 2)) + effect ** 2 * .01
                result[:, 0, 1] = -.05 + effect * .03
                self.calls.append((windows.copy(), condition.copy(), result.copy()))
                return [result]

            def get_providers(self):
                return ["CPUExecutionProvider"]

        engine = FaceEngine.__new__(FaceEngine)
        engine.selected = np.arange(3)
        engine.neutral = np.array([[0, .1, 0], [.2, 0, 0], [0, 0, .3]], dtype=np.float32)
        engine.basis = np.zeros((2, 3, 3), dtype=np.float32)
        engine.basis[0, :, 0] = [1, .5, -.2]
        engine.basis[1, :, 1] = [-.1, 1, .4]
        engine.center, engine.scale = np.zeros(3), 2
        engine.condition = np.zeros((1, 1, 26), dtype=np.float32)
        engine.condition[0, 0, 0] = .125
        engine.session = Session()
        pcm = np.arange(3000, dtype="<i2").tobytes()
        return engine, speech.Speech(speech.package_pcm(pcm), pcm, "fixture")

    def test_doubles_all_explicit_emotion_deltas_not_neutral_speech(self):
        for expression in ("happy", "sad", "surprised", "angry", "cheekiness",
                           "disgust", "fear", "grief", "outofbreath", "pain"):
            for strength, gain in ((.35, 2), (.6, 2), (.35, 4), (.6, 4)):
                with self.subTest(expression=expression, strength=strength, gain=gain):
                    engine, audio = self.expression_fixture()
                    clip = engine.generate(audio, expression, strength, expression_gain=gain)
                    calls = engine.session.calls
                    self.assertEqual([len(c[0]) for c in calls], [4, 4, 2, 2])
                    expected = bytearray()
                    for expressive, neutral in zip(calls[::2], calls[1::2]):
                        np.testing.assert_array_equal(expressive[0], neutral[0])
                        np.testing.assert_array_equal(neutral[1],
                                                     np.repeat(engine.condition, len(neutral[0]), axis=0))
                        old = (expressive[2][:, 0, :2] @ engine.basis.reshape(2, -1)).reshape(-1, 3, 3)
                        baseline = (neutral[2][:, 0, :2] @ engine.basis.reshape(2, -1)).reshape(-1, 3, 3)
                        expected.extend(pack_positions(engine.neutral + baseline + gain * (old - baseline),
                                                       engine.center, engine.scale))
                    np.testing.assert_allclose(np.frombuffer(clip.motion, dtype="<i2"),
                                               np.frombuffer(expected, dtype="<i2"), atol=1)
                    self.assertEqual(clip.audio, audio.wav)
                    self.assertEqual(clip.metadata["frames"], 6)
                    self.assertEqual(clip.metadata["expressionGain"], gain)
                    self.assertEqual(clip.metadata["expressionGainSetting"], gain)
                    np.testing.assert_array_equal(engine.condition[0, 0, 16:], 0)
        for expression, strength in (
            ("neutral", .6), *((name, 0) for name in (
                "happy", "sad", "surprised", "angry", "cheekiness",
                "disgust", "fear", "grief", "outofbreath", "pain")),
        ):
            with self.subTest(expression=expression, strength=strength):
                engine, audio = self.expression_fixture()
                clip = engine.generate(audio, expression, strength, expression_gain=4)
                self.assertEqual(len(engine.session.calls), 2)
                self.assertEqual(clip.metadata["expressionGain"], 1)
                self.assertEqual(clip.motion, engine.generate(audio).motion)

    def test_expression_gain_is_bounded_before_inference(self):
        for gain in (True, "4", None, [], {}, float("nan"), 0, 3, 5):
            with self.subTest(gain=gain):
                engine, audio = self.expression_fixture()
                with self.assertRaisesRegex(ValueError, "2x or 4x"):
                    engine.generate(audio, "happy", expression_gain=gain)
                self.assertEqual(engine.session.calls, [])

    def test_expression_reference_rejects_bad_output_and_honors_cancellation(self):
        for invalid in (np.zeros((4, 1, 30)), np.full((4, 1, 31), np.nan)):
            engine, audio = self.expression_fixture()
            with patch.object(engine.session, "run",
                              side_effect=[[np.zeros((4, 1, 31))], [invalid]]) as run:
                with self.assertRaisesRegex(ValueError, "finite matching"):
                    engine.generate(audio, "happy")
                self.assertEqual(run.call_count, 2)
        for stop_on in (1, 2):
            engine, audio = self.expression_fixture()
            stop = threading.Event()
            original = engine.session.run

            def cancel(names, inputs):
                result = original(names, inputs)
                if len(engine.session.calls) == stop_on:
                    stop.set()
                return result

            with patch.object(engine.session, "run", side_effect=cancel) as run:
                with self.assertRaisesRegex(RuntimeError, "stopped"):
                    engine.generate(audio, "happy", stop=stop)
                self.assertEqual(run.call_count, stop_on)

    def test_expression_uses_separate_model_channel_and_preserves_neutral(self):
        neutral = np.zeros((1, 1, 26), dtype=np.float32)
        neutral[0, 0, :16] = np.arange(16) / 32
        original = neutral.copy()
        names = ("surprised", "angry", "cheekiness", "disgust", "fear",
                 "grief", "happy", "outofbreath", "pain", "sad")
        for index, name in enumerate(names):
            with self.subTest(expression=name):
                result = expression_condition(neutral, name, .6)
                expected = original.copy()
                expected[0, 0, 16 + index] = .6
                np.testing.assert_array_equal(result, expected)
                np.testing.assert_array_equal(neutral, original)
        for intensity in (True, "0.3", float("nan"), -.1, .61):
            with self.assertRaises(ValueError):
                expression_condition(neutral, "happy", intensity)

    def test_complete_clip_keeps_rational_audio_frame_count_and_cancels(self):
        class Session:
            calls = 0

            def run(self, names, inputs):
                batch = inputs["input"].shape[0]
                self.batches.append(batch)
                self.assertions.append(inputs["emotion"].shape == (batch, 1, 26))
                result = np.zeros((batch, 1, 169), dtype=np.float32)
                result[:, 0, 0] = np.arange(self.calls + 1, self.calls + batch + 1) * .01
                self.calls += batch
                return [result]

            def get_providers(self):
                return ["CPUExecutionProvider"]

        engine = FaceEngine.__new__(FaceEngine)
        engine.selected = np.arange(3)
        engine.neutral = verona_rest_shape(np.array(
            [[6, 138, 2], [4, 144, 3], [0, 140.15, 4]], dtype=np.float32))
        engine.basis = np.zeros((140, 3, 3), dtype=np.float32)
        engine.basis[0, :, 0] = 1
        engine.center, engine.scale = np.array([0, 145, 0]), 20
        engine.condition = np.zeros((1, 1, 26), dtype=np.float32)
        engine.session = Session()
        engine.session.batches, engine.session.assertions = [], []
        pcm = bytes(3000 * 2)
        audio = speech.Speech(speech.package_pcm(pcm), pcm, "fixture")
        clip = engine.generate(audio)
        self.assertEqual(clip.metadata["frames"], 6)
        self.assertEqual(len(clip.motion), 6 * 3 * 3 * 2)
        self.assertEqual(engine.session.batches, [4, 2])
        self.assertTrue(all(engine.session.assertions))
        expected = (engine.neutral[0, 0] + np.arange(1, 7) * .01) / engine.scale * 8192
        positions = np.frombuffer(clip.motion, dtype="<i2").reshape(6, 3, 3)
        np.testing.assert_allclose(positions[:, 0, 0],
                                   expected, atol=.5)
        rest = np.frombuffer(pack_positions(engine.neutral, engine.center, engine.scale),
                             dtype="<i2").reshape(3, 3)
        np.testing.assert_array_equal(positions[:, :, 1:], np.broadcast_to(rest[:, 1:], (6, 3, 2)))
        self.assertEqual(clip.audio, audio.wav)
        self.assertGreater(clip.metadata["maximumSkinChangeCm"], 0)
        stop = threading.Event()
        stop.set()
        with self.assertRaisesRegex(RuntimeError, "stopped"):
            engine.generate(audio, stop=stop)
        stop.clear()
        original_run = engine.session.run

        def stop_after_batch(names, inputs):
            output = original_run(names, inputs)
            stop.set()
            return output

        with patch.object(engine.session, "run", side_effect=stop_after_batch) as run:
            with self.assertRaisesRegex(RuntimeError, "stopped"):
                engine.generate(audio, stop=stop)
            self.assertEqual(run.call_count, 1)


if __name__ == "__main__":
    unittest.main()
