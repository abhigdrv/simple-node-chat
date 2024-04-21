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
  socket.on('chat message', (data) => {
    const { to, msg } = data;
    const from = users[socket.id] || 'Anonymous';
    const sendTo = getKeyByValue(users, to);
    if (sendTo && users[sendTo]) {
      io.to(sendTo).emit('private message', { from, msg });
    } else {
      io.emit('group message', { from, msg });
    }
  });
});

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(port, () => {
  console.log('Server listening on port '+port);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;