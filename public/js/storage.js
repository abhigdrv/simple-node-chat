// Storage operations
import { STORAGE_KEYS } from './config.js';

export function saveMessagesToSession(chatMessages, currentRecipient, unreadCounts) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
    sessionStorage.setItem(STORAGE_KEYS.RECIPIENT, currentRecipient);
    sessionStorage.setItem(STORAGE_KEYS.UNREAD, JSON.stringify(unreadCounts));
  } catch (e) {
    console.error("Error saving to sessionStorage:", e);
  }
}

export function loadFromStorage() {
  try {
    const savedMessages = sessionStorage.getItem(STORAGE_KEYS.MESSAGES);
    const savedRecipient = sessionStorage.getItem(STORAGE_KEYS.RECIPIENT);
    const savedUnread = sessionStorage.getItem(STORAGE_KEYS.UNREAD);

    return {
      chatMessages: savedMessages ? JSON.parse(savedMessages) : { group: [], private: {} },
      currentRecipient: savedRecipient || "",
      unreadCounts: savedUnread ? JSON.parse(savedUnread) : { group: 0, private: {} }
    };
  } catch (e) {
    console.error("Error loading from sessionStorage:", e);
    return {
      chatMessages: { group: [], private: {} },
      currentRecipient: "",
      unreadCounts: { group: 0, private: {} }
    };
  }
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEYS.USERNAME);
  sessionStorage.removeItem(STORAGE_KEYS.MESSAGES);
  sessionStorage.removeItem(STORAGE_KEYS.RECIPIENT);
  sessionStorage.removeItem(STORAGE_KEYS.UNREAD);
}

export function saveUsername(username) {
  localStorage.setItem(STORAGE_KEYS.USERNAME, username);
}

export function getSavedUsername() {
  return localStorage.getItem(STORAGE_KEYS.USERNAME);
}