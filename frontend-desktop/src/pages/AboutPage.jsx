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
              {/* Django REST Framework (Vibrant Emerald Green for Dark Mode Visibility) */}
              <a href="https://www.django-rest-framework.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-django text-decoration-none" data-reveal="scale" data-reveal-delay="0">
                <div className="tech-icon">
                  <img src="https://cdn.simpleicons.org/django/2BA977" alt="Django" />
                </div>
                <div className="tech-name">Django REST</div>
                <div className="tech-use">Backend Web Server</div>
              </a>

              {/* React & Vite */}
              <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-react text-decoration-none" data-reveal="scale" data-reveal-delay="50">
                <div className="tech-icon">
                  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" alt="React" />
                </div>
                <div className="tech-name">React 18 &amp; Vite</div>
                <div className="tech-use">Frontend UI Framework</div>
              </a>

              {/* Ultralytics YOLOv8 */}
              <a href="https://docs.ultralytics.com/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-yolo text-decoration-none" data-reveal="scale" data-reveal-delay="100">
                <div className="tech-icon">
                  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg" alt="PyTorch YOLOv8" />
                </div>
                <div className="tech-name">Ultralytics YOLOv8</div>
                <div className="tech-use">Real-Time Object Detection</div>
              </a>

              {/* OpenCV Python */}
              <a href="https://opencv.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-opencv text-decoration-none" data-reveal="scale" data-reveal-delay="150">
                <div className="tech-icon">
                  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opencv/opencv-original.svg" alt="OpenCV" />
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
                  <img src="https://cdn.simpleicons.org/onnx/005CED" alt="ONNX" />
                </div>
                <div className="tech-name">ONNX Runtime</div>
                <div className="tech-use">Fast Model Acceleration</div>
              </a>

              {/* Scikit-learn */}
              <a href="https://scikit-learn.org/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-sklearn text-decoration-none" data-reveal="scale" data-reveal-delay="300">
                <div className="tech-icon">
                  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/scikitlearn/scikitlearn-original.svg" alt="Scikit-learn" />
                </div>
                <div className="tech-name">Scikit-learn</div>
                <div className="tech-use">DBSCAN Face Clustering</div>
              </a>

              {/* OpenPyXL (Document Sheet + Table Grid + Python Logo Overlay) */}
              <a href="https://openpyxl.readthedocs.io/" target="_blank" rel="noopener noreferrer" className="tech-card tech-card-openpyxl text-decoration-none" data-reveal="scale" data-reveal-delay="350">
                <div className="tech-icon">
                  <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
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
