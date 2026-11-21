const durations = {sneeze: 2.7};
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t*t*(3-2*t); };
const pulse = (t, a, b, c, d) => smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));

// The sneeze remains original synthesis; yawns come only from prepared local effects.
export function synthesizeIdleSound(kind, sampleRate = 24000) {
  if (!Object.hasOwn(durations, kind)) throw new Error(`Unknown idle sound: ${kind}`);
  const samples = new Float32Array(Math.round(durations[kind]*sampleRate));
  let seed = 19371, phase = 0, breath = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i/sampleRate, unit = t/durations[kind];
    seed = (1664525*seed+1013904223) >>> 0;
    const noise = seed/2147483648-1;
    breath = .88*breath+.12*noise;
    phase += 2*Math.PI*(150-35*unit)/sampleRate;
    const voice = Math.sin(phase)+.35*Math.sin(3*phase)+.18*Math.sin(5*phase)+.1*Math.sin(7*phase);
    const value = .35*breath*pulse(unit, .01, .20, .27, .37)
        +.9*(noise-breath)*pulse(unit, .31, .37, .44, .62)
        +.25*voice*pulse(unit, .40, .47, .55, .74);
    samples[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  for (let i = 0; i < samples.length; i++) samples[i] *= .9/peak;
  return samples;
}

export function createIdleSound({
  enabled, volume, report, yawnStyle = () => "female",
  loadYawn = () => { throw Error("Prepare local yawn effects first."); },
  createContext = () => new AudioContext({sampleRate: 24000}),
  now = () => performance.now(), random = Math.random,
}) {
  let context, source, gain, cached, controller, pending = null, revision = 0, unlocked = false;
  let nextYawn = 0;
  const ready = () => report(enabled() ? "Idle sounds ready: local yawn/sneeze, controlled level." : "Idle sounds muted.");
  const suspend = () => {
    if (context?.state === "running") context.suspend().catch(error =>
      report(`Idle audio suspend failed: ${error.message}`, true));
  };
  const stop = () => {
    revision++;
    controller?.abort(); controller = null;
    pending = null;
    if (source) { source.onended = null; source.stop(); source.disconnect(); source = null; }
    if (gain) { gain.disconnect(); gain = null; }
    suspend();
  };
  return {
    stop,
    async unlock() {
      try {
        context ||= createContext();
        await context.resume();
        if (context.state !== "running") throw new Error("Audio output did not become ready.");
        unlocked = true; ready();
        if (!source && pending === null) suspend();
      } catch (error) { report(`Idle sound unavailable: ${error.message}`, true); }
    },
    async start(action, {preview = false} = {}) {
      stop();
      if (!action.sound || !enabled() || volume() <= 0) return;
      if (action.sound === "yawn" && !preview && (now() < nextYawn || random() >= .1)) return;
      const version = revision, started = now();
      try {
        context ||= createContext();
        if (context.state === "running") unlocked = true;
        if (!unlocked) {
          report("Idle sound blocked by browser autoplay. Click Enable / retry idle sound.", true);
          return;
        }
        pending = version;
        await context.resume();
        if (version !== revision || !enabled()) {
          if (pending === null && !source) suspend();
          return;
        }
        if (context.state !== "running") throw new Error("Audio output is not running.");
        const key = action.sound === "yawn" ? `yawn-${yawnStyle()}` : action.sound;
        if (cached?.kind !== key) {
          let buffer;
          if (action.sound === "yawn") {
            if (!["yawn-male", "yawn-female"].includes(key)) throw Error("Unknown local yawn style.");
            const request = controller = new AbortController();
            const bytes = await loadYawn(key.slice(5), request.signal);
            if (version !== revision) return;
            if (bytes.byteLength > 202000) throw Error("Local yawn exceeds its audio size limit.");
            buffer = await context.decodeAudioData(bytes);
            if (version !== revision) return;
            if (buffer.numberOfChannels !== 1 || buffer.duration > 4.201 || buffer.duration <= 0)
              throw Error("Local yawn must be short mono audio.");
            controller = null;
          } else {
            const samples = synthesizeIdleSound(action.sound);
            buffer = context.createBuffer(1, samples.length, 24000);
            buffer.copyToChannel(samples, 0);
          }
          cached = {kind: key, buffer};
        }
        pending = null;
        const offset = (now()-started)/1000;
        if (offset >= Math.min(action.duration/1000, cached.buffer.duration)) { suspend(); return; }
        gain = context.createGain(); gain.gain.value = Math.max(0, Math.min(.2, volume()));
        gain.connect(context.destination);
        const current = source = context.createBufferSource();
        current.buffer = cached.buffer; current.connect(gain);
        current.onended = () => { if (source === current) { stop(); ready(); } };
        current.start(0, Math.max(0, offset));
        if (action.sound === "yawn") nextYawn = now()+600000;
        report(`Playing local ${key} (maximum 20%); speech or interaction stops it.`);
      } catch (error) {
        if (version === revision) { stop(); report(`Idle sound unavailable: ${error.message}`, true); }
      }
    },
    changed() { stop(); ready(); },
  };
}
