// The passcode lock screen (the liquid glass card Flows serves, so a locked
// share looks the same in every app) and the "access granted" beat.
// Pure HTML builders: no React, no DB.

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">`;

/** Liquid glass lock, the WWDC25 recipe (freefrontend.com/css-liquid-glass):
 *  a backdrop layer blurred and refracted through an SVG turbulence +
 *  displacement + specular-lighting filter, a white tint over it, a shine
 *  layer with inset white highlights, the content on top. Browsers that do
 *  not distort a backdrop (Safari) still get the blur, the tint and the shine.
 *  With a `backdrop` (a tiny PNG data URI of the diagram) the card sits on
 *  that diagram, blurred past reading, instead of a plain wash. */
export function gatePage({ action, title, bad, backdrop }: { action: string; title: string; bad?: boolean; backdrop?: string | null }): string {
  const bg = typeof backdrop === "string" && backdrop.startsWith("data:image/png;base64,") ? backdrop : null;
  const alert = bad ? `<div class="alert" role="alert">Wrong passcode</div>` : `<div class="alert hidden">&nbsp;</div>`;
  return `<!DOCTYPE html><html lang="en"${bg ? ` class="has-blur"` : ""}><head>
${HEAD}
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:linear-gradient(160deg,#f7f8fb 0%,#e9ecf5 100%);color:#1c1e21;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* the glass: 4 stacked layers, the content last */
.glass{position:relative;width:max-content;min-width:min(480px,calc(100vw - 32px));max-width:min(760px,calc(100vw - 32px));border-radius:44px;overflow:hidden;isolation:isolate;text-align:center;
  box-shadow:0 0 0 1px rgba(255,255,255,0.8),0 24px 70px -18px rgba(60,70,120,0.28),0 0 60px 8px rgba(255,255,255,0.55)}
.fx{position:absolute;inset:0;z-index:0;-webkit-backdrop-filter:blur(4px) saturate(170%);backdrop-filter:blur(4px) saturate(170%);filter:url(#liquid)}
.tint{position:absolute;inset:0;z-index:1;background:linear-gradient(135deg,rgba(255,255,255,0.62) 0%,rgba(255,255,255,0.4) 50%,rgba(255,255,255,0.56) 100%)}
.shine{position:absolute;inset:0;z-index:2;pointer-events:none;
  box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.85),inset -1px -1px 1px 1px rgba(255,255,255,0.6),inset 0 0 40px rgba(255,255,255,0.45);
  background:radial-gradient(60% 45% at 14% 6%,rgba(255,255,255,0.9) 0%,rgba(255,255,255,0) 60%),radial-gradient(50% 40% at 92% 98%,rgba(255,255,255,0.7) 0%,rgba(255,255,255,0) 60%)}
.body{position:relative;z-index:3;padding:44px 44px 36px}
.logo{display:block;margin:0 auto 20px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.3),inset 0 0 0 1px rgba(255,255,255,0.3)}
.caption{font-size:14px;color:#6b7280;margin-top:8px;line-height:1.5}
.name{font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alert{margin:18px 0 -6px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
/* the field is a smaller lens of the same glass */
.entry{position:relative;margin-top:30px;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 20px;border-radius:999px;
  background:rgba(255,255,255,0.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.95),inset -1px -1px 1px 1px rgba(255,255,255,0.7),0 0 0 1px rgba(255,255,255,0.9),0 10px 30px -10px rgba(110,100,200,0.3);transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.95),inset -1px -1px 1px 1px rgba(255,255,255,0.7),0 0 0 1px rgba(255,255,255,0.9),0 10px 30px -10px rgba(110,100,200,0.3),0 0 0 4px rgba(129,140,248,0.28)}
.entry svg.lock{flex:none;width:22px;height:22px;color:#6b7280}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#1f2937;font-size:18px;font-weight:600;font-family:inherit;letter-spacing:0.18em;padding:12px 0;-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#8b93a5;font-weight:400;letter-spacing:0.01em}
.go{flex:none;width:48px;height:48px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;color:#fff;
  background:linear-gradient(145deg,#a5a8ff 0%,#8f8bf4 100%);box-shadow:0 8px 18px -6px rgba(110,100,230,0.6),inset 0 1px 0 rgba(255,255,255,0.5);transition:transform .12s,box-shadow .12s}
.go:hover{transform:translateY(-1px);box-shadow:0 10px 22px -6px rgba(110,100,230,0.7),inset 0 1px 0 rgba(255,255,255,0.5)}
.go:active{transform:translateY(0) scale(0.97)}
.go:focus-visible{outline:3px solid rgba(129,140,248,0.6);outline-offset:2px}
.go svg{width:20px;height:20px}
/* the diagram behind: blurred enough to be unreadable, sharp enough to refract */
.blur{position:fixed;inset:-60px;background:#fff url("${bg || ""}") center/contain no-repeat;filter:blur(14px) saturate(1.15);z-index:0}
.veil{position:fixed;inset:0;background:rgba(255,255,255,0.3);z-index:0}
.has-blur .room{position:relative;z-index:1}
html.has-blur,html.has-blur body{background:#f5f6f8}
@media (prefers-reduced-motion:reduce){.alert,.go{animation:none;transition:none}}
</style>
</head><body>
<svg style="position:absolute;width:0;height:0" aria-hidden="true"><filter id="liquid" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="7" result="noise"/>
  <feGaussianBlur in="noise" stdDeviation="3" result="soft"/>
  <feSpecularLighting in="soft" surfaceScale="9" specularConstant="1.2" specularExponent="70" lighting-color="#ffffff" result="spec"><fePointLight x="-120" y="-160" z="320"/></feSpecularLighting>
  <feComposite in="spec" in2="SourceGraphic" operator="in" result="specIn"/>
  <feDisplacementMap in="SourceGraphic" in2="soft" scale="140" xChannelSelector="R" yChannelSelector="G" result="bent"/>
  <feComposite in="specIn" in2="bent" operator="arithmetic" k1="0" k2="0.9" k3="1" k4="0"/>
</filter></svg>
${bg ? `<div class="blur" aria-hidden="true"></div><div class="veil" aria-hidden="true"></div>` : ""}
<div class="room">
<form class="glass" method="POST" action="${esc(action)}">
  <div class="fx" aria-hidden="true"></div>
  <div class="tint" aria-hidden="true"></div>
  <div class="shine" aria-hidden="true"></div>
  <div class="body">
  <img class="logo" src="/icon.png" alt="Sequences" width="76" height="76">
  <div class="name">${esc(title)}</div>
  <div class="caption">Protected sequence</div>
  ${alert}

  <div class="entry">
    <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
    <input name="passcode" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="Passcode" aria-label="Passcode">
    <button class="go" type="submit" aria-label="Open sequence"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
  </div>
</form>
</div>
</body></html>`;
}

/** Radar sweep, SCANNING FILE -> ACCESS GRANTED, then on to the sequence. */
export function unlockedPage({ target }: { target: string }): string {
  const veil = "#ffffff";
  return `<!DOCTYPE html><html lang="en"><head>
${HEAD}
<title>ACCESS GRANTED</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
body{background:radial-gradient(ellipse at 50% 30%,#181818 0%,#000 80%);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.scene{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
  animation:appear .28s ease-out both,dissolve .48s ease-in 1.42s forwards}
@keyframes appear{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes dissolve{to{opacity:0;filter:blur(18px);transform:scale(1.04)}}
.veil{position:fixed;inset:0;background:${veil};opacity:0;pointer-events:none;animation:veil .55s ease-in 1.4s forwards}
@keyframes veil{to{opacity:1}}
/* radar dish: rings + crosshair etched into dark glass */
.radar{position:relative;width:46vmin;height:46vmin;max-width:340px;max-height:340px;border-radius:50%;overflow:hidden;
  background:
    repeating-radial-gradient(circle at 50% 50%,rgba(74,201,143,.16) 0 1px,transparent 1px 25%),
    linear-gradient(rgba(74,201,143,.16),rgba(74,201,143,.16)) 50% 0/1px 100% no-repeat,
    linear-gradient(rgba(74,201,143,.16),rgba(74,201,143,.16)) 0 50%/100% 1px no-repeat,
    radial-gradient(circle at 50% 50%,#0f1512 0%,#070908 70%,#000 100%);
  box-shadow:0 0 0 1px rgba(74,201,143,.22),0 0 40px rgba(74,201,143,.12),inset 0 0 40px rgba(0,0,0,.8)}
/* the beam: a thin bright edge with a long fading trail behind it */
.sweep{position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 0deg,rgba(74,201,143,0) 0deg,rgba(74,201,143,.05) 220deg,rgba(74,201,143,.28) 330deg,rgba(120,255,190,.9) 359deg,rgba(74,201,143,0) 360deg);
  animation:sweep 1.25s linear .15s 1 forwards;transform:rotate(0deg)}
@keyframes sweep{to{transform:rotate(720deg)}}
.center{position:absolute;top:50%;left:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#4ac98f;box-shadow:0 0 10px #4ac98f}
/* blips light up as the beam passes, then linger */
.blip{position:absolute;width:7px;height:7px;margin:-3.5px;border-radius:50%;background:#7dffbe;opacity:0;
  box-shadow:0 0 10px 2px rgba(125,255,190,.8);animation:blip 1.1s ease-out forwards}
.b1{top:32%;left:64%;animation-delay:.42s}.b2{top:66%;left:40%;animation-delay:.68s}.b3{top:44%;left:26%;animation-delay:.94s}
@keyframes blip{0%{opacity:0;transform:scale(.4)}15%{opacity:1;transform:scale(1.4)}100%{opacity:.75;transform:scale(1)}}
/* LCD readout under the dish */
.lcd{position:relative;height:18px;width:46vmin;max-width:340px;text-align:center;font-size:12px;letter-spacing:.34em;font-weight:700}
.lcd span{position:absolute;inset:0;white-space:nowrap}
.scan{color:rgba(74,201,143,.75);animation:scanTxt 1.2s steps(1) forwards}
@keyframes scanTxt{0%{opacity:1}100%{opacity:0}}
.ok{color:#7dffbe;text-shadow:0 0 12px rgba(125,255,190,.8);opacity:0;animation:okTxt .3s ease-out 1.2s forwards}
@keyframes okTxt{to{opacity:1}}
.scan i{font-style:normal;animation:dots 1.2s steps(4) infinite}
@keyframes dots{0%{content:""}}
@media (prefers-reduced-motion:reduce){.scene,.sweep,.blip,.veil,.scan,.ok{animation-duration:.01ms;animation-delay:0s}}
</style>
</head><body>
<div class="scene">
  <div class="radar">
    <div class="sweep"></div>
    <span class="blip b1"></span><span class="blip b2"></span><span class="blip b3"></span>
    <span class="center"></span>
  </div>
  <div class="lcd"><span class="scan">SCANNING FILE</span><span class="ok">ACCESS GRANTED</span></div>
</div>
<div class="veil"></div>
<script>
(function(){
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      var ctx = new AC();
      var beep = function(freq, start, dur){
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + start + 0.01);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.02);
      };
      beep(523.25, 0.42, 0.06); beep(523.25, 0.68, 0.06); beep(523.25, 0.94, 0.06); beep(987.77, 1.2, 0.26);
    }
  } catch(e){}
  setTimeout(function(){ window.location.replace(${JSON.stringify(target)}); }, 1950);
})();
</script>
</body></html>`;
}
