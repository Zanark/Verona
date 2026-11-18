# Local runtime and data

Verona's runtime does not download assets. The explicit setup commands fetch
pinned public files over certificate-verified HTTPS and verify their exact
size and SHA-256. A digest establishes identity, not a universal safety guarantee.
These data and installed environments stay under ignored `.local`; no model,
sample scene or Windows voice is bundled in this repository.

- NVIDIA Audio2Face-3D-v2.3-Mark weights/PCA/emotion data: **NVIDIA Open Model
  License**, not the SDK's MIT license. See
  <https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/>.
  Source revision and per-file hashes are in `scripts/fetch_cpu_model.py`.
- NVIDIA/Maya-ACE Mark v2 topology sample: repository **MIT license**, pinned
  revision `f0dc13670952c495450dab1655c94e9056c9d7d9`.
  [Compatibility guide](https://github.com/NVIDIA/Maya-ACE/blob/f0dc13670952c495450dab1655c94e9056c9d7d9/sample_project/README.md)
  explicitly pairs `mark_geom_v2_topo1.ma` with v2.3-Mark geometry.
  `scripts/fetch_face_mesh.py` records the source/hash. Treat the scene strictly
  as data; Verona does not execute MEL, load Maya plug-ins or resolve references.
- NumPy 2.3.5: BSD-3-Clause and the notices in its installed distribution.
- ONNX Runtime 1.23.2: MIT and its installed third-party notices.
- Windows System.Speech/SAPI and installed voices are existing OS components,
  governed by their Microsoft terms. Verona uses ordinary local plain-text
  synthesis, not SSML, voice cloning or a cloud speech service.
- The browser renderer uses built-in WebGL/Web Audio, without a CDN or JS package.

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
