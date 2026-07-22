import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = {
  // Session token
  getSessionToken: async () => {
    const response = await axios.post(`${API_BASE_URL}/session-token`);
    return response.data;
  },

  // Groq chat
  groqChat: async (message, chatHistory) => {
    const response = await axios.post(`${API_BASE_URL}/groq`, {
      message,
      chatHistory: chatHistory.filter(msg => msg.role !== 'system').map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    });
    return response.data;
  },

  // Sessions
  getSessions: async () => {
    const response = await axios.get(`${API_BASE_URL}/sessions`);
    return response.data;
  },

  createSession: async (name) => {
    const response = await axios.post(`${API_BASE_URL}/sessions`, { name });
    return response.data;
  },

  deleteSession: async (sessionId) => {
    const response = await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`);
    return response.data;
  },

  // Messages
  getMessages: async (sessionId) => {
    const response = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/messages`);
    return response.data;
  },

  addMessage: async (sessionId, role, content) => {
    const response = await axios.post(`${API_BASE_URL}/sessions/${sessionId}/messages`, {
      role,
      content
    });
    return response.data;
  }
};

export default api;