import React from 'react';
import StatusBar from './StatusBar';
import './Sidebar.css';

function Sidebar({ sessions, currentSessionId, onNewChat, onSelectSession, onDeleteSession, status }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">🌟</div>
        <div className="brand-text">
          <h1>Edith AI</h1>
          <p>Your friendly chat pal!</p>
        </div>
      </div>

      <StatusBar status={status} />

      <button className="btn-new-chat" onClick={onNewChat}>
        ＋ New Chat
      </button>

      <div className="section-label">Past Chats</div>
      <div className="sessions-list">
        {sessions.length === 0 ? (
          <div className="no-sessions">No past chats yet!</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
            >
              <div 
                className="session-item-text"
                onClick={() => onSelectSession(session.id)}
              >
                <div className="session-item-name">💬 {session.name}</div>
                <div className="session-item-date">
                  {new Date(session.created_at).toLocaleDateString()}
                </div>
              </div>
              <button 
                className="session-delete"
                onClick={() => onDeleteSession(session.id)}
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default Sidebar;