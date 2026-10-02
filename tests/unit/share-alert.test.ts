/**
 * Share-view alert: who gets told when a public /s/<id> link is opened, and
 * that a failing alert never reaches the reader.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }));

import db from "@/lib/db";
import { clientIp, isBot, readVisit, notifyShareView } from "@/lib/share-alert";

const q = db.query as unknown as ReturnType<typeof vi.fn>;
const fetchMock = vi.fn();
const SEQ = "11111111-2222-4333-8444-555555555555";
const IP = "73.159.109.147";
const GEO = { hostname: "pool-73-159-109-147.bstnma.fios.verizon.net", city: "Springfield", region: "Massachusetts", country: "US", loc: "42.1015,-72.5898", org: "AS701 Verizon", postal: "01101", timezone: "America/New_York" };

function headers(h: Record<string, string>) {
  return new Headers(h);
}

function visit(title = "Checkout flow") {
  return readVisit(headers({ "x-forwarded-for": IP, "user-agent": "Mozilla/5.0 (iPhone) Safari/604.1", "x-vercel-ip-country": "US", host: "sequences-bheng.vercel.app" }), SEQ, title);
}

function calls(prefix: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) =>
    new Response(String(url).startsWith("https://ipinfo.io/") ? JSON.stringify(GEO) : "{}", { status: 200 }));
  q.mockImplementation(async (sql: string) =>
    sql.trimStart().startsWith("SELECT COUNT") ? { rows: [{ n: "3" }] } : { rows: [], rowCount: 1 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for, then x-forwarded-for, then x-real-ip", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }))).toBe("1.1.1.1");
    expect(clientIp(headers({ "x-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("takes the first hop of a proxy chain and falls back to unknown", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("isBot", () => {
  it("skips link-preview crawlers", () => {
    for (const ua of ["Slackbot-LinkExpanding 1.0", "facebookexternalhit/1.1", "WhatsApp/2.23", "Twitterbot/1.0", "TelegramBot", "HeadlessChrome/120"]) {
      expect(isBot(ua)).toBe(true);
    }
  });

  it("lets real browsers and a missing agent through", () => {
    expect(isBot("Mozilla/5.0 (iPhone) Safari/604.1")).toBe(false);
    expect(isBot(null)).toBe(false);
  });
});

describe("readVisit", () => {
  it("decodes the Vercel city header and defaults to kind view", () => {
    const v = readVisit(headers({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR", referer: "https://x.test" }), SEQ, null);
    expect(v).toMatchObject({ sequenceId: SEQ, title: "Untitled", city: "São Paulo", country: "BR", referer: "https://x.test", kind: "view", url: null });
  });

  it("builds the visited share link from the forwarded host", () => {
    const v = readVisit(headers({ "x-forwarded-host": "sequences-bheng.vercel.app", "x-forwarded-proto": "https", host: "127.0.0.1:3000" }), SEQ, "T");
    expect(v.url).toBe(`https://sequences-bheng.vercel.app/s/${SEQ}`);
  });
});

describe("notifyShareView", () => {
  it("logs one row with the sequence id and kind view", async () => {
    await notifyShareView(visit());
    const [sql, params] = q.mock.calls[0];
    expect(sql).toContain("INSERT INTO sequence_share_view_log");
    expect(params.slice(0, 4)).toEqual([SEQ, "Checkout flow", "view", IP]);
  });

  it("emails the owner once through Resend with the right to and subject, then marks the row emailed", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("OWNER_EMAIL", "owner@example.test");
    await notifyShareView(visit());
    const resend = calls("https://api.resend.com/emails");
    expect(resend).toHaveLength(1);
    const body = JSON.parse(resend[0][1].body);
    expect(body.to).toEqual(["owner@example.test"]);
    expect(body.subject).toBe(`Sequences - Opened: Checkout flow - ${IP}`);
    expect(body.html).toContain("view <b>3</b>");
    expect(body.html).toContain("https://static-maps.yandex.ru/1.x/?lang=en_US&ll=-72.5898,42.1015");
    expect(body.html).toContain("Springfield");
    expect(body.html).toContain("Massachusetts");
    expect(body.html).toContain('<img src="https://sequences-bheng.vercel.app/icon-192.png" alt="Sequences"');
    expect(calls("https://formspree.io")).toHaveLength(0);
    expect(q.mock.calls.some(([sql]) => sql.includes("SET emailed = true"))).toBe(true);
  });

  it("mails through the keyless Formspree form when no Resend key is set", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.test");
    await notifyShareView(visit());
    expect(calls("https://api.resend.com")).toHaveLength(0);
    const form = calls("https://formspree.io/f/mbddjovk");
    expect(form).toHaveLength(1);
    const body = JSON.parse(form[0][1].body);
    expect(body.email).toBe("owner@example.test");
    expect(body._subject).toBe(`Sequences - Opened: Checkout flow - ${IP}`);
    expect(body.message).toContain('"Checkout flow" was opened on');
    expect(body.message).toContain("(view 3).");
    expect(body.message).toContain(`Open: sequences-bheng.vercel.app/s/${SEQ}`);
    expect(body.message).toContain("Where: Springfield, Massachusetts, US");
    // Formspree silently drops messages carrying full links, so none may appear.
    expect(body.message).not.toMatch(/https?:\/\//);
    expect(q.mock.calls.some(([sql]) => sql.includes("SET emailed = true"))).toBe(true);
  });

  it("always inserts a Stickies note for the owner as well, without stacking the Opened prefix", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.test");
    vi.stubEnv("OWNER_USER_ID", "731ace87-0000-4000-8000-000000000000");
    await notifyShareView(visit("Sequences - Opened: Checkout flow"));
    expect(calls("https://formspree.io")).toHaveLength(1);
    const note = q.mock.calls.find(([sql]) => sql.includes("INSERT INTO stickies"));
    expect(note).toBeDefined();
    const [sql, params] = note!;
    expect(sql).toContain("'Alerts'");
    expect(sql).toContain("'__app:sequences'");
    expect(params[0]).toBe("731ace87-0000-4000-8000-000000000000");
    expect(params[1]).toBe("Sequences - Opened: Checkout flow");
    expect(params[2]).toContain(`<a href="https://sequences-bheng.vercel.app/s/${SEQ}"`);
    expect(params[2]).toContain("view <b>3</b>");
  });

  it("stays quiet on both channels when neither owner email nor owner id is set", async () => {
    vi.stubEnv("OWNER_EMAIL", "");
    vi.stubEnv("OWNER_USER_ID", "");
    await notifyShareView(visit());
    expect(calls("https://api.resend.com")).toHaveLength(0);
    expect(calls("https://formspree.io")).toHaveLength(0);
    expect(q.mock.calls.some(([sql]) => sql.includes("INSERT INTO stickies"))).toBe(false);
  });

  it("escapes the title and skips the geo lookup for private addresses", async () => {
    vi.stubEnv("OWNER_USER_ID", "731ace87-0000-4000-8000-000000000000");
    const v = readVisit(headers({ "x-real-ip": "192.168.1.9", "user-agent": "Safari" }), SEQ, `<b>"Q&A"</b>`);
    await notifyShareView(v);
    expect(calls("https://ipinfo.io")).toHaveLength(0);
    const [, params] = q.mock.calls.find(([sql]) => sql.includes("INSERT INTO stickies"))!;
    expect(params[2]).toContain("&lt;b&gt;&quot;Q&amp;A&quot;&lt;/b&gt;");
    expect(params[2]).not.toContain("static-maps");
  });

  it("never throws when the database is down", async () => {
    q.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyShareView(visit())).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith("[share-alert] failed", "connect ECONNREFUSED");
    err.mockRestore();
  });
});
