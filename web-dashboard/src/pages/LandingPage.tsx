import { Link } from 'react-router-dom'
import './LandingPage.css'

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <img src="/salesgen-icon.png" alt="SalesGen" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span className="landing-nav-brand-text">SalesGen</span>
        </Link>

        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className="landing-nav-actions">
          <Link to="/login" className="landing-btn-login">Log In</Link>
          <Link to="/signup" className="landing-btn-cta">Get Started Free</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            AI-Powered Sales Intelligence
          </div>

          <h1>
            Turn Every Visitor Into a{' '}
            <span className="gradient-text">Qualified Lead</span>
          </h1>

          <p className="landing-hero-sub">
            SalesGen embeds an AI sales agent on your website that scores buyer intent
            in real-time, engages prospects intelligently, and routes hot leads
            directly to your team.
          </p>

          <div className="landing-hero-cta-group">
            <Link to="/signup" className="landing-btn-cta-lg">
              Start Free Trial →
            </Link>
            <a href="#how-it-works" className="landing-btn-secondary-lg">
              See How It Works
            </a>
          </div>
        </div>

        <div className="landing-hero-image">
          <img
            src="/landing/hero-dashboard.png"
            alt="SalesGen AI Dashboard - Real-time intent scoring"
            loading="eager"
          />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="landing-stats">
        <div className="landing-stat">
          <div className="landing-stat-value">10<span className="accent">x</span></div>
          <div className="landing-stat-label">Faster Lead Qualification</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">85<span className="accent">%</span></div>
          <div className="landing-stat-label">Intent Accuracy</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">3<span className="accent">min</span></div>
          <div className="landing-stat-label">Average Integration Time</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-value">24<span className="accent">/7</span></div>
          <div className="landing-stat-label">Always-On AI Agent</div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features" id="features">
        <div className="landing-section-header">
          <div className="landing-section-label">Core Capabilities</div>
          <h2 className="landing-section-title">
            A Complete AI Sales Pipeline,<br />Not Just a Chatbot
          </h2>
          <p className="landing-section-sub">
            SalesGen is a multi-agent framework that understands, scores, and
            routes — closing the loop between visitor engagement and revenue.
          </p>
        </div>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🎯</div>
            <h3 className="landing-feature-title">Real-Time Intent Scoring</h3>
            <p className="landing-feature-desc">
              Hybrid regex + LLM pipeline analyzes every message for buying signals
              like pricing probes, team mentions, and timeline urgency. Scores
              update live on your dashboard.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">🤖</div>
            <h3 className="landing-feature-title">AI Conversation Engine</h3>
            <p className="landing-feature-desc">
              Context-aware AI agent powered by Groq LLaMA delivers pacing-aware
              responses tuned to each buyer persona. It knows when to nurture and
              when to push.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">🧠</div>
            <h3 className="landing-feature-title">Persona Detection</h3>
            <p className="landing-feature-desc">
              Automatically classifies visitors into archetypes — Technical
              Evaluator, Budget Decision Maker, Startup Founder — and adapts
              tone accordingly.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">🔥</div>
            <h3 className="landing-feature-title">Human Takeover</h3>
            <p className="landing-feature-desc">
              When intent score hits threshold, your sales team gets alerted
              instantly. Take over the live conversation from your phone or
              dashboard in one tap.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">📊</div>
            <h3 className="landing-feature-title">Live Monitor Dashboard</h3>
            <p className="landing-feature-desc">
              Watch AI reasoning in real-time. See conversation flow, score
              trajectory, triggered signals, and KB citations — all in a
              beautiful dark-mode dashboard.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">⚡</div>
            <h3 className="landing-feature-title">One-Line Embed</h3>
            <p className="landing-feature-desc">
              Add the SalesGen widget to any website with a single script tag.
              Works on Shopify, WordPress, Webflow, React, or raw HTML — zero
              dependencies.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="landing-how" id="how-it-works">
        <div className="landing-section-header">
          <div className="landing-section-label">How It Works</div>
          <h2 className="landing-section-title">
            From Embed to Close in Four Steps
          </h2>
        </div>

        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-number">1</div>
            <h3 className="landing-step-title">Embed the Widget</h3>
            <p className="landing-step-desc">
              Paste one line of JavaScript into your site. The AI agent appears
              as a sleek chat bubble, ready to engage.
            </p>
          </div>

          <div className="landing-step">
            <div className="landing-step-number">2</div>
            <h3 className="landing-step-title">AI Engages Visitors</h3>
            <p className="landing-step-desc">
              The agent greets visitors, answers questions from your knowledge
              base, and qualifies leads through natural conversation.
            </p>
          </div>

          <div className="landing-step">
            <div className="landing-step-number">3</div>
            <h3 className="landing-step-title">Score & Route</h3>
            <p className="landing-step-desc">
              Buying signals are detected and scored 0–100. When a lead is hot,
              your team gets Slack alerts, webhooks, and mobile push notifications.
            </p>
          </div>

          <div className="landing-step">
            <div className="landing-step-number">4</div>
            <h3 className="landing-step-title">Close the Deal</h3>
            <p className="landing-step-desc">
              Take over live from the mobile app or let the AI schedule Calendly
              demos automatically. Pipeline accelerated.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-cta-section" id="pricing">
        <div className="landing-cta-box">
          <h2>Ready to supercharge your sales pipeline?</h2>
          <p>
            Join hundreds of teams using SalesGen to convert website visitors
            into revenue — automatically.
          </p>
          <Link to="/signup" className="landing-btn-cta-lg">
            Get Started Free →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-copy">
          © 2026 SalesGen. Built with AI.
        </div>
        <div className="landing-footer-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
          <Link to="/login">Login</Link>
        </div>
      </footer>
    </div>
  )
}
