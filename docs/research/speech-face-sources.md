# Speech-driven face research: source register

Research date: 2026-11-18. This register supports
[chapter 04](../chapters/04-speech-driven-face-research.md).

Repository links below are pinned to the exact reviewed default-branch snapshot.
Primary documentation/model-card links are live pages reviewed on the research
date, not immutable releases. Recheck them when selecting/downloading artifacts.
Public source snapshots and retrieval/hash receipts are retained in the authoring
session, outside this repository. Retrieval is not execution or semantic review
of an entire repository. No weights, rigs, recordings or datasets were downloaded
during that research-only workstream. The later
[CPU experiment](../chapters/05-local-cpu-feasibility.md) pins and downloads three
public Mark model assets separately, with actual inference evidence and limits.

## Repository evidence

### R01 - NVIDIA Audio2Face collection

Commit: `4d61b6b81ad7b5108512ea0eab10d8712ea4a236`.

- [README](https://github.com/NVIDIA/Audio2Face-3D/blob/4d61b6b81ad7b5108512ea0eab10d8712ea4a236/README.md):
  component boundaries, model/data license categories and the advertised CPU
  fallback. That fallback claim conflicts with the qualified paths in R02/R03;
  it does not establish a working CPU implementation.

### R02 - NVIDIA Audio2Face SDK

Commit: `1ca0f02535ed774f5dbcd724a31cd486368dc783`.

- [README, prerequisites and sample limitations](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/README.md#prerequisites).
- [MIT license](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/LICENSE.txt).
- [inference_engine.cpp:234-245, InferenceEngine initialization](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2x-common/source/audio2x/inference_engine.cpp#L234-L245).
- [inference_engine.cpp:503-506, InferenceEngine::Run](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2x-common/source/audio2x/inference_engine.cpp#L503-L506).
- [sample-a2f-executor/main.cpp:62-267](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/samples/sample-a2f-executor/main.cpp#L62-L267):
  `readAudio`, geometry bundle creation, emotion/audio accumulators,
  `RunExecutorOffline`, CUDA device selection and results callback.

The sample callback counts results; it is not an implemented Verona exporter or
viewer. Internal geometry executor implementations were not exhaustively audited.

### R02a - Full Claire emotion controls

Reviewed 2026-11-20 for vr-34, not part of the original November 18 execution.
Claire revision `a46eafb067adfdd7cc8f5c7941586b309004561c`; SDK revision remains
`1ca0f02535ed774f5dbcd724a31cd486368dc783`.

- [Claire network metadata](https://huggingface.co/nvidia/Audio2Face-3D-v2.3.1-Claire/blob/a46eafb067adfdd7cc8f5c7941586b309004561c/network_info.json):
  ten ordered explicit names, 16 implicit components, 140 skin PCA coefficients.
- [Claire model configuration](https://huggingface.co/nvidia/Audio2Face-3D-v2.3.1-Claire/blob/a46eafb067adfdd7cc8f5c7941586b309004561c/model_config.json):
  neutral source shot `cp1_neutral`, frame 212; SDK postprocessing parameters
  remain distinct from Verona's simplified reconstruction.
- [model_regression.cpp, GetExplicitEmotions](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/model_regression.cpp#L112-L117):
  explicit segment follows the implicit vector.
- [executor_regression_core.cpp, ReadExplicitEmotion](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/executor_regression_core.cpp#L74-L86):
  reads a multicomponent explicit vector, not a one-label enum.
- [emotion_accumulator.cpp, Accumulate_Helper](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2x-common/source/audio2x/emotion_accumulator.cpp):
  dimensions/timestamp/lifecycle checks and vector storage; no normalization
  in this reviewed boundary. This is not a claim about every SDK producer.

The actual 57-case, four-frame CPU probe and proposed finite GIF sampling policy
are distinguished from visual/semantic acceptance in chapter 09's vr-34 section.
No new model or native asset was downloaded for this follow-up.

### R03 - NVIDIA training framework

Commit: `112c5eb3408afd065ac8974b2c6ea9ab0e3965c6`.

- [README](https://github.com/NVIDIA/Audio2Face-3D-training-framework/blob/112c5eb3408afd065ac8974b2c6ea9ab0e3965c6/README.md):
  Linux/WSL2, CUDA GPU, Docker, custom training artifacts.
- [Apache-2.0 license](https://github.com/NVIDIA/Audio2Face-3D-training-framework/blob/112c5eb3408afd065ac8974b2c6ea9ab0e3965c6/LICENSE).
- [runners/run_inference.py:24-55](https://github.com/NVIDIA/Audio2Face-3D-training-framework/blob/112c5eb3408afd065ac8974b2c6ea9ab0e3965c6/runners/run_inference.py#L24-L55):
  runner dispatch; regression raises `NotImplementedError`.
- [audio2face/infer_diffusion.py:67-196](https://github.com/NVIDIA/Audio2Face-3D-training-framework/blob/112c5eb3408afd065ac8974b2c6ea9ab0e3965c6/audio2face/infer_diffusion.py#L67-L196):
  `InferenceEngine.setup`, checkpoint, conditioning, audio and offline inference.
- [audio2face/infer_diffusion.py:207-375](https://github.com/NVIDIA/Audio2Face-3D-training-framework/blob/112c5eb3408afd065ac8974b2c6ea9ab0e3965c6/audio2face/infer_diffusion.py#L207-L375):
  streaming, explicit CUDA ONNX provider, recurrent state, padding and truncation.

This is not evidence that SDK-distributed ONNX models can be dropped into a
CPU PyTorch runner. No conversion/CPU port was attempted.

### R04 - UniTalker

Commit: `21481130f126f950e646c828d7984984b1168feb`.

- [README](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/README.md):
  setup, external checkpoints/PCA/templates, optional rendering and FLAME.
- [Apache-2.0 code license](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/LICENSE).
- [main/demo.py](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/main/demo.py):
  `split_long_audio`, `merge_out_list`, `main`; CUDA transfers, 16 kHz audio,
  identity/template selection and dataset-specific frame rates.
- [models/unitalker.py](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/models/unitalker.py):
  `UniTalker.__init__`, `UniTalker.forward`, encoder/decoder/output heads.
- [models/wavlm.py](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/models/wavlm.py):
  `WavLMModel.forward`, feature extraction/encoding/interpolation.
- [models/unitalker_decoder.py](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/models/unitalker_decoder.py):
  `UniTalkerDecoderTCN.forward`, identity embedding and temporal decoder.
- [models/pca.py:6-35](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/models/pca.py#L6-L35):
  `PCALayer`, registered PCA buffers and decode.
- [dataset/dataset_config.py](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/dataset/dataset_config.py):
  topology, dimensions, scale and PCA contract for each head.
- [loss/loss.py:166-241](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/loss/loss.py#L166-L241):
  `VerticesLoss.mouth_metric`, `BlendShapeLoss.bs2vertices` and
  `BlendShapeLoss.mouth_metric`.
- [loss/loss.py:267-360](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/loss/loss.py#L267-L360):
  `UniTalkerLoss` dispatch to geometry conversion.
- [config/unitalker.yaml](https://github.com/X-niper/UniTalker/blob/21481130f126f950e646c828d7984984b1168feb/config/unitalker.yaml):
  default WavLM-base-plus, TCN decoder, PCA and checkpoint.

CPU portability is a proposal, not an observed capability. External weights,
templates, PCA data and third-party models need their own permission review.

### R05 - FaceFormer

Commit: `dfaea81983665b22b99af336a80574208cfcc099`.

- [README](https://github.com/EvelynFan/FaceFormer/blob/dfaea81983665b22b99af336a80574208cfcc099/README.md):
  older environment, checkpoints and required topology/template assets.
- [MIT code license](https://github.com/EvelynFan/FaceFormer/blob/dfaea81983665b22b99af336a80574208cfcc099/LICENSE).
- [demo.py:21-60](https://github.com/EvelynFan/FaceFormer/blob/dfaea81983665b22b99af336a80574208cfcc099/demo.py#L21-L60):
  `test_model`, checkpoint loading, `args.device`, template and audio to vertices.
- [faceformer.py:137-167](https://github.com/EvelynFan/FaceFormer/blob/dfaea81983665b22b99af336a80574208cfcc099/faceformer.py#L137-L167):
  `Faceformer.predict`, full audio features and autoregressive decoding.

Device selection exists, but CPU checkpoint loading, dependencies and inference
were not qualified on this machine.

### R06 - Rhubarb Lip Sync

Commit: `9b9573cd21b253c9ba58739bbd1aa0b50b991bff`.

- [README.adoc](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/README.adoc):
  six basic/three optional shapes, recognizer tradeoffs, dialogue hints and export.
- [LICENSE.md](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/LICENSE.md):
  actual MIT license and separate dependency notices; GitHub's NOASSERTION
  metadata is not the license text.
- [rhubarb/src/rhubarb/main.cpp:253-282](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/rhubarb/src/rhubarb/main.cpp#L253-L282):
  CLI invokes `animateWaveFile` then an exporter.
- [PocketSphinxRecognizer.cpp:152-238](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/rhubarb/src/recognition/PocketSphinxRecognizer.cpp#L152-L238):
  PocketSphinx alignment and extraction of timed phones.
- [mouthAnimation.cpp](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/rhubarb/src/animation/mouthAnimation.cpp):
  `animate`, rules, rough animation, timing, pauses, tweens and shape restrictions.
- [animationRules.cpp:75-175](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/9b9573cd21b253c9ba58739bbd1aa0b50b991bff/rhubarb/src/animation/animationRules.cpp#L75-L175):
  `getShapeSets`, plosive anticipation and phoneme/shape rules.

Selected recognizer/animation paths were read; the complete audio loading,
resampling and export implementations were not qualified.

### R07 - WhisperX

Commit: `b904f02b7e1f26fd10fb04840d655ff27e88e464`.

- [README](https://github.com/m-bain/whisperX/blob/b904f02b7e1f26fd10fb04840d655ff27e88e464/README.md):
  ASR/alignment/diarization separation and CPU mode.
- [BSD-2-Clause license](https://github.com/m-bain/whisperX/blob/b904f02b7e1f26fd10fb04840d655ff27e88e464/LICENSE).
- [whisperx/alignment.py:111-147](https://github.com/m-bain/whisperX/blob/b904f02b7e1f26fd10fb04840d655ff27e88e464/whisperx/alignment.py#L111-L147):
  `load_align_model`, model token/character dictionary.
- [whisperx/alignment.py:194-432](https://github.com/m-bain/whisperX/blob/b904f02b7e1f26fd10fb04840d655ff27e88e464/whisperx/alignment.py#L194-L432):
  `align`, character token alignment, word aggregation, interpolation and failure.

No claim here that default character/word output is an IPA/ARPAbet phone tier.

### R08 - TalkingHead

Commit: `1563de184c19b310de4b636664d5835e2c74dbba`.

- [README](https://github.com/met4citizen/TalkingHead/blob/1563de184c19b310de4b636664d5835e2c74dbba/README.md):
  Three.js/WebGL renderer, rig/morph assumptions, integration APIs.
- [MIT license](https://github.com/met4citizen/TalkingHead/blob/1563de184c19b310de4b636664d5835e2c74dbba/LICENSE).
- [modules/talkinghead.mjs:3106-3220](https://github.com/met4citizen/TalkingHead/blob/1563de184c19b310de4b636664d5835e2c74dbba/modules/talkinghead.mjs#L3106-L3220):
  `speakAudio`, word-derived timing fallback versus provided visemes.
- [modules/talkinghead.mjs:3227-3305](https://github.com/met4citizen/TalkingHead/blob/1563de184c19b310de4b636664d5835e2c74dbba/modules/talkinghead.mjs#L3227-L3305):
  `playAudio`, animation queue and Web Audio scheduling.

Renderer functionality is not evidence of a particular lip-sync estimator's
accuracy. Animations use a separate animation clock in this reviewed path.

### R09 - HeadAudio

Commit: `9f7654914559cf3beaf731117d2efa91958ef640`.

- [README](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/README.md):
  accuracy caveats, synthetic four-voice training, 15 Oculus visemes, latency.
- [MIT license](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/LICENSE).
- [modules/headworklet.mjs](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/modules/headworklet.mjs):
  `HeadWorklet.process` delegates mono blocks to `Processor.process`.
- [modules/processor.mjs:225-400](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/modules/processor.mjs#L225-L400):
  downsampling, MFCC, deltas, VAD, classifier and timestamped messages.
- [modules/classifier.mjs](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/modules/classifier.mjs):
  `Classifier.distanceMahalanobis`, `Classifier.predict`, six-result vote.
- [modules/headaudio.mjs](https://github.com/met4citizen/HeadAudio/blob/9f7654914559cf3beaf731117d2efa91958ef640/modules/headaudio.mjs):
  constructor defaults, `_onmessage` minimum hold, `update` easing/ramping.

### R10 - HeadTTS

Commit: `5ae6d5eb93b812859a09079944a66c6a2177b311`.

- [README](https://github.com/met4citizen/HeadTTS/blob/5ae6d5eb93b812859a09079944a66c6a2177b311/README.md):
  WebGPU/WASM/CPU options, English documented support and memory caveat.
- [MIT license](https://github.com/met4citizen/HeadTTS/blob/5ae6d5eb93b812859a09079944a66c6a2177b311/LICENSE).
- [modules/language.mjs:338-475](https://github.com/met4citizen/HeadTTS/blob/5ae6d5eb93b812859a09079944a66c6a2177b311/modules/language.mjs#L338-L475):
  `LanguageBase.partSetVisemes`, `generate`, phoneme-index metadata.
- [modules/language-en-us.mjs:638-708](https://github.com/met4citizen/HeadTTS/blob/5ae6d5eb93b812859a09079944a66c6a2177b311/modules/language-en-us.mjs#L638-L708):
  English dictionary/rule pronunciation.
- [modules/worker-tts.mjs:248-385](https://github.com/met4citizen/HeadTTS/blob/5ae6d5eb93b812859a09079944a66c6a2177b311/modules/worker-tts.mjs#L248-L385):
  `updateTimestamps`, `process`, waveform and duration outputs.

The timestamped Kokoro model is a distinct asset, not the ordinary Kokoro export.
Duration-derived timing still requires perceptual and rig qualification.

### R11 - CodeTalker (comparator, documentation-level review)

Commit: `1b7cb95a637bda670bd39369bae1bf10299b5339`.

- [README](https://github.com/Doubiiu/CodeTalker/blob/1b7cb95a637bda670bd39369bae1bf10299b5339/README.md):
  discrete motion prior, two stages, topology assets, CUDA environment and older
  dependency-patching instruction.
- [MIT code license](https://github.com/Doubiiu/CodeTalker/blob/1b7cb95a637bda670bd39369bae1bf10299b5339/LICENSE).

Inference code was not traced. Do not copy its instruction to edit installed
PyTorch internals into Verona's dependency procedure.

### R12 - ProbTalk3D (comparator, documentation/license review)

Commit: `b0ae74ba6049feb7846b8b61d0685f396fbc13cc` on `main`.

- [README](https://github.com/uuembodiedsocialai/ProbTalk3D/blob/b0ae74ba6049feb7846b8b61d0685f396fbc13cc/README.md):
  probabilistic emotional motion, FLAME parameters, CUDA environment and weights.
  It identifies `WithProsody` as ProbTalk3D-X; that branch was not reviewed.
- [CC BY-NC 4.0 license](https://github.com/uuembodiedsocialai/ProbTalk3D/blob/b0ae74ba6049feb7846b8b61d0685f396fbc13cc/LICENSE.txt).

Inference code was not traced; no Verona accuracy or hardware claim follows.

## Papers, model cards and official contracts

| ID | Primary source | Reviewed scope and significance |
|---|---|---|
| P01 | [Audio2Face-3D, arXiv 2508.16401v1](https://arxiv.org/html/2508.16401v1) | Sections 3-7: data, regression/diffusion, streaming, postprocess, solve, evaluation and limitations. RTX 4090 measurements are not local benchmarks. |
| P02 | [UniTalker, arXiv 2408.00762v1](https://arxiv.org/html/2408.00762v1) | Abstract/introduction/dataset table: multi-annotation architecture, training diversity and reported benchmark reductions. Full experiments were not independently reproduced. |
| P03 | [EMOTE, arXiv 2306.08990](https://ar5iv.labs.arxiv.org/html/2306.08990) | Abstract/intro/related work: speech/emotion conflict, decoupled losses, pseudo-3D supervision and research-use resources. No deployment/code qualification. |
| D01 | [Mark v2.3 model card](https://huggingface.co/nvidia/Audio2Face-3D-v2.3-Mark/blob/main/README.md) | 16 kHz audio, pose outputs, TensorRT integration, supported NVIDIA hardware, license and low-quality-input caveats. |
| D02 | [v3.0 model card](https://huggingface.co/nvidia/Audio2Face-3D-v3.0/blob/main/README.md) | Motion output, diffusion/HuBERT, NVIDIA hardware and NVIDIA Open Model License. |
| D03 | [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/) | October 24, 2025 version: commercial use/derivatives allowed subject to conditions; redistribution notice, other terms and component licenses remain applicable. Not MIT or legal advice. |
| D04 | [Azure Speech visemes](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme) | TTS synthesis events, 22 IDs, 100 ns offsets, 60 FPS/55-value 3D batches. Not arbitrary-recording inference. |
| D05 | [MFA alignment workflow](https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/workflows/alignment.html) | Existing transcript/audio, dictionary/acoustic model, alignment exports; version-specific commands and language/dialect selection. No local execution. |
| D06 | [SG Com 5.3 compute usage](https://docs.speech-graphics.com/en/sg-com/5.3/sg-com-compute-resource-usage) | Vendor CPU-only/memory/timing measurements and rendering exclusion. Not benchmarked on this Ryzen. |
| D07 | [SG Com 5.3 Engines and Players](https://docs.speech-graphics.com/en/sg-com/5.3/engines-and-players) | Audio engine/player split, vendor 50 ms processing latency, timestamp-based interpolation, separate transport. |
| D08 | [Speech Graphics products](https://www.speech-graphics.com/facial-animation-and-lip-sync-products) | SGX prerecorded production, SG Com live SDK, FaceFX and integration positioning. Quality superlatives are vendor claims. |
| D09 | [FaceFX analysis pipeline](https://facefx.github.io/documentation/doc/analyzing-audio) | WAV/text -> phoneme/word timings -> coarticulation -> rig curves/events. No SDK access or license acquisition. |
| D10 | [Timestamped Kokoro model card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/blob/main/README.md) | Apache-2.0 model metadata and ONNX/voice usage; HeadTTS code provides the traced durations contract. No model download. |
| D11 | [MDN AudioContext.getOutputTimestamp](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp) | Device output sample position versus performance-clock estimate, not guaranteed measured acoustic/display latency. |

## Access and interpretation limits

No vendor demo or model inference was run during the research-only workstream.
The later CPU numerical probe is documented separately; it is not visual/speech
qualification. No personal audio was supplied, transcribed or evaluated.
Published examples, model cards and code do not establish achieved accuracy.
