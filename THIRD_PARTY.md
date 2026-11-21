# Local runtime and data

Verona's runtime does not download assets. The explicit setup commands fetch
pinned public files over certificate-verified HTTPS and verify their exact
size and SHA-256. A digest establishes identity, not a universal safety guarantee.
Model data and Python environments stay under ignored `.local`; no model,
sample scene or Windows voice is bundled in this repository.

- NVIDIA Audio2Face-3D-v2.3.1-Claire (current app) and v2.3-Mark (historical
  optional probe and opt-in local GIF report) weights/PCA/emotion data: **NVIDIA Open Model
  License**, not the SDK's MIT license. See
  <https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/>.
  Source revisions/hashes are in `scripts/fetch_claire_model.py` and
  `scripts/fetch_cpu_model.py`.
- NVIDIA/Maya-ACE Claire/Mark v2 topology samples: repository **MIT license**, pinned
  revision `f0dc13670952c495450dab1655c94e9056c9d7d9`.
  [Compatibility guide](https://github.com/NVIDIA/Maya-ACE/blob/f0dc13670952c495450dab1655c94e9056c9d7d9/sample_project/README.md)
  explicitly pairs `claire_geom_v2_topo1.ma` with v2.3.x-Claire and
  `mark_geom_v2_topo1.ma` with v2.3-Mark.
  `scripts/fetch_claire_model.py` and `scripts/fetch_face_mesh.py` record the
  sources/hashes. Treat each scene strictly
  as data; Verona does not execute MEL, load Maya plug-ins or resolve references.
- NumPy 2.3.5: BSD-3-Clause and the notices in its installed distribution.
- ONNX Runtime 1.23.2: MIT and its installed third-party notices.
- Windows System.Speech/SAPI and installed voices are existing OS components,
  governed by their Microsoft terms. Verona escapes plain text into application-
  owned SSML for bounded local prosody. User SSML, voice cloning and cloud speech
  are not supported.
- The browser renderer uses built-in WebGL2 and HTML audio, without a CDN or JS package.
- The optional desktop shell pins Electron 45.3.1 (MIT) and its transitive setup
  dependencies in `desktop/package-lock.json`. The ignored local distribution
  includes Electron's `LICENSE` and `LICENSES.chromium.html`; retain those if a
  separate binary distribution is ever authorized. This source project does not
  bundle Electron, Chromium, Node.js or their third-party binaries.
  Explicit setup uses the existing verified HTTPS npm feed/registry and the
  official Electron installer's pinned checksums. No certificate bypass.
  <https://github.com/electron/electron/blob/v45.3.1/LICENSE>
- Rest-surface styling and procedural layered wavy hair are original Verona
  code applied to native-derived Claire geometry; the underlying model/sample
  licenses still apply. No hair model,
  texture, animation package or additional third-party asset was downloaded.
- Static cosmetic eye ellipsoids, shader iris/pupil/brow/lip treatment and
  lighting are original Verona code. No supplied reference image is bundled.
  README screenshots/GIFs show the actual renderer using native-derived Claire
  geometry and a synthetic greeting; the model/sample terms above still apply.

## Local journal-production tools

The separately pinned `book/requirements-journal.txt` uses installed
PyMuPDF 1.28.0 and Pillow 12.2.0. Installed distribution metadata declares
PyMuPDF **"Dual Licensed - GNU AFFERO GPL 3.0 or Artifex Commercial License"**
and Pillow **MIT-CMU**. These are book tools, not newly bundled application
dependencies. Use under the applicable upstream terms; this notice does not
grant commercial rights or settle a future distribution's compliance.

The journal uses locally installed Microsoft Georgia/Consolas. Its builder checks
TTF embedding/subsetting flags and embeds document subsets only; no font files,
tool binaries or dependency environments enter the local edition. Font flags
are a technical check, not a replacement for applicable license terms.
Model imagery retains the underlying NVIDIA/sample rights above. The edition
is local only; uploads and a separate binary/tool distribution need their own
permission and rights review.

## Local Blender authoring handoff

The ignored Claire-only export uses the already installed Blender 4.5.16 LTS and
the same document tools above; no Blender, font or library binary is bundled.
Claire GLB geometry/PCA modes derive from the pinned NVIDIA sources and retain
their separate model/sample terms. Local assets carry `ASSET-RIGHTS.md`;
redistribution requires the applicable full agreement and attribution notice,
not merely treating this source repository as permission to publish weights.

The separate armored study was withdrawn at the owner's request in vr-55.
Its former existence is not permission to restore or redistribute it.

## NVIDIA/Maya-ACE sample license

MIT License

Copyright (c) 2024, NVIDIA CORPORATION. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
