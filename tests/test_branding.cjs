// Invoke with the prepared Electron and an explicitly owned disposable profile/output.
const {app, BrowserWindow, nativeImage} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(arg=>arg.startsWith("--output="))?.slice(9);
const profile = process.argv.find(arg=>arg.startsWith("--user-data-dir="))?.slice(16);
assert(output && profile,"Explicit owned output and disposable profile are required.");
app.setPath("userData",profile);
const deadline=setTimeout(()=>app.exit(1),20000);
app.whenReady().then(async()=>{
  const iconPath=path.join(__dirname,"..","verona","web","verona.ico");
  const icon=nativeImage.createFromPath(iconPath);
  assert(!icon.isEmpty(),"The multiresolution Windows icon must actually decode.");
  const png=nativeImage.createFromPath(path.join(__dirname,"..","verona","web","favicon-32.png"));
  assert.deepEqual(png.getSize(),{width:32,height:32});
  const window=new BrowserWindow({show:false,icon:iconPath,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  assert(window.getNativeWindowHandle().length>0);
  assert(!window.isVisible());
  await fs.writeFile(path.join(output,"native-icon.png"),icon.toPNG());
  await fs.writeFile(path.join(output,"report.json"),JSON.stringify({
    iconDecoded:true,iconSize:icon.getSize(),faviconSize:png.getSize(),
    nativeWindowConstructed:true,hidden:true,
    limits:"Source window icon, not a rewritten Electron.exe or a manual Windows taskbar acceptance.",
  },null,2));
  window.destroy();
  clearTimeout(deadline);
  app.quit();
}).catch(async error=>{
  await fs.writeFile(path.join(output,"error.txt"),error.stack);
  clearTimeout(deadline);app.exit(1);
});
