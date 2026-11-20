// Authored native faceunit studies, not mappings of Claire's emotion channels.
const pair = (name, value) => ({[`${name}Left`]: value, [`${name}Right`]: value});
export const FACE_POSES = {
  neutral: {},
  surprised: {...pair("browOuterUp", .85), browInnerUp: .9, ...pair("eyeWide", .7), jawOpen: .55},
  angry: {...pair("browDown", .9), ...pair("eyeSquint", .55), ...pair("mouthPress", .55)},
  cheekiness: {mouthSmileLeft: .9, mouthDimpleLeft: .65, browOuterUpRight: .7, eyeSquintLeft: .35},
  disgust: {...pair("noseSneer", .9), ...pair("mouthUpperUp", .7), ...pair("browDown", .5), jawOpen: .12},
  fear: {browInnerUp: .85, ...pair("browOuterUp", .55), ...pair("eyeWide", .85),
    ...pair("mouthStretch", .65), jawOpen: .32},
  grief: {browInnerUp: .95, ...pair("mouthFrown", .8), ...pair("eyeBlink", .15), jawOpen: .16},
  happy: {...pair("mouthSmile", .95), ...pair("cheekSquint", .65), jawOpen: .12},
  outofbreath: {jawOpen: .5, mouthFunnel: .45, browInnerUp: .2},
  pain: {...pair("browDown", .65), browInnerUp: .4, ...pair("eyeSquint", .85),
    ...pair("mouthStretch", .6), jawOpen: .2},
  sad: {browInnerUp: .75, ...pair("mouthFrown", .75), mouthShrugLower: .2},
};

export function blendFaceUnits(model, weights, strength = 1) {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1
      || !model.rest.length || model.rest.length % 3) {
    throw new Error("Supply nonempty XYZ positions and strength between zero and one.");
  }
  const result = Float32Array.from(model.rest);
  for (const [name, weight] of Object.entries(weights)) {
    const delta = model.basis[name];
    if (!delta || delta.length !== result.length
        || !Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error(`Invalid native faceunit: ${name}`);
    }
    for (let i = 0; i < result.length; i++) result[i] += delta[i] * weight * strength;
  }
  if (!result.every(Number.isFinite)) throw new Error("Nonfinite faceunit result.");
  return result;
}
