"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// The Lock button and its menu, 1 switch row per lock: Lock access (the share
// passcode, Stickies style) and the existing edit + delete lock. Same menu as
// Flows, so a locked share reads the same in both apps.

const ICON = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const EyeIcon = () => <svg {...ICON}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOffIcon = () => <svg {...ICON}><path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.4 9.4 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;

// 1 row of the Lock menu: an icon tile, a name with its state, the switch on the right.
function SwitchRow({ on, name, sub, icon, onClick }: { on: boolean; name: string; sub: string; icon: ReactNode; onClick: () => void }) {
    return (
        <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "7px 0", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "#f1f5f9", color: "#0f172a", display: "grid", placeItems: "center" }}>{icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>{name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
            </span>
            <span aria-hidden="true" style={{ width: 38, height: 22, borderRadius: 11, flexShrink: 0, background: on ? "#2563eb" : "#cbd5e1", position: "relative", transition: "background 0.15s" }}>
                <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 9, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.25)", transition: "left 0.15s" }} />
            </span>
        </button>
    );
}

// The passcode box: shown in plain text by default (only the owner ever sees
// it), the eye masks it. Set or Update saves; switching Lock access off removes it.
function PasscodeField({ on, current = "", onSave }: { on: boolean; current?: string; onSave: (v: string) => Promise<boolean> }) {
    const [value, setValue] = useState(current);
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(true);
    // A save, or another sequence opened, brings a new current passcode.
    useEffect(() => { setValue(current); }, [current]);
    const ready = Boolean(value.trim()) && value.trim() !== current;
    const save = async () => {
        if (busy || !ready) return;
        setBusy(true);
        await onSave(value.trim());
        setBusy(false);
    };
    return (
        <div onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b", letterSpacing: "0.02em" }}>Passcode</div>
            <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={{ flex: 1, minWidth: 0, position: "relative", display: "flex" }}>
                    <input value={value} onChange={e => setValue(e.target.value.toLowerCase())} onKeyDown={e => e.stopPropagation()} autoFocus={!on}
                        type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                        data-lpignore="true" data-1p-ignore="" data-bwignore="" data-form-type="other"
                        placeholder={on ? "Enter new passcode" : "Choose a passcode"} aria-label="Passcode" maxLength={200}
                        style={{ flex: 1, minWidth: 0, height: 38, padding: "0 38px 0 12px", fontSize: 13.5, fontWeight: 600, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#dc2626", fontFamily: "inherit", WebkitTextSecurity: shown ? "none" : "disc", outline: "none" } as CSSProperties} />
                    <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Hide passcode" : "Show passcode"} title={shown ? "Hide" : "Show"}
                        style={{ position: "absolute", right: 4, top: 4, width: 30, height: 30, display: "grid", placeItems: "center", border: "none", background: "none", color: "#64748b", cursor: "pointer", outline: "none" }}>
                        {shown ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                </span>
                <button type="submit" disabled={busy || !ready}
                    style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.45, fontFamily: "inherit" }}>
                    {on ? "Update" : "Set"}
                </button>
            </form>
        </div>
    );
}

export const LOCK_BUTTON_ID = "sq-lock-btn";

export function LockMenu({ isLocked, onToggleLock, hasPasscode, passcode, onSetPasscode, compact, hoverBg }: {
    isLocked: boolean; onToggleLock: () => void;
    hasPasscode: boolean; passcode: string; onSetPasscode: (v: string) => Promise<boolean>;
    compact: boolean; hoverBg: string;
}) {
    const [menu, setMenu] = useState<{ top: number; left: number; caret: number } | null>(null);
    // Lock access switched on but no passcode typed yet: the box is open.
    const [passOpen, setPassOpen] = useState(false);
    const toggleAccess = () => { if (hasPasscode) onSetPasscode(""); setPassOpen(!hasPasscode && !passOpen); };
    const savePasscode = async (v: string) => { const ok = await onSetPasscode(v); if (ok) { setPassOpen(false); if (v) setMenu(null); } return ok; };
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!menu) return;
        const onPointerDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null); };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menu]);

    return (
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
            <button id={LOCK_BUTTON_ID} aria-haspopup="menu" aria-expanded={!!menu}
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const left = Math.max(8, Math.min(r.right - 340, window.innerWidth - 348)); setMenu(menu ? null : { top: r.bottom + 10, left, caret: Math.max(16, Math.min(r.left + r.width / 2 - left - 6, 300)) }); }}
                title={isLocked ? "Locked - open to see the locks and lift one" : "Open to lock access, edits and delete"}
                aria-label={isLocked ? "Locked" : "Lock"}
                style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "0 8px", height: 30, borderRadius: 8, border: "none",
                    background: menu ? "#e0eaff" : isLocked ? "rgba(15,118,110,0.15)" : "transparent",
                    color: menu ? "#1d4ed8" : isLocked ? "#14b8a6" : "#64748b",
                    cursor: "pointer", fontSize: 13, fontWeight: menu || isLocked ? 600 : 400, transition: "all 0.1s",
                }}
                onMouseEnter={e => { if (!(isLocked || menu)) e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={e => { if (!(isLocked || menu)) e.currentTarget.style.background = "transparent"; }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                {!compact && (isLocked ? "Locked" : "Lock")}
            </button>
            {menu && <div role="menu" style={{ position: "fixed", top: menu.top, left: menu.left, zIndex: 1000, width: 340, boxSizing: "border-box", padding: "10px 18px", background: "#fff", border: "1px solid #eef0f3", borderRadius: 16, boxShadow: "0 16px 40px rgba(15,23,42,0.14)", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                <span aria-hidden="true" style={{ position: "absolute", top: -6, left: menu.caret, width: 12, height: 12, background: "#fff", borderLeft: "1px solid #eef0f3", borderTop: "1px solid #eef0f3", transform: "rotate(45deg)" }} />
                <div>
                    <SwitchRow on={hasPasscode || passOpen} name="Lock access" icon={<EyeIcon />} onClick={toggleAccess}
                        sub={hasPasscode ? "Viewers need the passcode" : "Anyone with the link views it"} />
                    {(hasPasscode || passOpen) && <div style={{ padding: "4px 0 12px 48px" }}><PasscodeField on={hasPasscode} current={passcode} onSave={savePasscode} /></div>}
                    {/* Sequences has 1 lock for both: a locked sequence can be neither edited nor deleted. */}
                    <SwitchRow on={isLocked} name="Lock edit and delete" onClick={onToggleLock}
                        sub={isLocked ? "Nobody can edit or delete it" : "Only you can edit or delete it"}
                        icon={<svg {...ICON}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>} />
                </div>
            </div>}
        </div>
    );
}

// The header's state pill: dark when a passcode is on; a click opens the Lock menu.
export function PasscodePill({ on }: { on: boolean }) {
    return (
        <button type="button" aria-pressed={on}
            onClick={() => document.getElementById(LOCK_BUTTON_ID)?.click()}
            aria-label={on ? "Passcode on: change or remove it" : "Add a passcode to the share link"}
            title={on ? "Passcode on: the link opens to a lock screen. Click to change or remove it." : "Add a passcode: the link opens to a lock screen until it is typed."}
            style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, padding: 0, borderRadius: 999, cursor: "pointer",
                background: on ? "#0f172a" : "#f8fafc", color: on ? "#fff" : "#475569",
                border: `1px solid ${on ? "#0f172a" : "#e2e8f0"}`,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></svg>
        </button>
    );
}
