// /api/index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

let db; 

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (admin.apps.length === 0) { 
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL 
            });
            console.log("Firebase Admin SDK berhasil diinisialisasi.");
        }
        db = admin.database();
    } else {
        console.log("FIREBASE_SERVICE_ACCOUNT tidak ditemukan di Environment Variables.");
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e.message);
}

app.use(cors());

const checkDbConnection = (req, res, next) => {
    if (!db) {
        return res.status(500).send({ error: 'Koneksi database gagal. Periksa log server.' });
    }
    next();
};

app.use('/api', checkDbConnection);

// --- Endpoint yang Dioptimalkan ---

app.post('/api/update', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8').replace(/\0/g, '').trim();
    try {
        const data = JSON.parse(rawBody);
        const accountId = data.accountId;
        if (!accountId) return res.status(400).send({ error: 'accountId dibutuhkan' });
        
        // 1. Simpan data mentah seperti biasa
        await db.ref(`accounts/${accountId}`).set(data);

        // --- OPTIMASI BARU: Buat dan simpan data ringkasan ---
        const totalPL = (data.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
        
        const summaryData = {
            id: data.id,
            accountId: data.accountId,
            accountName: data.accountName,
            tradingRobotName: data.tradingRobotName,
            robotStatus: data.robotStatus,
            status: data.status,
            totalPL: totalPL, // Simpan total P/L yang sudah dihitung
            positionCount: (data.positions || []).length,
            orderCount: (data.orders || []).length,
        };
        // Simpan ke path baru yang ringan
        await db.ref(`dashboard_summary/${accountId}`).set(summaryData);
        // --- Akhir Optimasi ---

        const commandRef = db.ref(`commands/${accountId}`);
        const snapshot = await commandRef.once('value');
        if (snapshot.exists()) {
            res.json(snapshot.val());
            await commandRef.remove();
        } else {
            res.json({ status: 'ok', command: 'none' });
        }
    } catch (error) {
        res.status(400).send({ error: 'Gagal memproses data update.' });
    }
});

// Endpoint lain tetap sama...
app.post('/api/robot-toggle', express.json(), /* ... kode Anda ... */);
app.post('/api/delete-account', express.json(), async (req, res) => {
    const { accountId } = req.body;
    // Hapus juga dari summary
    await db.ref(`accounts/${accountId}`).remove();
    await db.ref(`dashboard_summary/${accountId}`).remove(); 
    await db.ref(`commands/${accountId}`).remove();
    res.status(200).json({ message: 'Akun berhasil dihapus' });
});
app.post('/api/save-order', express.json(), /* ... kode Anda ... */);
app.post('/api/log-history', express.raw({ type: '*/*' }), /* ... kode Anda ... */);

// Endpoint kalkulasi tetap ada sebagai fitur 'refresh' manual
app.get('/api/calculate-ea-stats', /* ... kode Anda dari panduan sebelumnya ... */);


// Jangan lupa untuk menyertakan semua endpoint Anda yang lain di sini
// ...
// ...

module.exports = app;
