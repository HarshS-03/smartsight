import React, { useEffect, useRef } from 'react';

/**
 * CyberBackground Component
 * Ultra-Modern Fluid Aurora Glow + Interactive Cyber Spotlight & Tech Mesh Grid
 * Replaces old static particle background with a rich, premium ambient AI experience.
 */
export default function CyberBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse tracking with smooth lerp interpolation
    const mouse = {
      targetX: width / 2,
      targetY: height / 2,
      x: width / 2,
      y: height / 2,
      radius: Math.min(width, height) * 0.35,
      active: false,
    };

    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
        mouse.active = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      mouse.radius = Math.min(width, height) * 0.35;
    };
    window.addEventListener('resize', handleResize);

    // Aurora Glowing Fluid Blobs Config
    const blobs = [
      {
        x: width * 0.2,
        y: height * 0.3,
        r: Math.max(width, height) * 0.38,
        colorStart: 'rgba(13, 110, 253, 0.28)',  // Electric Primary Blue
        colorEnd: 'rgba(13, 110, 253, 0)',
        vx: 0.0007,
        vy: 0.0005,
        phaseX: 0,
        phaseY: Math.PI / 3,
      },
      {
        x: width * 0.8,
        y: height * 0.25,
        r: Math.max(width, height) * 0.42,
        colorStart: 'rgba(99, 102, 241, 0.24)',  // Deep Indigo Glow
        colorEnd: 'rgba(99, 102, 241, 0)',
        vx: 0.0005,
        vy: 0.0008,
        phaseX: Math.PI / 2,
        phaseY: 0,
      },
      {
        x: width * 0.75,
        y: height * 0.8,
        r: Math.max(width, height) * 0.36,
        colorStart: 'rgba(6, 182, 212, 0.22)',   // Cyan Vision Pulse
        colorEnd: 'rgba(6, 182, 212, 0)',
        vx: 0.0006,
        vy: 0.0006,
        phaseX: Math.PI,
        phaseY: Math.PI / 4,
      },
      {
        x: width * 0.3,
        y: height * 0.75,
        r: Math.max(width, height) * 0.4,
        colorStart: 'rgba(139, 92, 246, 0.20)',  // Neon Violet AI Aura
        colorEnd: 'rgba(139, 92, 246, 0)',
        vx: 0.0004,
        vy: 0.0007,
        phaseX: Math.PI * 1.5,
        phaseY: Math.PI / 2,
      },
    ];

    // Scanning Cyber Wave State
    let scanLineY = -100;
    const scanSpeed = 1.2;

    let time = 0;

    const render = () => {
      time += 1;

      // 1. Clear background
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      // 2. Draw Floating Aurora Orbs (Blend mode screen / lighter)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];

        // Smooth sine wave movement
        const currentX = b.x + Math.sin(time * b.vx + b.phaseX) * (width * 0.12);
        const currentY = b.y + Math.cos(time * b.vy + b.phaseY) * (height * 0.12);
        const currentR = b.r + Math.sin(time * 0.001 + i) * 30;

        const grad = ctx.createRadialGradient(
          currentX,
          currentY,
          0,
          currentX,
          currentY,
          currentR
        );
        grad.addColorStop(0, b.colorStart);
        grad.addColorStop(0.5, b.colorStart.replace(/[\d\.]+\)$/, '0.08)'));
        grad.addColorStop(1, b.colorEnd);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(currentX, currentY, currentR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Interactive Mouse Spotlight Glow
      if (mouse.active) {
        const spotlightGrad = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          mouse.radius
        );
        spotlightGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)'); // Soft sky blue highlight
        spotlightGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.06)');
        spotlightGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');

        ctx.fillStyle = spotlightGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Subtle Cyber Tech Grid Pattern
      const gridSize = 64;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 5. Cyber Scanning Laser Beam (Subtle AI Surveillance Scan)
      scanLineY += scanSpeed;
      if (scanLineY > height + 200) {
        scanLineY = -200;
      }

      if (scanLineY >= -100 && scanLineY <= height + 100) {
        const scanGrad = ctx.createLinearGradient(0, scanLineY - 60, 0, scanLineY + 60);
        scanGrad.addColorStop(0, 'rgba(14, 165, 233, 0)');
        scanGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
        scanGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');

        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanLineY - 60, width, 120);

        // Thin sharp beam line
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scanLineY);
        ctx.lineTo(width, scanLineY);
        ctx.stroke();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.9,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
}
