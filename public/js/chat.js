
// Core chat functionality
import { updateChatHeader, updateUserListUnread, updateTotalUnreadBadge } from './ui.js';
import { displayMessages } from './messages.js';
import { saveMessagesToSession } from './storage.js';

export function setRecipient(val, state) {
  state.currentRecipient = val;

  // Get call buttons
  const audioCallBtn = document.getElementById('audio-call-btn');
  const videoCallBtn = document.getElementById('video-call-btn');

  if (val === "") {
    updateChatHeader("Group Chat", "Tap to see members");
    state.unreadCounts.group = 0;
    displayMessages("group", null, state);
    
    // Hide call buttons for group chat
    if (audioCallBtn) audioCallBtn.style.display = 'none';
    if (videoCallBtn) videoCallBtn.style.display = 'none';
  } else {
    const displayName = val.slice(0, -4);
    updateChatHeader(displayName, "Online");
    state.unreadCounts.private[val] = 0;
    if (!state.chatMessages.private[val]) {
      state.chatMessages.private[val] = [];
    }
    displayMessages("private", val, state);
    
    // Show call buttons for private chat
    if (audioCallBtn) audioCallBtn.style.display = 'flex';
    if (videoCallBtn) videoCallBtn.style.display = 'flex';
  }

  updateUserListUnread(state);
  updateTotalUnreadBadge(state);
  saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);

  document.querySelectorAll("#user-list li").forEach((li) => {
    li.classList.remove("active");
    const username = li.getAttribute("data-username");
    if (username === val) {
      li.classList.add("active");
    }
  });
}