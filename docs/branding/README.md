# Verona identity

`verona-master.png` is original generated artwork requested by the owner on
2026-11-21: a cyan polygon face, coral speaking mouth and midnight-navy field.
It is a logo, not an actual model capture, a measured face or reference anatomy.
No franchise character or third-party logo is used.

With the already available Pillow authoring tool:

```powershell
python -m scripts.build_branding
```

This rebuilds the 512px `verona/web/verona-logo.png`, 32px favicon and
seven-size 16/24/32/48/64/128/256px Windows ICO. Electron's source
`BrowserWindow` uses the ICO and Windows application identity `Zanark.Verona`.
The manager, Claire and native MPFB pages serve the same allowlisted local
favicons. Existing running windows need an explicit restart to load them.

This does not change the downloaded `electron.exe` file's embedded resources,
create an installer or replace existing shell shortcuts. No external font,
image request, runtime dependency or executable patching is involved.
