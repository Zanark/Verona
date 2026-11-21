const durations = {yawn: 4.2, sneeze: 2.7};

export function createIdleSound({
  enabled, volume, report, effectStyle = () => "female",
  loadEffect = () => { throw Error("Prepare local idle effects first."); },
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
        if (!Object.hasOwn(durations, action.sound)) throw Error("Unknown local idle effect.");
        const style = effectStyle();
        if (!["male", "female"].includes(style)) throw Error("Unknown local idle-effect style.");
        const key = `${action.sound}-${style}`;
        if (cached?.kind !== key) {
          const request = controller = new AbortController();
          const bytes = await loadEffect(action.sound, style, request.signal);
          if (version !== revision) return;
          if (bytes.byteLength > 202000) throw Error("Local idle effect exceeds its audio size limit.");
          const buffer = await context.decodeAudioData(bytes);
          if (version !== revision) return;
          if (buffer.numberOfChannels !== 1 || buffer.duration > durations[action.sound]+.001 || buffer.duration <= 0)
            throw Error("Local idle effect must be bounded mono audio.");
          controller = null;
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
