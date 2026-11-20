export function attachSessionControls(desktop, failure) {
  let options = document.getElementById("overlay-options");
  if (!options) {
    const menu = document.createElement("details");
    menu.className = "session-menu";
    const toggle = document.createElement("summary");
    toggle.textContent = "...";
    toggle.setAttribute("aria-label", "Floating controls");
    options = document.createElement("div");
    options.className = "session-options";
    menu.append(toggle, options);
    document.body.append(menu);
    const drag = document.createElement("span");
    drag.className = "drag-handle";
    drag.textContent = "Drag to move";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close head";
    close.addEventListener("click", async () => {
      try { await desktop.command("close"); }
      catch (error) { failure(error); }
    });
    options.append(drag, close);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menu.open) { menu.open = false; toggle.focus(); }
    });
    document.addEventListener("pointerdown", event => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  }
  let pin = document.getElementById("pin-overlay");
  if (!pin) {
    pin = document.createElement("input");
    pin.id = "pin-overlay";
    pin.type = "checkbox";
    pin.checked = true;
    pin.addEventListener("input", async () => {
      try { await desktop.command("pin", pin.checked); }
      catch (error) { failure(error); }
    });
  }
  pin.setAttribute("aria-label", "Always on top");
  const pinLabel = document.createElement("label");
  pinLabel.className = "session-pin";
  pinLabel.append(pin, document.createTextNode("Always on top"));
  options.append(pinLabel);
  const excluded = new Set(["text", "seek", "preview", "generate"]);
  const elements = () => [...document.querySelectorAll("input,select")].filter(element =>
    element.id && !excluded.has(element.id) && !/(?:-color|-hex)$/.test(element.id)
    && ["checkbox", "range", "number", "select-one"].includes(element.type));
  const describe = () => elements().map(element => ({
    id: element.id, type: element.type,
    label: element.getAttribute("aria-label") || element.id.replaceAll("-", " "),
    value: element.type === "checkbox" ? element.checked : element.value,
    // Collapsing the menu must not disable pinning from the central manager.
    disabled: element.disabled || (element !== pin && Boolean(element.closest("[hidden]"))),
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
  options.append(label);
  return {apply, report, describe};
}
