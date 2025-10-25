const socket = io();
let currentRecipient = "";
let currentUsername = "";
let chatMessages = {
  group: [],
  private: {},
};
let unreadCounts = {
  group: 0,
  private: {},
};

// Storage keys
const STORAGE_KEYS = {
  USERNAME: "flashchat_username",
  MESSAGES: "flashchat_messages",
  RECIPIENT: "flashchat_recipient",
  UNREAD: "flashchat_unread",
};

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  checkAutoLogin();
});

// Save messages to sessionStorage whenever they change
function saveMessagesToSession() {
  try {
    sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
    sessionStorage.setItem(STORAGE_KEYS.RECIPIENT, currentRecipient);
    sessionStorage.setItem(STORAGE_KEYS.UNREAD, JSON.stringify(unreadCounts));
  } catch (e) {
    console.error("Error saving to sessionStorage:", e);
  }
}

// Load messages from sessionStorage
function loadFromStorage() {
  try {
    const savedMessages = sessionStorage.getItem(STORAGE_KEYS.MESSAGES);
    const savedRecipient = sessionStorage.getItem(STORAGE_KEYS.RECIPIENT);
    const savedUnread = sessionStorage.getItem(STORAGE_KEYS.UNREAD);

    if (savedMessages) {
      chatMessages = JSON.parse(savedMessages);
    }

    if (savedRecipient) {
      currentRecipient = savedRecipient;
    }

    if (savedUnread) {
      unreadCounts = JSON.parse(savedUnread);
    }
  } catch (e) {
    console.error("Error loading from sessionStorage:", e);
  }
}

// Update total unread count badge
function updateTotalUnreadBadge() {
  let totalUnread = unreadCounts.group;

  // Add all private message unread counts
  Object.keys(unreadCounts.private).forEach((user) => {
    totalUnread += unreadCounts.private[user] || 0;
  });

  const currentUserBadge = document.getElementById("current-user-badge");
  let badge = currentUserBadge.querySelector(".unread-badge");

  if (totalUnread > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "unread-badge";
      currentUserBadge.appendChild(badge);
    }
    badge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    badge.style.display = "flex";
  } else {
    if (badge) {
      badge.style.display = "none";
    }
  }
}

// Update user list with unread counts
function updateUserListUnread() {
  const userListItems = document.querySelectorAll("#user-list li");

  userListItems.forEach((li) => {
    const username = li.textContent.replace(/\d+$/, "").trim();
    const fullUsername = li.getAttribute("data-username");
    const unreadCount = unreadCounts.private[fullUsername] || 0;

    let badge = li.querySelector(".user-unread-badge");

    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "user-unread-badge";
        li.appendChild(badge);
      }
      badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
      badge.style.display = "flex";
    } else {
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  updateTotalUnreadBadge();
  saveMessagesToSession();
}

// Check if user was previously logged in
function checkAutoLogin() {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME);

  if (savedUsername) {
    currentUsername = savedUsername;
    autoLogin(savedUsername);
  }
}

// Auto login with saved username
function autoLogin(username) {
  const usernameInput = document.getElementById("username-input");
  const messageInput = document.getElementById("message-input");
  const setButton = document.getElementById("login-btn");
  const sendButton = document.getElementById("send-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const currentUser = document.getElementById("current-user");
  const currentUserBadge = document.getElementById("current-user-badge");

  socket.emit("setUsername", username);
  usernameInput.style.display = "none";
  messageInput.style.display = "block";
  setButton.style.display = "none";
  sendButton.style.display = "block";
  logoutBtn.style.display = "block";
  currentUser.textContent = username;
  currentUserBadge.style.display = "flex";

  document.getElementById("chat-box").innerHTML = "";

  // Restore chat view
  if (currentRecipient === "") {
    displayMessages("group");
  } else {
    setRecipient(currentRecipient);
  }

  updateTotalUnreadBadge();
}

// Logout function
function logout() {
  if (confirm("Are you sure you want to logout? Your messages will be cleared.")) {
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    sessionStorage.removeItem(STORAGE_KEYS.MESSAGES);
    sessionStorage.removeItem(STORAGE_KEYS.RECIPIENT);
    sessionStorage.removeItem(STORAGE_KEYS.UNREAD);
    location.reload();
  }
}

document.getElementById("message-input").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("send-btn").click();
  }
});

document.getElementById("username-input").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("login-btn").click();
  }
});

function setUsername() {
  const usernameInput = document.getElementById("username-input");
  const messageInput = document.getElementById("message-input");
  const setButton = document.getElementById("login-btn");
  const sendButton = document.getElementById("send-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const randomNumber = Math.floor(Math.random() * 900) + 100;
  const username = usernameInput.value.trim() + "_" + randomNumber;
  const currentUser = document.getElementById("current-user");
  const currentUserBadge = document.getElementById("current-user-badge");

  if (usernameInput.value.trim() !== "") {
    currentUsername = username;

    // Save username to localStorage
    localStorage.setItem(STORAGE_KEYS.USERNAME, username);

    socket.emit("setUsername", username);
    usernameInput.style.display = "none";
    messageInput.style.display = "block";
    setButton.style.display = "none";
    sendButton.style.display = "block";
    logoutBtn.style.display = "block";
    currentUser.textContent = username;
    currentUserBadge.style.display = "flex";

    document.getElementById("chat-box").innerHTML = "";
  }
}

function setRecipient(val) {
  currentRecipient = val;
  const modeText = document.getElementById("mode-text");

  if (val === "") {
    modeText.textContent = "Group Chat";
    // Clear group chat unread count
    unreadCounts.group = 0;
    displayMessages("group");
  } else {
    modeText.textContent = `Chat with ${val.slice(0, -4)}`;
    // Clear this user's unread count
    unreadCounts.private[val] = 0;
    if (!chatMessages.private[val]) {
      chatMessages.private[val] = [];
    }
    displayMessages("private", val);
  }

  // Update badges
  updateUserListUnread();
  updateTotalUnreadBadge();

  // Save current recipient
  saveMessagesToSession();

  document.querySelectorAll("#user-list li").forEach((li) => {
    li.classList.remove("active");
    const username = li.getAttribute("data-username");
    if (username === val) {
      li.classList.add("active");
    }
  });
}

function sendMessage() {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();

  if (message !== "") {
    if (currentRecipient) {
      const data = {
        from: currentUsername,
        to: currentRecipient,
        msg: message,
        timestamp: Date.now(),
      };
      if (!chatMessages.private[currentRecipient]) {
        chatMessages.private[currentRecipient] = [];
      }
      chatMessages.private[currentRecipient].push({
        from: currentUsername,
        msg: message,
        sent: true,
        timestamp: Date.now(),
      });
      saveMessagesToSession();
      displayMessage(data, true);
    }
    socket.emit("chat message", { to: currentRecipient, msg: message });
    messageInput.value = "";
  }
}

function displayMessage(data, isSent = false) {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("div");
  messageElement.className = isSent ? "message sent" : "message received";
  if (!isSent) {
    messageElement.style.backgroundColor = generateColorHash(data.from);
  }

  const isPrivate = currentRecipient !== "";
  const label = isPrivate ? "(Private)" : "";
  const sender = isSent ? "You" : data.from.slice(0, -4);

  messageElement.innerHTML = `
        <strong>${sender} ${label}</strong>
        <div class="message-text">${data.msg}</div>
      `;

  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function displayMessages(type, recipient = null) {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = "";

  let messages = [];
  if (type === "group") {
    messages = chatMessages.group;
  } else if (type === "private" && recipient) {
    messages = chatMessages.private[recipient] || [];
  }

  messages.forEach((msg) => {
    displayMessage(msg, msg.sent);
  });
}

socket.on("userList", (users) => {
  const userList = document.getElementById("user-list");
  userList.innerHTML = "";

  users.forEach((user) => {
    if (currentUsername !== user) {
      const listItem = document.createElement("li");
      listItem.setAttribute("data-username", user);

      const displayName = user.slice(0, -4);
      listItem.textContent = displayName;

      if (user === currentRecipient) {
        listItem.classList.add("active");
      }

      listItem.addEventListener("click", function () {
        setRecipient(this.getAttribute("data-username"));
        closeNav();
      });

      userList.appendChild(listItem);
    }
  });

  // Update unread counts after user list is rebuilt
  updateUserListUnread();
});

socket.on("group message", (data) => {
  data.timestamp = Date.now();
  chatMessages.group.push(data);

  // Increment unread count if not viewing group chat
  if (currentRecipient !== "") {
    unreadCounts.group = (unreadCounts.group || 0) + 1;
    updateTotalUnreadBadge();
  }

  saveMessagesToSession();

  if (currentRecipient === "") {
    displayMessage(data);
  }
});

socket.on("private message", (data) => {
  data.timestamp = Date.now();
  if (!chatMessages.private[data.from]) {
    chatMessages.private[data.from] = [];
  }
  chatMessages.private[data.from].push(data);

  // Increment unread count if not viewing this chat
  if (currentRecipient !== data.from) {
    if (!unreadCounts.private[data.from]) {
      unreadCounts.private[data.from] = 0;
    }
    unreadCounts.private[data.from]++;
    updateUserListUnread();
  }

  saveMessagesToSession();

  if (currentRecipient === data.from) {
    displayMessage(data);
  }
});

function generateColorHash(name) {
  let hashCode = 0;
  for (let i = 0; i < name.length; i++) {
    hashCode = name.charCodeAt(i) + ((hashCode << 5) - hashCode);
  }
  const hue = Math.abs(hashCode % 360);
  return `hsla(${hue}, 65%, 85%, 0.6)`;
}

function openNav() {
  document.getElementById("mySidenav").style.width = "280px";
}

function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
}

// Save messages periodically (every 30 seconds)
setInterval(() => {
  if (currentUsername) {
    saveMessagesToSession();
  }
}, 30000);

// Save messages before page unload
window.addEventListener("beforeunload", () => {
  if (currentUsername) {
    saveMessagesToSession();
  }
});
