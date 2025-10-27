// UI updates and interactions
import { saveMessagesToSession } from './storage.js';

export function updateChatHeader(title, subtitle) {
  document.getElementById("chat-title").textContent = title;
  document.getElementById("chat-subtitle").textContent = subtitle;
}

export function updateTotalUnreadBadge(state) {
  let totalUnread = state.unreadCounts.group;
  Object.keys(state.unreadCounts.private).forEach((user) => {
    totalUnread += state.unreadCounts.private[user] || 0;
  });

  const badge = document.getElementById("total-unread");
  if (totalUnread > 0) {
    badge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

export function updateUserListUnread(state) {
  const userListItems = document.querySelectorAll("#user-list li");
  userListItems.forEach((li) => {
    const fullUsername = li.getAttribute("data-username");
    const unreadCount = state.unreadCounts.private[fullUsername] || 0;
    let badge = li.querySelector(".user-unread-badge");

    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "user-unread-badge";
        li.appendChild(badge);
      }
      badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
      badge.style.display = "flex";
    } else if (badge) {
      badge.style.display = "none";
    }
  });

  updateTotalUnreadBadge(state);
  saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);
}

export function openNav() {
  document.getElementById("mySidenav").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}

export function closeNav() {
  document.getElementById("mySidenav").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

export function setupMobileOptimizations() {
  // Prevent zoom on input focus (iOS)
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("focus", () => {
      document.body.style.zoom = 1;
    });
  });

  // Auto-scroll on keyboard show
  let lastHeight = window.innerHeight;
  window.addEventListener("resize", () => {
    const currentHeight = window.innerHeight;
    if (currentHeight < lastHeight) {
      setTimeout(() => {
        const chatBox = document.getElementById("chat-box");
        chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);
    }
    lastHeight = currentHeight;
  });
}