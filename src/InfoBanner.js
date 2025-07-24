import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

export default function InfoBanner() {
    // State untuk mengontrol visibilitas banner di sesi saat ini
    const [isVisible, setIsVisible] = useState(false);

    // useEffect ini hanya berjalan sekali saat komponen pertama kali dimuat
    useEffect(() => {
        // Cek di localStorage apakah pengguna sudah pernah menutup banner ini
        const hasClosedBanner = localStorage.getItem('infoBannerClosed');

        // Jika belum ada catatan 'infoBannerClosed', maka tampilkan banner
        if (!hasClosedBanner) {
            setIsVisible(true);
        }
    }, []); // Array dependensi kosong agar hanya berjalan sekali

    // Fungsi yang dijalankan saat tombol close (X) diklik
    const handleClose = () => {
        // 1. Simpan catatan ke localStorage agar tidak muncul lagi
        localStorage.setItem('infoBannerClosed', 'true');
        // 2. Sembunyikan banner dari layar saat ini
        setIsVisible(false);
    };

    // Jika state isVisible false, jangan render apa-apa
    if (!isVisible) {
        return null;
    }

    // Jika isVisible true, render banner ini
    return (
        <div className="bg-blue-600 text-white w-full p-3 flex items-center justify-center text-sm sticky top-0 z-50 animate-fade-in-down">
            <Info size={18} className="mr-3 flex-shrink-0" />
            <span className="text-center">
                Selamat datang di MJA Monitoring! Klik kartu untuk melihat detail atau drag-and-drop untuk mengubah urutan.
            </span>
            <button
                onClick={handleClose}
                className="absolute right-4 text-white hover:bg-blue-700 p-1 rounded-full transition-colors"
                aria-label="Tutup Notifikasi"
            >
                <X size={20} />
            </button>
        </div>
    );
}