// /api/index.js
// Versi final dengan inisialisasi yang lebih aman dan penyimpanan urutan

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

// --- Inisialisasi Firebase Admin yang Lebih Aman ---
try {
    // Ambil kunci dari Environment Variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        // Cek agar tidak inisialisasi ulang (penting untuk lingkungan serverless)
        if (admin.apps.length === 0) { 
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: process.env.FIREBASE_DATABASE_URL 
            });
            console.log("Firebase Admin SDK berhasil diinisialisasi.");
        }
    } else {
        console.log("FIREBASE_SERVICE_ACCOUNT tidak ditemukan di Environment Variables.");
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e.message);
}

const db = admin.database();

app.use(cors());
app.use(express.json());

// Middleware keamanan (opsional, jika Anda sudah menerapkannya)
const requireApiKey = (req, res, next) => {
  const apiKey = req.get('x-secret-key');
  if (process.env.API_SECRET_KEY && (!apiKey || apiKey !== process.env.API_SECRET_KEY)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// --- Endpoint yang Sudah Ada ---

app.post('/api/update', requireApiKey, express.raw({ type: '*/*' }), async (req, res) => {
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

// --- ENDPOINT BARU UNTUK DRAG & DROP ---

app.post('/api/save-order', async (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
        return res.status(400).send({ error: 'Data urutan tidak valid' });
    }

    try {
        const orderRef = db.ref('dashboard_config/accountOrder');
        await orderRef.set(order);
        res.status(200).json({ message: 'Urutan berhasil disimpan' });
    } catch (error) {
        console.error('Gagal menyimpan urutan:', error);
        res.status(500).send({ error: 'Gagal menyimpan urutan ke server.' });
    }
});

app.get('/api/get-order', async (req, res) => {
    try {
        const orderRef = db.ref('dashboard_config/accountOrder');
        const snapshot = await orderRef.once('value');
        res.json(snapshot.val() || []);
    } catch (error) {
        console.error('Gagal mengambil urutan:', error);
        res.status(500).send({ error: 'Gagal mengambil urutan dari server.' });
    }
});


module.exports = app;
