const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const http = require('http');
const socketIO = require('socket.io');
const server = http.createServer(app);
const io = socketIO(server);
const path = require('path');
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
const users = {};
io.on('connection', (socket) => {
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

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(port, () => {
  console.log('Server listening on port '+port);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;