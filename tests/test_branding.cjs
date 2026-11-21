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
  const ico=await fs.readFile(iconPath),frames=[];
  for(let entry=0;entry<ico.readUInt16LE(4);entry++) {
    const position=6+entry*16,size=ico.readUInt32LE(position+8),offset=ico.readUInt32LE(position+12);
    const frame=nativeImage.createFromBuffer(ico.subarray(offset,offset+size));
    assert.deepEqual(frame.getSize(),{width:ico[position]||256,height:ico[position+1]||256});
    frames.push(frame);
  }
  assert.deepEqual(frames.map(frame=>frame.getSize().width),[16,24,32,48,64,128,256]);
  const png=nativeImage.createFromPath(path.join(__dirname,"..","verona","web","favicon-32.png"));
  assert.deepEqual(png.getSize(),{width:32,height:32});
  for(const image of [...frames,icon,png,nativeImage.createFromPath(path.join(__dirname,"..","verona","web","verona-logo.png"))]) {
    const {width,height}=image.getSize(),bitmap=image.toBitmap();
    assert(bitmap.some((value,index)=>index%4===3 && value>0),"Artwork must remain visible.");
    for(const pixel of [0,width-1,(height-1)*width,width*height-1]) {
      assert.equal(bitmap[pixel*4+3],0,"Icon corners must stay transparent, not become a blue square.");
    }
  }
  const window=new BrowserWindow({show:false,icon:iconPath,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  assert(window.getNativeWindowHandle().length>0);
  assert(!window.isVisible());
  await fs.writeFile(path.join(output,"native-icon.png"),icon.toPNG());
  await fs.writeFile(path.join(output,"report.json"),JSON.stringify({
    iconDecoded:true,iconSize:icon.getSize(),faviconSize:png.getSize(),
    nativeWindowConstructed:true,hidden:true,
    transparentIconCorners:true,
    decodedIconSizes:frames.map(frame=>frame.getSize().width),
    limits:"Source window icon, not a rewritten Electron.exe or a manual Windows taskbar acceptance.",
  },null,2));
  window.destroy();
  clearTimeout(deadline);
  app.quit();
}).catch(async error=>{
  await fs.writeFile(path.join(output,"error.txt"),error.stack);
  clearTimeout(deadline);app.exit(1);
});
