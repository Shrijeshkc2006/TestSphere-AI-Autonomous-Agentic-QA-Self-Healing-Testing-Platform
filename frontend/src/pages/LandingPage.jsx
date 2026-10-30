import { useNavigate } from "react-router-dom";
import {
    TestTube2, Zap, Shield, Globe, Monitor, Upload, CheckCircle2,
    ArrowRight, Play, Sparkles, Code2, Activity, Lock, GitBranch,
} from "lucide-react";

const WORKFLOW = [
    { n: "01", icon: Globe, title: "Connect", body: "Point at a live URL, a local dev server, or upload your source as a ZIP archive." },
    { n: "02", icon: Sparkles, title: "Describe", body: "Write requirements in plain English. AI proposes a structured, editable test plan." },
    { n: "03", icon: CheckCircle2, title: "Review", body: "Inspect every step, selector, and assertion before execution. Nothing runs without approval." },
    { n: "04", icon: Play, title: "Execute", body: "Playwright runs each step in an isolated browser. Watch live progress via WebSocket." },
    { n: "05", icon: Zap, title: "Diagnose", body: "Screenshots, console errors, stack traces, and AI root-cause analysis for every failure." },
    { n: "06", icon: Shield, title: "Heal", body: "Self-healing proposes validated locator replacements and records every recovery attempt." },
];

const FEATURES = [
    { icon: Sparkles, color: "#4f46e5", bg: "#eef2ff", title: "AI-Assisted Test Planning", body: "Natural-language requirements become structured, executable test plans. Gemini 2.0 Flash proposes steps, selectors, and assertions � you review and approve before any code runs." },
    { icon: Zap, color: "#d97706", bg: "#fffbeb", title: "Self-Healing Locators", body: "When a selector breaks, the engine tries role, label, text, attribute, and semantic-similarity strategies. Replacements are validated against the live page before continuing." },
    { icon: Shield, color: "#16a34a", bg: "#f0fdf4", title: "Security by Design", body: "ZIP uploads run in isolated containers � not on the API server. SSRF protection, path-traversal prevention, non-root execution, and access-controlled artifact downloads." },
    { icon: Code2, color: "#0891b2", bg: "#ecfeff", title: "Maintainable Playwright Tests", body: "Jinja2-rendered, version-controlled test files. Download JUnit XML, JSON, and HTML reports. Generated tests use role and label selectors, not brittle CSS paths." },
    { icon: Activity, color: "#7c3aed", bg: "#f5f3ff", title: "Real-Time Execution", body: "Live step-by-step progress via WebSocket with automatic polling fallback. Screenshot gallery, browser video, and Playwright traces for every run." },
    { icon: GitBranch, color: "#0f766e", bg: "#f0fdfa", title: "Three Entry Points", body: "Deployed URL, local development server, or ZIP archive. Framework and package-manager detection for React, Vite, Next.js, Vue, Angular, Svelte, and more." },
];

const SECURITY = [
    "JWT Bearer auth � 24h expiry, backend-only secrets",
    "ZIP path-traversal and archive-bomb protection",
    "SSRF mitigation � destination validation and metadata endpoint blocking",
    "Container isolation for ZIP projects � non-root, resource-limited",
    "SHA-256 file integrity verification on upload",
    "Access-controlled artifact downloads with retention limits",
    "CORS origin allowlist, request-size limits",
    "Sensitive values masked in logs and screenshots",
];

const INTEGRATIONS = [
    "Playwright", "Gemini 2.0 Flash", "LangChain", "FastAPI", "SQLite / PostgreSQL",
    "Celery + Redis", "WebSockets", "Sentence Transformers", "FAISS", "Jinja2",
    "React", "Vite", "Docker",
];

export default function LandingPage() {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

            {/* Nav */}
            <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 60, borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky", top: 0, zIndex: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <TestTube2 size={18} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-strong)" }}>
                        Test<span style={{ color: "var(--accent)" }}>Sphere</span>
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>Sign in</button>
                    <button className="btn btn-primary btn-sm" id="nav-get-started" onClick={() => navigate("/register")}>Get started free <ArrowRight size={13} /></button>
                </div>
            </nav>

            {/* Hero */}
            <section style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "88px 24px 72px", borderBottom: "1px solid var(--border)", background: "linear-gradient(180deg, var(--bg) 0%, var(--bg-subtle) 100%)" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 20, marginBottom: 24, background: "var(--indigo-50)", border: "1px solid var(--indigo-100)", fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>
                    <Sparkles size={12} /> AI-Assisted &middot; Local-First &middot; Self-Healing
                </div>
                <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", maxWidth: 720, background: "linear-gradient(135deg, var(--gray-900) 0%, var(--indigo-600) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 20 }}>
                    End-to-end testing that understands your app
                </h1>
                <p style={{ fontSize: "1.0625rem", color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.7, marginBottom: 36 }}>
                    Describe what you want to test in plain English. TestSphere generates structured Playwright test plans, executes them in an isolated browser, diagnoses failures, and heals broken selectors.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    <button className="btn btn-primary btn-lg" id="hero-get-started" onClick={() => navigate("/register")}>Start testing free <ArrowRight size={15} /></button>
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate("/login")}>Sign in to dashboard</button>
                </div>
                <div style={{ display: "flex", gap: 40, marginTop: 56, padding: "20px 40px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg)" }}>
                    {[["3", "Testing entry points"], ["AI", "Test plan generation"], ["8", "Self-healing strategies"], ["100%", "Open & local-first"]].map(([n, l]) => (
                        <div key={l} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent)" }}>{n}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{l}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Workflow */}
            <section style={{ padding: "80px 48px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
                <div style={{ textAlign: "center", marginBottom: 52 }}>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>From requirement to verified test in minutes</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", maxWidth: 480, margin: "0 auto" }}>A structured, human-approved workflow � no magic black boxes.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                    {WORKFLOW.map(({ n, icon: Icon, title, body }) => (
                        <div key={n} style={{ padding: "20px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg)", transition: "box-shadow 150ms", position: "relative" }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                            <div style={{ position: "absolute", top: 14, right: 16, fontSize: "0.6875rem", fontWeight: 700, color: "var(--indigo-100)", letterSpacing: "0.1em" }}>{n}</div>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--indigo-50)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                                <Icon size={18} color="var(--accent)" />
                            </div>
                            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 6 }}>{title}</h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Entry points */}
            <section style={{ background: "var(--bg-subtle)", padding: "72px 48px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 44 }}>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Three ways to connect your app</h2>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                        {[
                            { icon: Globe, color: "#4f46e5", bg: "#eef2ff", title: "Deployed URL", body: "Point at any publicly accessible web app. Validation guards against SSRF and prohibited destinations.", code: "https://your-app.com" },
                            { icon: Monitor, color: "#16a34a", bg: "#f0fdf4", title: "Local URL", body: "Test your dev server running locally or in Docker. Supports host gateway and configurable tunnel.", code: "http://localhost:3000" },
                            { icon: Upload, color: "#d97706", bg: "#fffbeb", title: "ZIP Upload", body: "Upload source code. TestSphere detects framework, installs deps, starts it in isolation, and tests it.", code: "my-react-app.zip" },
                        ].map(({ icon: Icon, color, bg, title, body, code }) => (
                            <div key={title} style={{ padding: "24px", border: `2px solid ${color}25`, borderRadius: "var(--radius-lg)", background: "var(--bg)" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                    <Icon size={20} color={color} />
                                </div>
                                <h3 style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: 8, color }}>{title}</h3>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>{body}</p>
                                <code style={{ fontSize: "0.75rem", background: "var(--bg-muted)", padding: "3px 8px", borderRadius: 4 }}>{code}</code>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section style={{ padding: "80px 48px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
                <div style={{ textAlign: "center", marginBottom: 52 }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Everything your QA workflow needs</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", maxWidth: 480, margin: "0 auto" }}>Built on industry-standard tooling with production-grade reliability.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                    {FEATURES.map(({ icon: Icon, color, bg, title, body }) => (
                        <div key={title} style={{ padding: "24px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg)", transition: "box-shadow 150ms" }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                <Icon size={20} color={color} />
                            </div>
                            <h3 style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: 8 }}>{title}</h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.65 }}>{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Security */}
            <section style={{ background: "var(--gray-900)", padding: "72px 48px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                    <div style={{ display: "flex", gap: 64, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: "0 0 300px", minWidth: 240 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                                <Lock size={22} color="#818cf8" />
                            </div>
                            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#f9fafb", marginBottom: 12, letterSpacing: "-0.02em" }}>Security is not optional</h2>
                            <p style={{ fontSize: "0.875rem", color: "#9ca3af", lineHeight: 1.7 }}>Every security decision is deliberate. Uploaded code never runs on the API server. Secrets never leave the backend. All artifact access is owner-verified.</p>
                        </div>
                        <div style={{ flex: 1, minWidth: 240 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                                {SECURITY.map(item => (
                                    <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                        <CheckCircle2 size={14} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
                                        <span style={{ fontSize: "0.8125rem", color: "#d1d5db", lineHeight: 1.5 }}>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Integrations */}
            <section style={{ padding: "52px 48px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 20 }}>Powered by</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        {INTEGRATIONS.map(name => (
                            <span key={name} style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 500, background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{name}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: "80px 24px", textAlign: "center", background: "linear-gradient(180deg, var(--bg) 0%, var(--indigo-50) 100%)" }}>
                <h2 style={{ fontSize: "clamp(1.5rem, 4vw, 2.125rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-strong)", marginBottom: 14 }}>Ready to test smarter?</h2>
                <p style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: 32, maxWidth: 420, margin: "0 auto 32px" }}>Self-hosted, local-first, and completely open. No data leaves your machine.</p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-lg" id="cta-get-started" onClick={() => navigate("/register")}>Create free account <ArrowRight size={15} /></button>
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate("/login")}>Sign in</button>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: "18px 48px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TestTube2 size={15} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-strong)" }}>TestSphere</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>v1.0.0</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Local-first &middot; No cloud dependency &middot; Open architecture</p>
            </footer>
        </div>
    );
}