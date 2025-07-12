// /api/index.js
// Versi dengan endpoint untuk riwayat transaksi

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

// --- Inisialisasi Firebase Admin yang Lebih Aman ---
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (admin.apps.length === 0) { 
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: process.env.FIREBASE_DATABASE_URL 
            });
        }
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e.message);
}

const db = admin.database();

app.use(cors());
app.use(express.json());

// --- Endpoint yang Sudah Ada ---

app.post('/api/update', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8').replace(/\0/g, '').trim();
    try {
        const data = JSON.parse(rawBody);
        const accountId = data.accountId;
        if (!accountId) return res.status(400).send({ error: 'accountId dibutuhkan' });
        
        const accountRef = db.ref(`accounts/${accountId}`);
        await accountRef.set(data);

        const commandRef = db.ref(`commands/${accountId}`);
        const snapshot = await commandRef.once('value');
        if (snapshot.exists()) {
            res.json(snapshot.val());
            await commandRef.remove();
        } else {
            res.json({ status: 'ok', command: 'none' });
        }
    } catch (error) {
        res.status(400).send({ error: 'Gagal memproses data' });
    }
});

app.get('/api/accounts', async (req, res) => {
    try {
        const accountsRef = db.ref('accounts');
        const snapshot = await accountsRef.once('value');
        res.json(snapshot.val() || {});
    } catch (error) {
        res.status(500).send({ error: 'Gagal mengambil data akun.' });
    }
});

app.post('/api/robot-toggle', async (req, res) => {
    const { accountId, newStatus } = req.body;
    const commandRef = db.ref(`commands/${accountId}`);
    await commandRef.set({ command: 'toggle_robot', status: newStatus });
    res.json({ message: 'Perintah dicatat' });
});

app.post('/api/delete-account', async (req, res) => {
    const { accountId } = req.body;
    await db.ref(`accounts/${accountId}`).remove();
    await db.ref(`commands/${accountId}`).remove();
    res.status(200).json({ message: 'Akun berhasil dihapus' });
});

// --- ENDPOINT BARU UNTUK RIWAYAT ---

// Endpoint untuk menerima dan menyimpan data riwayat dari EA
app.post('/api/log-history', async (req, res) => {
    const { accountId, history } = req.body;
    if (!accountId || !history || !Array.isArray(history)) {
        return res.status(400).send({ error: 'Data riwayat tidak valid' });
    }

    try {
        // Simpan seluruh riwayat untuk akun ini. Ini akan menimpa data lama.
        const historyRef = db.ref(`trade_history/${accountId}`);
        await historyRef.set(history);
        res.status(200).json({ message: `Riwayat untuk akun ${accountId} berhasil disimpan.` });
    } catch (error) {
        console.error('Gagal menyimpan riwayat:', error);
        res.status(500).send({ error: 'Gagal menyimpan riwayat ke server.' });
    }
});

// Endpoint untuk frontend mengambil semua data riwayat
app.get('/api/get-history', async (req, res) => {
    try {
        const historyRef = db.ref('trade_history');
        const snapshot = await historyRef.once('value');
        res.json(snapshot.val() || {}); // Kirim objek kosong jika tidak ada
    } catch (error) {
        console.error('Gagal mengambil riwayat:', error);
        res.status(500).send({ error: 'Gagal mengambil riwayat dari server.' });
    }
});


module.exports = app;
