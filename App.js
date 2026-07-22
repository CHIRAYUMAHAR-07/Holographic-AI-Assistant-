import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import VideoPanel from './components/VideoPanel';
import api from './services/api';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [anamClient, setAnamClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState({ state: 'connecting', text: 'Connecting...' });

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Create new session on mount
  useEffect(() => {
    if (!currentSessionId) {
      createNewSession();
    }
  }, [currentSessionId]);

  // Connect avatar on mount
  useEffect(() => {
    connectAvatar();
  }, []);

  const loadSessions = async () => {
    try {
      const sessionsData = await api.getSessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const session = await api.createSession(`Chat ${new Date().toLocaleTimeString()}`);
      setCurrentSessionId(session.id);
      setChatHistory([]);
      await loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    try {
      const messages = await api.getMessages(sessionId);
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : (msg.role === 'buddy' ? 'assistant' : msg.role),
        content: msg.content,
        timestamp: msg.created_at
      }));
      setChatHistory(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const switchSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    await loadSessionMessages(sessionId);
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Delete this chat?')) return;
    
    try {
      await api.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        await createNewSession();
      } else {
        await loadSessions();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const connectAvatar = async () => {
    try {
      setStatus({ state: 'connecting', text: 'Getting ready...' });
      
      const data = await api.getSessionToken();
      const sdk = window.anam;
      
      if (!sdk?.createClient) {
        throw new Error('Anam SDK not loaded');
      }

      const client = sdk.createClient(data.sessionToken);

      client.addListener('CONNECTION_ESTABLISHED', () => {
        setStatus({ state: 'connected', text: 'Edith is ready! 🎉' });
        setConnected(true);
        setIsConnecting(false);
        
        // Mute microphone so avatar never listens
        try {
          client.muteInputAudio();
          console.log('🔇 Microphone disabled');
        } catch (e) {
          console.error('Could not mute:', e);
        }
      });

      client.addListener('CONNECTION_CLOSED', () => {
        setStatus({ state: '', text: 'Disconnected' });
        setConnected(false);
      });

      client.addListener('ERROR', (err) => {
        console.error('Anam error:', err);
        setStatus({ state: 'error', text: err?.message || 'Connection error' });
        setIsConnecting(false);
      });

      await client.streamToVideoElement('avatar-video');
      setAnamClient(client);

    } catch (error) {
      console.error('Connection error:', error);
      setStatus({ state: 'error', text: error.message });
      setIsConnecting(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text || !connected || !currentSessionId) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setChatHistory(prev => [...prev, userMessage]);
    
    // Save to database
    await api.addMessage(currentSessionId, 'user', text);

    // Show thinking indicator
    setChatHistory(prev => [...prev, { role: 'system', content: '🤔 Edith is thinking...', temporary: true }]);

    try {
      const response = await api.groqChat(text, chatHistory);
      
      // Remove thinking indicator
      setChatHistory(prev => prev.filter(msg => !msg.temporary));
      
      if (response.reply) {
        // Add AI response
        const aiMessage = { role: 'assistant', content: response.reply, timestamp: new Date().toISOString() };
        setChatHistory(prev => [...prev, aiMessage]);
        
        // Save to database
        await api.addMessage(currentSessionId, 'buddy', response.reply);
        
        // Make avatar speak
        if (anamClient) {
          try {
            anamClient.talk(response.reply);
            console.log('🔊 Avatar speaking');
          } catch (e) {
            console.error('Speech error:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prev => prev.filter(msg => !msg.temporary));
      setChatHistory(prev => [...prev, { 
        role: 'system', 
        content: '🌈 Oops! Something went wrong. Please try again!' 
      }]);
    }
  };

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={createNewSession}
        onSelectSession={switchSession}
        onDeleteSession={deleteSession}
        status={status}
      />
      <main className="stage">
        <div className="topbar">
          <h2>💬 {sessions.find(s => s.id === currentSessionId)?.name || 'New Chat'}</h2>
        </div>
        <div className="content">
          <VideoPanel isConnecting={isConnecting} connected={connected} />
          <ChatPanel
            chatHistory={chatHistory}
            connected={connected}
            onSendMessage={sendMessage}
          />
        </div>
      </main>
    </div>
  );
}

export default App;