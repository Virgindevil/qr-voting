const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Разрешаем все домены (для теста)
    methods: ["GET", "POST"]
  }
});

let votes = { yes: 0, no: 0 };

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Отправляем текущие данные
  socket.emit('update', votes);

  // Принимаем голос
  socket.on('vote', (data) => {
    if (data === 'yes' || data === 'no') {
      votes[data]++;
      console.log(`Голос: ${data}`, votes);
      io.emit('update', votes);
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
