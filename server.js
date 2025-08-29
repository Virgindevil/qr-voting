const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// === НАСТРОЙКИ ===
const GITHUB_TOKEN = 'ghp_ТВОЙ_ТОКЕН'; // ← Замени на свой токен
const GITHUB_USER = 'твой-логин';       // ← Замени на свой логин (например, smatyzov)
const GITHUB_REPO = 'qr-voting';        // ← имя репозитория
const FILE_PATH = 'votes.json';

let votes = { yes: 0, no: 0 };

// Загружаем голоса при старте
function loadVotes() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${GITHUB_USER}/${GITHUB_REPO}/main/${FILE_PATH}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          votes = JSON.parse(data);
          console.log('Голоса загружены:', votes);
          resolve();
        } catch (e) {
          console.log('Файл votes.json не найден или поврежден. Старт с { yes: 0, no: 0 }');
          votes = { yes: 0, no: 0 };
          saveVotesToGitHub(); // Создаём файл
          resolve();
        }
      });
    });

    req.on('error', (e) => {
      console.log('Ошибка загрузки голосов:', e.message);
      votes = { yes: 0, no: 0 };
      resolve();
    });

    req.end();
  });
}

// Сохраняем голоса в GitHub
function saveVotesToGitHub() {
  const data = JSON.stringify(votes, null, 2);

  // Получаем SHA файла
  https.get(
    `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
    { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } },
    (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const sha = JSON.parse(body).sha;

          // Обновляем файл
          const req = https.request(
            `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js'
              }
            },
            (res) => {
              res.on('data', () => {});
            }
          );

          req.write(JSON.stringify({
            message: 'Обновление голосов',
            content: Buffer.from(data).toString('base64'),
            sha: sha
          }));
          req.end();
        } catch (e) {
          // Если файла нет — создаём
          const req = https.request(
            `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js'
              }
            },
            (res) => {
              res.on('data', () => {});
            }
          );

          req.write(JSON.stringify({
            message: 'Создание файла голосов',
            content: Buffer.from(data).toString('base64')
          }));
          req.end();
        }
      });
    }
  ).on('error', console.log);
}

// === EXPRESS ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// === SOCKET.IO ===
io.on('connection', (socket) => {
  socket.emit('update', votes);

  socket.on('vote', (data) => {
    if (data === 'yes' || data === 'no') {
      votes[data]++;
      io.emit('update', votes);
      saveVotesToGitHub(); // Сохраняем сразу
    }
  });
});

// === СТАРТ ===
(async () => {
  await loadVotes();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Голосование: https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
  });
})();
