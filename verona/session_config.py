"""Lightweight named-head configuration shared by CLI, manager and hosts."""

import re


MODELS = {
    "claire": "Original Claire",
    "mpfb": "Native MPFB / neural transfer",
    "mark": "Original Mark",
    "reference-structure": "Claire / MPFB structural fit",
    "reference-shell": "Claire / historical subtle fit",
    "male-sharp": "Male-SharpJawline",
}
COLOR_KEYS = ("mesh", "eyes", "hair", "lips", "eyebrows")


def colors_patch(value):
    if not isinstance(value, dict) or set(value) - set(COLOR_KEYS):
        raise ValueError("Colors must contain only mesh, eyes, hair, lips and eyebrows.")
    result = {}
    for key, color in value.items():
        if color is None:
            result[key] = None
            continue
        if not isinstance(color, str) or not re.fullmatch(r"#?(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})", color.strip()):
            raise ValueError(f"{key}: supply a 3- or 6-digit RGB hex color, or null for original.")
        color = color.strip().lstrip("#")
        if len(color) == 3:
            color = "".join(c * 2 for c in color)
        result[key] = "#" + color.upper()
    return result


def appearance(model="claire", colors=None, session=None):
    if not isinstance(model, str) or model not in MODELS:
        raise ValueError("Choose one of the supported head variants.")
    return {"model": model, "session": session,
            "colors": {**dict.fromkeys(COLOR_KEYS), **colors_patch({} if colors is None else colors)}}
