const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// === Настройка Firebase из переменных окружения ===
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key: process.env.FB_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FB_CLIENT_EMAIL,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FB_CLIENT_EMAIL)}`
};

if (!process.env.FB_PRIVATE_KEY) {
  console.log('❌ ОШИБКА: Не задана переменная FB_PRIVATE_KEY');
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FB_DATABASE_URL
  });
  console.log('✅ Firebase инициализирован');
} catch (error) {
  console.log('❌ Ошибка инициализации Firebase:', error);
}

const db = admin.database();
let votes = { yes: 0, no: 0 };

// Загрузка голосов при старте
async function loadVotes() {
  try {
    const snapshot = await db.ref('votes').once('value');
    const data = snapshot.val();
    if (data) {
      votes = data;
      console.log('📊 Голоса загружены:', votes);
    } else {
      await db.ref('votes').set(votes);
      console.log('📁 Создан начальный счётчик');
    }
  } catch (error) {
    console.log('❌ Ошибка загрузки голосов:', error);
  }
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

  socket.on('vote', async (data) => {
    if (data === 'yes' || data === 'no') {
      votes[data]++;
      try {
        await db.ref('votes').set(votes);
        io.emit('update', votes);
        console.log('🗳️ Голос принят:', data, votes);
      } catch (err) {
        console.log('❌ Ошибка сохранения голоса:', err);
      }
    }
  });
});

// === СТАРТ ===
(async () => {
  await loadVotes();
  const PORT = process.env.PORT || 10000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
  });
})();



