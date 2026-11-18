// Bounded real-browser check using Node's built-in CDP/WebSocket support.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const [origin, capability, debuggingPort, output] = process.argv.slice(2);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
const target = pages.find((item) => item.type === "page");
assert(target, "An owned browser page must exist.");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let next = 0, generationRequest;
const pending = new Map(), exceptions = [], external = [], networkFailures = [];
const report = { audioAudition: "Playback tested muted; no listening/human acceptance claim.", checks: [] };
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails.text);
  } else if (message.method === "Network.requestWillBeSent") {
    const { request, requestId } = message.params;
    if (request.url === `${origin}/api/generate`) generationRequest = requestId;
    if (!request.url.startsWith(origin + "/") && !request.url.startsWith(`blob:${origin}/`)) {
      external.push(request.url.split("#")[0]);
    }
  } else if (message.method === "Network.loadingFailed") {
    networkFailures.push({
      errorText: message.params.errorText, blockedReason: message.params.blockedReason,
    });
  }
});
function cdp(method, params = {}) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}
async function waitFor(expression, timeout = 60000) {
  const until = Date.now() + timeout;
  do {
    const value = await evaluate(expression);
    if (value) return value;
    await delay(50);
  } while (Date.now() < until);
  const state = await evaluate(`({status:document.getElementById("status")?.textContent,error:document.getElementById("error")?.textContent})`);
  throw new Error(`Browser condition timed out: ${expression}; ${JSON.stringify(state)}`);
}
async function screenshot(name) {
  const data = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(data.data, "base64"));
}
async function click(id) {
  const point = await evaluate(`(() => {
    const element=document.getElementById(${JSON.stringify(id)});
    element.scrollIntoView({block:"nearest"});
    const rect=element.getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
async function check(name, run) {
  await run();
  report.checks.push(name);
}
async function generate(text, expression = "neutral", voice = null) {
  await evaluate(`document.getElementById("text").value=${JSON.stringify(text)};
    document.getElementById("expression").value=${JSON.stringify(expression)};
    ${voice ? `document.getElementById("voice").value=${JSON.stringify(voice)};` : ""}`);
  await click("generate");
  await waitFor(`!document.getElementById("play").disabled || !document.getElementById("error").hidden`);
  const error = await evaluate(`document.getElementById("error").hidden ? null : document.getElementById("error").textContent`);
  assert.equal(error, null, error || "");
  const body = await cdp("Network.getResponseBody", { requestId: generationRequest });
  return JSON.parse(body.body);
}
try {
  await Promise.all([cdp("Page.enable"), cdp("Runtime.enable"), cdp("Network.enable")]);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 980, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${origin}/#${capability}` });
  await waitFor(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  await check("Real WebGL2 neutral face, no GL errors and visible connected geometry", async () => {
    const result = await evaluate(`(() => {
      document.getElementById("yaw").dispatchEvent(new Event("input"));
      const canvas=document.getElementById("face"), gl=canvas.getContext("webgl2");
      const pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let colored=0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i+1]>60 && pixels[i+1]>pixels[i]*1.3)colored++;
      return {error:gl.getError(),colored,width:canvas.width,height:canvas.height};
    })()`);
    assert.equal(result.error, 0);
    assert(result.colored > 1000, JSON.stringify(result));
    report.renderer = result;
    await screenshot("01-neutral");
  });
  const greeting = await generate("Hey, how are you?");
  report.greeting = greeting;
  await check("Actual text synthesis, complete motion and browser WAV decode", async () => {
    const data = await evaluate(`({duration:document.getElementById("audio").duration,
      source:document.getElementById("audio").currentSrc.startsWith("blob:"),
      ready:document.getElementById("audio").readyState,quote:document.getElementById("spoken").textContent})`);
    assert(Math.abs(data.duration - greeting.duration) < .01);
    assert.equal(data.source, true);
    assert(data.ready >= 1);
    assert.equal(data.quote, "Hey, how are you?");
    assert(greeting.maximumSkinChangeCm > .01);
    assert.equal(greeting.frames, Math.ceil(greeting.duration * 30));
  });
  await check("Real muted audio-clock advance and pause/resume", async () => {
    await evaluate(`document.getElementById("audio").muted=true;`);
    await click("play");
    await waitFor(`document.getElementById("audio").currentTime>.50`, 5000);
    await screenshot("02-speaking");
    await click("play");
    const data = await evaluate(`({time:document.getElementById("audio").currentTime,frame:document.getElementById("frame").textContent})`);
    await delay(200);
    const paused = await evaluate(`({time:document.getElementById("audio").currentTime,paused:document.getElementById("audio").paused})`);
    assert.equal(paused.paused, true);
    assert(Math.abs(data.time - paused.time) < .025);
    assert.notEqual(data.frame, `FRAME 1 / ${greeting.frames}`);
    await click("play");
    await waitFor(`document.getElementById("audio").currentTime>${paused.time + .12}`);
    await click("play");
  });
  await check("Seek selects the corresponding original-time neural frame", async () => {
    await evaluate(`document.getElementById("seek").value="1.25";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await waitFor(`Math.abs(document.getElementById("audio").currentTime-1.25)<.01`);
    const frame = await evaluate(`document.getElementById("frame").textContent`);
    assert.equal(frame, `FRAME 38 / ${greeting.frames}`);
    await screenshot("03-seek");
  });
  await check("Restart, replay and natural end clamp to the final frame", async () => {
    await click("restart");
    const restart = await evaluate(`({time:document.getElementById("audio").currentTime,
      paused:document.getElementById("audio").paused,frame:document.getElementById("frame").textContent})`);
    assert.equal(restart.time, 0);
    assert.equal(restart.paused, true);
    assert.equal(restart.frame, `FRAME 1 / ${greeting.frames}`);
    await evaluate(`document.getElementById("seek").value=String(document.getElementById("audio").duration-.07);
      document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await click("play");
    await waitFor(`document.getElementById("audio").ended`);
    assert.equal(await evaluate(`document.getElementById("frame").textContent`), `FRAME ${greeting.frames} / ${greeting.frames}`);
  });
  await check("Second generated clip uses explicit neural expression and replaces prior state", async () => {
    const happy = await generate("Hey, how are you?", "happy");
    report.happy = happy;
    assert.notEqual(happy.id, greeting.id);
    assert.notEqual(happy.motionSha256, greeting.motionSha256);
    assert.equal(happy.expression, "happy");
    await evaluate(`document.getElementById("seek").value=".9";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await screenshot("04-happy");
  });
  await check("Available alternate English voices, P/B/M and vowels generate complete clips", async () => {
    const voices = await evaluate(`Array.from(document.getElementById("voice").options, option=>option.value)`);
    const pbm = await generate("Mom, Bob packed my blue paper bag.", "sad", voices[Math.min(1, voices.length - 1)]);
    const vowels = await generate("We see a blue moon. Oh, wow!", "surprised", voices[Math.min(2, voices.length - 1)]);
    assert.equal(pbm.expression, "sad");
    assert.equal(vowels.expression, "surprised");
    assert(pbm.maximumSkinChangeCm > .01 && vowels.maximumSkinChangeCm > .01);
    report.pbm = pbm;
    report.vowels = vowels;
  });
  await check("Overlong synthesized speech fails explicitly without silent truncation", async () => {
    await evaluate(`document.getElementById("text").value="1234567890 ".repeat(24);`);
    await click("generate");
    await waitFor(`!document.getElementById("generate").disabled`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /25 seconds/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
  });
  await check("Controlled generation network failure is explicit and retryable", async () => {
    await cdp("Network.setBlockedURLs", { urls: [`${origin}/api/generate`] });
    await click("generate");
    await waitFor(`!document.getElementById("generate").disabled`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /Cannot reach local Verona/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
    await cdp("Network.setBlockedURLs", { urls: [] });
    const recovery = await generate("Five very vivid flowers wave in the wind.");
    report.recovery = recovery;
    assert(recovery.frames > greeting.frames);
    await evaluate(`document.getElementById("seek").value="1.2";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await screenshot("05-recovered-fv");
  });
  await check("Empty input rejected without losing the usable clip", async () => {
    await evaluate(`document.getElementById("text").value=" ";document.getElementById("generate").click();`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /1-280/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), false);
  });
  await check("Narrow layout has no horizontal page overflow", async () => {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(100);
    const bounds = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth})`);
    assert(bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
    await screenshot("06-mobile");
  });
  await check("Reload clears media and preserves only the capability URL", async () => {
    await cdp("Page.reload");
    await waitFor(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
    assert.equal(await evaluate(`document.getElementById("frame").textContent`), "NEUTRAL");
  });
  assert.deepEqual(exceptions, []);
  assert.deepEqual(external, []);
  assert(networkFailures.length === 1 && networkFailures[0].blockedReason === "inspector", JSON.stringify(networkFailures));
  report.pageExceptions = exceptions;
  report.externalPageRequests = external;
  report.expectedInjectedNetworkFailures = networkFailures.length;
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  try { await screenshot("failure"); } catch (captureError) { report.captureError = captureError.message; }
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "browser-report.json"), JSON.stringify(report, null, 2) + "\n");
  try { await cdp("Browser.close"); } catch (error) { report.closeError = error.message; }
  ws.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, error: report.error }));
