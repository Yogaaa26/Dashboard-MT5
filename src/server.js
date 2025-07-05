// server.js

// Memanggil "staf" yang sudah kita install
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000; // Port tempat server akan berjalan

// Middleware untuk mengizinkan server menerima data JSON dan diakses dari alamat lain
app.use(cors());
app.use(express.json());

// --- DATABASE SEMENTARA ---
// Kita gunakan objek sederhana untuk menyimpan data, seolah-olah ini adalah buku catatan Manajer Operasional.
let accountsData = {}; // Untuk menyimpan data terbaru dari semua akun
let commandQueue = {}; // Untuk menyimpan perintah yang akan diambil oleh EA

// --- RUTE API (JALUR KOMUNIKASI) ---

// 1. Jalur untuk Asisten Cabang (EA) melapor
// Alamat: POST http://alamat-server-anda/api/update
app.post('/api/update', (req, res) => {
    const data = req.body;
    const accountId = data.accountId;

    if (!accountId) {
        return res.status(400).send({ error: 'Nomor Akun (accountId) dibutuhkan' });
    }

    // Menyimpan atau memperbarui data ke "buku catatan" kita
    accountsData[accountId] = { ...accountsData[accountId], ...data };
    console.log(`Menerima update dari Akun: ${accountId}`);
    
    // Mengirim kembali perintah yang mungkin ada untuk akun ini
    const command = commandQueue[accountId];
    if (command) {
        res.json(command); // Kirim perintah ke EA
        delete commandQueue[accountId]; // Hapus perintah setelah dikirim
    } else {
        res.json({ status: 'ok', command: 'none' }); // Tidak ada perintah
    }
});

// 2. Jalur untuk Ruang Kontrol (Dasbor) melihat semua data
// Alamat: GET http://alamat-server-anda/api/accounts
app.get('/api/accounts', (req, res) => {
    res.json(Object.values(accountsData)); // Mengirim semua data yang tersimpan
});

// 3. Jalur untuk Ruang Kontrol (Dasbor) memberi perintah
// Alamat: POST http://alamat-server-anda/api/robot-toggle
app.post('/api/robot-toggle', (req, res) => {
    const { accountId, newStatus } = req.body;

    if (!accountId || !newStatus) {
        return res.status(400).send({ error: 'Nomor Akun (accountId) dan Status Baru dibutuhkan' });
    }

    // Menyimpan perintah di "buku catatan perintah"
    commandQueue[accountId] = { command: 'toggle_robot', status: newStatus };
    console.log(`Perintah diterima untuk Akun ${accountId}: Set Robot ke ${newStatus}`);
    res.json({ message: `Perintah untuk Akun ${accountId} telah dicatat.` });
});


// Menyalakan server
app.listen(PORT, () => {
    console.log(`Server Manajer Operasional berjalan di port ${PORT}`);
});