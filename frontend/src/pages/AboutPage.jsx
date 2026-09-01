import React, { useEffect } from 'react';

export default function AboutPage() {
  useEffect(() => {
    // Number counter animation logic
    document.querySelectorAll('[data-count-to]').forEach(function (el) {
      const target = parseInt(el.getAttribute('data-count-to'));
      const suffix = el.getAttribute('data-suffix') || '';
      let current = 0;
      const step = Math.ceil(target / (1800 / 16));
      const timer = setInterval(function () {
        current = Math.min(current + step, target);
        el.textContent = current + suffix;
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
    <>

      <div className="about-container">

        {/* ═══ HERO ═══ */}
        <section className="page-hero text-center">
          <div className="page-hero-bg-wrapper">
            <div className="page-hero-bg"></div>
            <div className="page-hero-orb"></div>
          </div>

          <div className="container page-hero-content">
            <div className="row align-items-center g-5">
              <div className="col-lg-10 mx-auto text-center">

                <h1 className="hero-title mb-4" data-reveal="true" data-reveal-delay="50">
                  Smart <span className="accent">Sight</span>
                </h1>

                <p className="hero-sub mb-5 mx-auto" data-reveal="true" data-reveal-delay="100">
                  An intelligent surveillance project leveraging Computer Vision and YOLOv8 deep learning
                  to detect faces, track movement, and transform passive CCTV into an active security hub.
                </p>

                <div className="hero-cta-group mb-5 justify-content-center" data-reveal="true" data-reveal-delay="200">
                  <a href="#project-details" className="btn-hero-primary">
                    <i className="bi bi-book-fill"></i>
                    Read Blueprint
                  </a>
                  <a href="#team-section" className="btn-hero-outline">
                    Meet the Team
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
                    <div className="num" data-count-to="30" data-suffix="">0</div>
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

          {/* ═══ ABOUT THE PROJECT ═══ */}
          <section className="project-details" id="project-details">
            <div className="section-header" data-reveal="true">
              <p className="section-eyebrow">Overview</p>
              <h2 className="section-title">About the Project</h2>
              <p className="section-desc">A deep dive into the engineering, security mechanisms, and capabilities of the
                Smart Sight Platform.</p>
            </div>

            <div className="row g-4">
              <div className="col-md-6" data-reveal="true" data-reveal-delay="0">
                <div className="project-detail-card h-100">
                  <div className="detail-heading">
                    <i className="bi bi-cpu"></i>
                    <span>Intelligent Processing Core</span>
                  </div>
                  <p className="detail-text">
                    At the heart of the system is the combination of OpenCV and YOLOv8 deep learning models. Traditional systems simply record footage, placing the burden of analysis on humans. Our system ingests live RTSP or local video streams, normalizes the frames, and runs inference pipelines in milliseconds to detect and identify faces, tracking occurrences instantly with zero frame drop.
                  </p>
                </div>
              </div>

              <div className="col-md-6" data-reveal="true" data-reveal-delay="100">
                <div className="project-detail-card h-100">
                  <div className="detail-heading">
                    <i className="bi bi-shield-lock"></i>
                    <span>Robust Security Framework</span>
                  </div>
                  <p className="detail-text">
                    Security is built directly into every tier. Authorized personnel access the platform via an encrypted role-based login system. The dataset storage, detection consoles, and report aggregators remain locked behind Django middleware guards. Bulk dataset imports are protected by custom system synchronization protocols that validate file trees programmatically before accepting logs.
                  </p>
                </div>
              </div>

              <div className="col-md-6" data-reveal="true" data-reveal-delay="200">
                <div className="project-detail-card h-100">
                  <div className="detail-heading">
                    <i className="bi bi-database-fill-gear"></i>
                    <span>Dataset & Model Training</span>
                  </div>
                  <p className="detail-text">
                    We designed a streamlined, folder-based bulk import protocol that allows administrators to upload person datasets containing multiple training images with a simple drag-and-drop mechanism. The system automatically processes these images, updates database associations, and maps them to the recognition pipeline, ensuring seamless integration of newly authorized personnel without downtime.
                  </p>
                </div>
              </div>

              <div className="col-md-6" data-reveal="true" data-reveal-delay="300">
                <div className="project-detail-card h-100">
                  <div className="detail-heading">
                    <i className="bi bi-graph-up"></i>
                    <span>Advanced Reports & Insights</span>
                  </div>
                  <p className="detail-text">
                    Detection events are compiled into structured, searchable database tables with entry and exit timestamps. The reports panel features a modern dashboard displaying metrics like total system detections, known vs. unknown intrusions, and daily attendance aggregations. This data can be filtered by dates or classification and exported directly to Microsoft Excel reports.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="section-divider"></div>

          {/* ═══ TEAM ═══ */}
          <section className="team-section" id="team-section">
            <div className="section-header" data-reveal="true">
              <p className="section-eyebrow">The People Behind It</p>
              <h2 className="section-title">Meet the Developers</h2>
              <p className="section-desc">The core development team responsible for building the AI models, backend
                architecture, and front-end interface.</p>
            </div>

            <div className="row g-4 justify-content-center">
              {/* Harsh Shrimali */}
              <div className="col-lg-4 col-md-6" data-reveal="true" data-reveal-delay="0">
                <div className="dev-card">
                  {/* YOLOv8 AI HUD Reticle Overlay */}
                  <div className="hud-reticle">
                    <div className="hud-bracket hud-bracket-tl"></div>
                    <div className="hud-bracket hud-bracket-tr"></div>
                    <div className="hud-bracket hud-bracket-bl"></div>
                    <div className="hud-bracket hud-bracket-br"></div>
                    <div className="hud-scanline"></div>
                    <div className="hud-label">[Harsh Shrimali | Conf: 99.9%]</div>

                  </div>
                  <div className="dev-img-container">
                    <img src="/team/Harsh.jpg" alt="Harsh Shrimali" loading="lazy" decoding="async" />
                  </div>
                  <div className="dev-overlay">
                    <div className="dev-info">
                      <div className="dev-name">Harsh Shrimali</div>
                      <div className="dev-socials">
                        <a href="https://www.linkedin.com/in/harsh-shrimali-8bbb13245/" target="_blank" rel="noopener noreferrer" className="social-btn linkedin" aria-label="LinkedIn"><i
                          className="bi bi-linkedin"></i></a>
                        <a href="https://github.com/HarshS-03" target="_blank" rel="noopener noreferrer" className="social-btn github" aria-label="GitHub"><i
                          className="bi bi-github"></i></a>
                        <a href="https://www.instagram.com/harsh0308_/" target="_blank" rel="noopener noreferrer" className="social-btn instagram" aria-label="Instagram"><i
                          className="bi bi-instagram"></i></a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Om Joshi */}
              <div className="col-lg-4 col-md-6" data-reveal="true" data-reveal-delay="150">
                <div className="dev-card">
                  {/* YOLOv8 AI HUD Reticle Overlay */}
                  <div className="hud-reticle">
                    <div className="hud-bracket hud-bracket-tl"></div>
                    <div className="hud-bracket hud-bracket-tr"></div>
                    <div className="hud-bracket hud-bracket-bl"></div>
                    <div className="hud-bracket hud-bracket-br"></div>
                    <div className="hud-scanline"></div>
                    <div className="hud-label">[Om Joshi | Conf: 99.9%]</div>

                  </div>
                  <div className="dev-img-container">
                    <img src="/team/Om.png" alt="Om Joshi" loading="lazy" decoding="async" />
                  </div>
                  <div className="dev-overlay">
                    <div className="dev-info">
                      <div className="dev-name">Om Joshi</div>
                      <div className="dev-socials">
                        <a href="https://www.linkedin.com/in/om-joshi-478512373" target="_blank" rel="noopener noreferrer" className="social-btn linkedin" aria-label="LinkedIn"><i
                          className="bi bi-linkedin"></i></a>
                        <a href="https://github.com/OmJoshi297" target="_blank" rel="noopener noreferrer" className="social-btn github" aria-label="GitHub"><i
                          className="bi bi-github"></i></a>
                        <a href="https://www.instagram.com/cla.xsy/" target="_blank" rel="noopener noreferrer" className="social-btn instagram" aria-label="Instagram"><i
                          className="bi bi-instagram"></i></a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="section-divider"></div>

          {/* ═══ TECHNOLOGY STACK ═══ */}
          <section className="tech-stack-section">
            <div className="section-header" data-reveal="true">
              <p className="section-eyebrow">Technology</p>
              <h2 className="section-title">Built With</h2>
              <p className="section-desc">The core libraries, database layers, frameworks, and deep learning architectures
                that power this platform.</p>
            </div>

            <div className="tech-grid">
              {/* Django REST Framework (Vibrant Emerald Green) */}
              <a href="https://www.django-rest-framework.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-django text-decoration-none" data-reveal="scale" data-reveal-delay="0">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="#2BA977" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.146 0h3.924v18.166c-2.013.382-3.491.535-5.096.535-4.791 0-7.288-2.166-7.288-6.32 0-4.002 2.65-6.6 6.753-6.6.637 0 1.121.05 1.707.203zm0 9.143a3.894 3.894 0 00-1.325-.204c-1.988 0-3.134 1.223-3.134 3.365 0 2.09 1.096 3.236 3.109 3.236.433 0 .79-.025 1.35-.102V9.142zM21.314 6.06v9.098c0 3.134-.229 4.638-.917 5.937-.637 1.249-1.478 2.039-3.211 2.905l-3.644-1.733c1.733-.815 2.574-1.53 3.109-2.625.561-1.121.739-2.421.739-5.835V6.059h3.924zM17.39.021h3.924v4.026H17.39z"/>
                  </svg>
                </div>
                <div className="tech-name">Django REST</div>
                <div className="tech-use">Backend Web Server</div>
              </a>

              {/* React & Vite */}
              <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-react text-decoration-none" data-reveal="scale" data-reveal-delay="50">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                    <g fill="#61DAFB">
                      <circle cx="64" cy="64" r="11.4" />
                      <path d="M107.3 45.2c-2.2-.8-4.5-1.6-6.9-2.3.6-2.4 1.1-4.8 1.5-7.1 2.1-13.2-.2-22.5-6.6-26.1-1.9-1.1-4-1.6-6.4-1.6-7 0-15.9 5.2-24.9 13.9-9-8.7-17.9-13.9-24.9-13.9-2.4 0-4.5-.5-6.4 1.6-6.4 3.7-8.7 13-6.6 26.1.4 2.3.9 4.7 1.5 7.1-2.4.7-4.7 1.4-6.9 2.3C8.2 50 1.4 56.6 1.4 64s6.9 14 19.3 18.8c2.2.8 4.5 1.6 6.9 2.3-.6 2.4-1.1 4.8-1.5 7.1-2.1 13.2.2 22.5 6.6 26.1 1.9 1.1 4 1.6 6.4 1.6 7.1 0 16-5.2 24.9-13.9 9 8.7 17.9 13.9 24.9 13.9 2.4 0 4.5-.5 6.4-1.6 6.4-3.7 8.7-13 6.6-26.1-.4-2.3-.9-4.7-1.5-7.1 2.4-.7 4.7-1.4 6.9-2.3 12.5-4.8 19.3-11.4 19.3-18.8s-6.8-14-19.3-18.8zM92.5 14.7c4.1 2.4 5.5 9.8 3.8 20.3-.3 2.1-.8 4.3-1.4 6.6-5.2-1.2-10.7-2-16.5-2.5-3.4-4.8-6.9-9.1-10.4-13 7.4-7.3 14.9-12.3 21-12.3 1.3 0 2.5.3 3.5.9zM81.3 74c-1.8 3.2-3.9 6.4-6.1 9.6-3.7.3-7.4.4-11.2.4-3.9 0-7.6-.1-11.2-.4-2.2-3.2-4.2-6.4-6-9.6-1.9-3.3-3.7-6.7-5.3-10 1.6-3.3 3.4-6.7 5.3-10 1.8-3.2 3.9-6.4 6.1-9.6 3.7-.3 7.4-.4 11.2-.4 3.9 0 7.6.1 11.2.4 2.2 3.2 4.2 6.4 6 9.6 1.9 3.3 3.7 6.7 5.3 10-1.7 3.3-3.4 6.6-5.3 10zm8.3-3.3c1.5 3.5 2.7 6.9 3.8 10.3-3.4.8-7 1.4-10.8 1.9 1.2-1.9 2.5-3.9 3.6-6 1.2-2.1 2.3-4.2 3.4-6.2zM64 97.8c-2.4-2.6-4.7-5.4-6.9-8.3 2.3.1 4.6.2 6.9.2 2.3 0 4.6-.1 6.9-.2-2.2 2.9-4.5 5.7-6.9 8.3zm-18.6-15c-3.8-.5-7.4-1.1-10.8-1.9 1.1-3.3 2.3-6.8 3.8-10.3 1.1 2 2.2 4.1 3.4 6.1 1.2 2.2 2.4 4.1 3.6 6.1zm-7-25.5c-1.5-3.5-2.7-6.9-3.8-10.3 3.4-.8 7-1.4 10.8-1.9-1.2 1.9-2.5 3.9-3.6 6-1.2 2.1-2.3 4.2-3.4 6.2zM64 30.2c2.4 2.6 4.7 5.4 6.9 8.3-2.3-.1-4.6-.2-6.9-.2-2.3 0-4.6.1-6.9.2 2.2-2.9 4.5-5.7 6.9-8.3zm22.2 21l-3.6-6c3.8.5 7.4 1.1 10.8 1.9-1.1 3.3-2.3 6.8-3.8 10.3-1.1-2.1-2.2-4.2-3.4-6.2zM31.7 35c-1.7-10.5-.3-17.9 3.8-20.3 1-.6 2.2-.9 3.5-.9 6 0 13.5 4.9 21 12.3-3.5 3.8-7 8.2-10.4 13-5.8.5-11.3 1.4-16.5 2.5-.6-2.3-1-4.5-1.4-6.6zM7 64c0-4.7 5.7-9.7 15.7-13.4 2-.8 4.2-1.5 6.4-2.1 1.6 5 3.6 10.3 6 15.6-2.4 5.3-4.5 10.5-6 15.5C15.3 75.6 7 69.6 7 64zm28.5 49.3c-4.1-2.4-5.5-9.8-3.8-20.3.3-2.1.8-4.3 1.4-6.6 5.2 1.2 10.7 2 16.5 2.5 3.4 4.8 6.9 9.1 10.4 13-7.4 7.3-14.9 12.3-21 12.3-1.3 0-2.5-.3-3.5-.9zM96.3 93c1.7 10.5.3 17.9-3.8 20.3-1 .6-2.2.9-3.5.9-6 0-13.5-4.9-21-12.3 3.5-3.8 7-8.2 10.4-13 5.8-.5 11.3-1.4 16.5-2.5.6 2.3 1 4.5 1.4 6.6zm9-15.6c-2 .8-4.2 1.5-6.4 2.1-1.6-5-3.6-10.3-6-15.6 2.4-5.3 4.5-10.5 6-15.5 13.8 4 22.1 10 22.1 15.6 0 4.7-5.8 9.7-15.7 13.4z" />
                    </g>
                  </svg>
                </div>
                <div className="tech-name">React 18 &amp; Vite</div>
                <div className="tech-use">Frontend UI Framework</div>
              </a>

              {/* Ultralytics YOLOv8 */}
              <a href="https://docs.ultralytics.com/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-yolo text-decoration-none" data-reveal="scale" data-reveal-delay="100">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="-1 2 116 118" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M26.58 2.75781C11.8159 2.75781 -0.195312 14.8321 -0.195312 29.6734C-0.195312 44.5137 11.8159 56.5883 26.58 56.5883C41.3443 56.5883 53.3555 44.5137 53.3555 29.6734C53.3555 14.8321 41.3443 2.75781 26.58 2.75781Z" fill="#005CED" />
                    <path d="M56.8751 87.0419C47.2303 87.0419 38.117 84.5871 30.1172 80.2771V92.4883C30.1172 107.307 41.888 119.602 56.6286 119.745C71.5137 119.89 83.6687 107.76 83.6687 92.8315V80.2656C75.6613 84.5864 66.5332 87.0419 56.8751 87.0419Z" fill="#005CED" />
                    <path d="M60.38 29.6796C60.3522 48.4032 45.2313 63.609 26.5383 63.6548C19.3274 63.6736 12.5609 61.417 7.03906 57.4776C16.8259 75.0637 35.5008 87.0544 56.8545 87.0128C87.8741 87.0375 113.47 61.6505 113.987 30.514L113.914 30.4474C113.944 29.6716 113.906 30.3071 113.944 29.6716C113.959 14.8198 101.929 2.69846 87.2282 2.75016C72.3871 2.80905 60.3948 14.8276 60.38 29.6796Z" fill="#005CED" />
                  </svg>
                </div>
                <div className="tech-name">Ultralytics YOLOv8</div>
                <div className="tech-use">Real-Time Face Detection</div>
              </a>

              {/* OpenCV Python */}
              <a href="https://opencv.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-opencv text-decoration-none" data-reveal="scale" data-reveal-delay="150">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                    <path d="M112.871 66.602c9.004 5.277 15.055 15.027 15.074 26.191.032 16.805-13.617 30.453-30.48 30.48-16.863.032-30.559-13.57-30.59-30.375-.02-11.164 5.996-20.933 14.984-26.246l8.774 14.778c.219.37.094.847-.262 1.09-3.32 2.25-5.496 6.046-5.488 10.347.012 6.895 5.633 12.477 12.55 12.461 6.919-.012 12.516-5.61 12.504-12.504-.007-4.3-2.195-8.09-5.523-10.328-.355-.242-.484-.719-.266-1.09zm0 0" fill="#128dff" />
                    <path d="M45.477 66.422a30.495 30.495 0 00-14.907-3.867C13.703 62.555.035 76.18.035 92.985c0 16.804 13.668 30.43 30.535 30.43 16.946 0 30.95-14.337 30.524-31.212H43.906c-.453 0-.808.383-.812.832-.043 6.723-5.672 12.434-12.524 12.434-6.922 0-12.527-5.59-12.527-12.485 0-6.894 5.605-12.484 12.527-12.484 1.809 0 3.532.383 5.086 1.074.383.168.836.04 1.047-.316zm0 0" fill="#8bda67" />
                    <path d="M47.945 61.648c-8.992-5.293-15.027-15.054-15.027-26.218C32.918 18.625 46.59 5 63.453 5s30.535 13.625 30.535 30.43c0 11.164-6.035 20.925-15.027 26.218L70.21 46.86c-.219-.37-.094-.847.266-1.09 3.32-2.246 5.503-6.039 5.503-10.34 0-6.894-5.609-12.484-12.527-12.484-6.918 0-12.527 5.59-12.527 12.485 0 4.3 2.183 8.093 5.504 10.34.36.242.484.718.265 1.09zm0 0" fill="#ff2a44" />
                  </svg>
                </div>
                <div className="tech-name">OpenCV Python</div>
                <div className="tech-use">Video Ingestion &amp; Frames</div>
              </a>

              {/* DeepFace AI */}
              <a href="https://github.com/serengil/deepface" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-deepface text-decoration-none" data-reveal="scale" data-reveal-delay="200">
                <div className="tech-icon">
                  <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Top-Left Corner */}
                    <path d="M12 32V20C12 15.58 15.58 12 20 12H32" stroke="var(--text-heading)" strokeWidth="6.5" strokeLinecap="round" />
                    {/* Top-Right Corner */}
                    <path d="M88 32V20C88 15.58 84.42 12 80 12H68" stroke="var(--text-heading)" strokeWidth="6.5" strokeLinecap="round" />
                    {/* Bottom-Left Corner */}
                    <path d="M12 68V80C12 84.42 15.58 88 20 88H32" stroke="var(--text-heading)" strokeWidth="6.5" strokeLinecap="round" />
                    {/* Bottom-Right Corner */}
                    <path d="M88 68V80C88 84.42 84.42 88 80 88H68" stroke="var(--text-heading)" strokeWidth="6.5" strokeLinecap="round" />
                    {/* Eyes */}
                    <circle cx="34" cy="30" r="5" fill="var(--text-heading)" />
                    <circle cx="66" cy="30" r="5" fill="var(--text-heading)" />
                    {/* Nose */}
                    <path d="M52 34C49 40 44 44 48 48C50 50 53 47 52 44" stroke="var(--text-heading)" strokeWidth="5.5" strokeLinecap="round" />
                    {/* Smile */}
                    <path d="M35 60C42 67 58 67 65 60" stroke="var(--text-heading)" strokeWidth="5.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="tech-name">DeepFace AI</div>
                <div className="tech-use">Facial Recognition Model</div>
              </a>

              {/* ONNX Runtime */}
              <a href="https://onnxruntime.ai/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-onnx text-decoration-none" data-reveal="scale" data-reveal-delay="250">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="#005CED" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.0325 11.2963c-.0503 0-.1006 0-.1508.0126l-4.021-7.4387c.0754-.1383.1131-.289.1131-.4524 0-.5403-.4398-.9675-.9675-.9675-.2765 0-.5278.113-.7037.3015L9.286 1.156C9.2357.6785 8.821.3016 8.3184.3016c-.5277 0-.9675.4398-.9675.9675 0 .1634.0377.3141.113.4524l-6.245 8.9591c-.0753-.0251-.1633-.0377-.2513-.0377-.5403 0-.9675.4398-.9675.9676 0 .5403.4398.9675.9675.9675h.0377l3.3676 8.3309c-.0503.1257-.088.2639-.088.402 0 .5404.4398.9676.9676.9676.2764 0 .5277-.113.7036-.3015l10.1152.9926c.1005.4273.49.7288.9424.7288.5403 0 .9676-.4398.9676-.9675 0-.2388-.088-.465-.2262-.6283l5.1141-8.8712c.0503.0126.1005.0126.1634.0126.5403 0 .9675-.4398.9675-.9676 0-.5403-.4272-.98-.9675-.98zM17.2272 4.021c.1131.1508.2765.264.4524.3267l-1.533 11.5728c-.1005.0252-.1885.0503-.2764.1005L7.4513 8.708c.0251-.0754.0377-.1634.0377-.2514 0-.0628-.0126-.1256-.0126-.1884zm4.8754 8.5068l-5.177 3.556a1.105 1.105 0 0 0-.1256-.0753L18.3455 4.335h.0126l3.9456 7.288c-.1508.1759-.2388.3895-.2388.6408 0 .1005.0126.1885.0377.2638zM6.3832 7.5016c-.4649.0754-.8293.4775-.8293.955v.0628l-3.4555 2.0481 5.378-7.7026zm.3519 1.91c.1256-.0252.2513-.088.3518-.1634l8.356 7.2628c-.0377.113-.0628.2262-.0628.3518v.0503l-9.311 3.845c-.1382-.201-.3518-.3518-.6031-.402zm8.8963 8.1172c.1257.1382.3016.2513.5026.289l.465 4.046c-.201.1006-.3519.264-.4524.4524l-9.8136-.955zm1.1435.2136c.3267-.1633.5403-.49.5403-.867 0-.088-.0126-.1634-.0377-.2513l4.7372-3.2545-4.8 8.331zm.2513-14.3497l-9.889 4.31-.1131-.0755 1.2565-5.3906h.0377c.3393 0 .6409-.1759.8168-.4397l7.891 1.5706zM1.935 11.6105c0-.0629-.0126-.1257-.0126-.1885l3.9079-2.2995c.0754.0754.1633.1508.2638.201L4.8252 20.243l-3.2043-7.9036c.1885-.176.3142-.4398.3142-.7288Z" />
                  </svg>
                </div>
                <div className="tech-name">ONNX Runtime</div>
                <div className="tech-use">Fast Model Acceleration</div>
              </a>

              {/* Scikit-learn */}
              <a href="https://scikit-learn.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-sklearn text-decoration-none" data-reveal="scale" data-reveal-delay="300">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#f89939" d="M98.18 88.13c15.63-15.62 18.23-38.36 5.8-50.78-12.43-12.42-35.17-9.82-50.8 5.8-15.63 15.62-11.11 45.48-5.8 50.78 4.29 4.29 35.17 9.82 50.8-5.8Z" />
                    <path fill="#3499cd" d="M34.04 65.56c-9.07-9.06-22.27-10.57-29.48-3.37-7.21 7.21-5.7 20.4 3.37 29.46 9.07 9.07 26.4 6.44 29.48 3.37 2.49-2.49 5.71-20.4-3.37-29.46Z" />
                    <path fill="var(--text-heading, #ffffff)" d="M123.82 85.68c-.58 0-.87-.35-.87-1.06 0-.53.35-1.69 1.04-3.46 1.01-2.59 1.52-4.45 1.52-5.58 0-.68-.2-1.25-.6-1.7-.4-.45-.9-.68-1.5-.68-.88 0-1.89.41-3.03 1.24-1.14.83-2.67 2.32-4.6 4.48.28-1.4.88-3.32 1.78-5.76l-4.31.83c-.98 2.12-1.69 4.03-2.13 5.73-.22.83-.38 1.69-.49 2.56-1.35 1.31-2.23 2.1-2.61 2.39-.39.29-.8.43-1.22.43-.39 0-.7-.15-.93-.44-.23-.29-.34-.69-.34-1.18 0-.53.1-1.14.3-1.83s.64-1.99 1.33-3.9l1.64-4.52-1.61.07c-1.46 2.78-3.17 4.28-5.13 4.49.53-1.38.8-2.44.8-3.18 0-.94-.46-1.41-1.38-1.41-1.09 0-1.94.51-2.55 1.54-.62 1.03-.93 2-.93 2.91s.51 1.55 1.52 2c-.66.97-1.4 1.88-2.2 2.74-.95.94-1.69 1.66-2.23 2.13-.55.49-1.06.73-1.52.73-.72 0-1.08-.51-1.08-1.52s.4-2.75 1.2-5.35l1.56-5.18h-.99l-3.61 2c-.59-1.35-1.62-2.03-3.09-2.03-1.17 0-2.51.5-4.03 1.49-1.52.99-2.77 2.28-3.74 3.89-.75 1.24-1.21 2.54-1.38 3.88-1.36 1.36-2.38 2.24-3.06 2.65-.71.42-1.45.63-2.23.63-1.99 0-3.22-1.15-3.69-3.45 5.19-1.52 7.78-3.5 7.78-5.94 0-.92-.33-1.66-.99-2.23-.66-.57-1.54-.85-2.63-.85-2.11 0-4.03 1.01-5.76 3.03-1.57 1.83-2.42 3.86-2.57 6.09-1.43 1.41-2.51 2.34-3.21 2.79-.72.46-1.4.69-2.03.69s-1.13-.3-1.5-.9c-.38-.6-.57-1.41-.57-2.44 0-.46.05-1.3.14-2.53 2.36-2.56 4.09-4.96 5.2-7.21 1.11-2.25 1.66-4.58 1.66-6.98 0-.85-.11-1.52-.33-2.02-.22-.5-.5-.75-.84-.75-.07 0-.18.02-.32.07l-4.49 1.66c-1.53 2.92-2.84 6.11-3.91 9.58-1.07 3.46-1.61 6.43-1.61 8.9 0 1.65.38 2.96 1.16 3.94.77.98 1.79 1.47 3.05 1.47 1.1 0 2.25-.35 3.46-1.05 1.21-.7 2.61-1.79 4.22-3.26s0-.02 0-.02c.19 1.11.65 2.04 1.37 2.8.99 1.02 2.28 1.54 3.88 1.54 1.44 0 2.75-.35 3.94-1.05 1.15-.67 2.44-1.72 3.88-3.11.12 1.04.46 1.94 1.03 2.71.73.97 1.61 1.46 2.64 1.46s2.09-.4 3.09-1.2c1-.8 2.08-2.05 3.26-3.73-.11 3.29.77 4.93 2.63 4.93.74 0 1.52-.27 2.33-.81s2.16-1.71 4.05-3.5c1.64-1.62 2.84-3.14 3.61-4.56 1.04-.18 1.99-.49 2.86-.94-1.78 2.79-2.67 5.02-2.67 6.68 0 .9.25 1.65.74 2.25.49.6 1.1.91 1.82.91 1.57 0 3.8-1.41 6.68-4.2 0 .22-.02.43-.02.65 0 .78.07 1.96.19 3.55l3.91-.92c0-1.06.02-1.9.05-2.53.06-.84.18-1.76.35-2.76.11-.59.38-1.15.81-1.68l.99-1.15c.36-.42.71-.8 1.02-1.13.37-.39.7-.72.99-.99.33-.29.62-.53.87-.69.27-.16.49-.25.65-.25.29 0 .44.19.44.57s-.28 1.26-.83 2.65c-1.04 2.59-1.56 4.52-1.56 5.78 0 .93.24 1.67.73 2.23.48.55 1.12.83 1.91.83 1.94 0 4.28-1.44 7-4.31V82.3c-1.93 2.27-3.32 3.41-4.18 3.41Zm-65.26-8.29c.8-3.91 1.62-6.94 2.45-9.11.83-2.17 1.47-3.26 1.9-3.26.2 0 .37.13.5.4.13.26.19.62.19 1.05 0 1.49-.46 3.26-1.4 5.33-.93 2.06-2.15 3.93-3.64 5.59Zm11.79-.98c.71-1.19 1.45-1.78 2.23-1.78.82 0 1.24.57 1.24 1.7 0 2.29-1.51 3.85-4.53 4.7 0-1.9.35-3.44 1.06-4.62Zm17.48 5.85c-1.04 2.01-2.16 3.01-3.33 3.01-.48 0-.88-.2-1.19-.59-.31-.39-.47-.91-.47-1.55 0-1.68.53-3.53 1.58-5.53 1.05-2 2.17-3 3.35-3 .49 0 .89.18 1.18.56.29.37.44.89.44 1.55 0 1.7-.52 3.55-1.56 5.56Z" />
                    <path fill="#fff" d="M75.46 64.88c.15.21.22.48.22.8s-.09.61-.27.88-.44.49-.79.64c-.34.15-.73.23-1.16.23-.72 0-1.26-.15-1.64-.45s-.62-.74-.72-1.33l.93-.15c.05.37.2.66.43.85.24.2.57.3 1 .3s.75-.09.96-.26c.21-.17.31-.38.31-.62 0-.21-.09-.38-.28-.5-.13-.08-.45-.19-.96-.32-.69-.17-1.16-.32-1.43-.45s-.47-.3-.6-.53-.21-.47-.21-.74c0-.25.06-.47.17-.68.11-.21.27-.38.46-.52.15-.11.34-.2.59-.27.25-.07.52-.11.81-.11.43 0 .81.06 1.14.19.33.12.57.29.73.51.16.21.26.5.32.86l-.92.12c-.04-.28-.16-.51-.36-.67-.2-.16-.48-.24-.85-.24-.43 0-.74.07-.92.21-.18.14-.28.31-.28.5 0 .12.04.23.11.33.08.1.2.18.36.25.09.03.37.11.83.24.66.18 1.12.32 1.39.43.26.11.47.28.62.49Zm4.47 1.44c-.25.23-.55.34-.92.34-.46 0-.83-.17-1.11-.5s-.43-.88-.43-1.62.15-1.27.44-1.6.68-.51 1.15-.51c.31 0 .58.09.8.28.22.19.37.47.46.84l.91-.14c-.11-.56-.35-.99-.73-1.29-.38-.3-.87-.45-1.47-.45-.48 0-.91.11-1.32.34-.4.22-.71.56-.9 1.01-.2.45-.3.97-.3 1.57 0 .92.23 1.63.69 2.12.46.49 1.07.74 1.82.74.6 0 1.11-.18 1.53-.54.41-.36.67-.86.77-1.49l-.92-.12c-.07.47-.22.81-.47 1.04Zm2.19.98h.94v-5.52h-.94v5.52Zm0-6.55h.94v-1.08h-.94v1.08Zm6.73 1.02h-1.21l-2.22 2.25v-4.35h-.94v7.62h.94V65.1l.66-.63 1.83 2.82h1.16l-2.33-3.47 2.11-2.05Zm.96-1.02h.94v-1.08h-.94v1.08Zm0 6.55h.94v-5.52h-.94v5.52Zm4.41-.84c-.17.02-.31.04-.41.04-.14 0-.25-.02-.32-.07s-.13-.11-.16-.18c-.03-.08-.05-.25-.05-.51v-3.23h.94v-.73h-.94v-1.93l-.93.56v1.37h-.69v.73h.69v3.18c0 .56.04.93.11 1.1.08.18.21.32.39.42.19.11.45.16.79.16.21 0 .44-.03.71-.08l-.14-.83Z" />
                  </svg>
                </div>
                <div className="tech-name">Scikit-learn</div>
                <div className="tech-use">DBSCAN Face Clustering</div>
              </a>

              {/* OpenPyXL (Document Sheet + Table Grid + Python Logo Overlay) */}
              <a href="https://openpyxl.readthedocs.io/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-openpyxl text-decoration-none" data-reveal="scale" data-reveal-delay="350">
                <div className="tech-icon">
                  <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Outer Document Border with Folded Top Right Corner */}
                    <path d="M26 10 H64 L82 28 V82 C82 86.4 78.4 90 74 90 H26 C21.6 90 18 86.4 18 82 V18 C18 13.6 21.6 10 26 10 Z" stroke="#00945E" strokeWidth="5.5" fill="white" />
                    {/* Folded Corner Triangle */}
                    <path d="M64 10 V28 H82 Z" fill="#00945E" />

                    {/* Spreadsheet Table Grid */}
                    <rect x="34" y="30" width="12" height="7" fill="#00945E" />
                    <rect x="48" y="30" width="12" height="7" fill="#00945E" />
                    <rect x="62" y="30" width="12" height="7" fill="#00945E" />

                    <rect x="34" y="39" width="12" height="6" fill="#86C59E" />
                    <rect x="48" y="39" width="12" height="6" fill="#86C59E" />
                    <rect x="62" y="39" width="12" height="6" fill="#86C59E" />

                    <rect x="34" y="47" width="12" height="6" fill="#B3E0C4" />
                    <rect x="48" y="47" width="12" height="6" fill="#B3E0C4" />
                    <rect x="62" y="47" width="12" height="6" fill="#B3E0C4" />

                    <rect x="34" y="55" width="12" height="6" fill="#86C59E" />
                    <rect x="48" y="55" width="12" height="6" fill="#86C59E" />
                    <rect x="62" y="55" width="12" height="6" fill="#86C59E" />

                    <rect x="34" y="63" width="12" height="6" fill="#B3E0C4" />
                    <rect x="48" y="63" width="12" height="6" fill="#B3E0C4" />
                    <rect x="62" y="63" width="12" height="6" fill="#B3E3C4" />

                    <rect x="34" y="71" width="12" height="6" fill="#86C59E" />
                    <rect x="48" y="71" width="12" height="6" fill="#86C59E" />
                    <rect x="62" y="71" width="12" height="6" fill="#86C59E" />

                    {/* Python Logo Overlay on Bottom Left with White Outline */}
                    <g transform="translate(0, 24) scale(0.46)">
                      {/* White border background outline */}
                      <path d="M49.5 0C22.6 0 24.2 11.6 24.2 11.6L24.3 23.6H49.9V27.3H14.2C14.2 27.3 0 25.7 0 52.8C0 79.9 12.4 78.4 12.4 78.4H19.8V68C19.8 53.6 32.2 53.8 32.2 53.8H57.7C57.7 53.8 69.4 54.3 69.4 42.1V12.1C69.4 12.1 71.4 0 49.5 0Z" stroke="white" strokeWidth="8" strokeLinejoin="round" fill="white" />
                      <path d="M50.5 100C77.4 100 75.8 88.4 75.8 88.4L75.7 76.4H50.1V72.7H85.8C85.8 72.7 100 74.3 100 47.2C100 20.1 87.6 21.6 87.6 21.6H80.2V32C80.2 46.4 67.8 46.2 67.8 46.2H42.3C42.3 46.2 30.6 45.7 30.6 57.9V87.9C30.6 87.9 28.6 100 50.5 100Z" stroke="white" strokeWidth="8" strokeLinejoin="round" fill="white" />

                      {/* Actual Blue & Yellow Snakes */}
                      <path d="M49.5 0C22.6 0 24.2 11.6 24.2 11.6L24.3 23.6H49.9V27.3H14.2C14.2 27.3 0 25.7 0 52.8C0 79.9 12.4 78.4 12.4 78.4H19.8V68C19.8 53.6 32.2 53.8 32.2 53.8H57.7C57.7 53.8 69.4 54.3 69.4 42.1V12.1C69.4 12.1 71.4 0 49.5 0ZM36 7.5C38.5 7.5 40.5 9.5 40.5 12C40.5 14.5 38.5 16.5 36 16.5C33.5 16.5 31.5 14.5 31.5 12C31.5 9.5 33.5 7.5 36 7.5Z" fill="#1E689F" />
                      <path d="M50.5 100C77.4 100 75.8 88.4 75.8 88.4L75.7 76.4H50.1V72.7H85.8C85.8 72.7 100 74.3 100 47.2C100 20.1 87.6 21.6 87.6 21.6H80.2V32C80.2 46.4 67.8 46.2 67.8 46.2H42.3C42.3 46.2 30.6 45.7 30.6 57.9V87.9C30.6 87.9 28.6 100 50.5 100ZM64 92.5C61.5 92.5 59.5 90.5 59.5 88C59.5 85.5 61.5 83.5 64 83.5C66.5 83.5 68.5 85.5 68.5 88C68.5 90.5 66.5 92.5 64 92.5Z" fill="#FFC82F" />
                    </g>
                  </svg>
                </div>
                <div className="tech-name">OpenPyXL</div>
                <div className="tech-use">Excel Exports Engine</div>
              </a>
            </div>
          </section>

          <div className="section-divider"></div>

          {/* ═══ PILLARS ═══ */}
          <section className="pillar-section">
            <div className="row g-4 justify-content-center">
              {/* Pillar 1 */}
              <div className="col-md-4" data-reveal="true" data-reveal-delay="0">
                <div className="pillar-card">
                  <div className="pillar-icon">
                    <i className="bi bi-eye"></i>
                  </div>
                  <h3 className="pillar-title">Active Monitoring</h3>
                  <p className="pillar-desc">
                    Detects and flags events in real-time, turning passive camera feeds into an active security layer.
                  </p>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="col-md-4" data-reveal="true" data-reveal-delay="150">
                <div className="pillar-card">
                  <div className="pillar-icon">
                    <i className="bi bi-cpu"></i>
                  </div>
                  <h3 className="pillar-title">AI at the Core</h3>
                  <p className="pillar-desc">
                    AI-driven face and object recognition delivers fast, accurate detection across all connected camera feeds.
                  </p>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="col-md-4" data-reveal="true" data-reveal-delay="300">
                <div className="pillar-card">
                  <div className="pillar-icon">
                    <i className="bi bi-shield-lock"></i>
                  </div>
                  <h3 className="pillar-title">Secure by Design</h3>
                  <p className="pillar-desc">
                    Role-based access and encrypted sessions keep your surveillance data private and fully protected.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
