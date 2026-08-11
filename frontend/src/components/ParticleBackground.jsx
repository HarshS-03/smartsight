import React from 'react';

/**
 * Pure Blue & Cyan Stationary Mesh Gradient Background
 * No purplish/violet undertones — strictly ocean blue, sky blue, ice blue, and cyan.
 * Palette: #1e56a0, #3b82f6, #38bdf8, #7dd3fc, #0284c7
 */
export default function ParticleBackground() {
  return (
    <div className="stationary-mesh-bg" aria-hidden="true">
      <style>{`
        .stationary-mesh-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: 
            radial-gradient(at 5% 5%, rgba(30, 86, 160, 0.40) 0px, transparent 55%),
            radial-gradient(at 95% 5%, rgba(59, 130, 246, 0.35) 0px, transparent 55%),
            radial-gradient(at 50% 50%, rgba(56, 189, 248, 0.30) 0px, transparent 60%),
            radial-gradient(at 5% 95%, rgba(125, 211, 252, 0.35) 0px, transparent 55%),
            radial-gradient(at 95% 95%, rgba(2, 132, 199, 0.35) 0px, transparent 55%),
            linear-gradient(135deg, rgba(30, 86, 160, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%),
            #f8fafc;
          transition: background-color 0.5s ease;
        }

        [data-bs-theme="dark"] .stationary-mesh-bg {
          background: 
            radial-gradient(at 5% 5%, rgba(30, 86, 160, 0.45) 0px, transparent 55%),
            radial-gradient(at 95% 5%, rgba(59, 130, 246, 0.40) 0px, transparent 55%),
            radial-gradient(at 50% 50%, rgba(56, 189, 248, 0.28) 0px, transparent 60%),
            radial-gradient(at 5% 95%, rgba(125, 211, 252, 0.35) 0px, transparent 55%),
            radial-gradient(at 95% 95%, rgba(2, 132, 199, 0.40) 0px, transparent 55%),
            linear-gradient(135deg, rgba(30, 86, 160, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%),
            #0b0f19;
        }
      `}</style>
    </div>
  );
}
