import React, { useEffect } from 'react';

export default function HomePage({ setActivePage }) {
  useEffect(() => {
    // Counter animation logic
    document.querySelectorAll('[data-count-to]').forEach(function (el) {
      const target = parseInt(el.getAttribute('data-count-to'));
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      let current = 0;
      const duration = 1800;
      const step = Math.ceil(target / (duration / 16));
      const timer = setInterval(function () {
        current = Math.min(current + step, target);
        el.textContent = prefix + current + suffix;
        if (current >= target) clearInterval(timer);
      }, 16);
    });

    // Scroll reveal logic
    const revealEls = document.querySelectorAll('[data-reveal]');
    if (revealEls.length > 0) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute('data-reveal-delay') || 0;
            setTimeout(function () {
              entry.target.classList.add('is-visible');
            }, parseInt(delay, 10));
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      revealEls.forEach(function (el) { observer.observe(el); });
    }
  }, []);

  return (
    <div className="homepage-root-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ════════════════════════════════════════════════════════ */}
      {/* HERO SECTION */}
      {/* ════════════════════════════════════════════════════════ */}
      <section className="page-hero text-center">
        <div className="page-hero-bg-wrapper">
          <div className="page-hero-bg"></div>
          <div className="page-hero-orb"></div>
        </div>
        <div className="container page-hero-content">
          <div className="row align-items-center g-5">
            {/* Center: Copy */}
            <div className="col-lg-10 mx-auto text-center">
              <h1 className="hero-title mb-3 mb-md-4" data-reveal="true" data-reveal-delay="0">
                Smart <span className="accent">Sight</span>
              </h1>

              <p className="hero-sub mb-4 mb-md-5 mx-auto" data-reveal="true" data-reveal-delay="100">
                Harnessing YOLO object detection and <span className="text-nowrap">state-of-the-art</span> Computer Vision to automate tracking, detect faces, and ensure smarter monitoring in real-time.
              </p>

              <div className="hero-cta-group mb-5 justify-content-center" data-reveal="true" data-reveal-delay="200">
                <a href="#" onClick={(e) => { e.preventDefault(); setActivePage('detection'); }} className="btn-hero-primary">
                  <i className="bi bi-play-fill"></i>
                  Start Detection
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); setActivePage('about'); }} className="btn-hero-outline">
                  Explore Project
                  <i className="bi bi-arrow-right"></i>
                </a>
              </div>

              <div className="hero-stats justify-content-center" data-reveal="true" data-reveal-delay="300">
                <div className="stat-item">
                  <div className="num" data-count-to="99" data-suffix="%">0%</div>
                  <div className="label">Detection Accuracy</div>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <div className="num" data-count-to="30" data-suffix="">30</div>
                  <div className="label">FPS Processing</div>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <div className="num">24/7</div>
                  <div className="label">Live Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container position-relative" style={{ zIndex: 1 }}>
        <div className="section-divider"></div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* FEATURES SECTION */}
      {/* ════════════════════════════════════════════════════════ */}
      <section className="features-section">
        <div className="container">
          <div className="text-center mb-5" data-reveal="true">
            <p className="section-eyebrow">Core Technology</p>
            <h2 className="section-title">Built for precision.<br />Designed for scale.</h2>
          </div>

          <div className="row g-4 d-flex align-items-stretch">
            <div className="col-md-4 d-flex" data-reveal="true" data-reveal-delay="0">
              <div className="feature-card w-100 flex-grow-1">
                <div className="feature-icon-wrap">
                  <i className="bi bi-camera-video text-primary"></i>
                </div>
                <h3>Real-time OpenCV</h3>
                <p>Lightning-fast image processing directly from camera feeds. Engineered for minimal latency with hardware-accelerated pipelines.</p>
              </div>
            </div>
            <div className="col-md-4 d-flex" data-reveal="true" data-reveal-delay="120">
              <div className="feature-card w-100 flex-grow-1">
                <div className="feature-icon-wrap">
                  <i className="bi bi-person-bounding-box text-primary"></i>
                </div>
                <h3>YOLO Detection</h3>
                <p>State-of-the-art YOLOv8 models for accurate and robust face detection in complex environments, day or night.</p>
              </div>
            </div>
            <div className="col-md-4 d-flex" data-reveal="true" data-reveal-delay="240">
              <div className="feature-card w-100 flex-grow-1">
                <div className="feature-icon-wrap">
                  <i className="bi bi-layers text-primary"></i>
                </div>
                <h3>Django Core</h3>
                <p>Built on a battle-tested web framework with a premium front-end, ensuring secure session management and smooth user flows.</p>
              </div>
            </div>
          </div>

          {/* CTA Strip */}
          <div className="cta-strip" data-reveal="true" data-reveal-delay="0">
            <h2 className="fw-900 mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', fontWeight: 700, color: 'var(--text-heading)' }}>
              Ready to secure your premises?
            </h2>
            <p className="mb-4" style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Jump into the detection console and start monitoring in seconds.
            </p>
            <div className="d-flex justify-content-center">
              <a href="#" onClick={(e) => { e.preventDefault(); setActivePage('detection'); }} className="btn-hero-primary">
                <i className="bi bi-shield-check"></i>
                Launch Detection Console
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
