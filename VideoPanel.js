import React from 'react';
import './VideoPanel.css';

function VideoPanel({ isConnecting, connected }) {
  return (
    <div className="video-panel">
      <div className="video-wrapper">
        <div id="placeholder" style={{ display: connected ? 'none' : 'flex' }}>
          <div className="avatar-ring">🤖</div>
          <p>Connecting to Edith..</p>
        </div>
        <video 
          id="avatar-video" 
          autoPlay 
          playsInline 
          style={{ display: connected ? 'block' : 'none' }}
        ></video>
        <audio id="avatar-audio" autoPlay></audio>
        <div className={`connecting-overlay ${isConnecting ? 'show' : ''}`}>
          <div className="spinner"></div>
          <p>Setting up Edith..</p>
        </div>
      </div>
    </div>
  );
}

export default VideoPanel;