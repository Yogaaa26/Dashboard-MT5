import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, ArrowLeft, History, Activity, Check, Power, Trash2, Cpu, Volume2, VolumeX, BellRing } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, remove } from "firebase/database";
import { firebaseConfig } from './firebaseConfig';

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper function
const formatCurrency = (value, includeSign = true) => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : (includeSign ? '+' : '');
  return `${sign}$${absValue.toFixed(2)}`;
};

// --- React Components (Tidak ada perubahan di sini) ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => { /* ... */ };
const Notification = ({ notification, onClose }) => { /* ... */ };
const NotificationContainer = ({ notifications, removeNotification }) => { /* ... */ };
const SummaryStat = ({ icon, title, value, colorClass = 'text-white' }) => { /* ... */ };
const SummaryDashboard = ({ accounts }) => { /* ... */ };
const AccountCard = ({ account, onToggleRobot, onDelete, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging }) => { /* ... */ };
const HistoryPage = ({ accounts, tradeHistory }) => { /* ... */ };


// Main App Component
export default function App() {
  const [accountsData, setAccountsData] = useState({});
  const [accountOrder, setAccountOrder] = useState([]);
  const [tradeHistory, setTradeHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, accountId: null, accountName: '' });
  
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const prevPositionsRef = useRef({});
  const initialLoadComplete = useRef(false);

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addNotification = (title, message, type) => {
    setNotifications(prev => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 5));
  };
  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  
  // PERBAIKAN: Fungsi untuk mengeja angka
  const formatNumberForSpeech = useCallback((num) => {
    const numStr = String(num);
    const parts = numStr.split('.');
    const integerPart = parts[0].split('').join(' ');
    if (parts.length > 1) {
      const decimalPart = parts[1].split('').join(' ');
      return `${integerPart} koma ${decimalPart}`;
    }
    return integerPart;
  }, []);

  const speak = useCallback((text) => {
    if (!isSoundEnabled || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    window.speechSynthesis.speak(utterance);
  }, [isSoundEnabled]);

  const showNotification = useCallback((title, options) => {
    if (!isNotifEnabled || !("Notification" in window) || notifPermission !== "granted") {
        return;
    }
    new Notification(title, options);
  }, [isNotifEnabled, notifPermission]);
  
  const handleNotifToggle = () => {
    if (!("Notification" in window)) {
        alert("Browser ini tidak mendukung notifikasi desktop.");
        return;
    }

    if (notifPermission === 'granted') {
        setIsNotifEnabled(!isNotifEnabled);
    } else if (notifPermission === 'denied') {
        alert("Anda telah memblokir notifikasi. Mohon aktifkan melalui pengaturan browser.");
    } else {
        Notification.requestPermission().then(permission => {
            setNotifPermission(permission);
            if (permission === 'granted') {
                setIsNotifEnabled(true);
                addNotification('Sukses', 'Notifikasi berhasil diaktifkan.', 'take_profit_profit');
            }
        });
    }
  };

  // PERBAIKAN: Memeriksa status izin notifikasi saat aplikasi dimuat
  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const accountsRef = ref(db, 'accounts/');
    const historyRef = ref(db, 'trade_history/');
    const orderRef = ref(db, 'dashboard_config/accountOrder');

    const unsubscribeAccounts = onValue(accountsRef, (snapshot) => {
        const data = snapshot.val() || {};
        
        if(initialLoadComplete.current) {
            Object.values(data).forEach(acc => {
                const prevPosTickets = new Set(prevPositionsRef.current[acc.accountId] || []);
                const currentPositions = acc.positions || [];

                currentPositions.forEach(pos => {
                    if (!prevPosTickets.has(pos.ticket)) {
                        const executionType = pos.executionType.replace('_', ' ');
                        const capitalizedType = executionType.charAt(0).toUpperCase() + executionType.slice(1);
                        
                        const messageForNotification = `${capitalizedType} di Akun ${acc.accountName} dengan Lot ${pos.lotSize.toFixed(2)} pada harga @${pos.entryPrice}`;
                        
                        const lotForSpeech = formatNumberForSpeech(pos.lotSize.toFixed(2));
                        const priceForSpeech = formatNumberForSpeech(pos.entryPrice);
                        const messageForSpeech = `${capitalizedType} di Akun ${acc.accountName} dengan Lot ${lotForSpeech} di harga ${priceForSpeech}`;

                        showNotification(`Aktivitas Baru: ${acc.accountName}`, { body: messageForNotification, icon: '/logo192.png' });
                        speak(messageForSpeech);
                    }
                });
            });
        }

        const newPositions = {};
        Object.values(data).forEach(acc => {
            newPositions[acc.accountId] = (acc.positions || []).map(p => p.ticket);
        });
        prevPositionsRef.current = newPositions;
        
        if(!initialLoadComplete.current) {
            initialLoadComplete.current = true;
        }

        setAccountsData(data);
    });

    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
        const data = snapshot.val() || {};
        setTradeHistory(data);
    });

    const unsubscribeOrder = onValue(orderRef, (snapshot) => {
        const data = snapshot.val() || [];
        setAccountOrder(data);
    });

    return () => {
        unsubscribeAccounts();
        unsubscribeHistory();
        unsubscribeOrder();
    };
  }, [speak, showNotification, formatNumberForSpeech]);

  const accounts = useMemo(() => {
    const allAccounts = Object.values(accountsData);
    
    if (accountOrder && accountOrder.length > 0) {
      const accountMap = new Map(allAccounts.map(acc => [String(acc.id), acc]));
      const orderedIdSet = new Set(accountOrder.map(id => String(id)));

      const orderedList = accountOrder
        .map(id => accountMap.get(String(id)))
        .filter(Boolean);
        
      const unorderedList = allAccounts
        .filter(acc => !orderedIdSet.has(String(acc.id)))
        .sort((a, b) => a.accountName.localeCompare(b.accountName));

      return [...orderedList, ...unorderedList];
    }

    return allAccounts.sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [accountsData, accountOrder]);


  const handleToggleRobot = async (accountId, newStatus) => {
    try {
        await set(ref(db, `commands/${accountId}`), { command: 'toggle_robot', status: newStatus });
    } catch (error) {
        addNotification('Error', 'Gagal mengirim perintah ke server.', 'take_profit_loss');
    }
  };

  const openDeleteModal = (accountId, accountName) => {
    setDeleteModal({ isOpen: true, accountId, accountName });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, accountId: null, accountName: '' });
  };

  const handleDeleteAccount = async () => {
    const { accountId, accountName } = deleteModal;
    if (!accountId) return;
    try {
        await remove(ref(db, `accounts/${accountId}`));
        await remove(ref(db, `commands/${accountId}`));
        addNotification('Sukses', `Akun ${accountName} telah dihapus.`, 'take_profit_profit');
    } catch (error) {
        addNotification('Error', 'Gagal menghapus akun. Mohon refresh halaman.', 'take_profit_loss');
    }
    closeDeleteModal();
  };

  const handleDragStart = (e, pos) => {
    dragItem.current = pos;
    setDragging(true);
  };

  const handleDragEnter = (e, pos) => {
    dragOverItem.current = pos;
  };

  const handleDragEnd = async () => {
    if (dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragging(false);
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const reorderedAccounts = [...accounts];
    const dragItemContent = reorderedAccounts[dragItem.current];
    reorderedAccounts.splice(dragItem.current, 1);
    reorderedAccounts.splice(dragOverItem.current, 0, dragItemContent);
    
    const newOrderIds = reorderedAccounts.map(acc => acc.id);
    setAccountOrder(newOrderIds);

    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);

    try {
        await set(ref(db, 'dashboard_config/accountOrder'), newOrderIds);
        addNotification('Sukses', 'Urutan kartu telah disimpan.', 'take_profit_profit');
    } catch (error) {
        addNotification('Error', 'Gagal menyimpan urutan kartu.', 'take_profit_loss');
    }
  };

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    return accounts.filter(account => account.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [accounts, searchTerm]);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-gray-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <header className="mb-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">MJA Monitoring Dashboard</h1>
            <p className="text-slate-400 mt-1">Ringkasan global dan status akun individual.</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleNotifToggle} title="Notifikasi Browser" className={`p-2 rounded-lg transition-colors ${isNotifEnabled && notifPermission === 'granted' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'} ${notifPermission === 'denied' ? 'text-red-500' : ''}`}>
              <BellRing size={20} />
            </button>
            <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} title="Pemberitahuan Suara" className={`p-2 rounded-lg transition-colors ${isSoundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            {page === 'dashboard' ? (
              <button onClick={() => setPage('history')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                  <History size={20} />
                  <span>Lihat Riwayat</span>
              </button>
            ) : (
              <button onClick={() => setPage('dashboard')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                  <ArrowLeft size={20} />
                  <span>Kembali</span>
              </button>
            )}
          </div>
        </header>

        <main className="border-t border-slate-700 pt-8">
            {page === 'dashboard' ? (
                <>
                  <div className="mb-6 relative">
                    <input type="text" placeholder="Cari nama akun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  </div>
                  
                  <SummaryDashboard accounts={accounts} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredAccounts.map((account, index) => (
                          <AccountCard
                              key={account.id}
                              account={account}
                              onToggleRobot={handleToggleRobot}
                              onDelete={openDeleteModal}
                              index={index}
                              handleDragStart={handleDragStart}
                              handleDragEnter={handleDragEnter}
                              handleDragEnd={handleDragEnd}
                              isDragging={dragging && dragItem.current === index}
                          />
                      ))}
                  </div>
                </>
            ) : (
                <HistoryPage accounts={accounts} tradeHistory={tradeHistory} />
            )}
        </main>
      </div>
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Konfirmasi Penghapusan"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteModal.accountName}"? Tindakan ini akan menghapus data dari dasbor. Anda juga harus mematikan EA di akun ini agar tidak muncul kembali.`}
        onConfirm={handleDeleteAccount}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
