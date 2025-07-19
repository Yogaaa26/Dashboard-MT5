// /api/index.js
// Versi final dengan perbaikan parser untuk mengatasi SyntaxError

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

let db; // Deklarasikan db di scope yang lebih tinggi

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

// Middleware untuk memeriksa koneksi DB
const checkDbConnection = (req, res, next) => {
    if (!db) {
        return res.status(500).send({ error: 'Koneksi database gagal. Periksa log server.' });
    }
    next();
};

// Terapkan middleware ke semua rute
app.use('/api', checkDbConnection);


// --- Endpoint yang Sudah Ada ---

// Endpoint ini secara khusus menggunakan parser RAW untuk membersihkan data dari EA
app.post('/api/update', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8').replace(/\0/g, '').trim();
    try {
        const data = JSON.parse(rawBody);
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
        res.status(400).send({ error: 'Gagal memproses data update.' });
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

// Endpoint di bawah ini secara eksplisit menggunakan parser JSON
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
        res.status(500).send({ error: 'Gagal menyimpan urutan ke server.' });
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

// --- Endpoint untuk Riwayat ---

// PERBAIKAN: Gunakan parser RAW untuk endpoint ini juga
app.post('/api/log-history', express.raw({ type: '*/*' }), async (req, res) => {
    const rawBody = req.body.toString('utf-8').replace(/\0/g, '').trim();
    try {
        const { accountId, history } = JSON.parse(rawBody);
        if (!accountId || !history || !Array.isArray(history)) {
            return res.status(400).send({ error: 'Data riwayat tidak valid' });
        }
        
        await db.ref(`trade_history/${accountId}`).set(history);
        res.status(200).json({ message: `Riwayat untuk akun ${accountId} berhasil disimpan.` });
    } catch (error) {
        console.error('Gagal menyimpan riwayat:', error);
        res.status(500).send({ error: 'Gagal menyimpan riwayat ke server.' });
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

// --- ENDPOINT BARU UNTUK MEMBATALKAN ORDER ---
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

// --- ENDPOINT UTAMA UNTUK KALKULASI STATISTIK EA ---
app.get('/api/calculate-ea-stats', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).send({ error: 'Koneksi database belum siap.' });
        }

        console.log("Memulai kalkulasi statistik EA...");

        // 1. Ambil semua data mentah yang diperlukan
        const accountsSnapshot = await db.ref('accounts').once('value');
        const historySnapshot = await db.ref('trade_history').once('value');
        const accountsData = accountsSnapshot.val() || {};
        const historyData = historySnapshot.val() || {};

        const eaStats = {};

        // 2. Kelompokkan akun berdasarkan nama robot
        for (const accountId in accountsData) {
            const account = accountsData[accountId];
            const robotName = account.tradingRobotName;

            if (robotName && robotName !== "EA Trading Tidak Aktif") {
                // Inisialisasi statistik untuk robot jika belum ada
                if (!eaStats[robotName]) {
                    eaStats[robotName] = {
                        name: robotName,
                        accounts: [],
                        totalFloating: 0,
                        history: [],
                    };
                }
                eaStats[robotName].accounts.push(account);
                
                // Tambahkan riwayat transaksi akun ini ke robot yang sesuai
                if(historyData[accountId]) {
                    eaStats[robotName].history.push(...historyData[accountId]);
                }
            }
        }

        // 3. Lakukan kalkulasi untuk setiap robot
        for (const robotName in eaStats) {
            const stats = eaStats[robotName];
            
            // Kalkulasi: Accounts Reach
            stats.accountsReach = stats.accounts.length;

            // Kalkulasi: Current Floating
            stats.totalFloating = stats.accounts.reduce((sum, acc) => {
                const positionsPL = (acc.positions || []).reduce((posSum, pos) => posSum + (parseFloat(pos.profit) || 0), 0);
                return sum + positionsPL;
            }, 0);

            // --- Kalkulasi berdasarkan riwayat ---
            const history = stats.history;
            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

            let weeklyTrades = 0;
            let totalProfitLoss = 0;
            let profitableTrades = 0;
            let totalDrawdown = 0;
            let drawdownTrades = 0;
            
            history.forEach(trade => {
                const closeTime = new Date(trade.closeDate.replace(/\./g, '-')).getTime();
                if (closeTime > oneWeekAgo) {
                    weeklyTrades++;
                }

                const pl = parseFloat(trade.pl) || 0;
                totalProfitLoss += pl;
                if (pl >= 0) {
                    profitableTrades++;
                } else {
                    totalDrawdown += pl; // pl sudah negatif
                    drawdownTrades++;
                }
            });

            // Kalkulasi: Profit/Loss Average (dari total history)
            stats.profitLoss = totalProfitLoss;
            
            // Kalkulasi: Weekly Trade Ratio
            stats.weeklyTradeRatio = weeklyTrades;

            // Kalkulasi: Drawdown Ratio (rata-rata kerugian per trade yang rugi)
            stats.drawdownRatio = drawdownTrades > 0 ? totalDrawdown / drawdownTrades : 0;

            // Kalkulasi: Winrate
            stats.winrate = history.length > 0 ? (profitableTrades / history.length) * 100 : 0;
            
            // Kalkulasi: Equity Growth Curve (Contoh: snapshot harian selama 7 hari)
            stats.equityCurve = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const dailyTotalPL = history.reduce((sum, trade) => {
                    const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                    if (tradeDate <= date) {
                        return sum + (parseFloat(trade.pl) || 0);
                    }
                    return sum;
                }, 0);
                stats.equityCurve.push({ date: date.toISOString().split('T')[0], equity: dailyTotalPL });
            }
            
            // Hapus data mentah yang tidak perlu dikirim ke klien
            delete stats.accounts;
            delete stats.history;
        }

        // 4. Simpan hasil kalkulasi ke path /ea_stats/
        await db.ref('ea_stats').set(eaStats);

        console.log("Kalkulasi statistik EA selesai. Data tersimpan di /ea_stats/.");
        res.status(200).json({ message: 'Kalkulasi statistik EA berhasil.', data: eaStats });

    } catch (error) {
        console.error('Error saat kalkulasi statistik EA:', error);
        res.status(500).send({ error: 'Terjadi kesalahan di server saat kalkulasi.' });
    }
});

module.exports = app;
