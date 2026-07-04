
import React, { useState, useEffect } from 'react';
import { InventoryItem, SavedReport } from '../types';
import { generateBillItemsFromReport } from '../services/billingService';

const ProfitLossScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [reports, setReports] = useState<SavedReport[]>([]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        const inv = localStorage.getItem('labInventory');
        const hist = localStorage.getItem('reportHistory');
        if (inv) setInventory(JSON.parse(inv));
        if (hist) setReports(JSON.parse(hist));
    }, []);

    const calculateEconomics = () => {
        let totalRevenue = 0;
        let totalStockValue = 0;
        
        // Filter reports by date AND exclude deleted ones
        const filteredReports = reports.filter(r => {
            if (r.isDeleted || !r.reportData) return false; // Exclude deleted or incomplete reports
            
            if (!startDate && !endDate) return true;
            const reportDate = new Date(r.reportData.date);
            // Fix comparison to include the end date fully
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end = endDate ? new Date(endDate) : new Date();
            end.setHours(23, 59, 59, 999); 
            
            return reportDate >= start && reportDate <= end;
        });

        // Revenue from filtered reports
        filteredReports.forEach(r => {
            if (r.billData) {
                totalRevenue += r.billData.total;
            } else {
                // Fallback: Calculate revenue based on performed tests if bill wasn't explicitly generated
                const items = generateBillItemsFromReport(r.selectedTests, r.reportData);
                totalRevenue += items.reduce((sum, item) => sum + item.price, 0);
            }
        });

        // Current Stock Value (Always calculated from current inventory state)
        inventory.forEach(i => {
            totalStockValue += i.totalPrice;
        });
        
        return { totalRevenue, totalStockValue, count: filteredReports.length };
    };

    const data = calculateEconomics();
    
    // Reorder Logic
    const reorderItems = inventory.filter(i => {
        // Simple logic: If category is kit and remaining tests < 10
        if (i.category === 'finecare_machine' || i.name.includes('Kit')) return i.remainingTests < 5;
        // If consumables < 5 units
        if (i.category === 'routine_consumable') return i.quantity < 5;
        return false;
    });

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Profit & Loss / Stock Alerts</h2>
                <button onClick={onBack} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded">Back</button>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex gap-4 items-end">
                <div>
                    <label className="block text-sm text-slate-500">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800" />
                </div>
                <div>
                    <label className="block text-sm text-slate-500">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-6 rounded-lg border border-green-200 shadow-sm">
                     <h3 className="text-xl font-bold text-green-700">Revenue (Selected Period)</h3>
                     <p className="text-4xl font-bold text-slate-900 mt-2">₹ {data.totalRevenue.toFixed(2)}</p>
                     <p className="text-sm text-green-600 mt-1">From {data.count} active reports</p>
                </div>
                 <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 shadow-sm">
                     <h3 className="text-xl font-bold text-yellow-700">Total Stock Value</h3>
                     <p className="text-4xl font-bold text-slate-900 mt-2">₹ {data.totalStockValue.toFixed(2)}</p>
                     <p className="text-sm text-yellow-600 mt-1">Current Inventory Asset</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-red-600 mb-4 border-b border-slate-200 pb-2">⚠️ Re-order Alerts (Stock Low)</h3>
                {reorderItems.length === 0 ? (
                    <p className="text-slate-500">Stock levels are healthy.</p>
                ) : (
                    <table className="w-full text-sm text-left text-slate-700">
                        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-4 py-2">Item</th>
                                <th className="px-4 py-2">Category</th>
                                <th className="px-4 py-2">Remaining</th>
                            </tr>
                        </thead>
                         <tbody>
                            {reorderItems.map(item => (
                                <tr key={item.id} className="border-b border-slate-100 bg-red-50">
                                    <td className="px-4 py-2 font-medium">{item.name}</td>
                                    <td className="px-4 py-2">{item.category}</td>
                                    <td className="px-4 py-2 text-red-600 font-bold">{item.remainingTests}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ProfitLossScreen;
