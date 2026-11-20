function waitForAudio(audio, event, signal, milliseconds) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      audio.removeEventListener(event, done);
      audio.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      error ? reject(error) : resolve();
    };
    const done = () => finish();
    const failed = () => finish(new Error("Native speech audio failed."));
    const aborted = () => finish(new Error("Speech cancelled."));
    audio.addEventListener(event, done, { once: true });
    audio.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(() => finish(new Error(`Native audio ${event} timed out.`)), milliseconds);
    if (signal.aborted) aborted();
    else if (event === "loadedmetadata" && audio.readyState >= 1) done();
  });
}

export async function startAgent(desktop, prepare, lock, failure) {
  let active = null;
  let controls = null;
  desktop.onAgent(async (message) => {
    if (message.action === "configure") {
      try {
        if (message.settings) {
          const value = controls.apply(message.settings);
          await desktop.agentControls({controls: value, revision: message.revision});
        } else {
          const colors = window.veronaAppearance.apply(message.colors);
          await desktop.agentAppearance({colors, revision: message.revision});
        }
      } catch (error) {
        failure(error);
        const result = {revision: message.revision, error: error.message};
        if (message.settings) await desktop.agentControls({...result, controls: controls.describe()});
        else await desktop.agentAppearance({...result, colors: window.veronaAppearance.read()});
      }
      return;
    }
    if (message.action === "cancel") {
      if (active?.id === message.id) {
        active.cancelled = true;
        active.controller.abort();
        active.audio?.pause();
      }
      return;
    }
    if (active) {
      await desktop.agentResult({ id: message.id, state: "failed", error: "Native player is busy." });
      return;
    }
    const job = { id: message.id, cancelled: false, controller: new AbortController() };
    active = job;
    let result = { id: job.id, state: "failed" };
    lock(true);
    if (controls) await controls.report(null);
    try {
      const prepared = await prepare(message);
      job.audio = prepared.audio;
      lock(true);
      if (job.cancelled) throw new Error("Speech cancelled.");
      await waitForAudio(job.audio, "loadedmetadata", job.controller.signal, 15000);
      if (!Number.isFinite(job.audio.duration) || job.audio.duration <= 0 || job.audio.duration > 25) {
        throw new Error("Native speech duration is invalid.");
      }
      const ended = waitForAudio(job.audio, "ended", job.controller.signal, 35000);
      // Attach rejection handling before play(), which can itself fail.
      ended.catch(() => {});
      await job.audio.play();
      await desktop.agentResult({ id: job.id, state: "playing", ...prepared.cache });
      await ended;
      result = { id: job.id, state: "completed", ...prepared.cache };
    } catch (error) {
      result = { id: job.id, state: job.cancelled ? "cancelled" : "failed",
        ...(job.cancelled ? {} : { error: error.message || String(error) }) };
      if (!job.cancelled) failure(error);
    } finally {
      job.audio?.pause();
      job.controller.abort();
      active = null;
      lock(false);
      if (controls) await controls.report(null);
    }
    try { await desktop.agentResult(result); }
    catch (error) { failure(error); }
  });
  if (desktop.agentAppearance && globalThis.window?.veronaAppearance) {
    window.addEventListener("verona-appearance", event => {
      desktop.agentAppearance({colors: event.detail}).catch(failure);
    });
    await desktop.agentAppearance({colors: window.veronaAppearance.read()});
  }
  if (desktop.agentControls && globalThis.document) {
    const {attachSessionControls} = await import("/session-controls.mjs");
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "/session-controls.css"; document.head.append(link);
    controls = attachSessionControls(desktop, failure);
    await controls.report(null);
    await desktop.command("overlay");
  }
  await desktop.agentReady();
}
