// /api/index.js
// Revisi dengan integrasi Firebase Realtime Database

const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, remove } = require("firebase/database");
const app = express();

// --- KONFIGURASI FIREBASE ---
// Variabel ini akan diambil dari Environment Variables di Vercel
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Inisialisasi Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// Middleware
app.use(cors());

// Rute untuk menerima update dari EA
app.post('/api/update', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8').replace(/\0/g, '').trim();
    try {
        const data = JSON.parse(rawBody);
        const accountId = data.accountId;

        if (!accountId) {
            return res.status(400).send({ error: 'accountId dibutuhkan dari EA' });
        }
        
        // Gunakan ID unik dari EA sebagai key
        const dataId = data.id || `${accountId}-fallback`;
        await set(ref(db, `accounts/${dataId}`), data);
        console.log(`Update BERHASIL dari Akun: ${accountId} ke Firebase`);

        const commandRef = ref(db, `commands/${accountId}`);
        const snapshot = await get(commandRef);
        if (snapshot.exists()) {
            const command = snapshot.val();
            res.json(command);
            await remove(commandRef);
        } else {
            res.json({ status: 'ok', command: 'none' });
        }
    } catch (error) {
        console.error("Gagal mem-parsing atau menyimpan data:", error.message);
        res.status(400).send({ error: 'Format JSON tidak valid atau gagal menyimpan.' });
    }
});

// Rute untuk frontend mengambil data
app.get('/api/accounts', async (req, res) => {
    try {
        const accountsRef = ref(db, 'accounts');
        const snapshot = await get(accountsRef);
        if (snapshot.exists()) {
            res.json(snapshot.val());
        } else {
            res.json({});
        }
    } catch (error) {
        console.error("Gagal mengambil data dari Firebase:", error);
        res.status(500).send({ error: "Gagal mengambil data akun." });
    }
});

// Rute untuk menerima perintah toggle robot
app.post('/api/robot-toggle', express.json(), async (req, res) => {
    const { accountId, newStatus } = req.body;
    if (!accountId || !newStatus) {
        return res.status(400).send({ error: 'accountId dan newStatus dibutuhkan' });
    }
    try {
        const command = { command: 'toggle_robot', status: newStatus };
        await set(ref(db, `commands/${accountId}`), command);
        res.json({ message: `Perintah untuk Akun ${accountId} dicatat.` });
    } catch (error) {
        console.error("Gagal menyimpan perintah ke Firebase:", error);
        res.status(500).send({ error: "Gagal menyimpan perintah." });
    }
});

module.exports = app;