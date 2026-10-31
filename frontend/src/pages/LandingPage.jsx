import { useNavigate } from "react-router-dom";
import {
  TestTube2, Zap, Shield, Globe, CheckCircle2,
  ArrowRight, Play, Sparkles, Code2, Activity, Lock, GitBranch
} from "lucide-react";

const WORKFLOW = [
  { n: "01", icon: Globe, title: "Connect", body: "Target any live remote URL, local Docker/dev server, or upload a ZIP archive of your source code." },
  { n: "02", icon: Sparkles, title: "Synthesize", body: "Specify user stories and requirements in plain English. AI proposes structured, editable test steps." },
  { n: "03", icon: CheckCircle2, title: "Approve", body: "Inspect every step, locator, and assertion. No test executes without explicit developer approval." },
  { n: "04", icon: Play, title: "Execute", body: "Playwright launches in an isolated container. Watch live progress and screenshot captures in real time." },
  { n: "05", icon: Zap, title: "Self-Heal", body: "When UI changes break selectors, the engine validates alternate strategies and repairs locators automatically." },
  { n: "06", icon: Shield, title: "Diagnose", body: "Comprehensive test artifacts: Playwright traces, failure screenshots, video recordings, and AI root-cause analysis." },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Test Plan Synthesis",
    body: "Natural language turns into deterministic Playwright plans. Powered by Gemini 2.0 Flash to propose exact actions, selectors, and assertions with zero hallucinated state.",
  },
  {
    icon: Zap,
    title: "Self-Healing Locators",
    body: "When DOM elements shift or classes change, the self-healing service evaluates role, label, text, and vector semantic similarity to propose validated repairs.",
  },
  {
    icon: Shield,
    title: "Isolated Container Sandboxes",
    body: "Uploaded ZIP applications run in resource-capped, non-root environments with strict SSRF defense, path traversal prevention, and owner-scoped artifacts.",
  },
  {
    icon: Code2,
    title: "Versioned Playwright Specs",
    body: "Every approved plan compiles into maintainable JavaScript specs using resilient locator best practices (roles, labels, accessible text) with JUnit, JSON, and HTML reports.",
  },
  {
    icon: Activity,
    title: "Real-Time WebSocket Streaming",
    body: "Watch step-by-step test execution live over WebSocket with automatic HTTP polling fallback. Immediate visual feedback on passes, failures, and healing events.",
  },
  {
    icon: GitBranch,
    title: "Three Flexible Entry Points",
    body: "Point at a live deployed staging URL, a localhost dev port, or upload source code directly with automatic React, Vite, Next.js, and package manager detection.",
  },
];

const SECURITY_ITEMS = [
  "JWT Bearer authentication with backend-only secret verification",
  "ZIP path-traversal prevention and archive bomb protection",
  "Strict SSRF mitigation with local network and cloud metadata blocks",
  "Resource-capped sandbox containers for uploaded project builds",
  "SHA-256 integrity hashing on file uploads",
  "Owner-scoped artifact access tokens with 30-day retention policies",
  "Automated redaction for sensitive inputs and environment keys",
  "CORS origin allowlist enforcement and strict request size limits",
];

const STACK_BADGES = [
  "Playwright", "FastAPI", "Gemini 2.0 Flash", "LangChain", "SQLite / PostgreSQL",
  "Sentence Transformers", "FAISS", "WebSockets", "Docker", "React 19", "Vite"
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-main)" }}>
      {/* Top Navigation */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          height: "52px",
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-main)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <TestTube2 size={15} />
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Test<span style={{ color: "var(--accent)" }}>Sphere</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>
            Sign In
          </button>
          <button className="btn btn-primary btn-sm" id="nav-get-started" onClick={() => navigate("/register")}>
            Get Started <ArrowRight size={12} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "72px 24px 56px",
          borderBottom: "1px solid var(--border-primary)",
          background: "linear-gradient(180deg, var(--bg-main) 0%, var(--bg-card) 100%)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: "var(--radius-full)",
            marginBottom: 20,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "var(--accent)",
          }}
        >
          <Sparkles size={12} /> Autonomous QA · Self-Healing · Playwright Engine
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3rem)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            maxWidth: 680,
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          Automated end-to-end testing that heals itself
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--text-secondary)",
            maxWidth: 540,
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          Express verification requirements in natural language. TestSphere generates robust Playwright test plans, executes them in isolated browsers, diagnoses failures, and automatically heals broken locators.
        </p>

        <div className="flex gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg" id="hero-get-started" onClick={() => navigate("/register")}>
            Start Testing Free <ArrowRight size={14} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate("/login")}>
            Sign In to Dashboard
          </button>
        </div>

        {/* Quick Numbers Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
            marginTop: 48,
            padding: "16px 28px",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-card)",
            width: "100%",
            maxWidth: 720,
          }}
        >
          {[
            ["3 Entry Points", "URL, Local, or ZIP"],
            ["AI Synthesis", "Gemini 2.0 Flash"],
            ["Self-Healing", "Multi-strategy repair"],
            ["100% Local-First", "Container isolated"],
          ].map(([title, sub]) => (
            <div key={title} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section style={{ padding: "64px 32px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 8 }}>
            Engineered Testing Lifecycle
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", maxWidth: 440, margin: "0 auto" }}>
            A disciplined, developer-governed workflow with no black-box surprises.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {WORKFLOW.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="card"
              style={{
                padding: "18px 20px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {n}
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                  color: "var(--accent)",
                }}
              >
                <Icon size={16} />
              </div>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {title}
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section
        style={{
          background: "var(--bg-card)",
          padding: "64px 32px",
          borderTop: "1px solid var(--border-primary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 8 }}>
              Built for Modern Software Engineering
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", maxWidth: 460, margin: "0 auto" }}>
              Enterprise-grade execution, semantic selector recovery, and isolated browser sandboxing.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="card-elevated"
                style={{ padding: "20px" }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    color: "var(--accent)",
                  }}
                >
                  <Icon size={16} />
                </div>
                <h3 style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", marginBottom: 6 }}>
                  {title}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section style={{ padding: "64px 32px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 36, alignItems: "start" }}>
          <div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-sm)",
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                color: "var(--success)",
              }}
            >
              <Lock size={16} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>
              Zero-Trust Architecture
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Test code should never compromise host infrastructure. Uploaded source code executes inside non-root container sandboxes with strict egress rules and full secret isolation.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {SECURITY_ITEMS.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius)",
                }}
              >
                <CheckCircle2 size={13} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Ribbon */}
      <section
        style={{
          padding: "36px 32px",
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-primary)",
          borderBottom: "1px solid var(--border-primary)",
          textAlign: "center",
        }}
      >
        <p className="text-xs text-muted mb-3 font-mono" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
          POWERED BY OPEN FOUNDATIONS
        </p>
        <div className="flex gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {STACK_BADGES.map((b) => (
            <span
              key={b}
              className="badge badge-neutral"
              style={{ fontSize: "0.6875rem", padding: "3px 10px" }}
            >
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section style={{ padding: "64px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
          Ready to verify your software autonomously?
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
          Open architecture, container-isolated, and self-hosted on your machine.
        </p>
        <div className="flex gap-2" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" id="cta-get-started" onClick={() => navigate("/register")}>
            Create Free Account <ArrowRight size={13} />
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/login")}>
            Sign In
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "16px 32px",
          borderTop: "1px solid var(--border-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-sidebar)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <TestTube2 size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-primary)" }}>TestSphere</span>
          <span className="font-mono text-xs text-muted">v1.0.0</span>
        </div>
        <p className="text-xs text-muted">
          Autonomous Agentic QA &middot; Playwright Self-Healing Platform
        </p>
      </footer>
    </div>
  );
}