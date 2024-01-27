const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname + '/public'));

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

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
