import React from 'react';

export default function Footer({ setActivePage }) {
  return (
    <footer
      className="footer py-4 mt-auto"
      style={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.03), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
        position: 'relative',
        zIndex: 10
      }}
    >
      <div className="container">
        <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2">
          <a
            className="text-decoration-none fw-bold"
            href="#"
            onClick={(e) => { e.preventDefault(); setActivePage('home'); }}
            style={{ fontSize: '1.1rem', letterSpacing: '-0.5px', fontFamily: 'var(--font-brand)', color: 'var(--text-heading)' }}
          >
            Smart <span style={{ color: '#0d6efd' }}>Sight</span>
          </a>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>&copy; 2026 Smart Sight. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
