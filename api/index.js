// /api/index.js
// Revisi dengan endpoint untuk menghapus akun

const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, remove } = require("firebase/database");
const app = express();

// Konfigurasi Firebase diambil dari Environment Variables Vercel
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

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
        
        await set(ref(db, `accounts/${accountId}`), data);
        console.log(`Update BERHASIL untuk Akun: ${accountId}`);

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
        res.json(snapshot.exists() ? snapshot.val() : {});
    } catch (error) {
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
        res.status(500).send({ error: "Gagal menyimpan perintah." });
    }
});

// ENDPOINT BARU: Untuk menghapus akun
app.post('/api/delete-account', express.json(), async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) {
        return res.status(400).send({ error: 'accountId dibutuhkan' });
    }

    try {
        // Hapus data akun utama
        await remove(ref(db, `accounts/${accountId}`));
        // Hapus juga perintah yang mungkin menunggu
        await remove(ref(db, `commands/${accountId}`));
        
        console.log(`Akun ${accountId} telah dihapus dari Firebase.`);
        res.status(200).json({ message: 'Akun berhasil dihapus' });
    } catch (error) {
        console.error(`Gagal menghapus akun ${accountId}:`, error);
        res.status(500).send({ error: 'Gagal menghapus akun dari server.' });
    }
});


module.exports = app;
