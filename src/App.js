import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, ArrowLeft, History, Activity, Check, Power, Trash2 } from 'lucide-react';

// Helper function
const formatCurrency = (value, includeSign = true) => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : (includeSign ? '+' : '');
  return `${sign}$${absValue.toFixed(2)}`;
};

// --- React Components ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Batal</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Hapus</button>
                </div>
            </div>
        </div>
    );
};

const Notification = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const isProfit = notification.type === 'take_profit_profit';
  const isLoss = notification.type === 'take_profit_loss';
  const Icon = isProfit ? CheckCircle : (isLoss ? X : Bell);
  const iconColor = isProfit ? 'text-green-400' : (isLoss ? 'text-red-400' : 'text-blue-400');

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 flex items-start space-x-3 animate-fade-in-up">
      <Icon className={`${iconColor} mt-1 flex-shrink-0`} size={20} />
      <div className="flex-1">
        <p className="text-sm text-white font-semibold">{notification.title}</p>
        <p className="text-xs text-slate-300">{notification.message}</p>
      </div>
      <button onClick={() => onClose(notification.id)} className="text-slate-500 hover:text-white">
        <X size={18} />
      </button>
    </div>
  );
};

const NotificationContainer = ({ notifications, removeNotification }) => (
  <div className="fixed bottom-4 right-4 z-50 w-80 space-y-3">
    {notifications.map(n => <Notification key={n.id} notification={n} onClose={removeNotification} />)}
  </div>
);

const SummaryStat = ({ icon, title, value, colorClass = 'text-white' }) => (
  <div className="bg-slate-800 p-4 rounded-lg shadow-lg flex items-center space-x-4 border border-slate-700">
    <div className="bg-slate-900 p-3 rounded-full">{icon}</div>
    <div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  </div>
);

const SummaryDashboard = ({ accounts }) => {
  const summary = useMemo(() => {
    let totalPL = 0;
    let profitableAccounts = 0;
    let losingAccounts = 0;
    let pendingOrdersCount = 0;

    accounts.forEach(acc => {
        if (acc.status === 'active') {
            const accountPL = (acc.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
            totalPL += accountPL;
            if (accountPL > 0) profitableAccounts++;
            if (accountPL < 0) losingAccounts++;
            pendingOrdersCount += (acc.orders || []).length;
        }
    });
    
    return { 
        totalAccounts: accounts.length, 
        activeAccountsCount: accounts.filter(acc => acc.status === 'active').length, 
        profitableAccounts, 
        losingAccounts, 
        pendingOrdersCount, 
        totalPL 
    };
  }, [accounts]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <SummaryStat icon={<Briefcase size={24} className="text-blue-400" />} title="Total Akun" value={summary.totalAccounts} />
      <SummaryStat icon={<List size={24} className="text-cyan-400" />} title="Akun Aktif" value={summary.activeAccountsCount} />
      <SummaryStat icon={<TrendingUp size={24} className="text-green-400" />} title="Akun Profit" value={summary.profitableAccounts} colorClass="text-green-500" />
      <SummaryStat icon={<TrendingDown size={24} className="text-red-400" />} title="Akun Minus" value={summary.losingAccounts} colorClass="text-red-500" />
      <SummaryStat icon={<Clock size={24} className="text-yellow-400" />} title="Order Pending" value={summary.pendingOrdersCount} colorClass="text-yellow-500" />
      <SummaryStat icon={<DollarSign size={24} className={summary.totalPL >= 0 ? 'text-green-400' : 'text-red-400'} />} title="Total P/L" value={formatCurrency(summary.totalPL, false)} colorClass={summary.totalPL >= 0 ? 'text-green-500' : 'text-red-500'} />
    </div>
  );
};

const AccountCard = ({ account, onToggleRobot, onDelete, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging }) => {
  const totalPL = useMemo(() => (account.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0), [account.positions]);
  const isProfitable = totalPL > 0;
  
  const getBorderColor = () => {
    if (account.status !== 'active') return 'border-slate-600';
    return isProfitable ? 'border-green-500' : 'border-red-500';
  };

  const getTypePill = (type) => {
    let bgColor = 'bg-gray-500', textColor = 'text-white';
    if (type === 'buy_stop' || type === 'buy_limit') { bgColor = 'bg-yellow-500/20'; textColor = 'text-yellow-400'; }
    else if (type === 'sell_stop' || type === 'sell_limit') { bgColor = 'bg-yellow-500/20'; textColor = 'text-yellow-400'; }
    else if (type === 'buy') { bgColor = 'bg-blue-600/20'; textColor = 'text-blue-400'; }
    else if (type === 'sell') { bgColor = 'bg-red-600/20'; textColor = 'text-red-400'; }
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${bgColor} ${textColor}`}>{type.replace('_', ' ').toUpperCase()}</span>;
  }

  return (
    <div className={`bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden flex flex-col transition-all duration-300 cursor-grab ${isDragging ? 'opacity-50 scale-105' : 'opacity-100'}`}
      draggable="true" onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}>
      <div className={`p-4 border-l-4 ${getBorderColor()} flex-grow`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{account.accountName}</h3>
            <p className={`text-xl font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalPL)}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={(e) => { e.stopPropagation(); onToggleRobot(account.accountId, account.robotStatus === 'on' ? 'off' : 'on'); }} title={`Robot ${account.robotStatus === 'on' ? 'ON' : 'OFF'}`} className="p-1 rounded-full hover:bg-slate-700 transition-colors">
              <Power size={18} className={`${account.robotStatus === 'on' ? 'text-green-500' : 'text-slate-500'} transition-colors`} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(account.accountId, account.accountName); }} title="Hapus Akun" className="p-1 rounded-full text-slate-500 hover:bg-slate-700 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <div className="space-y-3 text-xs">
          {/* Daftar Posisi Aktif */}
          {(account.positions && account.positions.length > 0) && account.positions.map(pos => (
            <div key={pos.ticket} className="grid grid-cols-4 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                <div>{getTypePill(pos.executionType)}</div>
                <div className="text-slate-300 font-semibold">{pos.pair}</div>
                <div className="text-slate-400 text-right">Lot {pos.lotSize.toFixed(2)}</div>
                <div className={`font-bold text-right ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(pos.profit)}</div>
            </div>
          ))}
          {/* Daftar Order Pending */}
          {(account.orders && account.orders.length > 0) && account.orders.map(ord => (
             <div key={ord.ticket} className="grid grid-cols-4 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                <div>{getTypePill(ord.executionType)}</div>
                <div className="text-slate-300 font-semibold">{ord.pair}</div>
                <div className="text-slate-400 text-right">Lot {ord.lotSize.toFixed(2)}</div>
                <div className="text-yellow-400 text-right">@ {ord.entryPrice.toFixed(3)}</div>
            </div>
          ))}
          {/* Pesan jika tidak ada aktivitas */}
          {account.status === 'inactive' && (
            <div className="flex items-center justify-center h-full bg-slate-800/50 rounded-md p-4">
                <p className="text-slate-400 italic">Tidak ada order aktif</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, accountId: null, accountName: '' });

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addNotification = (title, message, type) => {
    setNotifications(prev => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 5));
  };
  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/accounts');
        const data = await response.json();

        if (data && typeof data === 'object') {
            let serverAccounts = Object.values(data);
            serverAccounts.sort((a, b) => a.accountName.localeCompare(b.accountName));
            setAccounts(serverAccounts);
        }
      } catch (error) {
        console.error("Gagal mengambil data dari server:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleRobot = async (accountId, newStatus) => {
    setAccounts(prevAccounts =>
      prevAccounts.map(account =>
        account.accountId === accountId ? { ...account, robotStatus: newStatus } : account
      )
    );
    try {
        await fetch('/api/robot-toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId, newStatus })
        });
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

    setAccounts(prev => prev.filter(acc => acc.accountId !== accountId));
    closeDeleteModal();

    try {
        await fetch('/api/delete-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId })
        });
        addNotification('Sukses', `Akun ${accountName} telah dihapus.`, 'take_profit_profit');
    } catch (error) {
        addNotification('Error', 'Gagal menghapus akun. Mohon refresh halaman.', 'take_profit_loss');
    }
  };

  const handleDragStart = (e, pos) => {
    dragItem.current = pos;
    setDragging(true);
  };

  const handleDragEnter = (e, pos) => {
    dragOverItem.current = pos;
  };

  const handleDragEnd = () => {
    if (dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragging(false);
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const accountsCopy = [...accounts];
    const dragItemContent = accountsCopy[dragItem.current];
    accountsCopy.splice(dragItem.current, 1);
    accountsCopy.splice(dragOverItem.current, 0, dragItemContent);
    setAccounts(accountsCopy);

    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    return accounts.filter(account => account.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [accounts, searchTerm]);

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard MetaTrader</h1>
            <p className="text-slate-400 mt-1">Ringkasan global dan status akun individual.</p>
          </div>
        </header>

        <main>
            <>
              <div className="mb-6 relative">
                <input type="text" placeholder="Cari nama akun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                          index={accounts.findIndex(a => a.id === account.id)}
                          handleDragStart={handleDragStart}
                          handleDragEnter={handleDragEnter}
                          handleDragEnd={handleDragEnd}
                          isDragging={dragging && dragItem.current === accounts.findIndex(a => a.id === account.id)}
                      />
                  ))}
              </div>
            </>
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
