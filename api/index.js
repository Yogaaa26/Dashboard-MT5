// /api/index.js
// Versi final dengan perbaikan logika duplikasi menggunakan .set() saja

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

let db;

// --- Inisialisasi Firebase Admin yang Lebih Aman ---
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

const extractJsonFromString = (rawString) => {
    const match = rawString.match(/\{.*\}/);
    if (match && match[0]) {
        return JSON.parse(match[0]);
    }
    throw new Error("JSON yang valid tidak ditemukan di dalam string.");
};

// --- ENDPOINTS ---

app.post('/api/update', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8');
    try {
        const data = extractJsonFromString(rawBody);
        const accountId = data.accountId;
        if (!accountId) return res.status(400).send({ error: 'accountId dibutuhkan' });
        
        await db.ref(`accounts/${accountId}`).set(data);

        const commandRef = db.ref(`commands/${accountId}`);
        const snapshot = await commandRef.once('value');
        if (snapshot.exists()) {
            res.json(snapshot.val());
            await commandRef.remove();
        } else {
            res.json({ status: 'ok', command: 'none' });
        }
    } catch (error) {
        console.error("Error di /api/update:", error.message, "Body Mentah:", rawBody);
        res.status(400).send({ error: 'Gagal memproses data update.' });
    }
});

// --- PERBAIKAN DI SINI: Hanya menggunakan .set() untuk menimpa data ---
app.post('/api/log-history', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8');
    try {
        const { accountId, history } = extractJsonFromString(rawBody);
        if (!accountId || !history || !Array.isArray(history)) {
            return res.status(400).send({ error: 'Data riwayat tidak valid' });
        }
        
        const historyRef = db.ref(`trade_history/${accountId}`);
        
        const cleanHistoryObject = {};
        history.forEach(item => {
            if (item.ticket) {
                cleanHistoryObject[item.ticket] = item;
            } else {
                const uniqueKey = `balance_${item.closeDate.replace(/[^0-9]/g, '')}_${item.pl}`;
                cleanHistoryObject[uniqueKey] = item;
            }
        });

        // Gunakan set() untuk menimpa seluruh data lama dengan data baru yang sudah bersih.
        // Ini adalah operasi tunggal yang andal.
        await historyRef.set(cleanHistoryObject);
        
        res.status(200).json({ message: `Riwayat untuk akun ${accountId} berhasil disimpan.` });
    } catch (error) {
        console.error('Gagal menyimpan riwayat:', error.message, "Body Mentah:", rawBody);
        res.status(500).send({ error: 'Gagal menyimpan riwayat ke server.' });
    }
});
// --- AKHIR DARI PERBAIKAN ---

app.post('/api/log-activity', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8');
    try {
        const { accountId, magicNumber } = extractJsonFromString(rawBody);

        if (accountId === undefined || magicNumber === undefined) {
            return res.status(400).json({ message: 'Missing accountId or magicNumber' });
        }

        const activityRef = db.ref(`robot_activity_logs/${accountId}`);
        
        await activityRef.push({
            magicNumber: magicNumber,
            timestamp: admin.database.ServerValue.TIMESTAMP,
        });

        res.status(200).json({ message: 'Activity logged successfully' });
    } catch (error) {
        console.error('Error logging activity:', error.message, "Body Mentah:", rawBody);
        res.status(500).json({ message: 'Internal Server Error' });
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

app.post('/api/robot-toggle', express.json(), async (req, res) => {
    const { accountId, newStatus } = req.body;
    await db.ref(`commands/${accountId}`).set({ command: 'toggle_robot', status: newStatus });
    res.json({ message: 'Perintah dicatat' });
});

app.post('/api/delete-account', express.json(), async (req, res) => {
    const { accountId } = req.body;
    await db.ref(`accounts/${accountId}`).remove();
    await db.ref(`commands/${accountId}`).remove();
    res.status(200).json({ message: 'Akun berhasil dihapus' });
});

app.post('/api/save-order', express.json(), async (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
        return res.status(400).send({ error: 'Data urutan tidak valid' });
    }
    try {
        await db.ref('dashboard_config/accountOrder').set(order);
        res.status(200).json({ message: 'Urutan berhasil disimpan' });
    } catch (error) {
        res.status(500).send({ error: 'Gagal menyimpan urutan ke server.' })
    }
});

app.get('/api/get-order', async (req, res) => {
    try {
        const orderRef = db.ref('dashboard_config/accountOrder');
        const snapshot = await orderRef.once('value');
        res.json(snapshot.val() || []);
    } catch (error) {
        res.status(500).send({ error: 'Gagal mengambil urutan dari server.' });
    }
});

app.get('/api/get-history', async (req, res) => {
    try {
        const historyRef = db.ref('trade_history');
        const snapshot = await historyRef.once('value');
        res.json(snapshot.val() || {});
    } catch (error) {
        res.status(500).send({ error: 'Gagal mengambil riwayat dari server.' });
    }
});

app.post('/api/cancel-order', express.json(), async (req, res) => {
    const { accountId, ticket } = req.body;
    if (!accountId || !ticket) {
        return res.status(400).send({ error: 'accountId dan ticket dibutuhkan' });
    }
    try {
        const commandRef = db.ref(`commands/${accountId}`);
        await commandRef.set({ command: 'cancel_order', ticket: ticket });
        res.status(200).json({ message: `Perintah pembatalan untuk tiket ${ticket} telah dikirim.` });
    } catch (error) {
        console.error('Gagal mengirim perintah pembatalan:', error);
        res.status(500).send({ error: 'Gagal mengirim perintah ke server.' });
    }
});

module.exports = app;
