import React from 'react';
import './StatusBar.css';

function StatusBar({ status }) {
  const getStatusClass = () => {
    if (status.state === 'connected') return 'connected';
    if (status.state === 'connecting') return 'connecting';
    if (status.state === 'error') return 'error';
    return '';
  };

  return (
    <div className="status-bar">
      <div className={`status-dot ${getStatusClass()}`}></div>
      <span className="status-text">{status.text}</span>
    </div>
  );
}

export default StatusBar;