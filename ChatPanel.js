import React, { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

function ChatPanel({ chatHistory, connected, onSendMessage }) {
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const chatHistoryRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Setup speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        sendMessageHandler(transcript);
      };
      
      recognitionInstance.onerror = () => {
        setIsRecording(false);
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const sendMessageHandler = async (messageOverride) => {
    const message = messageOverride || inputMessage.trim();
    if (!message || !connected) return;
    
    onSendMessage(message);
    setInputMessage('');
  };

  const toggleSpeechRecognition = () => {
    if (!recognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }
    
    if (!connected) {
      alert('Wait for Edith to connect!');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
      setIsRecording(true);
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isRecording) {
          recognition.stop();
        }
      }, 10000);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasMessages = chatHistory.length > 0;

  return (
    <div className="chat-panel">
      <div className="chat-history" ref={chatHistoryRef}>
        {!hasMessages && (
          <div className="empty-chat">
            <div className="emoji">👋</div>
            <p>Say hello to Edith! Type or click the mic to speak!</p>
          </div>
        )}
        
        {chatHistory.map((msg, index) => (
          <div key={index} className={`msg ${msg.role}`}>
            <div className="msg-bubble">{msg.content}</div>
            {msg.role !== 'system' && msg.timestamp && (
              <div className="msg-time">{formatTime(msg.timestamp)}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-bar">
        <input
          id="msg-input"
          type="text"
          placeholder="Type something fun…"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessageHandler()}
          disabled={!connected}
        />
        <button
          id="btn-mic"
          className={`icon-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleSpeechRecognition}
          disabled={!connected}
          title="Click to Speak"
        >
          {isRecording ? '🎙️' : '🎤'}
        </button>
        <button
          id="btn-send"
          className="icon-btn"
          onClick={() => sendMessageHandler()}
          disabled={!connected || !inputMessage.trim()}
          title="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;