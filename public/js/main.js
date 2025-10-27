// Main entry point
import { CONFIG } from './config.js';
import { loadFromStorage, saveMessagesToSession } from './storage.js';
import { checkAutoLogin, setUsername, logout } from './auth.js';
import { setRecipient } from './chat.js';
import { sendMessage } from './messages.js';
import { setupMobileOptimizations, updateTotalUnreadBadge } from './ui.js';
import { setupSocketHandlers } from './socket-handlers.js';

// Initialize socket
const socket = io();

// Application state
const state = {
  currentRecipient: "",
  currentUsername: "",
  chatMessages: { group: [], private: {} },
  unreadCounts: { group: 0, private: {} }
};

// Load saved data
window.addEventListener("DOMContentLoaded", () => {
  const savedData = loadFromStorage();
  state.chatMessages = savedData.chatMessages;
  state.currentRecipient = savedData.currentRecipient;
  state.unreadCounts = savedData.unreadCounts;
  
  setupMobileOptimizations();
  
  // Create callbacks object for cross-module communication
  const callbacks = {
    setRecipient: (val) => setRecipient(val, state),
    updateTotalUnreadBadge: () => updateTotalUnreadBadge(state)
  };
  
  setupSocketHandlers(socket, state, callbacks);
  checkAutoLogin(socket, state, callbacks);
});

// Event Listeners
document.getElementById("message-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage(socket, state);
  }
});

document.getElementById("send-btn").addEventListener("click", () => {
  sendMessage(socket, state);
});

document.getElementById("username-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    setUsername(socket, state, {
      updateTotalUnreadBadge: () => updateTotalUnreadBadge(state)
    });
  }
});

document.getElementById("login-btn").addEventListener("click", () => {
  setUsername(socket, state, {
    updateTotalUnreadBadge: () => updateTotalUnreadBadge(state)
  });
});

document.getElementById("logout-btn").addEventListener("click", () => {
  logout(socket);
});

document.getElementById("image-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    alert("File too large! Please select file under 2MB.");
    e.target.value = "";
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64String = event.target.result;
    const messageInput = document.getElementById("message-input");
    messageInput.value = base64String;
    sendMessage(socket, state);
  };
  reader.readAsDataURL(file);
});

// Auto-save
setInterval(() => {
  if (state.currentUsername) {
    saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);
  }
}, CONFIG.AUTO_SAVE_INTERVAL);

window.addEventListener("beforeunload", () => {
  if (state.currentUsername) {
    saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);
  }
});

// Make functions available globally if needed
window.openNav = () => import('./ui.js').then(m => m.openNav());
window.closeNav = () => import('./ui.js').then(m => m.closeNav());