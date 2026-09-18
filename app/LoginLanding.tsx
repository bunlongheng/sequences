"use client";
import Image from "next/image";
import LoginForm from "./SignInButton";

// The root landing for logged-out visitors AND the /sign-in page: the on-brand
// animated sequence-diagram backdrop, the Google sign-in, and a link into the
// public /demo gallery (browse without an account).
export default function LoginLanding() {
  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      background: "radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #f5f6fb 55%, #eceef5 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui,-apple-system,sans-serif",
    }}>
      <svg aria-hidden="true" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <radialGradient id="llR"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.16" /><stop offset="70%" stopColor="#ef4444" stopOpacity="0" /></radialGradient>
          <radialGradient id="llY"><stop offset="0%" stopColor="#eab308" stopOpacity="0.16" /><stop offset="70%" stopColor="#eab308" stopOpacity="0" /></radialGradient>
          <radialGradient id="llGr"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.16" /><stop offset="70%" stopColor="#22c55e" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse className="ll-blob" cx="360" cy="330" rx="320" ry="290" fill="url(#llR)" />
        <ellipse className="ll-blob" cx="620" cy="500" rx="340" ry="300" fill="url(#llY)" style={{ animationDelay: "-8s" }} />
        <ellipse className="ll-blob" cx="850" cy="330" rx="320" ry="290" fill="url(#llGr)" style={{ animationDelay: "-16s" }} />
        <line className="ll-life" x1="380" y1="100" x2="380" y2="720" stroke="#ef4444" strokeWidth="3" strokeDasharray="10 14" opacity="0.22" />
        <line className="ll-life" x1="600" y1="100" x2="600" y2="720" stroke="#eab308" strokeWidth="3" strokeDasharray="10 14" opacity="0.22" style={{ animationDuration: "44s" }} />
        <line className="ll-life" x1="820" y1="100" x2="820" y2="720" stroke="#22c55e" strokeWidth="3" strokeDasharray="10 14" opacity="0.22" style={{ animationDuration: "40s" }} />
        <g className="ll-msg"><line x1="380" y1="240" x2="600" y2="240" stroke="#f97316" strokeWidth="4.5" strokeLinecap="round" /><polygon points="600,240 578,230 578,250" fill="#f97316" /></g>
        <g className="ll-msg" style={{ animationDelay: "1.5s" }}><line x1="600" y1="360" x2="820" y2="360" stroke="#22c55e" strokeWidth="4.5" strokeLinecap="round" /><polygon points="820,360 798,350 798,370" fill="#22c55e" /></g>
        <g className="ll-msg" style={{ animationDelay: "3s" }}><line x1="820" y1="470" x2="380" y2="470" stroke="#8b5cf6" strokeWidth="4.5" strokeLinecap="round" /><polygon points="380,470 402,460 402,480" fill="#8b5cf6" /></g>
      </svg>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: 24 }}>
        <div className="ll-icon">
          <Image src="/icon-512.png" alt="Sequences" width={88} height={88} priority
            style={{ borderRadius: 20, boxShadow: "0 12px 40px rgba(15,23,42,0.16)" }} />
        </div>
        <h1 className="ll-in ll-t1" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>Sequences</h1>
        <p className="ll-in ll-t2" style={{ fontSize: 15, color: "#6b7280", margin: 0, maxWidth: 340, lineHeight: 1.5 }}>
          Beautiful sequence diagrams, generated from plain English.
        </p>
        <div className="ll-in ll-t3" style={{ marginTop: 6 }}><LoginForm /></div>
        <a className="ll-in ll-t4" href="/demo" style={{
          fontSize: 13.5, fontWeight: 600, color: "#7c3aed", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>View live demo →</a>
      </div>

      <style>{`
        @keyframes llUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes llFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes llFlow { to { stroke-dashoffset: -240; } }
        @keyframes llMsg { 0%,10% { opacity: 0; } 18% { opacity: 0.32; } 42% { opacity: 0.32; } 54%,100% { opacity: 0; } }
        @keyframes llBlob { 0%,100% { transform: translate(0,0); } 50% { transform: translate(26px,-20px); } }
        .ll-in { opacity: 0; animation: llUp 0.7s cubic-bezier(.16,.84,.44,1) both; }
        .ll-icon { opacity: 0; animation: llUp 0.7s cubic-bezier(.16,.84,.44,1) both, llFloat 6.5s ease-in-out 0.8s infinite; }
        .ll-t1 { animation-delay: 0.12s; } .ll-t2 { animation-delay: 0.22s; }
        .ll-t3 { animation-delay: 0.34s; } .ll-t4 { animation-delay: 0.44s; }
        .ll-life { animation: llFlow 48s linear infinite; }
        .ll-msg { opacity: 0; animation: llMsg 11s ease-in-out infinite; }
        .ll-blob { animation: llBlob 18s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ll-in, .ll-icon, .ll-life, .ll-msg, .ll-blob { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
