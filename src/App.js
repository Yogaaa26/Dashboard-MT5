import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, ArrowLeft, History, Activity, Check, Power, Trash2, Cpu, Volume2, VolumeX, BellRing, XCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, remove } from "firebase/database";
import { firebaseConfig } from './firebaseConfig';

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper functions
const formatCurrency = (value, includeSign = true) => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : (includeSign ? '+' : '');
  return `${sign}$${absValue.toFixed(2)}`;
};

const formatNumberForSpeech = (num) => {
  const numStr = String(num);
  const parts = numStr.split('.');
  const integerPart = parts[0].split('').join(' ');
  if (parts.length > 1) {
    const decimalPart = parts[1].split('').join(' ');
    return `${integerPart} koma ${decimalPart}`;
  }
  return integerPart;
};

// --- React Components ---
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => { /* ... (komponen tetap sama) ... */ };
const Notification = ({ notification, onClose }) => { /* ... (komponen tetap sama) ... */ };
const NotificationContainer = ({ notifications, removeNotification }) => { /* ... (komponen tetap sama) ... */ };
const SummaryStat = ({ icon, title, value, colorClass = 'text-white' }) => { /* ... (komponen tetap sama) ... */ };
const SummaryDashboard = ({ accounts }) => { /* ... (komponen tetap sama) ... */ };
const AccountCard = ({ account, onToggleRobot, onDelete, handleCancelOrder, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging }) => { /* ... (komponen tetap sama) ... */ };
const HistoryPage = ({ accounts, tradeHistory }) => { /* ... (komponen tetap sama) ... */ };
const EAOverviewPage = ({ accounts, tradeHistory }) => { /* ... (komponen tetap sama) ... */ };


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

  const addNotification = (title, message, type) => { /* ... (fungsi tetap sama) ... */ };
  const removeNotification = (id) => { /* ... (fungsi tetap sama) ... */ };
  const speak = useCallback((text) => { /* ... (fungsi tetap sama) ... */ }, [isSoundEnabled]);
  const showNotification = useCallback((title, options) => { /* ... (fungsi tetap sama) ... */ }, [isNotifEnabled, notifPermission]);
  const handleNotifToggle = () => { /* ... (fungsi tetap sama) ... */ };

  useEffect(() => { /* ... (useEffect untuk listener tetap sama) ... */ }, [speak, showNotification]);

  const accounts = useMemo(() => { /* ... (useMemo untuk accounts tetap sama) ... */ }, [accountsData, accountOrder]);

  const handleToggleRobot = async (accountId, newStatus) => { /* ... (fungsi tetap sama) ... */ };
  const openDeleteModal = (accountId, accountName) => { /* ... (fungsi tetap sama) ... */ };
  const closeDeleteModal = () => { /* ... (fungsi tetap sama) ... */ };
  const handleDeleteAccount = async () => { /* ... (fungsi tetap sama) ... */ };
  const handleCancelOrder = async (accountId, ticket) => { /* ... (fungsi tetap sama) ... */ };
  const handleDragStart = (e, pos) => { /* ... (fungsi tetap sama) ... */ };
  const handleDragEnter = (e, pos) => { /* ... (fungsi tetap sama) ... */ };
  const handleDragEnd = async () => { /* ... (fungsi tetap sama) ... */ };

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
              <div className="flex items-center gap-2">
                  <button onClick={() => setPage('ea_overview')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                      <Cpu size={20} />
                      <span>EA Overview</span>
                  </button>
                  <button onClick={() => setPage('history')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                      <History size={20} />
                      <span>Riwayat</span>
                  </button>
              </div>
            ) : (
              <button onClick={() => setPage('dashboard')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                  <ArrowLeft size={20} />
                  <span>Kembali</span>
              </button>
            )}
          </div>
        </header>

        <main className="border-t border-slate-700 pt-8">
            {page === 'dashboard' && (
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
                              onToggleRobot={handleToggleRobot} // <-- PERBAIKAN DI SINI
                              onDelete={openDeleteModal}
                              handleCancelOrder={handleCancelOrder}
                              index={index}
                              handleDragStart={handleDragStart}
                              handleDragEnter={handleDragEnter}
                              handleDragEnd={handleDragEnd}
                              isDragging={dragging && dragItem.current === index}
                          />
                      ))}
                  </div>
                </>
            )}
            {page === 'history' && <HistoryPage accounts={accounts} tradeHistory={tradeHistory} />}
            {page === 'ea_overview' && <EAOverviewPage accounts={accounts} tradeHistory={tradeHistory} />}
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
