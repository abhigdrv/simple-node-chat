const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const http = require('http');
const socketIO = require('socket.io');
const server = http.createServer(app);
const io = socketIO(server);
const users = {};
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    io.emit('userList', Object.values(users));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    delete users[socket.id];
    io.emit('userList', Object.values(users));
  });

  socket.on('chat message', (msg) => {
    const username = users[socket.id] || 'Anonymous';
    io.emit('chat message', { username, msg });
  });
});

app.get("/", (req, res) => res.type('html').send(html));

// const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
server.listen(port, () => {
  console.log('Server listening on port '+port);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Socket.IO Chat App</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    #chat-container {
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      width: 90%;
    }
    #user-list {
      padding: 10px;
      border-bottom: 1px solid #ddd;
      text-align: center;
      background-color: #3498db;
      color: #fff;
    }
    #chat-box {
      padding: 10px;
      max-height: 300px;
      overflow-y: auto;
    }
    #message-input,
    #username-input {
      width: 70%;
      padding: 8px;
      margin: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    #username-input {
      margin-bottom: 0;
    }
    #message-input {
      margin-bottom: 10px;
    }
    button {
      padding: 8px;
      background-color: #3498db;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
</head>
<body>

<div id="chat-container">
  <div id="user-list">Users Online: </div>
  <div id="chat-box"></div>
  <input type="text" id="username-input" placeholder="Enter your username">
  <button onclick="setUsername()" id="setButton">Set</button>
  <input type="text" id="message-input" placeholder="Type your message...">
  <button onclick="sendMessage()" type="submit">Send</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script src="https://code.jquery.com/jquery-3.6.4.min.js"></script>
<script>
  const socket = io();

  function setUsername() {
    const usernameInput = document.getElementById('username-input');
    const setButton = document.getElementById('setButton');
    const username = usernameInput.value.trim();
    if (username !== '') {
      socket.emit('setUsername', username);
      usernameInput.style.display = 'none';
      setButton.style.display = 'none';
    }
  }

  function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    if (message !== '') {
      socket.emit('chat message', message);
      messageInput.value = '';
    }
  }

  socket.on('userList', (users) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = 'Users Online: ' + users.join(', ');
  });

  socket.on('chat message', (data) => {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('p');
    messageElement.textContent = data.username + ': ' + data.msg;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the bottom
  });
</script>

</body>
</html>

`
