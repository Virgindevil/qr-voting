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
  "private_key_id": "883639ecaa4e956fe24914f0f486608d4d772237",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC1Thhzp/oblqZ+\nSG55bpd265+RkPpg+BWOJ6IXmos3GQOfekrAoGAmD4zKsAXQVxNmRmwwaLp71zMb\nfBT9n6daEl4FqySUrG5RAj8jyF87j/N7YWZVfy5KMX33bRC5Ql8XGMEAzktRfl0e\nmpAzuRJ/lt+9EDRZHY/IrjJUrGlZbvLnig9ZfmGrKZIVrDEoaJCGBITCQcUKhCHu\nhThg8fAh9/9M/z2gp0sETB2Pe8FSGqWRYLOTy6ydOiyzF375QRXJ0IB1su0uXjoG\nXImg433QNwkFBdRunwc+7cUuYv8+eh2AvoazsdCisbx/9igPchmwVPAjnh1KYuyc\nI97gxNpTAgMBAAECggEACxZcvpVUPLYZtf4Dz4GvoyAKFW4sni4v90UGxoW//wHw\nPf6pUp53jjVxqTV/Nqnv+Ndmp1gRXbKyIHuDtxqU++FXPQsTe9M0gmpuQZ647eYL\nEo2SNXAi2DFloCklOwcUZuH43UlAVb7WmkW56IfV7GhBOuSQAmWznfAMCgtqjrpi\ne3nm0LcUPzOws88mxik9OCuH9ZS20iusP476IyCohbjxgmS6JUwKrP0NrHo38ovf\n+ltXWQoivrJFilEMHhLVbcHakUUmjWDQu4Z1tcIP3xstFOwYPaGXkOaWfnJO3D7g\nW12KVfutM/yEhwJ106r56Pha4BH1EFwDHGtMy8BhyQKBgQDiaZwD7J2jEOxwpCUk\nKc/1pAFWMl9cJXNmvvOGNSIv5+Np1hQteooxzEDleEcBiQ+YPFrEDQpD4+BYHQ0J\nk93gLSPU93siDFQlxE8aubt1Dg/+Pu7h6tJuABW5XDXG3LH/1vt+p/FpE+ZdYDag\nwEnpoKYkl3yOrE6GbB7gzG8fqwKBgQDM/3akc0SFUMD8Og+UZmzYGGHKr2624EeW\nWxhaBUVkI7QLNPlrPkBSuAI3SSG7kiPC43M6QBLVFzg+e1SmWoSibp2jbFBzo8QA\nHYyGtckyrER6DXfzS1bYS7kqGbY38MZr0oe7mn128QC6zVcX2Nuuub+fXlMdtfEH\nEmxiZJQn+QKBgQDb+7i2p2PSWFMibpoXtPh1ttAFrBOzOEAUCFwcfeulmC0BXBtm\nxLUZBVfYnTCAcWdRhvK5oeHjbLlBY5iTQbRGaBV0irB8uHXZ7A7f7K4SYYNwiD0a\nDEpAzpxM6Sbm/O+FoJ/iw9JvQgKFn0H0lmA6OviyfO1swkXZnZuy127w2QKBgBmu\nPxym3ASfcy2l0GHU2vnPRCDyDTqXqiAp1Ukhs+mxl1J4Fm7a44/5QT3PyYwH6Lb3\na232rOVI/WDGbnpQiKEYnmLkpMd30ov5J6uQhl30urdXjJlL7Ns30UB27B7h6NmF\nDD/yQJlv45mDM8/m+M5QsrKyTFNCgalTI4TH+M9xAoGBAM1J9ssK3hjsn5++RjHl\nq9FYT4SsfaZ3Df4E0Y0e+6w6F5xHpe2MaQZ/uAIx1I7YdLLO74phAhBwJlYiJtF6\nmKtjuS6vrRXgCJ1z6d6viJQ4VLY9yB9UXyfp2bOZpznx+AGnLlAVwgH3bttgOxaQ\nfWoGHjUs+cmGGyWOhSww4P6E\n-----END PRIVATE KEY-----\n",
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



