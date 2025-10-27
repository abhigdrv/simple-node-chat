// Message display and sending
import { generateColorHash } from './utils.js';
import { saveMessagesToSession } from './storage.js';

export function sendMessage(socket, state) {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();

  if (message !== "") {
    if (state.currentRecipient) {
      const data = {
        from: state.currentUsername,
        to: state.currentRecipient,
        msg: message,
        timestamp: Date.now(),
      };
      
      if (!state.chatMessages.private[state.currentRecipient]) {
        state.chatMessages.private[state.currentRecipient] = [];
      }
      
      state.chatMessages.private[state.currentRecipient].push({
        from: state.currentUsername,
        msg: message,
        sent: true,
        timestamp: Date.now(),
      });
      
      saveMessagesToSession(state.chatMessages, state.currentRecipient, state.unreadCounts);
      displayMessage(data, true, state);
    }
    
    socket.emit("chat message", { to: state.currentRecipient, msg: message });
    messageInput.value = "";
  }
}

export function displayMessage(data, isSent, state) {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("div");
  messageElement.className = isSent ? "message sent" : "message received";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const isGroupChat = state.currentRecipient === "";
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
  const timeStr = time.getHours().toString().padStart(2, "0") + ":" + 
                  time.getMinutes().toString().padStart(2, "0");
  const timeSpan = document.createElement("span");
  timeSpan.className = "message-time";
  timeSpan.textContent = timeStr;
  bubble.appendChild(timeSpan);

  messageElement.appendChild(bubble);
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

export function displayMessages(type, recipient, state) {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = "";

  let messages = [];
  if (type === "group") {
    messages = state.chatMessages.group;
  } else if (type === "private" && recipient) {
    messages = state.chatMessages.private[recipient] || [];
  }

  messages.forEach((msg) => {
    displayMessage(msg, msg.sent, state);
  });
}