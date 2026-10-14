import type { ShareChrome } from "@/lib/share-chrome";

// The passcode lock screen: the liquid glass card Flows serves, so a locked
// share looks the same in every app. A pure HTML builder: no React, no DB.
// A right passcode goes straight to /s/:id?reveal=1, which plays the reveal
// (app/s/[id]/UnlockReveal.tsx).

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">`;

/** What the share page looks like behind the glass: the diagram as a small
 *  PNG data URI shown at the diagram's own size on the paper, its byline, and
 *  the chrome of its theme. Blurred past reading on the page. */
export type Scene = { png: string; width: number; height: number; byline: string; c: ShareChrome };

const TILES = [
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h7a5 5 0 0 1 3.5 8.6A5.5 5.5 0 0 1 13.5 21H6zm3 7h4a2 2 0 1 0 0-4H9zm0 8h4.5a2.5 2.5 0 1 0 0-5H9z"/></svg>`,
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>`,
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.4 20.5h-3.5v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1M7.1 20.5H3.6V9h3.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5c0 1 .8 1.8 1.8 1.8h20.4c1 0 1.8-.8 1.8-1.8V1.7C24 .8 23.2 0 22.2 0"/></svg>`,
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.3h3.3l-7.2 8.2 8.5 11.3h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3h6.8l4.7 6.2zm-1.2 17.5h1.9L7.1 4.1H5.1z"/></svg>`,
].map((i) => `<i>${i}</i>`).join("");

/** The share page, as the reader would see it, drawn behind the glass. */
function sceneHtml(title: string, sc: Scene): string {
  const { c } = sc;
  return `<div class="scene" aria-hidden="true" style="background:${c.ground}">
  <div class="bar" style="background:${c.bar};border-bottom:1px solid ${c.barBorder};color:${c.barText}"><div class="wm"><img src="/icon-512.png" width="28" height="28" alt=""><span>Sequences</span></div><div class="pill"><span class="act"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg><span>Download SVG</span></span></div></div>
  <div class="ground"><div class="paper" style="background:${c.card};border:1px solid ${c.cardBorder}"><div><h1 style="color:${c.barText}">${esc(title)}</h1><div class="by" style="color:${c.muted}"><b>BH</b><span style="opacity:.5"> | </span>${esc(sc.byline)}</div></div><div class="dg"><img src="${sc.png}" alt="" style="aspect-ratio:${sc.width}/${sc.height};width:min(${sc.width}px,100%);max-height:100%"></div></div></div>
  <div class="foot"><div class="sf"><span class="built">Built by <img src="/brand/bunlong-anim-poster.webp" height="26" alt=""></span><div class="tiles">${TILES}</div></div></div>
</div>`;
}

/** Liquid glass lock: the WWDC25 recipe from freefrontend.com/css-liquid-glass
 *  (lucasromerodb/liquid-glass-effect-macos), layer for layer, minus its
 *  displacement ripple. An effect layer blurs the backdrop 3 px, a 25% white
 *  tint sits over it, a shine layer draws the 2 inset highlights, the content
 *  is on top. With a `scene` the card sits on the share page itself, header,
 *  paper, diagram and footer, blurred past reading. */
export function gatePage({ action, title, bad, scene }: { action: string; title: string; bad?: boolean; scene?: Scene | null }): string {
  const sc = scene && scene.png.startsWith("data:image/png;base64,") ? scene : null;
  const alert = bad ? `<div class="alert" role="alert">Wrong passcode</div>` : `<div class="alert hidden">&nbsp;</div>`;
  return `<!DOCTYPE html><html lang="en"><head>
${HEAD}
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:linear-gradient(160deg,#e8ecf6 0%,#d6dcea 100%);color:#1c1e21;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.room{position:relative;z-index:1;min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* LIQUID GLASS: wrapper, effect, tint, shine, text */
.glass{position:relative;width:max-content;min-width:min(480px,calc(100vw - 32px));max-width:min(760px,calc(100vw - 32px));border-radius:44px;overflow:hidden;text-align:center;
  box-shadow:0 6px 6px rgba(0,0,0,0.2),0 0 20px rgba(0,0,0,0.1)}
.effect{position:absolute;z-index:0;inset:0;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);overflow:hidden;isolation:isolate}
.tint{z-index:1;position:absolute;inset:0;background:rgba(255,255,255,0.25)}
.shine{position:absolute;inset:0;z-index:2;overflow:hidden;border-radius:inherit;
  box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.5),inset -1px -1px 1px 1px rgba(255,255,255,0.5)}
.body{position:relative;z-index:3;padding:44px 44px 36px}
.logo{display:block;margin:0 auto 20px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.3),inset 0 0 0 1px rgba(255,255,255,0.3)}
.caption{font-size:14px;color:#374151;margin-top:8px;line-height:1.5}
.name{font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:#0b1220;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alert{margin:18px 0 -6px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
/* the field: the same glass, 1 size down */
.entry{position:relative;margin-top:30px;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 20px;border-radius:999px;
  background:rgba(255,255,255,0.3);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);
  box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.6),inset -1px -1px 1px 1px rgba(255,255,255,0.6),0 4px 10px rgba(0,0,0,0.08);transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 2px 2px 1px 0 rgba(255,255,255,0.6),inset -1px -1px 1px 1px rgba(255,255,255,0.6),0 4px 10px rgba(0,0,0,0.08),0 0 0 4px rgba(129,140,248,0.28)}
.entry svg.lock{flex:none;width:22px;height:22px;color:#374151}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#0b1220;font-size:18px;font-weight:600;font-family:inherit;letter-spacing:0.18em;padding:12px 0;-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#4b5563;font-weight:400;letter-spacing:0.01em}
.go{flex:none;width:48px;height:48px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;color:#fff;
  background:linear-gradient(145deg,#a5a8ff 0%,#8f8bf4 100%);box-shadow:0 8px 18px -6px rgba(110,100,230,0.6),inset 0 1px 0 rgba(255,255,255,0.5);transition:transform .12s,box-shadow .12s}
.go:hover{transform:translateY(-1px);box-shadow:0 10px 22px -6px rgba(110,100,230,0.7),inset 0 1px 0 rgba(255,255,255,0.5)}
.go:active{transform:translateY(0) scale(0.97)}
.go:focus-visible{outline:3px solid rgba(129,140,248,0.6);outline-offset:2px}
.go svg{width:20px;height:20px}
/* THE SCENE: the share page as the reader would see it (app/s/[id]/page.tsx),
   header, paper, diagram, footer, blurred just past reading */
.scene{position:fixed;inset:0;z-index:0;display:flex;flex-direction:column;overflow:hidden;filter:blur(7px) saturate(1.1);font-family:system-ui,-apple-system,sans-serif}
.bar{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 20px}
.wm{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:800;letter-spacing:-0.01em}.wm img{border-radius:7px}
.pill{display:flex;align-items:center;background:#fff;border:1px solid #e4e6e8;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:4px 6px}
.act{display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;color:#64748b;font-size:13px}
.ground{flex:1;min-height:0;padding:20px 20px 0}
.paper{height:100%;display:flex;flex-direction:column;gap:12px;padding:28px;box-shadow:0 1px 3px rgba(15,23,42,0.06);overflow:hidden}
.paper h1{font-size:24px;line-height:1.2;font-weight:700}
.by{margin-top:6px;font-size:11px}
.dg{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.foot{flex:none;padding:0 20px 12px}
.sf{border-top:1px solid #e6e8ee;margin-top:20px;padding-top:14px;display:flex;align-items:center;justify-content:space-between}
.built{font-size:13px;color:#94a3b8;display:flex;align-items:center;gap:8px}
.tiles{display:flex;gap:6px}.tiles i{width:30px;height:30px;border-radius:8px;border:1px solid #e6e8ee;background:#fff;display:flex;align-items:center;justify-content:center;color:#64748b}
@media (prefers-reduced-motion:reduce){.alert,.go{animation:none;transition:none}}
</style>
</head><body>
${sc ? sceneHtml(title, sc) : ""}
<div class="room">
<form class="glass" method="POST" action="${esc(action)}">
  <div class="effect" aria-hidden="true"></div>
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
