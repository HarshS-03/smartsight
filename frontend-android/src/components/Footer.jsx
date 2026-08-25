import React from 'react';

export default function Footer({ setActivePage }) {
  return (
    <footer
      className="footer py-4 mt-auto"
      style={{
        background: 'var(--bg-surface-solid, #ffffff)',
        borderTop: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: 'var(--shadow-xs, 0 -1px 2px rgba(0, 0, 0, 0.03))',
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
            Smart <span style={{ color: 'var(--color-primary, #2563eb)' }}>Sight</span>
          </a>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>&copy; 2026 Smart Sight. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
