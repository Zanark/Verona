export function attachPerformanceMode(enabled, opacity, media, apply, {
  quickOpacity, output, quickOutput,
} = {}) {
  let previous = "";
  const refresh = () => {
    const speaking = media.some(item => !item.paused && !item.ended && !item.error);
    const sleeping = enabled && !speaking;
    const percent = enabled ? sleeping ? 10 : 100 : Number(opacity.value);
    if (quickOpacity) quickOpacity.value = opacity.value;
    if (output) output.value = `${opacity.value}%`;
    if (quickOutput) quickOutput.value = `${opacity.value}%`;
    const key = `${percent}:${opacity.value}`;
    if (key === previous) return;
    previous = key;
    apply({sleeping, opacity: percent / 100, enabled});
  };
  opacity.addEventListener("input", refresh);
  quickOpacity?.addEventListener("input", () => {
    opacity.value = quickOpacity.value;
    opacity.dispatchEvent(new Event("input", {bubbles: true}));
  });
  for (const item of media) {
    for (const event of ["play", "playing", "pause", "ended", "error", "emptied"]) {
      item.addEventListener(event, refresh);
    }
  }
  refresh();
  return {refresh};
}
