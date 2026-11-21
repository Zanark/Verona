const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function trimSamples(input, rate = 24000, maxSeconds = 4.2) {
  const block = Math.round(rate*.01), energy = [];
  for (let i=0; i<input.length; i+=block) {
    let sum=0;
    for (let j=i; j<Math.min(i+block,input.length); j++) sum+=input[j]**2;
    energy.push(Math.sqrt(sum/Math.min(block,input.length-i)));
  }
  const threshold = Math.max(.002, Math.max(...energy)*.018);
  const first = energy.findIndex(value => value >= threshold);
  const last = energy.findLastIndex(value => value >= threshold);
  if (first < 0) throw Error("No usable idle effect above the silence threshold.");
  const start = Math.max(0, first*block-Math.round(.04*rate));
  const end = Math.min(input.length,(last+1)*block+Math.round(.04*rate),start+Math.round(maxSeconds*rate));
  const samples = Float32Array.from(input.subarray(start,end));
  let peak=0;
  for (const value of samples) {
    if (!Number.isFinite(value)) throw Error("Non-finite decoded audio.");
    peak=Math.max(peak,Math.abs(value));
  }
  const fade=Math.min(Math.round(rate*.025),Math.floor(samples.length/2));
  for(let i=0;i<samples.length;i++)
    samples[i]*=Math.min(1,.9/peak)*Math.min(1,i/fade,(samples.length-1-i)/fade);
  return {samples,startSeconds:start/rate,endSeconds:end/rate,sourceSeconds:input.length/rate,
    activeEndSeconds:Math.min(input.length,(last+1)*block)/rate,
    peakSeconds:energy.indexOf(Math.max(...energy))*block/rate};
}

function wav(samples) {
  const bytes=Buffer.alloc(44+samples.length*2);
  bytes.write("RIFF");bytes.writeUInt32LE(bytes.length-8,4);bytes.write("WAVEfmt ",8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);
  bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write("data",36);
  bytes.writeUInt32LE(samples.length*2,40);
  samples.forEach((value,i)=>bytes.writeInt16LE(Math.round(value*32767),44+i*2));
  return bytes;
}

async function main() {
  const {app,BrowserWindow}=require("electron");
  const arg=(name,fallback)=>{
    const value=process.argv.find(value=>value.startsWith(`--${name}=`));
    if(!value) {
      if(fallback!==undefined)return fallback;
      throw Error(`Missing --${name}=...`);
    }
    return value.slice(name.length+3);
  };
  const kind=arg("kind","yawn");
  if(!["yawn","sneeze"].includes(kind))throw Error("Kind must be yawn or sneeze.");
  const maxSeconds=kind==="sneeze"?2.7:4.2;
  const output=path.resolve(arg("output"));
  await fs.mkdir(output,{recursive:false});
  app.setPath("userData",path.join(output,"decoder-profile"));
  await app.whenReady();
  const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
  window.webContents.setAudioMuted(true);
  try {
    await window.loadURL("about:blank");
    const receipt={kind,decoder:"Installed Electron OfflineAudioContext; no playback, network or microphone.",clips:{}};
    for(const style of ["male","female"]) {
      const source=path.resolve(arg(style)),stat=await fs.stat(source);
      if(stat.size>5000000)throw Error("Idle-effect input exceeds five MB.");
      const original=await fs.readFile(source);
      const decoded=await window.webContents.executeJavaScript(`(async()=>{
        const context=new OfflineAudioContext(1,1,24000);
        const bytes=Uint8Array.from(atob(${JSON.stringify(original.toString("base64"))}),c=>c.charCodeAt(0));
        const buffer=await context.decodeAudioData(bytes.buffer);
        if(buffer.duration>60)throw Error("Input exceeds sixty seconds.");
        const mono=new Float32Array(buffer.length);
        for(let c=0;c<buffer.numberOfChannels;c++){
          const data=buffer.getChannelData(c);
          for(let i=0;i<mono.length;i++)mono[i]+=data[i]/buffer.numberOfChannels;
        }
        return Array.from(mono);
      })()`);
      const {samples,...timing}=trimSamples(Float32Array.from(decoded),24000,maxSeconds);
      const bytes=wav(samples);
      await fs.writeFile(path.join(output,`${kind}-${style}.wav`),bytes,{flag:"wx"});
      receipt.clips[style]={...timing,duration:samples.length/24000,bytes:bytes.length,
        sourceSha256:crypto.createHash("sha256").update(original).digest("hex"),
        sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
    }
    await fs.writeFile(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
    console.log(JSON.stringify(receipt));
  } finally {window.destroy();app.quit();}
}
module.exports={trimSamples,wav};
if(process.versions.electron || require.main===module)
  main().catch(error=>{console.error(error);require("electron").app.exit(1);});
