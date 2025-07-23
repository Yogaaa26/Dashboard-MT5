import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, ArrowLeft, History, Activity, Check, Power, Trash2, Volume2, VolumeX, BellRing } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseConfig } from './firebaseConfig';
import * as XLSX from 'xlsx';

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Helper function
const formatCurrency = (value, includeSign = true) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : (includeSign ? '+' : '');
    return `${sign}$${absValue.toFixed(2)}`;
};

// --- KOMPONEN UTAMA APP ---
export default function App() {
    
    // --- STATE & REFS ---
    const [accountsData, setAccountsData] = useState({});
    const [accountOrder, setAccountOrder] = useState([]);
    const [tradeHistory, setTradeHistory] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [page, setPage] = useState('dashboard');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, accountId: null, accountName: '' });
    const [detailModal, setDetailModal] = useState({ isOpen: false, account: null });
    const [activeFilter, setActiveFilter] = useState('all');
    const [isNotifEnabled, setIsNotifEnabled] = useState(false);
    const [notifPermission, setNotifPermission] = useState('default');
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const [historyResetTimestamp, setHistoryResetTimestamp] = useState(null); 
    const prevPositionsRef = useRef({});
    const initialLoadComplete = useRef(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false); // <-- TAMBAHKAN BARIS INI
    

    // --- FUNGSI LOGIKA (HANDLERS) ---
    const addNotification = (title, message, type) => {
        setNotifications(prev => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 5));
    };
    const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
    
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
    
     const handleConfirmReset = () => {
    setHistoryResetTimestamp(new Date());
    addNotification('Sukses', 'Tampilan riwayat telah direset.', 'take_profit_profit');
    setShowResetConfirm(false); // Tutup modal setelah konfirmasi
    };

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

    const handleCancelOrder = async (accountId, ticket) => {
        try {
            await fetch('/api/cancel-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, ticket })
            });
            addNotification('Info', `Perintah pembatalan order #${ticket} telah dikirim.`, 'default');
        } catch (error) {
            addNotification('Error', 'Gagal mengirim perintah pembatalan.', 'take_profit_loss');
        }
    };

    const handleToggleRobot = async (accountId, newStatus) => {
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
            await fetch('/api/save-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrderIds })
            });
            addNotification('Sukses', 'Urutan kartu telah disimpan.', 'take_profit_profit');
        } catch (error) {
            addNotification('Error', 'Gagal menyimpan urutan kartu.', 'take_profit_loss');
        }
    };

    const openDetailModal = (account) => {
        setDetailModal({ isOpen: true, account: account });
    };

    const closeDetailModal = () => {
        setDetailModal({ isOpen: false, account: null });
    };

    // --- DATA TURUNAN (useEffect & useMemo) ---
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
                            const message = `Posisi ${pos.executionType} dibuka pada ${pos.pair} lot ${pos.lotSize.toFixed(2)}`;
                            showNotification(`Aktivitas Baru: ${acc.accountName}`, { body: message, icon: '/logo192.png' });
                            speak(message);
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
    }, [speak, showNotification]);

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

    const filteredAccounts = useMemo(() => {
        let filtered = accounts;

        if (activeFilter !== 'all') {
            filtered = accounts.filter(account => {
                const accountPL = (account.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
                
                switch (activeFilter) {
                    case 'active':
                        return account.status === 'active';
                    case 'profit':
                        return account.status === 'active' && accountPL > 0;
                    case 'loss':
                        return account.status === 'active' && accountPL < 0;
                    case 'pending':
                        return (account.orders || []).length > 0;
                    default:
                        return true;
                }
            });
        }

        if (!searchTerm) return filtered;
        return filtered.filter(account => 
            account.accountName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [accounts, searchTerm, activeFilter]);


    // --- KOMPONEN PEMBANTU ---
    const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Konfirmasi', confirmColorClass = 'bg-blue-600 hover:bg-blue-700' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Batal</button>
                    <button onClick={onConfirm} className={`${confirmColorClass} text-white font-bold py-2 px-4 rounded-lg transition-colors`}>{confirmText}</button>
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
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-4 flex items-start space-x-3 animate-fade-in-up">
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

    const SummaryStat = ({ icon, title, value, colorClass = 'text-white', onClick, isActive }) => (
        <div 
            onClick={onClick} 
            className={`
                bg-slate-800/70 backdrop-blur-sm p-4 rounded-xl shadow-lg flex items-center space-x-4 border 
                ${onClick ? 'cursor-pointer transition-all duration-300 hover:bg-slate-700/80' : ''} 
                ${isActive ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-700'}
            `}
        >
            <div className="bg-slate-900/80 p-3 rounded-full">{icon}</div>
            <div>
                <p className="text-sm text-slate-400">{title}</p>
                <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
            </div>
        </div>
    );

    const SummaryDashboard = ({ accounts, activeFilter, setActiveFilter }) => {
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
            return { totalAccounts: accounts.length, activeAccountsCount: accounts.filter(acc => acc.status === 'active').length, profitableAccounts, losingAccounts, pendingOrdersCount, totalPL };
        }, [accounts]);

        const handleFilterClick = (filterName) => {
            setActiveFilter(prevFilter => prevFilter === filterName ? 'all' : filterName);
        };

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <SummaryStat icon={<Briefcase size={24} className="text-blue-400" />} title="Total Akun" value={summary.totalAccounts} />
                <SummaryStat icon={<List size={24} className="text-cyan-400" />} title="Akun Aktif" value={summary.activeAccountsCount} onClick={() => handleFilterClick('active')} isActive={activeFilter === 'active'} />
                <SummaryStat icon={<TrendingUp size={24} className="text-green-400" />} title="Akun Profit" value={summary.profitableAccounts} colorClass="text-green-500" onClick={() => handleFilterClick('profit')} isActive={activeFilter === 'profit'} />
                <SummaryStat icon={<TrendingDown size={24} className="text-red-400" />} title="Akun Minus" value={summary.losingAccounts} colorClass="text-red-500" onClick={() => handleFilterClick('loss')} isActive={activeFilter === 'loss'} />
                <SummaryStat icon={<Clock size={24} className="text-yellow-400" />} title="Order Pending" value={summary.pendingOrdersCount} colorClass="text-yellow-500" onClick={() => handleFilterClick('pending')} isActive={activeFilter === 'pending'} />
                <SummaryStat icon={<DollarSign size={24} className={summary.totalPL >= 0 ? 'text-green-400' : 'text-red-400'} />} title="Total P/L" value={formatCurrency(summary.totalPL, false)} colorClass={summary.totalPL >= 0 ? 'text-green-500' : 'text-red-500'} />
            </div>
        );
    };

    const AccountCard = ({ account, onToggleRobot, onDelete, onCancelOrder, onCardClick, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging }) => {
        const totalPL = useMemo(() => (account.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0), [account.positions]);
        const isProfitable = totalPL >= 0;
        
        const getGlowEffect = () => {
            if (account.status !== 'active') return 'shadow-slate-900/50';
            if (isProfitable) return 'shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)]';
            if (totalPL < 0) return 'shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]';
            return 'shadow-slate-900/50';
        };

        const getTypePill = (type) => {
            let bgColor = 'bg-gray-500', textColor = 'text-white';
            if (type === 'buy_stop' || type === 'buy_limit') { bgColor = 'bg-white'; textColor = 'text-black'; }
            else if (type === 'sell_stop' || type === 'sell_limit') { bgColor = 'bg-yellow-600'; }
            else if (type === 'buy') { bgColor = 'bg-blue-600'; }
            else if (type === 'sell') { bgColor = 'bg-red-600'; }
            return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${bgColor} ${textColor}`}>{type.replace('_', ' ').toUpperCase()}</span>;
        }
        
        const totalActivities = (account.positions?.length || 0) + (account.orders?.length || 0);
        const singleItem = totalActivities === 1 ? (account.positions?.[0] || account.orders?.[0]) : null;
        const isSingleItemPending = singleItem && (singleItem.executionType.includes('limit') || singleItem.executionType.includes('stop'));

        return (
            <div 
                onClick={() => onCardClick(account)}
                className={`bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700 flex flex-col h-72 transition-all duration-300 cursor-pointer relative ${getGlowEffect()} ${isDragging ? 'opacity-50 scale-105' : 'opacity-100'}`}
                draggable="true" 
                onDragStart={(e) => handleDragStart(e, index)} 
                onDragEnter={(e) => handleDragEnter(e, index)} 
                onDragEnd={handleDragEnd} 
                onDragOver={(e) => e.preventDefault()}>
                
                <div className="p-4 flex flex-col flex-grow min-h-0">
                    <div className="flex-shrink-0 flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-x-2 mb-1">
                                <h3 className="text-lg font-bold text-white">{account.accountName}</h3>
                                <button onClick={(e) => { e.stopPropagation(); onToggleRobot(account.accountId, account.robotStatus === 'on' ? 'off' : 'on'); }} title={`Robot ${account.robotStatus === 'on' ? 'ON' : 'OFF'}`} className="p-1 rounded-full hover:bg-slate-700 transition-colors">
                                    <Power size={18} className={`${account.robotStatus === 'on' ? 'text-green-500' : 'text-slate-500'} transition-colors`} />
                                </button>
                            </div>
                            {account.tradingRobotName && <p className="text-xs text-cyan-400 -mt-1">{account.tradingRobotName}</p>}
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Balance</p>
                                <p className="text-lg font-bold text-cyan-400">
                                    {`$${(account.balance || 0).toFixed(2)}`}
                                </p>
                            </div>
                            {totalActivities === 1 && singleItem && (
                                <div className="flex-shrink-0">{getTypePill(singleItem.executionType)}</div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col min-h-0">
                        {account.status === 'inactive' && (
                            <div className="flex-1 flex items-center justify-center"><p className="text-slate-400 italic">Tidak ada order aktif</p></div>
                        )}

                        {account.status === 'active' && totalActivities === 1 && singleItem && (
                            <div className="grid grid-cols-3 gap-x-4 text-sm flex-1">
                                <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-4">
                                    <div><p className="text-slate-500 text-xs">Pair</p><p className="font-semibold text-lg">{singleItem.pair}</p></div>
                                    <div><p className="text-slate-500 text-xs">Lot</p><p className="font-semibold text-lg">{singleItem.lotSize.toFixed(2)}</p></div>
                                    <div><p className="text-slate-500 text-xs">{isSingleItemPending ? 'Harga Akan Eksekusi' : 'Harga Eksekusi'}</p><p className="font-semibold text-lg">{singleItem.entryPrice.toFixed(3)}</p></div>
                                    <div><p className="text-slate-500 text-xs">Harga Sekarang</p><p className="font-semibold text-lg">{singleItem.currentPrice ? singleItem.currentPrice.toFixed(3) : '...'}</p></div>
                                </div>
                                <div className="flex flex-col justify-start items-end">
                                    <p className="text-slate-500 text-xs mb-1">Status</p>
                                    {isSingleItemPending ? 
                                        <div className="text-right flex items-center justify-end">
                                            <p className="text-lg font-bold text-yellow-400 flex items-center"><Clock size={16} className="mr-2"/> Pending</p>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onCancelOrder(account.accountId, singleItem.ticket); }} 
                                                title="Batalkan Order" 
                                                className="ml-2 text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-700">
                                                <X size={16}/>
                                            </button>
                                        </div> :
                                        <div className="text-right"><p className={`text-lg font-bold ${singleItem.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(singleItem.profit)}</p></div>
                                    }
                                </div>
                            </div>
                        )}

                        {account.status === 'active' && totalActivities > 1 && (
                            <div className="space-y-2 text-xs overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                                {(account.positions || []).map(pos => (
                                    <div key={pos.ticket} className="grid grid-cols-4 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                                        <div>{getTypePill(pos.executionType)}</div>
                                        <div className="text-slate-300 font-semibold">{pos.pair}</div>
                                        <div className="text-slate-400 text-right">Lot {pos.lotSize.toFixed(2)}</div>
                                        <div className={`font-bold text-right ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(pos.profit)}</div>
                                    </div>
                                ))}
                                {(account.orders || []).map(ord => (
                                    <div key={ord.ticket} className="grid grid-cols-5 gap-x-2 items-center bg-slate-900/50 p-2 rounded-md">
                                        <div>{getTypePill(ord.executionType)}</div>
                                        <div className="text-slate-300 font-semibold">{ord.pair}</div>
                                        <div className="text-slate-400 text-right">Lot {ord.lotSize.toFixed(2)}</div>
                                        <div className="text-yellow-400 text-right">@ {ord.entryPrice.toFixed(3)}</div>
                                        <div className="text-right">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onCancelOrder(account.accountId, ord.ticket); }}
                                                title="Batalkan Order"
                                                className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-700/80">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(account.accountId, account.accountName); }} title="Hapus Akun" className="absolute bottom-3 right-3 p-1 rounded-full text-slate-600 hover:bg-slate-900/50 hover:text-red-500 transition-all duration-200 opacity-50 hover:opacity-100">
                    <Trash2 size={16} />
                </button>
            </div>
        );
    };
    
    const HistoryPage = ({ accounts, tradeHistory, addNotification, historyResetTimestamp, onResetRequest }) => {
        
        const accountSummary = useMemo(() => {
            let relevantHistory = Object.values(tradeHistory || {}).reduce((acc, val) => acc.concat(val), []);

            if (historyResetTimestamp) {
                relevantHistory = relevantHistory.filter(trade => {
                    if (!trade || typeof trade.closeDate !== 'string') return false;
                    const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                    return !isNaN(tradeDate) && tradeDate > historyResetTimestamp;
                });
            }

            return accounts.map(account => {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const weeklyTrades = relevantHistory.filter(trade => {
                    if (trade.accountName !== account.accountName) return false;
                    const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                    return !isNaN(tradeDate) && tradeDate > oneWeekAgo;
                });

                const totalPL = weeklyTrades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
                const startingBalance = (account.balance || 0) - totalPL;
                const percentagePL = startingBalance > 0 ? (totalPL / startingBalance) * 100 : 0;
                return {
                    id: account.id, name: account.accountName, totalOrders: weeklyTrades.length,
                    totalPL: totalPL, percentagePL: percentagePL, status: account.status,
                };
            }).sort((a,b) => a.name.localeCompare(b.name));
        }, [accounts, tradeHistory, historyResetTimestamp]);

        const handleDownload = () => {
            const allHistory = Object.values(tradeHistory || {}).reduce((acc, val) => acc.concat(val), []);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const monthlyHistory = allHistory.filter(trade => {
                if (!trade || typeof trade.closeDate !== 'string') return false;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return !isNaN(tradeDate) && tradeDate > oneMonthAgo;
            });
            if (monthlyHistory.length === 0 && accounts.length > 0) {
                 // Tetap lanjutkan jika ada akun tapi tidak ada riwayat
            } else if (monthlyHistory.length === 0) {
                alert("Tidak ada data riwayat dalam 1 bulan terakhir untuk diunduh.");
                return;
            }

            const historyMap = monthlyHistory.reduce((acc, trade) => {
                const accountName = trade.accountName;
                if (!acc[accountName]) {
                    acc[accountName] = [];
                }
                acc[accountName].push(trade);
                return acc;
            }, {});
            const summaryData = accounts.map((account, index) => {
                const trades = historyMap[account.accountName] || [];
                const totalPL = trades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
                const totalTrades = trades.length;
                const startingBalance = (account.balance || 0) - totalPL;
                const percentagePL = startingBalance > 0 ? (totalPL / startingBalance) * 100 : 0;
                return {
                    'No.': index + 1,
                    'Periode': new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
                    'Nama Akun': account.accountName,
                    'Nama Robot/EA': account.tradingRobotName || 'N/A',
                    'Total trade': totalTrades,
                    'Total Profit/Loss': `$${totalPL.toFixed(2)}`,
                    'Presentase': percentagePL.toFixed(2) + '%'
                };
            });
            const worksheet = XLSX.utils.json_to_sheet(summaryData);
            const columnWidths = [
                { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 25 },
                { wch: 20 }, { wch: 20 }, { wch: 20 }
            ];
            worksheet['!cols'] = columnWidths;
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Ringkasan 1 Bulan');
            XLSX.writeFile(workbook, 'Ringkasan_Trading_Bulanan.xlsx');
        };

        const handleReset = () => {
            onResetRequest(); 
};

        return (
            <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-4">Riwayat Kinerja Akun (7 Hari Terakhir)</h2>
                <div className="mb-6 flex space-x-4">
                    <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                        <span>Unduh Riwayat (.xlsx)</span>
                    </button>
                    <button onClick={handleReset} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                        <span>Reset Tampilan</span>
                    </button>
                </div>
                <div className="bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700 overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nama Akun</th>
                                <th scope="col" className="px-6 py-3 text-center">Total Transaksi</th>
                                <th scope="col" className="px-6 py-3 text-right">Total P/L</th>
                                <th scope="col" className="px-6 py-3 text-right">Persentase (%)</th>
                                <th scope="col" className="px-6 py-3 text-center">Status Saat Ini</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountSummary.map(summary => (
                                <tr key={summary.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-medium text-white">{summary.name}</td>
                                    <td className="px-6 py-4 text-center">{summary.totalOrders}</td>
                                    <td className={`px-6 py-4 font-semibold text-right ${summary.totalPL > 0 ? 'text-green-500' : summary.totalPL < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                        {formatCurrency(summary.totalPL)}
                                    </td>
                                    <td className={`px-6 py-4 font-semibold text-right ${summary.percentagePL > 0 ? 'text-green-500' : summary.percentagePL < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                        {(summary.percentagePL || 0).toFixed(2)}%
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${summary.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                            {summary.status === 'active' ? <Activity className="mr-2" size={14} /> : <Check className="mr-2" size={14} />}
                                            {summary.status === 'active' ? 'Floating' : 'Clear'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    const GlobalSummary = ({ accounts, tradeHistory, historyResetTimestamp }) => {
    const weeklySummary = useMemo(() => {
        if (!tradeHistory || !accounts.length) {
            return { totalPL: 0, totalTrades: 0, winRate: 0 };
        }
        
        let allHistory = Object.values(tradeHistory || {}).reduce((acc, val) => acc.concat(val), []);

        // --- TAMBAHKAN LOGIKA FILTER INI ---
        if (historyResetTimestamp) {
            allHistory = allHistory.filter(trade => {
                if (!trade || typeof trade.closeDate !== 'string') return false;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return !isNaN(tradeDate) && tradeDate > historyResetTimestamp;
            });
        }
        // --- AKHIR BLOK TAMBAHAN ---

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            let totalPL = 0;
            let totalTrades = 0;
            let winningTrades = 0;
            allHistory.forEach(trade => {
                if (!trade || typeof trade.closeDate !== 'string') return;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                if (!isNaN(tradeDate) && tradeDate > oneWeekAgo) {
                    const profit = parseFloat(trade.pl) || 0;
                    totalPL += profit;
                    totalTrades++;
                    if (profit > 0) {
                        winningTrades++;
                    }
                }
            });
            const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
            return { totalPL, totalTrades, winRate };
        }, [accounts, tradeHistory]);

        return (
            <div className="mb-8 p-4 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-3">Ringkasan Global (7 Hari Terakhir)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm text-slate-400">Total P/L</p>
                        <p className={`text-2xl font-bold ${weeklySummary.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(weeklySummary.totalPL, false)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">Total Transaksi</p>
                        <p className="text-2xl font-bold text-white">{weeklySummary.totalTrades}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">Win Rate</p>
                        <p className="text-2xl font-bold text-cyan-400">{weeklySummary.winRate.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        );
    };

    const AccountDetailModal = ({ isOpen, onClose, account, tradeHistory }) => {
        const accountHistory = useMemo(() => {
            if (!isOpen || !account || !tradeHistory) return [];
            const allHistory = Object.values(tradeHistory).reduce((acc, val) => acc.concat(val), []);
            return allHistory
                .filter(trade => trade && trade.accountName === account.accountName)
                .sort((a, b) => new Date(b.closeDate.replace(/\./g, '-')) - new Date(a.closeDate.replace(/\./g, '-')));
        }, [isOpen, account, tradeHistory]);

        if (!isOpen || !account) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-6 w-full max-w-2xl mx-4 shadow-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Detail Akun: {account.accountName}</h3>
                        <button onClick={onClose} className="text-slate-500 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="mb-6 p-4 bg-slate-900/50 rounded-lg">
                        <p className="text-center text-slate-400">Area Grafik Performa (Sparkline)</p>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Riwayat Transaksi Terakhir</h4>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2">Tiket</th>
                                    <th scope="col" className="px-4 py-2">Pair</th>
                                    <th scope="col" className="px-4 py-2 text-right">P/L</th>
                                    <th scope="col" className="px-4 py-2">Tanggal Tutup</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accountHistory.length > 0 ? accountHistory.map(trade => (
                                    <tr key={trade.ticket} className="border-b border-slate-700/50">
                                        <td className="px-4 py-2">{trade.ticket}</td>
                                        <td className="px-4 py-2 font-medium">{trade.pair}</td>
                                        <td className={`px-4 py-2 font-semibold text-right ${parseFloat(trade.pl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(parseFloat(trade.pl))}
                                        </td>
                                        <td className="px-4 py-2 text-slate-400">{trade.closeDate}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="text-center py-4 text-slate-500 italic">Tidak ada riwayat transaksi.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // --- LANGKAH 5: TAMPILAN UTAMA APP (RETURN) ---
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
                            
                            <SummaryDashboard accounts={accounts} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredAccounts.map((account, index) => (
                                    <AccountCard
                                        key={account.id}
                                        account={account}
                                        onToggleRobot={handleToggleRobot}
                                        onDelete={openDeleteModal}
                                        onCancelOrder={handleCancelOrder}
                                        onCardClick={openDetailModal}
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
                        <>
                            <GlobalSummary 
                                accounts={accounts} 
                                tradeHistory={tradeHistory} 
                                historyResetTimestamp={historyResetTimestamp} 
                              />
                            <HistoryPage 
                                accounts={accounts} 
                                tradeHistory={tradeHistory} 
                                addNotification={addNotification} 
                                historyResetTimestamp={historyResetTimestamp}
                                onResetRequest={() => setShowResetConfirm(true)}
                            />
                        </>
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
            
           <ConfirmationModal
                isOpen={showResetConfirm}
                title="Konfirmasi Reset Tampilan"
                message="Apakah Anda yakin ingin mereset tampilan riwayat? Ini hanya akan menampilkan data baru yang masuk setelah ini."
                onConfirm={handleConfirmReset}
                onCancel={() => setShowResetConfirm(false)}
                confirmText="Ya, Reset"
                confirmColorClass="bg-blue-600 hover:bg-blue-700"
            />

            <AccountDetailModal
                isOpen={detailModal.isOpen}
                onClose={closeDetailModal}
                account={detailModal.account}
                tradeHistory={tradeHistory}
            />
        </div>
    );
}
