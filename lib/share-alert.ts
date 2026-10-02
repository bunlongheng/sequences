// Who opened a public share link (/s/<id>). Fires once per real view: every
// view is written to sequence_share_view_log (so nothing is lost if a channel
// is down), emailed to OWNER_EMAIL (Resend when RESEND_API_KEY is set, else the
// keyless Formspree form), and dropped into the owner's Stickies as a note.
//
// Never throws and never blocks the response - a failed alert must not stop a
// reader from seeing the diagram. Modeled on the Stickies share alert.
import db from "@/lib/db";

/** Anything with headers().get - a Request's Headers or Next's ReadonlyHeaders. */
type HeaderBag = { get(name: string): string | null };

export interface ShareVisit {
  sequenceId: string;
  title: string;
  /** The share link that was opened, from the request host. */
  url: string | null;
  ip: string;
  city: string | null;
  country: string | null;
  userAgent: string | null;
  referer: string | null;
  at: Date;
  /** "view" = open link opened. "unlock" is reserved for a future passcode gate. */
  kind: "view" | "unlock";
  geo?: IpGeo;
}

/** Link-preview crawlers (iMessage, Slack, WhatsApp, Twitter, Facebook) fetch a shared URL without a person behind it. */
export function isBot(userAgent: string | null): boolean {
  return /bot|crawler|spider|preview|facebookexternalhit|slackbot|twitterbot|whatsapp|telegram|discord|skype|linkedin|applebot|headless/i.test(userAgent || "");
}

/** ipinfo.io fields for the visitor's IP. */
export interface IpGeo {
  hostname: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  loc: string | null;
  org: string | null;
  postal: string | null;
  timezone: string | null;
}

const PRIVATE_IP = /^(unknown|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

/** Enrich a public IP via ipinfo.io (keyless; IPINFO_TOKEN lifts the rate limit). 3 s cap, null on any failure. */
export async function lookupIp(ip: string): Promise<IpGeo | null> {
  if (PRIVATE_IP.test(ip)) return null;
  try {
    const token = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : "";
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${token}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const j = await res.json();
    const pick = (k: string) => (typeof j[k] === "string" && j[k] ? j[k] : null);
    return { hostname: pick("hostname"), city: pick("city"), region: pick("region"), country: pick("country"),
      loc: pick("loc"), org: pick("org"), postal: pick("postal"), timezone: pick("timezone") };
  } catch { return null; }
}

/** First hop of x-forwarded-for is the real client on Vercel; others are proxies. */
export function clientIp(h: HeaderBag): string {
  const raw = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  return raw.split(",")[0].trim() || "unknown";
}

export function readVisit(h: HeaderBag, sequenceId: string, title: string | null, kind: "view" | "unlock" = "view"): ShareVisit {
  const city = h.get("x-vercel-ip-city");
  const host = h.get("x-forwarded-host") || h.get("host");
  return {
    sequenceId,
    kind,
    title: title || "Untitled",
    url: host ? `${h.get("x-forwarded-proto") || "https"}://${host}/s/${sequenceId}` : null,
    ip: clientIp(h),
    city: city ? decodeURIComponent(city) : null,
    country: h.get("x-vercel-ip-country"),
    userAgent: h.get("user-agent"),
    referer: h.get("referer"),
    at: new Date(),
  };
}

async function logVisit(v: ShareVisit): Promise<void> {
  await db.query(
    `INSERT INTO sequence_share_view_log (sequence_id, title, kind, ip, city, country, user_agent, referer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [v.sequenceId, v.title, v.kind, v.ip, v.city, v.country, v.userAgent, v.referer]
  );
}

/** The app's own logo, absolute so it renders inside an email as well as a note.
 *  Pinned to the live site on purpose: NEXT_PUBLIC_SITE_URL still carries the
 *  pre-rename host in some envs, which produced a broken image. */
const APP_ICON_URL = "https://sequences-bheng.vercel.app/icon-192.png";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function alertBody(v: ShareVisit, viewNumber: number): string {
  const g = v.geo;
  const city = g?.city || v.city;
  const country = g?.country || v.country;
  const when = v.at.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
  const [lat, lon] = (g?.loc || "").split(",");
  const mapUrl = lat && lon
    ? `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lon},${lat}&z=9&size=600,300&l=map&pt=${lon},${lat},pm2rdm`
    : null;
  const row = (k: string, val: string | null) =>
    `<tr><td style="padding:7px 16px 7px 0;color:#71717a;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td>` +
    `<td style="padding:7px 0;color:#18181b;font-size:14px;font-weight:600;word-break:break-word">${val ? escapeHtml(val) : "<span style=\"color:#a1a1aa;font-weight:400\">unknown</span>"}</td></tr>`;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:8px 0 24px;color:#18181b">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a1a1aa;font-weight:700;margin-bottom:6px">Sequences share - ${v.kind === "unlock" ? "passcode unlock" : "link opened"}</div>
  <h1 style="display:flex;align-items:center;gap:10px;font-size:20px;line-height:1.35;margin:0 0 14px;color:#18181b"><img src="${APP_ICON_URL}" alt="Sequences" width="28" height="28" style="width:28px;height:28px;border-radius:7px;flex:none"><span>Someone opened "${escapeHtml(v.title)}"</span></h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3f3f46">Someone from <b>${escapeHtml(v.ip)}</b> ${v.kind === "unlock" ? "entered the passcode" : "opened the shared link"} on <b>${when}</b>${country ? ` from <b style="color:#ef4444">${escapeHtml(country)}</b>` : ""}. This is view <b>${viewNumber}</b> of this diagram.</p>
  <table style="border-collapse:collapse;width:100%;max-width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:0 0 18px">
    ${row("Target IP", v.ip)}
    ${row("Hostname", g?.hostname ?? null)}
    ${row("City", city)}
    ${row("Region", g?.region ?? null)}
    ${row("Country", country)}
    ${row("Coordinates", g?.loc ?? null)}
    ${row("Org", g?.org ?? null)}
    ${row("Postal", g?.postal ?? null)}
    ${row("Timezone", g?.timezone ?? null)}
    ${row("Referrer", v.referer)}
    ${v.url ? `<tr><td style="padding:7px 16px 7px 0;color:#71717a;font-size:13px;white-space:nowrap;vertical-align:top">Link</td><td style="padding:7px 0;font-size:14px;font-weight:600;word-break:break-all"><a href="${escapeHtml(v.url)}" style="color:#2563eb">${escapeHtml(v.url)}</a></td></tr>` : ""}
  </table>
  ${mapUrl ? `<img src="${mapUrl}" alt="Map near ${escapeHtml(city || v.ip)}" width="600" height="300" style="display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid #e4e4e7;margin:0 0 18px">` : ""}
  <p style="margin:0 0 6px;font-size:14px;color:#3f3f46">More detail: <a href="https://ipinfo.io/${encodeURIComponent(v.ip)}" style="color:#2563eb">ipinfo.io/${escapeHtml(v.ip)}</a></p>
  <p style="margin:0;color:#a1a1aa;font-size:12px;word-break:break-all">${escapeHtml(v.userAgent || "no user agent")}</p>
</div>`;
}

/** Plain-text twin of alertBody for the Formspree route, which cannot carry
 *  HTML. Kept short and free of full URLs on purpose: Formspree answers 200 to
 *  a message with several https:// links and then drops it as spam, which is
 *  how the first production alerts were lost. A bare host gets through. */
function textBody(v: ShareVisit, viewNumber: number): string {
  const g = v.geo;
  const when = v.at.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
  const where = [g?.city || v.city, g?.region, g?.country || v.country].filter(Boolean).join(", ");
  const rows: [string, string | null | undefined][] = [
    ["Open", v.url?.replace(/^https?:\/\//, "")],
    ["IP", v.ip],
    ["Where", where || null],
    ["Org", g?.org],
    ["From", v.referer?.replace(/^https?:\/\//, "").replace(/\/.*$/, "")],
    ["Browser", v.userAgent],
  ];
  return [
    `"${v.title}" was ${v.kind === "unlock" ? "unlocked" : "opened"} on ${when} (view ${viewNumber}).`,
    ...rows.filter(([, val]) => val).map(([k, val]) => `${k}: ${val}`),
  ].join("\n");
}

/** Resend when a key is set, otherwise the keyless Formspree form the Stickies alert mails through. */
async function sendEmail(v: ShareVisit, viewNumber: number): Promise<boolean> {
  const to = process.env.OWNER_EMAIL;
  if (!to) return false;
  const key = process.env.RESEND_API_KEY;
  const res = key
    ? await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.SHARE_ALERT_FROM || "Sequences <onboarding@resend.dev>",
          to: [to],
          subject: `Opened: ${v.title} - ${v.ip}`,
          html: alertBody(v, viewNumber),
        }),
      })
    : await fetch(`https://formspree.io/f/${process.env.FORMSPREE_FORM || "mbddjovk"}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: to, _subject: `Opened: ${v.title} - ${v.ip}`, message: textBody(v, viewNumber) }),
      });
  return res.ok;
}

/**
 * The same alert as a note in the owner's Stickies Alerts folder. Stickies
 * shares this database, so the note is inserted directly: Vercel cannot reach
 * the Stickies API on localhost, and no API key is needed.
 */
async function postAlertNote(v: ShareVisit, viewNumber: number): Promise<void> {
  const userId = process.env.OWNER_USER_ID;
  if (!userId) return;
  await db.query(
    `INSERT INTO stickies (user_id, title, content, folder_name, folder_color, is_folder, type, "order", created_by_key, created_by_machine, icon)
     VALUES ($1, $2, $3, 'Alerts', '#FF3B30', false, 'html', 0, 'share-alert', 'sequences', '__app:sequences')`,
    [userId, `Opened: ${v.title.replace(/^(Opened:\s*)+/, "")}`, alertBody(v, viewNumber)]
  );
}

/** Fire-and-forget. Call without awaiting; it swallows its own failures. */
export async function notifyShareView(v: ShareVisit): Promise<void> {
  try {
    await logVisit(v);
    const { rows } = await db.query(`SELECT COUNT(*) AS n FROM sequence_share_view_log WHERE sequence_id = $1`, [v.sequenceId]);
    const viewNumber = Number(rows[0]?.n ?? 1);
    v.geo = (await lookupIp(v.ip)) ?? undefined;
    if (await sendEmail(v, viewNumber)) {
      await db.query(
        `UPDATE sequence_share_view_log SET emailed = true WHERE id = (
           SELECT id FROM sequence_share_view_log WHERE sequence_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [v.sequenceId]
      );
    }
    await postAlertNote(v, viewNumber);
  } catch (e) {
    console.error("[share-alert] failed", e instanceof Error ? e.message : String(e));
  }
}
