import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, List, Clock, Search, X, CheckCircle, Bell, Activity, Check, Power, Trash2, Volume2, VolumeX, BellRing, LoaderCircle, ArrowUpCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from "firebase/database";
import { firebaseConfig } from './firebaseConfig';
import * as XLSX from 'xlsx';
import InfoBanner from './InfoBanner';
import BottomNav from './BottomNav';
import EAOverviewPage from './EAOverviewpage.js';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const formatCurrency = (value, includeSign = true) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : (includeSign ? '+' : '');
    return `${sign}$${absValue.toFixed(2)}`;
};

const getEaIdentifier = (account) => {
    if (account.magicNumber) {
        return account.magicNumber.toString();
    }
    if (account.tradingRobotName) {
        const match = account.tradingRobotName.match(/\((\d+)\)$/);
        if (match && match[1]) {
            return match[1];
        }
        return account.tradingRobotName;
    }
    return null;
};

// --- Fungsi Pembantu Universal untuk Memproses Riwayat ---
const flattenHistory = (historyObject) => {
    const data = historyObject || {};
    let flatList = [];
    if (typeof data !== 'object' || data === null) {
        return flatList;
    }

    Object.values(data).forEach(accountHistory => {
        if (typeof accountHistory === 'object' && accountHistory !== null) {
            flatList.push(...Object.values(accountHistory));
        }
    });
    return flatList.filter(item => item !== null && typeof item === 'object');
};


// --- KOMPONEN BARU: Tombol Kembali ke Atas ---
const ScrollToTopButton = ({ scrollableRef }) => {
    const [isVisible, setIsVisible] = useState(false);

    const handleScroll = useCallback(() => {
        if (scrollableRef.current && scrollableRef.current.scrollTop > 300) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [scrollableRef]);

    const scrollToTop = () => {
        if (scrollableRef.current) {
            scrollableRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const scrollableElement = scrollableRef.current;
        if (scrollableElement) {
            scrollableElement.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (scrollableElement) {
                scrollableElement.removeEventListener('scroll', handleScroll);
            }
        };
    }, [scrollableRef, handleScroll]);

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-24 right-4 z-40 p-3 rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 hover:bg-blue-700 hover:scale-110 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}
            title="Kembali ke atas"
        >
            <ArrowUpCircle size={24} />
        </button>
    );
};


// --- KOMPONEN PEMBANTU ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Konfirmasi', confirmColorClass = 'bg-blue-600 hover:bg-blue-700' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    {onCancel && <button onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Batal</button>}
                    <button onClick={onConfirm} className={`bg-gradient-to-br ${confirmColorClass} text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-current/40`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const NotificationToast = ({ notification, onClose }) => {
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

const NotificationToastContainer = ({ notifications, removeNotification }) => (
    <div className="fixed bottom-20 right-4 z-50 w-80 space-y-3">
        {notifications.map(n => <NotificationToast key={n.id} notification={n} onClose={removeNotification} />)}
    </div>
);

const SummaryStat = ({ icon, title, value, colorClass = 'text-white', onClick, isActive }) => (
    <div
        onClick={onClick}
        className={`bg-slate-800/70 backdrop-blur-sm p-4 rounded-xl shadow-lg flex items-center space-x-4 border ${onClick ? 'cursor-pointer transition-all duration-300 hover:bg-slate-700/80' : ''} ${isActive ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-700'}`}>
        <div className="bg-slate-900/80 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
        </div>
    </div>
);

const SummaryDashboard = ({ accounts, activeFilter, setActiveFilter }) => {
    const summary = useMemo(() => {
        let totalPL = 0, profitableAccounts = 0, losingAccounts = 0, pendingOrdersCount = 0;
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

    const handleFilterClick = (filterName) => setActiveFilter(prevFilter => prevFilter === filterName ? 'all' : filterName);

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

const AccountCard = ({ account, onToggleRobot, onDelete, onCancelOrder, onCardClick, handleDragStart, handleDragEnter, handleDragEnd, index, isDragging, togglingRobotId }) => {
    const totalPL = useMemo(() => (account.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0), [account.positions]);
    const isProfitable = totalPL >= 0;

    const getGlowEffect = () => {
        if (account.status !== 'active') return 'shadow-slate-900/50';
        if (isProfitable && totalPL > 0) return 'shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)]';
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
                <div className="flex-shrink-0 flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-x-2 mb-1">
                            <h3 className="text-lg font-bold text-white">{account.accountName}</h3>
                            {account.platform && (
                                <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-md border border-slate-600">
                                    {account.platform}
                                </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onToggleRobot(account.accountId, account.robotStatus === 'on' ? 'off' : 'on'); }} title={`Robot ${account.robotStatus === 'on' ? 'ON' : 'OFF'}`} className="p-1 rounded-full hover:bg-slate-700 transition-colors w-7 h-7 flex items-center justify-center" disabled={togglingRobotId === account.accountId}>
                                {togglingRobotId === account.accountId ? <LoaderCircle size={18} className="animate-spin text-slate-400" /> : <Power size={18} className={`${account.robotStatus === 'on' ? 'text-green-500' : 'text-slate-500'} transition-colors`} />}
                            </button>
                        </div>
                        {account.tradingRobotName && <p className="text-xs text-cyan-400 -mt-1">{account.tradingRobotName}</p>}
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Balance</p>
                            <p className="text-lg font-bold text-cyan-400">{`$${(account.balance || 0).toFixed(2)}`}</p>
                        </div>
                        {totalActivities === 1 && singleItem && <div className="flex-shrink-0">{getTypePill(singleItem.executionType)}</div>}
                    </div>
                </div>
                <div className="border-t border-slate-700/80 my-3"></div>
                <div className="flex-1 flex flex-col min-h-0">
                    {account.status === 'inactive' && <div className="flex-1 flex items-center justify-center"><p className="text-slate-400 italic">Tidak ada order aktif</p></div>}
                    {account.status === 'active' && totalActivities === 1 && singleItem && (
                        <div className="flex-1 flex flex-col justify-between text-sm">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div><p className="text-slate-400 text-sm">Pair</p><p className="font-semibold text-lg">{singleItem.pair}</p></div>
                                <div><p className="text-slate-400 text-sm">Lot</p><p className="font-semibold text-lg">{singleItem.lotSize.toFixed(2)}</p></div>
                                <div><p className="text-slate-400 text-sm">{isSingleItemPending ? 'Harga Akan Eksekusi' : 'Harga Eksekusi'}</p><p className="font-semibold text-lg">{singleItem.entryPrice.toFixed(3)}</p></div>
                                <div><p className="text-slate-400 text-sm">Harga Sekarang</p><p className="font-semibold text-lg">{singleItem.currentPrice ? singleItem.currentPrice.toFixed(3) : '...'}</p></div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-700/80 flex justify-between items-center">
                                <p className="text-slate-300 text-base font-semibold">Status</p>
                                {isSingleItemPending ? (
                                    <div className="text-right flex items-center justify-end">
                                        <p className="text-lg font-bold text-yellow-400 flex items-center"><Clock size={16} className="mr-2"/> Pending</p>
                                        <button onClick={(e) => { e.stopPropagation(); onCancelOrder(account.accountId, singleItem.ticket); }} title="Batalkan Order" className="ml-2 text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-700"><X size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="text-right"><p className={`text-2xl font-bold ${singleItem.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(singleItem.profit)}</p></div>
                                )}
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
                                        <button onClick={(e) => { e.stopPropagation(); onCancelOrder(account.accountId, ord.ticket); }} title="Batalkan Order" className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-700/80"><X size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(account.accountId, account.accountName); }} title="Hapus Akun" className="absolute bottom-3 left-3 p-1 rounded-full text-slate-600 hover:bg-slate-900/50 hover:text-red-500 transition-all duration-200 opacity-50 hover:opacity-100">
                <Trash2 size={16} />
            </button>
        </div>
    );
};

const HistoryPage = ({ accounts, tradeHistory, activityLogs, addNotification, historyResetTimestamp, onResetRequest }) => {
    const accountSummary = useMemo(() => {
        let relevantHistory = flattenHistory(tradeHistory);
        // --- PERBAIKAN: Filter yang lebih fleksibel ---
        relevantHistory = relevantHistory.filter(trade => trade && trade.type !== 'balance');

        if (historyResetTimestamp) {
            relevantHistory = relevantHistory.filter(trade => {
                if (!trade || typeof trade.closeDate !== 'string') return false;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return !isNaN(tradeDate) && tradeDate > historyResetTimestamp;
            });
        }

        return accounts.map(account => {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const startOfWeek = new Date(today.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);

            const weeklyTrades = relevantHistory.filter(trade => {
                if (trade.accountName !== account.accountName) return false;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return !isNaN(tradeDate) && tradeDate >= startOfWeek;
            });

            const totalPL = weeklyTrades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
            
            const currentBalance = account.balance || 0;
            const percentagePL = currentBalance > 0 ? (totalPL / currentBalance) * 100 : 0;

            return { 
                id: account.id, 
                name: account.accountName, 
                robotName: account.tradingRobotName || 'N/A',
                totalOrders: weeklyTrades.length, 
                totalPL: totalPL, 
                percentagePL: percentagePL, 
                status: account.status 
            };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [accounts, tradeHistory, historyResetTimestamp]);

    const handleDownload = (period) => {
        const allHistory = flattenHistory(tradeHistory);
        const allActivityLogs = flattenHistory(activityLogs);
        
        // --- PERBAIKAN: Filter yang lebih fleksibel ---
        const allTrades = allHistory.filter(trade => trade && trade.type !== 'balance');
        
        let periodHistory, tableData, periodLabel, summaryTitle, alertMessage;

        if (period === 'weekly') {
            periodLabel = 'Mingguan';
            summaryTitle = 'Ringkasan Global (Minggu Ini)';
            alertMessage = 'Tidak ada data mingguan untuk diunduh.';
            
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const startOfWeek = new Date(today.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);
            
            periodHistory = allTrades.filter(trade => new Date(trade.closeDate.replace(/\./g, '-')) >= startOfWeek);
            const periodActivity = allActivityLogs.filter(log => log.timestamp >= startOfWeek.getTime());

            tableData = accounts.map((account, index) => {
                const weeklyTrades = periodHistory.filter(trade => trade.accountName === account.accountName);
                const totalPL = weeklyTrades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
                const totalTrades = weeklyTrades.length;
                const currentBalance = account.balance || 0;
                const percentagePL = currentBalance > 0 ? (totalPL / currentBalance) * 100 : 0;
                
                const magicNumber = parseInt(getEaIdentifier(account));
                const robotLogs = periodActivity.filter(log => log.magicNumber === magicNumber && log.accountId === account.accountId);
                let activeHours = 0;
                let tradeRatio = 0;

                if (robotLogs.length > 1) {
                    const timestamps = robotLogs.map(log => log.timestamp).sort((a,b) => a - b);
                    const durationInMillis = timestamps[timestamps.length - 1] - timestamps[0];
                    activeHours = durationInMillis / (1000 * 60 * 60);
                    if (activeHours > 0) {
                        tradeRatio = totalTrades / activeHours;
                    }
                }

                return {
                    'No.': index + 1,
                    'Periode': 'Minggu Ini (Sejak Senin)',
                    'Nama Akun': account.accountName,
                    'Nama Robot/EA': account.tradingRobotName || 'N/A',
                    'Est. Jam Aktif (jam)': activeHours.toFixed(2),
                    'Rasio Trade/Jam': tradeRatio.toFixed(2),
                    'Total Transaksi': totalTrades,
                    'Total P/L': totalPL,
                    'Presentase (%)': percentagePL,
                    'Status': account.status === 'active' ? 'Floating' : 'Clear'
                };
            });

        } else {
            periodLabel = 'Bulanan';
            summaryTitle = 'Ringkasan Global (30 Hari Terakhir)';
            alertMessage = 'Tidak ada data riwayat dalam 30 hari terakhir untuk diunduh.';

            const oneMonthAgo = new Date();
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            periodHistory = allTrades.filter(trade => new Date(trade.closeDate.replace(/\./g, '-')) >= oneMonthAgo);
            
            const periodActivity = allActivityLogs.filter(log => log.timestamp >= oneMonthAgo.getTime());

            const historyMap = periodHistory.reduce((acc, trade) => {
                const accountName = trade.accountName;
                if (!acc[accountName]) acc[accountName] = [];
                acc[accountName].push(trade);
                return acc;
            }, {});

            tableData = accounts.map((account, index) => {
                const trades = historyMap[account.accountName] || [];
                const totalPL = trades.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
                const totalTrades = trades.length;
                const currentBalance = account.balance || 0;
                const percentagePL = currentBalance > 0 ? (totalPL / currentBalance) * 100 : 0;
                
                const magicNumber = parseInt(getEaIdentifier(account));
                const robotLogs = periodActivity.filter(log => log.magicNumber === magicNumber && log.accountId === account.accountId);
                let activeHours = 0;
                let tradeRatio = 0;

                if (robotLogs.length > 1) {
                    const timestamps = robotLogs.map(log => log.timestamp).sort((a,b) => a - b);
                    const durationInMillis = timestamps[timestamps.length - 1] - timestamps[0];
                    activeHours = durationInMillis / (1000 * 60 * 60);
                    if (activeHours > 0) {
                        tradeRatio = totalTrades / activeHours;
                    }
                }

                return {
                    'No.': index + 1,
                    'Periode': new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
                    'Nama Akun': account.accountName,
                    'Nama Robot/EA': account.tradingRobotName || 'N/A',
                    'Est. Jam Aktif (jam)': activeHours.toFixed(2),
                    'Rasio Trade/Jam': tradeRatio.toFixed(2),
                    'Total trade': totalTrades,
                    'Total Profit/Loss': totalPL,
                    'Presentase (%)': percentagePL
                };
            });
        }

        if (tableData.every(row => (row['Total Transaksi'] === 0 || row['Total trade'] === 0))) {
            alert(alertMessage);
            return;
        }

        const totalPLGlobal = periodHistory.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
        const totalTradesGlobal = periodHistory.length;
        const winningTrades = periodHistory.filter(trade => (parseFloat(trade.pl) || 0) > 0).length;
        const winRate = totalTradesGlobal > 0 ? (winningTrades / totalTradesGlobal) * 100 : 0;

        const summaryData = [
            { "Statistik": summaryTitle, "Nilai": "" },
            { "Statistik": "Total Profit/Loss", "Nilai": totalPLGlobal },
            { "Statistik": "Total Transaksi", "Nilai": totalTradesGlobal },
            { "Statistik": "Win Rate", "Nilai": winRate }
        ];

        const worksheet = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
        XLSX.utils.sheet_add_json(worksheet, tableData, { origin: 'A5' });
        worksheet[XLSX.utils.encode_cell({c: 1, r: 1})].z = '$#,##0.00';
        worksheet[XLSX.utils.encode_cell({c: 1, r: 3})].z = '0.00"%"';

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = 4; R <= range.e.r; ++R) {
            const plColIndex = period === 'weekly' ? 7 : 7;
            const pctColIndex = period === 'weekly' ? 8 : 8;
            
            const plCellRef = XLSX.utils.encode_cell({c: plColIndex, r: R});
            if(worksheet[plCellRef]) worksheet[plCellRef].z = '$#,##0.00';
            
            const pctCellRef = XLSX.utils.encode_cell({c: pctColIndex, r: R});
            if(worksheet[pctCellRef]) worksheet[pctCellRef].z = '0.00"%"';
        }

        const colWidths = period === 'weekly'
            ? [{ wch: 5 }, { wch: 22 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }]
            : [{ wch: 5 }, { wch: 22 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Ringkasan ${periodLabel}`);
        XLSX.writeFile(workbook, `Ringkasan_Trading_${periodLabel}.xlsx`);
    };

    const handleReset = () => onResetRequest();

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">Riwayat Kinerja Akun (Minggu Ini)</h2>
            <div className="mb-6 flex flex-wrap gap-4">
                <button onClick={() => handleDownload('weekly')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105"><span>Unduh Mingguan (.xlsx)</span></button>
                <button onClick={() => handleDownload('monthly')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105"><span>Unduh Bulanan (.xlsx)</span></button>
                <button onClick={handleReset} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-transform duration-200 hover:scale-105"><span>Reset Tampilan</span></button>
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
                                <td className={`px-6 py-4 font-semibold text-right ${summary.totalPL > 0 ? 'text-green-500' : summary.totalPL < 0 ? 'text-red-500' : 'text-slate-300'}`}>{formatCurrency(summary.totalPL)}</td>
                                <td className={`px-6 py-4 font-semibold text-right ${summary.percentagePL > 0 ? 'text-green-500' : summary.percentagePL < 0 ? 'text-red-500' : 'text-slate-300'}`}>{(summary.percentagePL || 0).toFixed(2)}%</td>
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
        if (!tradeHistory || !accounts.length) return { totalPL: 0, totalTrades: 0, winRate: 0 };
        
        let allHistory = flattenHistory(tradeHistory);
        // --- PERBAIKAN: Filter yang lebih fleksibel ---
        allHistory = allHistory.filter(trade => trade && trade.type !== 'balance');

        if (historyResetTimestamp) {
            allHistory = allHistory.filter(trade => {
                if (!trade || typeof trade.closeDate !== 'string') return false;
                const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
                return !isNaN(tradeDate) && tradeDate > historyResetTimestamp;
            });
        }
        
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        let totalPL = 0, totalTrades = 0, winningTrades = 0;
        
        allHistory.forEach(trade => {
            if (!trade || typeof trade.closeDate !== 'string') return;
            const tradeDate = new Date(trade.closeDate.replace(/\./g, '-'));
            
            if (!isNaN(tradeDate) && tradeDate >= startOfWeek) {
                const profit = parseFloat(trade.pl) || 0;
                totalPL += profit;
                totalTrades++;
                if (profit > 0) winningTrades++;
            }
        });
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        return { totalPL, totalTrades, winRate };
    }, [accounts, tradeHistory, historyResetTimestamp]);

    return (
        <div className="mb-8 p-6 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Ringkasan Global (Minggu Ini)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-sm text-slate-400">Total P/L</p>
                    <p className={`text-3xl font-bold font-mono ${weeklySummary.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(weeklySummary.totalPL, false)}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">Total Transaksi</p>
                    <p className="text-3xl font-bold font-mono text-white">{weeklySummary.totalTrades}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">Win Rate</p>
                    <p className="text-3xl font-bold font-mono text-blue-400">{weeklySummary.winRate.toFixed(2)}%</p>
                </div>
            </div>
        </div>
    );
};

const AccountDetailModal = ({ isOpen, onClose, account, tradeHistory }) => {
    const accountHistory = useMemo(() => {
        if (!isOpen || !account || !tradeHistory) return [];
        
        let allHistory = flattenHistory(tradeHistory);
        // --- PERBAIKAN: Filter yang lebih fleksibel ---
        allHistory = allHistory.filter(trade => trade && trade.type !== 'balance');

        return allHistory.filter(trade => 
            trade && 
            trade.accountName === account.accountName
        ).sort((a, b) => new Date(b.closeDate.replace(/\./g, '-')) - new Date(a.closeDate.replace(/\./g, '-')));
    }, [isOpen, account, tradeHistory]);

    const chartData = useMemo(() => {
        if (accountHistory.length === 0) return [];
        const sortedHistory = [...accountHistory].sort((a, b) => new Date(a.closeDate.replace(/\./g, '-')) - new Date(b.closeDate.replace(/\./g, '-')));
        
        const totalClosedPL = sortedHistory.reduce((sum, trade) => sum + (parseFloat(trade.pl) || 0), 0);
        
        const startingBalance = (account.balance || 0) - totalClosedPL;
        let currentBalance = startingBalance;
        const processedData = sortedHistory.map((trade, index) => {
            currentBalance += parseFloat(trade.pl) || 0;
            return { name: `Trade ${index + 1}`, profit: parseFloat(trade.pl), balance: currentBalance };
        });
        return [{name: 'Start', balance: startingBalance}, ...processedData];
    }, [accountHistory, account]);

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-3xl mx-4 shadow-2xl shadow-black/40 border border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white">Detail Akun: {account.accountName}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full p-2 transition-colors"><X size={24} /></button>
                </div>
                <div className="mb-6 h-64 bg-slate-900/50 rounded-lg p-4">
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toFixed(0)}`} domain={['dataMin - 100', 'dataMax + 100']} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ fontWeight: 'bold' }} formatter={(value) => `$${value.toFixed(2)}`} />
                                <Area type="monotone" dataKey="balance" stroke="#22c55e" fillOpacity={1} fill="url(#colorBalance)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : ( <div className="flex items-center justify-center h-full"><p className="text-center text-slate-500">Data tidak cukup untuk menampilkan grafik.</p></div> )}
                </div>
                <h4 className="text-lg font-semibold text-white mb-3">Riwayat Transaksi Terakhir</h4>
                <div className="max-h-64 overflow-y-auto custom-scrollbar pr-2 bg-slate-900/50 rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Nama Robot</th>
                                <th scope="col" className="px-4 py-3 text-right">P/L</th>
                                <th scope="col" className="px-4 py-3">Tanggal Tutup</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accountHistory.length > 0 ? accountHistory.map(trade => (
                                <tr key={trade.ticket} className="border-b border-slate-700">
                                    <td className="px-4 py-3 font-medium">{account.tradingRobotName || 'N/A'}</td>
                                    <td className={`px-4 py-3 font-semibold text-right ${parseFloat(trade.pl) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(parseFloat(trade.pl))}</td>
                                    <td className="px-4 py-3 text-slate-400">{trade.closeDate}</td>
                                </tr>
                            )) : ( <tr><td colSpan="3" className="text-center py-8 text-slate-500 italic">Tidak ada riwayat transaksi.</td></tr> )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// --- KOMPONEN UTAMA APP ---
export default function App() {
    const [accountsData, setAccountsData] = useState({});
    const [accountOrder, setAccountOrder] = useState([]);
    const [tradeHistory, setTradeHistory] = useState({});
    const [activityLogs, setActivityLogs] = useState({});
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
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [togglingRobotId, setTogglingRobotId] = useState(null);
    const [showEaDeleteInfo, setShowEaDeleteInfo] = useState({ isOpen: false, eaName: '', eaId: null });
    
    const mainContentRef = useRef(null);
    const scrollPositions = useRef({ dashboard: 0, history: 0, 'ea-overview': 0 });

    const handlePageChange = (newPage) => {
        if (mainContentRef.current) {
            scrollPositions.current[page] = mainContentRef.current.scrollTop;
        }
        setPage(newPage);
    };

    useLayoutEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = scrollPositions.current[page] || 0;
        }
    }, [page]);

    const addNotification = (title, message, type) => setNotifications(prev => [{ id: Date.now(), title, message, type }, ...prev].slice(0, 5));
    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);
    const speak = useCallback((text) => {
        if (!isSoundEnabled || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        window.speechSynthesis.speak(utterance);
    }, [isSoundEnabled]);
    const showNotification = useCallback((title, options) => {
        if (!isNotifEnabled || !("Notification" in window) || notifPermission !== "granted") return;
        new Notification(title, options);
    }, [isNotifEnabled, notifPermission]);
    const handleConfirmReset = () => {
        setHistoryResetTimestamp(new Date());
        addNotification('Sukses', 'Tampilan riwayat telah direset.', 'take_profit_profit');
        setShowResetConfirm(false);
    };
    const handleNotifToggle = () => {
        if (!("Notification" in window)) return alert("Browser ini tidak mendukung notifikasi desktop.");
        if (notifPermission === 'granted') setIsNotifEnabled(!isNotifEnabled);
        else if (notifPermission === 'denied') alert("Anda telah memblokir notifikasi. Mohon aktifkan melalui pengaturan browser.");
        else {
            window.Notification.requestPermission().then(permission => {
                setNotifPermission(permission);
                if (permission === 'granted') {
                    setIsNotifEnabled(true);
                    addNotification('Sukses', 'Notifikasi berhasil diaktifkan.', 'take_profit_profit');
                }
            });
        }
    };
    const handleCancelOrder = async (accountId, ticket) => {
        const originalAccountsData = { ...accountsData };
        try {
            setAccountsData(prev => {
                const newAccountsData = JSON.parse(JSON.stringify(prev));
                if(newAccountsData[accountId] && newAccountsData[accountId].orders) {
                    newAccountsData[accountId].orders = newAccountsData[accountId].orders.filter(ord => ord.ticket !== ticket);
                }
                return newAccountsData;
            });
            await fetch('/api/cancel-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, ticket }) });
            addNotification('Info', `Perintah pembatalan order #${ticket} telah dikirim.`, 'default');
        } catch (error) { 
            addNotification('Error', 'Gagal mengirim perintah pembatalan.', 'take_profit_loss');
            setAccountsData(originalAccountsData);
        }
    };
    const handleToggleRobot = async (accountId, newStatus) => {
        const originalAccountsData = { ...accountsData };
        setTogglingRobotId(accountId);
        try {
            setAccountsData(prev => {
                const newAccountsData = JSON.parse(JSON.stringify(prev));
                if(newAccountsData[accountId]) {
                    newAccountsData[accountId].robotStatus = newStatus;
                }
                return newAccountsData;
            });
            await fetch('/api/robot-toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, newStatus }) });
        } catch (error) {
            addNotification('Error', 'Gagal mengirim perintah ke server.', 'take_profit_loss');
            setAccountsData(originalAccountsData);
        } finally {
            setTimeout(() => {
                setTogglingRobotId(null);
            }, 500);
        }
    };
    const openDeleteModal = (accountId, accountName) => setDeleteModal({ isOpen: true, accountId, accountName });
    const closeDeleteModal = () => setDeleteModal({ isOpen: false, accountId: null, accountName: '' });
    const handleDeleteAccount = async () => {
        const { accountId, accountName } = deleteModal;
        if (!accountId) { closeDeleteModal(); return; }
        try {
            await fetch('/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }) });
            addNotification('Sukses', `Akun ${accountName} telah dihapus.`, 'take_profit_profit');
        } catch (error) {
            addNotification('Error', 'Gagal menghapus akun. Mohon refresh halaman.', 'take_profit_loss');
        } finally {
            closeDeleteModal();
        }
    };
    const handleDragStart = (e, pos) => { dragItem.current = pos; setDragging(true); };
    const handleDragEnter = (e, pos) => { dragOverItem.current = pos; };
    const handleDragEnd = async () => {
        if (dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            setDragging(false); dragItem.current = null; dragOverItem.current = null; return;
        }
        const reorderedAccounts = [...accounts];
        const dragItemContent = reorderedAccounts[dragItem.current];
        reorderedAccounts.splice(dragItem.current, 1);
        reorderedAccounts.splice(dragOverItem.current, 0, dragItemContent);
        const newOrderIds = reorderedAccounts.map(acc => acc.id);
        setAccountOrder(newOrderIds);
        dragItem.current = null; dragOverItem.current = null; setDragging(false);
        try {
            await fetch('/api/save-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: newOrderIds }) });
            addNotification('Sukses', 'Urutan kartu telah disimpan.', 'take_profit_profit');
        } catch (error) { addNotification('Error', 'Gagal menyimpan urutan kartu.', 'take_profit_loss'); }
    };
    const openDetailModal = (account) => setDetailModal({ isOpen: true, account: account });
    const closeDetailModal = () => setDetailModal({ isOpen: false, account: null });
    const openEaDeleteInfoModal = (eaName, eaId) => setShowEaDeleteInfo({ isOpen: true, eaName, eaId });
    const closeEaDeleteInfoModal = () => setShowEaDeleteInfo({ isOpen: false, eaName: '', eaId: null });

    useEffect(() => {
        const accountsRef = ref(db, 'accounts/');
        const historyRef = ref(db, 'trade_history/');
        const orderRef = ref(db, 'dashboard_config/accountOrder');
        const activityRef = ref(db, 'robot_activity_logs/');

        const unsubscribeAccounts = onValue(accountsRef, (snapshot) => {
            const data = snapshot.val() || {};
            if(initialLoadComplete.current) {
                Object.values(data).forEach(acc => {
                    const prevAllTickets = new Set(prevPositionsRef.current[acc.accountId] || []);
                    const currentAllItems = [...(acc.positions || []), ...(acc.orders || [])];
                    currentAllItems.forEach(item => {
                        if (!prevAllTickets.has(item.ticket)) {
                            const type = item.executionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            const byEA = acc.tradingRobotName ? ` oleh ${acc.tradingRobotName}` : '';
                            const message = `${type} pada Akun ${acc.accountName}${byEA} pada harga ${item.entryPrice.toFixed(4)}`;
                            showNotification(`Aktivitas Baru: ${item.pair}`, { body: message, icon: '/logo192.png' });
                            speak(message);
                        }
                    });
                });
            }
            const newPositions = {};
            Object.values(data).forEach(acc => {
                newPositions[acc.accountId] = [...(acc.positions || []).map(p => p.ticket), ...(acc.orders || []).map(o => o.ticket)];
            });
            prevPositionsRef.current = newPositions;
            if(!initialLoadComplete.current) initialLoadComplete.current = true;
            setAccountsData(data);
        });
        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            setTradeHistory(snapshot.val() || {});
        });
        const unsubscribeOrder = onValue(orderRef, (snapshot) => {
            setAccountOrder(snapshot.val() || []);
        });
        const unsubscribeActivity = onValue(activityRef, (snapshot) => {
            setActivityLogs(snapshot.val() || {});
        });

        return () => { 
            unsubscribeAccounts(); 
            unsubscribeHistory(); 
            unsubscribeOrder();
            unsubscribeActivity();
        };
    }, [speak, showNotification]);

    const accounts = useMemo(() => {
        const allAccounts = Object.values(accountsData);
        if (accountOrder && accountOrder.length > 0) {
            const accountMap = new Map(allAccounts.map(acc => [String(acc.id), acc]));
            const orderedIdSet = new Set(accountOrder.map(id => String(id)));
            const orderedList = accountOrder.map(id => accountMap.get(String(id))).filter(Boolean);
            const unorderedList = allAccounts.filter(acc => !orderedIdSet.has(String(acc.id))).sort((a, b) => a.accountName.localeCompare(b.accountName));
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
                    case 'active': return account.status === 'active';
                    case 'profit': return account.status === 'active' && accountPL > 0;
                    case 'loss': return account.status === 'active' && accountPL < 0;
                    case 'pending': return (account.orders || []).length > 0;
                    default: return true;
                }
            });
        }
        if (!searchTerm) return filtered;
        return filtered.filter(account => account.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [accounts, searchTerm, activeFilter]);

    const eaOverviewData = useMemo(() => {
        const eaMap = new Map();
        
        let allHistory = flattenHistory(tradeHistory);

        Object.values(accountsData).forEach(acc => {
            const eaIdentifier = getEaIdentifier(acc);
            if (eaIdentifier && eaIdentifier !== "0" && acc.tradingRobotName !== "Tidak Ada EA Aktif") {
                if (!eaMap.has(eaIdentifier)) {
                    eaMap.set(eaIdentifier, {
                        eaId: eaIdentifier,
                        eaName: acc.tradingRobotName,
                        accounts: [],
                        totalFloatingPL: 0,
                        totalEquity: 0,
                        history: []
                    });
                }
                const ea = eaMap.get(eaIdentifier);
                if (!ea.eaName.includes("(") && acc.tradingRobotName.includes("(")) {
                    ea.eaName = acc.tradingRobotName;
                }
                ea.accounts.push(acc);
                ea.totalFloatingPL += (acc.positions || []).reduce((sum, pos) => sum + (parseFloat(pos.profit) || 0), 0);
                ea.totalEquity += (acc.balance || 0);
            }
        });
        
        allHistory.forEach(trade => {
            const account = Object.values(accountsData).find(acc => acc.accountName === trade.accountName);
            if (account) {
                const eaIdentifier = getEaIdentifier(account);
                if (eaIdentifier && eaMap.has(eaIdentifier)) {
                    eaMap.get(eaIdentifier).history.push(trade);
                }
            }
        });
        
        return Array.from(eaMap.values()).map(ea => {
            const eaTradingHistory = ea.history.filter(t => t.type === 'trade');
            const totalTrades = eaTradingHistory.length;
            const winningTrades = eaTradingHistory.filter(t => parseFloat(t.pl) > 0).length;
            const losingTrades = eaTradingHistory.filter(t => parseFloat(t.pl) < 0);
            const totalClosedPL = eaTradingHistory.reduce((sum, t) => sum + (parseFloat(t.pl) || 0), 0);
            
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyTrades = eaTradingHistory.filter(t => new Date(t.closeDate.replace(/\./g, '-')) > oneWeekAgo).length;
            
            return {
                ...ea,
                totalClosedPL,
                winrate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
                avgDrawdown: losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.pl), 0) / losingTrades.length) : 0,
                weeklyTradeRatio: weeklyTrades
            };
        });
    }, [accountsData, tradeHistory]);

    return (
        <div className="bg-slate-900 text-white font-sans h-screen flex flex-col overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Inter:wght@400;700;900&display=swap');
                body { font-family: 'Inter', sans-serif; background-color: #020617; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }
                .font-mono { font-family: 'Roboto Mono', monospace; }
            `}</style>
            
            <InfoBanner />

            <div ref={mainContentRef} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        <header className="mb-8 flex flex-wrap justify-between items-center gap-4">
                            {page !== 'ea-overview' ? (
                                <div>
                                    <h1 className="text-3xl font-bold text-white">MJA Monitoring</h1>
                                    <p className="text-slate-400 mt-1">Ringkasan global dan status akun individual.</p>
                                </div>
                            ) : <div />}
                            <div className="flex items-center gap-3">
                                <button onClick={handleNotifToggle} title="Notifikasi Browser" className={`p-2 rounded-lg transition-all duration-300 ${isNotifEnabled && notifPermission === 'granted' ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}><BellRing size={20} /></button>
                                <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} title="Pemberitahuan Suara" className={`p-2 rounded-lg transition-all duration-300 ${isSoundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
                            </div>
                        </header>
                        
                        <main>
                            <div style={{ display: page === 'dashboard' ? 'block' : 'none' }}>
                                <div className="mb-8 relative">
                                    <input type="text" placeholder="Cari nama akun atau nama EA..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-12 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                </div>
                                <SummaryDashboard accounts={accounts} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {filteredAccounts.map((account, index) => (
                                        <AccountCard key={account.id} account={account} onToggleRobot={handleToggleRobot} onDelete={openDeleteModal} onCancelOrder={handleCancelOrder} onCardClick={openDetailModal} index={index} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDragEnd={handleDragEnd} isDragging={dragging && dragItem.current === index} togglingRobotId={togglingRobotId} />
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: page === 'history' ? 'block' : 'none' }}>
                                <GlobalSummary accounts={accounts} tradeHistory={tradeHistory} historyResetTimestamp={historyResetTimestamp} />
                                <HistoryPage 
                                    accounts={accounts} 
                                    tradeHistory={tradeHistory} 
                                    activityLogs={activityLogs} 
                                    addNotification={addNotification} 
                                    historyResetTimestamp={historyResetTimestamp} 
                                    onResetRequest={() => setShowResetConfirm(true)} 
                                />
                            </div>

                            <div style={{ display: page === 'ea-overview' ? 'block' : 'none' }}>
                                <EAOverviewPage eaData={eaOverviewData} onDeleteEa={openEaDeleteInfoModal} />
                            </div>
                        </main>
                        
                        <div className="h-24" />
                    </div>
                </div>
            </div>
            
            <BottomNav activePage={page} setPage={handlePageChange} />
            <ScrollToTopButton scrollableRef={mainContentRef} />

            <NotificationToastContainer notifications={notifications} removeNotification={removeNotification} />
            <ConfirmationModal isOpen={deleteModal.isOpen} title="Konfirmasi Penghapusan" message={`Apakah Anda yakin ingin menghapus akun "${deleteModal.accountName}"? Tindakan ini akan menghapus data dari dasbor. Anda juga harus mematikan EA di akun ini agar tidak muncul kembali.`} onConfirm={handleDeleteAccount} onCancel={closeDeleteModal} confirmColorClass="from-red-500 to-orange-600" />
            <ConfirmationModal isOpen={showResetConfirm} title="Konfirmasi Reset Tampilan" message="Apakah Anda yakin ingin mereset tampilan riwayat? Ini hanya akan menampilkan data baru yang masuk setelah ini." onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirm(false)} confirmText="Ya, Reset" confirmColorClass="from-sky-500 to-blue-600" />
            <ConfirmationModal
                isOpen={showEaDeleteInfo.isOpen}
                title={`Cara Menghapus Robot "${showEaDeleteInfo.eaName}"`}
                message={`Untuk menghapus robot dengan Magic Number (${showEaDeleteInfo.eaId}) ini, Anda harus menghentikan atau menghapus EA dari semua akun yang menggunakannya di terminal MetaTrader Anda. Dasbor akan diperbarui secara otomatis.`}
                onConfirm={closeEaDeleteInfoModal}
                onCancel={null}
                confirmText="Mengerti"
                confirmColorClass="bg-blue-600 hover:bg-blue-700"
            />
            <AccountDetailModal isOpen={detailModal.isOpen} onClose={closeDetailModal} account={detailModal.account} tradeHistory={tradeHistory} />
        </div>
    );
}
