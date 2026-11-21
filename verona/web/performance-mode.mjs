export function attachPerformanceMode(input, opacity, media, apply, {
  quickInput, quickOpacity, output, quickOutput,
} = {}) {
  let previous = "";
  const refresh = () => {
    const speaking = media.some(item => !item.paused && !item.ended && !item.error);
    const sleeping = input.checked && !speaking;
    const percent = input.checked ? sleeping ? 10 : 100 : Number(opacity.value);
    if (quickInput) quickInput.checked = input.checked;
    if (quickOpacity) quickOpacity.value = opacity.value;
    if (output) output.value = `${opacity.value}%`;
    if (quickOutput) quickOutput.value = `${opacity.value}%`;
    const key = `${input.checked}:${percent}:${opacity.value}`;
    if (key === previous) return;
    previous = key;
    apply({sleeping, opacity: percent / 100, enabled: input.checked});
  };
  for (const element of [input, opacity]) element.addEventListener("input", refresh);
  for (const [quick, original] of [[quickInput, input], [quickOpacity, opacity]]) {
    quick?.addEventListener("input", () => {
      if (original.type === "checkbox") original.checked = quick.checked;
      else original.value = quick.value;
      original.dispatchEvent(new Event("input", {bubbles: true}));
    });
  }
  for (const item of media) {
    for (const event of ["play", "playing", "pause", "ended", "error", "emptied"]) {
      item.addEventListener(event, refresh);
    }
  }
  refresh();
  return {refresh};
}
