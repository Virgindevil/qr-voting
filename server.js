const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let votes = { yes: 0, no: 0 };

// Подключаем папку public
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

// Страница результатов
app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// WebSockets
io.on('connection', (socket) => {
  socket.emit('update', votes);

  socket.on('vote', (data) => {
    if (data === 'yes' || data === 'no') {
      votes[data]++;
      io.emit('update', votes);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});