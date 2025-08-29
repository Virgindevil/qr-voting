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

// === 1. НАСТРОЙКА FIREBASE ===
// Вот где будет твой serviceAccount (ключ)
const serviceAccount = {
  "type": "service_account",
  "project_id": "qr-voting-live",
  "private_key_id": "a4ed570ba792f062ed278e5cf7c26f10e23f3cfd",
  "private_key": "a4ed570ba792f062ed278e5cf7c26f10e23f3cfd\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCgM7Lm8IT4N6pg\nOSp2lXicBR8zksz7WxXxXLgds1Uc6Ft7mYeTAeng3VhIPBLW7zOvHSg2zKxUAeE+\nW/EERfoHFI3IS1uLvrRGUTM/YQ13iCPKwtZxIap9ztrc7zLyUqYGcQveBko2dNnC\nF5k/eWn1mFoLYCpPyT2WLQqQHHuuvkPKIFDcZCcD3y2De/YNt6VYA0bPsdFtqi2w\nKUXj2KebNo1LqginiNOpKawWyCftuN/iCeN3v/75wLN1EDfX8wuifkUYb74s8Bl1\nuidWlzQ7ulFkNQPg4eMareYq9QN1/73nDrGetPxmAz/gh1930Ofu5nHWFGq/pmCp\nn0K3hmj9AgMBAAECggEAAX1BjEKPpeQUliTp52TP1Hl6twbGF48a9t2zC3mjkKt7\nUDyW5U+2/iNoovFGBo/+NcJKYaoI7xX+Y09FABJrdt3izIogzX2GHQI7vPrYvnP6\nSzQA/NfAhz9hSv0BRv3sM7Kg1t1NmtB+xr5j6xJkoQcbzS/FbOz0wNzl1H2jS7ZO\nzpSc86KRadY03+L33dQIsGo1qzwtClDABLlPu65F/SKvIFLaxbn/duwLnI+Ih70q\nGHQSY5isdnr230YXxHa7tuvtcJlje5BwclCNkSQ3l9D4gySy4jLhSiY5QRTOWcRK\nTSdHBX6o/w+bDWVgViaBd5jUZQZDB27AU0seGSJOuQKBgQDidb9b0SkiGSJ19lN9\nGKnHHfiLWUJ53XAE8Zky8ftc9yMYYGykWEooeg+t6FuRYBWUoWOtRVdlvGTSeVuv\n2saoCs7LCP8NGxY6bZMm8iJvPwtkv4j81SPZKyZx7afoiHO6uGaG2d4XRtssNuO4\nCaa7rng/DhrvfCzLnID7ADZA2QKBgQC1GWA1VWK06TdSxaJuU/QfzDSBf/RSNajX\n+VsLEcvIUM5UqonuTrYG7H9ZbDxwM6K7tWQ0Bnj2CWQibr8fpz6XoYANvtYHH4o9\nrX8vlPk9kTF3DCjq1MwD1KGmvnvhOfZKo1TKiU5xREzmmMG0cehdKRceJe0QPmuA\npz8ZtGlSxQKBgQCCj5A7x2MHnaYYjGOmA8oeWlEpRdTlnZ0vvHquvIRHHNTHARCh\nz6UxoO3ZPdVNAzBt+H4XL5srtGoMTptlz6QozdJbjFw/mhY+qV3lXkQsDxTqiOLZ\noaiBVDdeB75+eez/AcFajdFVaiyCWUMAn8/Y9MWu1NsCp3zMBvb1vzGIQQKBgFNT\n4MPJjQhnAtCwJUQUlxCGemZXxMiK7iyqDK00PArou3eTnLGtP+5BpXs05T5PVAKA\nvSF/FOtIeO2q/YAICTHl2rD4bSyL46TrjskLB/+/Lf5z9uPOlCzzCopZvVBtxhij\nvKEQuqo9XhEAmqh3fQ5YmM2Db+f4gKiKy+r86zVtAoGBALBe/RmKfr2aAmyIU2h7\n5W5RUf66jkgRtjEj6TfpVFXMeDo25fQYXyP1QPu+ip2TgmaRIMUJWhJwPdcIQxM8\nTBHktrHnTNaD7GVg8VS91JGrA11M4HxcznD5bPF0X+lgDk+r5EhhrLEGsEOpXO2l\n8u//VV2pbf8VI5lvHP+SZXjr\n-----END PRIVATE KEY-----\n",
  "client_email": "voting-app@qr-voting-live.iam.gserviceaccount.com",
  "client_id": "113409409227592108261",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/voting-app%40qr-voting-live.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

// Инициализируем Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://qr-voting-live-default-rtdb.europe-west1.firebasedatabase.app/" // ← замени на свою
});

// Получаем доступ к базе
const db = admin.database();
let votes = { yes: 0, no: 0 };

// === 2. ЗАГРУЗКА ГОЛОСОВ ПРИ СТАРТЕ ===
async function loadVotes() {
  try {
    const snapshot = await db.ref('votes').once('value');
    const data = snapshot.val();
    if (data) {
      votes = data;
      console.log('✅ Голоса загружены:', votes);
    } else {
      await db.ref('votes').set(votes); // Создаём, если нет
      console.log('📁 Создан пустой счётчик голосов');
    }
  } catch (error) {
    console.log('❌ Ошибка загрузки голосов:', error);
  }
}

// === 3. ГОЛОСОВАНИЕ ===
io.on('connection', (socket) => {
  socket.emit('update', votes); // Отправляем текущие голоса

  socket.on('vote', async (choice) => {
    if (choice === 'yes' || choice === 'no') {
      votes[choice]++;
      await db.ref('votes').set(votes); // Сохраняем в Firebase
      io.emit('update', votes); // Отправляем всем
      console.log('🗳️ Голос принят:', choice, votes);
    }
  });
});

// === 4. СТАТИЧЕСКИЕ ФАЙЛЫ ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// === 5. ЗАПУСК СЕРВЕРА ===
(async () => {
  await loadVotes(); // Ждём загрузки голосов
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🔗 Голосование: https://qr-voting.onrender.com`);
    console.log(`📊 Результаты: https://qr-voting.onrender.com/results`);
  });
})();

