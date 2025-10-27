// Authentication functions
import { STORAGE_KEYS } from './config.js';
import { saveUsername, getSavedUsername, clearStorage } from './storage.js';
import { updateChatHeader } from './ui.js';
import { displayMessages } from './messages.js';

export function checkAutoLogin(socket, state, callbacks) {
  const savedUsername = getSavedUsername();
  if (savedUsername) {
    state.currentUsername = savedUsername;
    autoLogin(savedUsername, socket, state, callbacks);
  }
}

export function autoLogin(username, socket, state, callbacks) {
  const elements = {
    usernameInput: document.getElementById("username-input"),
    messageInput: document.getElementById("message-input"),
    imgButton: document.getElementById("image-btn"),
    setButton: document.getElementById("login-btn"),
    sendButton: document.getElementById("send-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    currentUserBadge: document.getElementById("current-user-badge"),
  };

  socket.emit("setUsername", username);
  
  elements.usernameInput.style.display = "none";
  elements.messageInput.style.display = "block";
  elements.imgButton.style.display = "flex";
  elements.setButton.style.display = "none";
  elements.sendButton.style.display = "flex";
  elements.logoutBtn.style.display = "block";
  elements.currentUserBadge.style.display = "flex";

  document.getElementById("chat-box").innerHTML = "";

  if (state.currentRecipient === "") {
    displayMessages("group", null, state);
    updateChatHeader("Group Chat", "Tap to see members");
  } else {
    callbacks.setRecipient(state.currentRecipient);
  }

  callbacks.updateTotalUnreadBadge();
}

export function setUsername(socket, state, callbacks) {
  const usernameInput = document.getElementById("username-input");
  const messageInput = document.getElementById("message-input");
  const imgButton = document.getElementById("image-btn");
  const setButton = document.getElementById("login-btn");
  const sendButton = document.getElementById("send-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const currentUserBadge = document.getElementById("current-user-badge");
  
  const randomNumber = Math.floor(Math.random() * 900) + 100;
  const username = usernameInput.value.trim() + "_" + randomNumber;

  if (usernameInput.value.trim() !== "") {
    state.currentUsername = username;
    saveUsername(username);

    socket.emit("setUsername", username);
    
    usernameInput.style.display = "none";
    messageInput.style.display = "block";
    imgButton.style.display = "flex";
    setButton.style.display = "none";
    sendButton.style.display = "flex";
    logoutBtn.style.display = "block";
    currentUserBadge.style.display = "flex";

    document.getElementById("chat-box").innerHTML = "";
    updateChatHeader("Group Chat", "Tap to see members");
  }
}

export function logout(socket) {
  if (confirm("Are you sure you want to logout? Your messages will be cleared.")) {
    clearStorage();
    socket.disconnect();
    location.reload();
  }
}