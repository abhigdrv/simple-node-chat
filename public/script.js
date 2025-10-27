const socket = io();
let currentRecipient = "";
let currentUsername = "";
let chatMessages = { group: [], private: {} };
let unreadCounts = { group: 0, private: {} };

const STORAGE_KEYS = {
  USERNAME: "flashchat_username",
  MESSAGES: "flashchat_messages",
  RECIPIENT: "flashchat_recipient",
  UNREAD: "flashchat_unread",
};

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
    // Keyboard shown
    setTimeout(() => {
      const chatBox = document.getElementById("chat-box");
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 100);
  }
  lastHeight = currentHeight;
});

window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  checkAutoLogin();
});

function saveMessagesToSession() {
  try {
    sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
    sessionStorage.setItem(STORAGE_KEYS.RECIPIENT, currentRecipient);
    sessionStorage.setItem(STORAGE_KEYS.UNREAD, JSON.stringify(unreadCounts));
  } catch (e) {
    console.error("Error saving to sessionStorage:", e);
  }
}

function loadFromStorage() {
  try {
    const savedMessages = sessionStorage.getItem(STORAGE_KEYS.MESSAGES);
    const savedRecipient = sessionStorage.getItem(STORAGE_KEYS.RECIPIENT);
    const savedUnread = sessionStorage.getItem(STORAGE_KEYS.UNREAD);

    if (savedMessages) chatMessages = JSON.parse(savedMessages);
    if (savedRecipient) currentRecipient = savedRecipient;
    if (savedUnread) unreadCounts = JSON.parse(savedUnread);
  } catch (e) {
    console.error("Error loading from sessionStorage:", e);
  }
}

function updateTotalUnreadBadge() {
  let totalUnread = unreadCounts.group;
  Object.keys(unreadCounts.private).forEach((user) => {
    totalUnread += unreadCounts.private[user] || 0;
  });

  const badge = document.getElementById("total-unread");
  if (totalUnread > 0) {
    badge.textContent = totalUnread > 99 ? "99+" : totalUnread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function updateUserListUnread() {
  const userListItems = document.querySelectorAll("#user-list li");
  userListItems.forEach((li) => {
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
    } else if (badge) {
      badge.style.display = "none";
    }
  });

  updateTotalUnreadBadge();
  saveMessagesToSession();
}

function checkAutoLogin() {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME);
  if (savedUsername) {
    currentUsername = savedUsername;
    autoLogin(savedUsername);
  }
}

function autoLogin(username) {
  const usernameInput = document.getElementById("username-input");
  const messageInput = document.getElementById("message-input");
  const imgButton = document.getElementById("image-btn");
  const setButton = document.getElementById("login-btn");
  const sendButton = document.getElementById("send-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const currentUserBadge = document.getElementById("current-user-badge");

  socket.emit("setUsername", username);
  usernameInput.style.display = "none";
  messageInput.style.display = "block";
  imgButton.style.display = "flex";
  setButton.style.display = "none";
  sendButton.style.display = "flex";
  logoutBtn.style.display = "block";
  currentUserBadge.style.display = "flex";

  document.getElementById("chat-box").innerHTML = "";

  if (currentRecipient === "") {
    displayMessages("group");
    updateChatHeader("Group Chat", "Tap to see members");
  } else {
    setRecipient(currentRecipient);
  }

  updateTotalUnreadBadge();
}

function logout() {
  if (confirm("Are you sure you want to logout? Your messages will be cleared.")) {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    
    // Clear sessionStorage
    sessionStorage.removeItem(STORAGE_KEYS.MESSAGES);
    sessionStorage.removeItem(STORAGE_KEYS.RECIPIENT);
    sessionStorage.removeItem(STORAGE_KEYS.UNREAD);
    
    // Clear in-memory variables
    currentUsername = "";
    currentRecipient = "";
    chatMessages = { group: [], private: {} };
    unreadCounts = { group: 0, private: {} };
    
    // Disconnect socket
    socket.disconnect();
    
    // Reload page
    location.reload();
  }
}

function updateChatHeader(title, subtitle) {
  document.getElementById("chat-title").textContent = title;
  document.getElementById("chat-subtitle").textContent = subtitle;
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

document.getElementById("image-input").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024) {
    alert("File too large! Please select file under 2MB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    const base64String = e.target.result;
    const messageInput = document.getElementById("message-input");
    messageInput.value = base64String;
    document.getElementById("send-btn").click();
  };
  reader.readAsDataURL(file);
});

function setUsername() {
  const usernameInput = document.getElementById("username-input");
  const messageInput = document.getElementById("message-input");
  const imgButton = document.getElementById("image-btn");
  const setButton = document.getElementById("login-btn");
  const sendButton = document.getElementById("send-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const randomNumber = Math.floor(Math.random() * 900) + 100;
  const username = usernameInput.value.trim() + "_" + randomNumber;
  const currentUserBadge = document.getElementById("current-user-badge");

  if (usernameInput.value.trim() !== "") {
    currentUsername = username;
    localStorage.setItem(STORAGE_KEYS.USERNAME, username);

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

function setRecipient(val) {
  currentRecipient = val;

  if (val === "") {
    updateChatHeader("Group Chat", "Tap to see members");
    unreadCounts.group = 0;
    displayMessages("group");
  } else {
    const displayName = val.slice(0, -4);
    updateChatHeader(displayName, "Online");
    unreadCounts.private[val] = 0;
    if (!chatMessages.private[val]) {
      chatMessages.private[val] = [];
    }
    displayMessages("private", val);
  }

  updateUserListUnread();
  updateTotalUnreadBadge();
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

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  // Show sender name only in group chat for received messages
  const isGroupChat = currentRecipient === "";
  if (isGroupChat && !isSent) {
    const senderName = data.from.slice(0, -4);
    const senderColor = generateColorHash(data.from);
    const senderSpan = document.createElement("span");
    senderSpan.className = "message-sender";
    senderSpan.style.color = senderColor;
    senderSpan.textContent = senderName;
    bubble.appendChild(senderSpan);
  }

  const textDiv = document.createElement("div");
  textDiv.className = "message-text";
  if (typeof data.msg === "string" && data.msg.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = data.msg;
    img.alt = "Image message";
    img.style.maxWidth = "200px";
    img.style.borderRadius = "8px";
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      const byteString = atob(data.msg.split(",")[1]);
      const mimeString = data.msg.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    textDiv.appendChild(img);
  } else {
    textDiv.textContent = data.msg;
  }
  bubble.appendChild(textDiv);

  const time = new Date(data.timestamp || Date.now());
  const timeStr = time.getHours().toString().padStart(2, "0") + ":" + time.getMinutes().toString().padStart(2, "0");
  const timeSpan = document.createElement("span");
  timeSpan.className = "message-time";
  timeSpan.textContent = timeStr;
  bubble.appendChild(timeSpan);

  messageElement.appendChild(bubble);
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

  updateUserListUnread();
});

socket.on("group message", (data) => {
  data.timestamp = Date.now();
  chatMessages.group.push(data);

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
  return `hsl(${hue}, 65%, 45%)`;
}

function openNav() {
  document.getElementById("mySidenav").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}

function closeNav() {
  document.getElementById("mySidenav").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

setInterval(() => {
  if (currentUsername) {
    saveMessagesToSession();
  }
}, 30000);

window.addEventListener("beforeunload", () => {
  if (currentUsername) {
    saveMessagesToSession();
  }
});
