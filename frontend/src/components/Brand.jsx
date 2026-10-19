import React from 'react';
import logoMark from '../assets/logo-mark.png';
import logoFull from '../assets/Logo.png';
import './Brand.css';

export default function Brand({ compact = false, full = false }) {
  if (full) {
    return (
      <div className={`brand brand-full ${compact ? 'compact' : ''}`} aria-label="Meritx home">
        <img src={logoFull} alt="SW Meritx" className="brand-logo-full" />
      </div>
    );
  }

  return (
    <div className={`brand ${compact ? 'compact' : ''}`} aria-label="Meritx home">
      <div className="brand-icon">
        <img src={logoMark} alt="Meritx" className="brand-logo-mark" />
      </div>
      <div className="brand-words">
        <span>Merit<span>x</span></span>
        {!compact && <small>LEARN · PRACTICE · RISE</small>}
      </div>
    </div>
  );
}

