// The passcode lock screen (the liquid glass card Flows serves, so a locked
// share looks the same in every app) and the "access granted" beat.
// Pure HTML builders: no React, no DB.

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">`;

/** Liquid glass lock: a white frosted card with the title, 1 masked field,
 *  Enter submits. With a `backdrop` (a tiny PNG data URI of the diagram) the
 *  card sits on that diagram, blurred past reading, instead of a plain wash. */
export function gatePage({ action, title, bad, backdrop }: { action: string; title: string; bad?: boolean; backdrop?: string | null }): string {
  const bg = typeof backdrop === "string" && backdrop.startsWith("data:image/png;base64,") ? backdrop : null;
  const alert = bad ? `<div class="alert" role="alert">Wrong passcode</div>` : `<div class="alert hidden">&nbsp;</div>`;
  return `<!DOCTYPE html><html lang="en"${bg ? ` class="has-blur"` : ""}><head>
${HEAD}
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:linear-gradient(160deg,#f7f8fb 0%,#eceef5 100%);color:#1c1e21;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* liquid glass: the diagram shows through, a prismatic rim catches the light */
.glass{position:relative;width:max-content;min-width:min(480px,calc(100vw - 32px));max-width:min(760px,calc(100vw - 32px));padding:44px 44px 36px;border-radius:44px;text-align:center;isolation:isolate;
  background:linear-gradient(135deg,rgba(255,255,255,0.86) 0%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0.78) 100%);
  -webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);
  box-shadow:0 0 0 1px rgba(255,255,255,0.95),0 0 0 6px rgba(255,255,255,0.28),0 0 70px 14px rgba(255,255,255,0.85),0 30px 80px -20px rgba(60,70,120,0.18),inset 0 1px 0 rgba(255,255,255,1),inset 0 0 0 2px rgba(255,255,255,0.8),inset 0 0 48px rgba(255,255,255,0.75),inset 0 -18px 36px -24px rgba(170,160,255,0.3)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;pointer-events:none;z-index:1;
  background:linear-gradient(135deg,rgba(255,200,180,0.9) 0%,rgba(255,255,255,0.98) 12%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.98) 88%,rgba(180,210,255,0.9) 100%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;
  background:radial-gradient(55% 40% at 16% 8%,rgba(255,255,255,1) 0%,rgba(255,255,255,0.6) 30%,rgba(255,255,255,0) 65%),radial-gradient(50% 38% at 90% 96%,rgba(255,255,255,0.85) 0%,rgba(255,255,255,0) 60%),radial-gradient(42% 32% at 4% 6%,rgba(255,190,170,0.35) 0%,rgba(255,190,170,0) 70%),radial-gradient(40% 32% at 97% 96%,rgba(170,150,255,0.35) 0%,rgba(170,150,255,0) 70%),radial-gradient(30% 25% at 96% 6%,rgba(150,215,255,0.25) 0%,rgba(150,215,255,0) 70%)}
.logo{display:block;margin:0 auto 20px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.3),inset 0 0 0 1px rgba(255,255,255,0.3)}
.caption{font-size:14px;color:#6b7280;margin-top:8px;line-height:1.5}
.name{font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alert{margin:18px 0 -6px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
.entry{margin-top:30px;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 20px;border-radius:999px;
  background:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,1);
  box-shadow:inset 0 1px 1px rgba(255,255,255,1),0 0 0 1px rgba(255,255,255,0.95),0 0 28px 4px rgba(255,255,255,0.8),0 12px 34px -8px rgba(110,100,200,0.18);transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 0 1px 1px rgba(255,255,255,1),0 0 0 1px rgba(255,255,255,0.95),0 0 28px 4px rgba(255,255,255,0.8),0 12px 34px -8px rgba(110,100,200,0.25),0 0 0 4px rgba(129,140,248,0.28)}
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
.blur{position:fixed;inset:-60px;background:#fff url("${bg || ""}") center/contain no-repeat;filter:blur(22px) saturate(1.1);z-index:0}
.veil{position:fixed;inset:0;background:rgba(255,255,255,0.4);z-index:0}
.has-blur .room{position:relative;z-index:1}
html.has-blur,html.has-blur body{background:#f5f6f8}
@media (prefers-reduced-motion:reduce){.alert,.go{animation:none;transition:none}}
</style>
</head><body>
${bg ? `<div class="blur" aria-hidden="true"></div><div class="veil" aria-hidden="true"></div>` : ""}
<div class="room">
<form class="glass" method="POST" action="${esc(action)}">
  <img class="logo" src="/icon.png" alt="Sequences" width="76" height="76">
  <div class="name">${esc(title)}</div>
  <div class="caption">Protected sequence</div>
  ${alert}

  <div class="entry">
    <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
    <input name="passcode" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="Passcode" aria-label="Passcode">
    <button class="go" type="submit" aria-label="Open sequence"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
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
