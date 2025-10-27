// Socket event handlers
import { generateColorHash } from './utils.js';
import { closeNav, updateUserListUnread, updateTotalUnreadBadge } from './ui.js';
import { displayMessage } from './messages.js';
import { saveMessagesToSession } from './storage.js';

export function setupSocketHandlers(socket, state, callbacks) {
  socket.on("userList", (users) => {
    const userList = document.getElementById("user-list");
    userList.innerHTML = "";

    users.forEach((user) => {
      if (state.currentUsername !== user) {
        const listItem = document.createElement("li");
        listItem.setAttribute("data-username", user);

        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        avatar.textContent = user.charAt(0).toUpperCase();
        avatar.style.background = generateColorHash(user);

        const userInfo = document.createElement("div");
        userInfo.className = "user-info";

        const userName = document.createElement("div");
        userName.className = "user-name";
        userName.textContent = user.slice(0, -4);

        userInfo.appendChild(userName);
        listItem.appendChild(avatar);
        listItem.appendChild(userInfo);

        if (user === state.currentRecipient) {
          listItem.classList.add("active");
        }

        listItem.addEventListener("click", function () {
          callbacks.setRecipient(this.getAttribute("data-username"));
          closeNav();
        });

        userList.appendChild(listItem);
      }
    });

    updateUserListUnread(state);
  });

  socket.on("group message", (data) => {
    data.timestamp = Date.now();
    state.chatMessages.group.push(data);

    if (state.currentRecipient !== "") {
      state.unreadCounts.group = (state.unreadCounts.group || 0) + 1;
      updateTotalUnreadBadge(state);
    }

    saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);

    if (state.currentRecipient === "") {
      displayMessage(data, false, state);
    }
  });

  socket.on("private message", (data) => {
    data.timestamp = Date.now();
    if (!state.chatMessages.private[data.from]) {
      state.chatMessages.private[data.from] = [];
    }
    state.chatMessages.private[data.from].push(data);

    if (state.currentRecipient !== data.from) {
      if (!state.unreadCounts.private[data.from]) {
        state.unreadCounts.private[data.from] = 0;
      }
      state.unreadCounts.private[data.from]++;
      updateUserListUnread(state);
    }

    saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);

    if (state.currentRecipient === data.from) {
      displayMessage(data, false, state);
    }
  });
}