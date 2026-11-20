export function attachSessionControls(desktop, failure) {
  const excluded = new Set(["text", "seek", "preview", "generate"]);
  const elements = () => [...document.querySelectorAll("input,select")].filter(element =>
    element.id && !excluded.has(element.id) && !/(?:-color|-hex)$/.test(element.id)
    && ["checkbox", "range", "number", "select-one"].includes(element.type));
  const describe = () => elements().map(element => ({
    id: element.id, type: element.type,
    label: element.getAttribute("aria-label") || element.id.replaceAll("-", " "),
    value: element.type === "checkbox" ? element.checked : element.value,
    disabled: element.disabled || Boolean(element.closest("[hidden]")),
    min: element.min || "", max: element.max || "", step: element.step || "",
    options: element.tagName === "SELECT" ? [...element.options].map(option =>
      ({value: option.value, label: option.textContent, disabled: option.disabled})) : [],
  }));
  let timer;
  const report = revision => desktop.agentControls({controls: describe(), revision}).catch(failure);
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => report(null), 40); };
  for (const element of elements()) element.addEventListener("input", changed);
  const observer = new MutationObserver(changed);
  observer.observe(document.body, {subtree: true, attributes: true,
    attributeFilter: ["disabled", "hidden"]});
  const apply = settings => {
    const available = new Map(elements().map(element => [element.id, element]));
    const updates = Object.entries(settings).map(([id, value]) => {
      const element = available.get(id);
      if (!element || element.disabled) throw new Error(`Control ${id} is not available in this head.`);
      const probe = element.cloneNode(true);
      if (element.type === "checkbox") {
        if (typeof value !== "boolean") throw new Error(`${id} requires true or false.`);
        probe.checked = value;
      } else {
        if (typeof value !== "string" || value.length > 200) throw new Error(`Invalid ${id} value.`);
        if (element.tagName === "SELECT" &&
            ![...element.options].some(option => option.value === value && !option.disabled)) {
          throw new Error(`Choose an available ${id} option.`);
        }
        if (element.tagName !== "SELECT" && (!Number.isFinite(Number(value)) ||
            (element.min !== "" && Number(value) < Number(element.min)) ||
            (element.max !== "" && Number(value) > Number(element.max)))) {
          throw new Error(`${id} is outside its supported range.`);
        }
        probe.value = value;
        if (!probe.checkValidity()) throw new Error(`Invalid ${id} value.`);
      }
      return [element, value];
    });
    for (const [element, value] of updates) {
      if (element.type === "checkbox") element.checked = value;
      else element.value = value;
      element.dispatchEvent(new Event("input", {bubbles: true}));
    }
    return describe();
  };
  document.documentElement.classList.add("managed-head");
  const label = document.createElement("div");
  label.className = "session-label";
  label.textContent = document.title;
  document.body.append(label);
  return {apply, report, describe};
}
