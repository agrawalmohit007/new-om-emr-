
import React, { useState, useEffect } from 'react';
import { SavedReport, InventoryItem, HormoneReportSelection, UserRole } from '../types';

interface StatisticsScreenProps {
  onBack: () => void;
  userRole: UserRole;
}

const StatisticsScreen: React.FC<StatisticsScreenProps> = ({ onBack, userRole }) => {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Date state for filtering which ORDERS to show (optional, default to all)
  const [inputStartDate, setInputStartDate] = useState<string>('');
  const [inputEndDate, setInputEndDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('cloud-data-sync', handleSync);
    return () => window.removeEventListener('cloud-data-sync', handleSync);
  }, []);

  const loadData = () => {
    const historyJson = localStorage.getItem('reportHistory');
    const inventoryJson = localStorage.getItem('labInventory');
    if (historyJson) setReports(JSON.parse(historyJson));
    if (inventoryJson) setInventory(JSON.parse(inventoryJson));
  };

  const handleApplyFilter = () => {
    setFilterStartDate(inputStartDate);
    setFilterEndDate(inputEndDate);
  };

  // Helper to count tests based on keywords and date range
  const countTestsInRange = (keywords: string[], startDate: Date, endDate: Date, category: string) => {
    return reports.filter(r => {
        if (r.isDeleted || !r.reportData) return false;
        const rDate = new Date(r.reportData.date);
        // Normalize time
        rDate.setHours(12, 0, 0, 0); 
        
        // Strict window: [InstallDate, NextInstallDate)
        if (rDate < startDate || rDate >= endDate) return false;

        // Match Logic
        const upperKeywords = keywords.map(k => k.toUpperCase());
        
        if (category === 'cbc') {
             // For CBC/Lyse/Diluent, we count CBC reports
             return r.selectedTests.cbc;
        }

        if (category === 'blood_group') {
             return r.selectedTests.other && (r.reportData.otherTests.bloodGroup || r.reportData.otherTests.rhType);
        }
        
        // Reagents - Fixed strict equality check to includes()
        if (upperKeywords.some(k => k.includes('HIV'))) {
             return r.selectedTests.serology && r.reportData.serology.selection.hiv;
        }
        if (upperKeywords.some(k => k.includes('HBSAG'))) {
             return r.selectedTests.serology && r.reportData.serology.selection.hbsag;
        }
        if (upperKeywords.some(k => k.includes('VDRL'))) {
             return r.selectedTests.serology && r.reportData.serology.selection.vdrl;
        }
        if (upperKeywords.some(k => k.includes('BSL'))) {
             return r.selectedTests.other && !!r.reportData.otherTests.randomBloodSugar;
        }
        if (upperKeywords.some(k => k.includes('URINE'))) {
             return r.selectedTests.urine;
        }

        // Fincare
        if (category === 'fincare') {
             const hormoneMatchKey = Object.keys(r.reportData.hormoneReport.selection).find(k => 
                upperKeywords.some(keyword => keyword.includes(k.toUpperCase()))
             );
             if (hormoneMatchKey && r.selectedTests.hormone) {
                return r.reportData.hormoneReport.selection[hormoneMatchKey as keyof HormoneReportSelection];
             }
        }

        return false;
    }).length;
  };

  const processInventoryStats = () => {
    // 1. Group items by exact name (TRIMMED and UPPERCASED) to prevent duplicates in grouping
    const grouped: Record<string, InventoryItem[]> = {};
    inventory.forEach(item => {
        const key = item.name.trim().toUpperCase();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    // 2. Process each group
    let processedItems: any[] = [];

    Object.values(grouped).forEach(group => {
        // Sort by installation date (preferred) or order date ascending
        group.sort((a, b) => {
            const d1 = new Date(a.installationDate || a.orderDate).getTime();
            const d2 = new Date(b.installationDate || b.orderDate).getTime();
            return d1 - d2;
        });

        group.forEach((item, index) => {
            const startDateStr = item.installationDate || item.orderDate;
            const startDate = new Date(startDateStr);
            startDate.setHours(0,0,0,0);
            
            // Determine end date (Next Install Date or Today/Future)
            let endDate = new Date(); // Default to now/future
            endDate.setHours(23, 59, 59, 999);

            if (index < group.length - 1) {
                const next = group[index + 1];
                const nextStartDateStr = next.installationDate || next.orderDate;
                endDate = new Date(nextStartDateStr);
                endDate.setHours(0,0,0,0);
            }

            // Determine category tag for matching logic
            let catTag = 'general';
            const nameUp = item.name.toUpperCase();
            if (item.category === 'cbc_machine' || nameUp.includes('DILUENT') || nameUp.includes('LYSE')) catTag = 'cbc';
            else if (nameUp.includes('BLOOD GROUP')) catTag = 'blood_group';
            else if (item.category === 'finecare_machine') catTag = 'fincare';
            else if (nameUp.includes('HIV') || nameUp.includes('HBSAG') || nameUp.includes('VDRL') || nameUp.includes('BSL') || nameUp.includes('URINE')) catTag = 'reagent';

            // Calculate Usage in Window
            const usage = countTestsInRange([item.name], startDate, endDate, catTag);

            // Calculate Ordered
            const qty = Number(item.quantity) || 0;
            const strips = Number(item.stripsPerBox) || Number(item.unitsPerBox) || 0;
            const packSize = strips > 0 ? strips : 1; 
            const orderedTotal = qty * packSize;

            // Calculate Remaining based on formula: Remaining = Ordered - Used
            // Note: This overrides the inventory.remainingTests for display purposes on this screen
            const calculatedRemaining = orderedTotal - usage;

            processedItems.push({
                ...item,
                // Ensure name matches the group key casing to look clean, or use original name
                statsOrdered: orderedTotal,
                statsUsed: usage,
                statsRemaining: calculatedRemaining,
                uiCategory: catTag,
                effectiveDate: startDateStr // For display sorting
            });
        });
    });
    
    // Filter by UI inputs if set
    if (filterStartDate || filterEndDate) {
        processedItems = processedItems.filter(i => {
            const d = new Date(i.orderDate);
            const start = filterStartDate ? new Date(filterStartDate) : new Date('1900-01-01');
            const end = filterEndDate ? new Date(filterEndDate) : new Date();
            end.setHours(23,59,59,999);
            return d >= start && d <= end;
        });
    }

    // Sort by Date Descending for display
    processedItems.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    return {
        cbc: processedItems.filter(i => i.uiCategory === 'cbc'),
        bloodGroup: processedItems.filter(i => i.uiCategory === 'blood_group'),
        reagents: processedItems.filter(i => i.uiCategory === 'reagent'),
        fincare: processedItems.filter(i => i.uiCategory === 'fincare')
    };
  };

  const stats = processInventoryStats();

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Laboratory Statistics</h2>
        <button onClick={onBack} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded">Back</button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
            <label className="block text-xs text-slate-500">Order Start Date</label>
            <input type="date" value={inputStartDate} onChange={e => setInputStartDate(e.target.value)} className="bg-white border-slate-300 rounded px-2 py-1 text-slate-800 border" />
        </div>
        <div>
            <label className="block text-xs text-slate-500">Order End Date</label>
            <input type="date" value={inputEndDate} onChange={e => setInputEndDate(e.target.value)} className="bg-white border-slate-300 rounded px-2 py-1 text-slate-800 border" />
        </div>
        <button 
            onClick={handleApplyFilter}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded transition-colors"
        >
            Filter Orders
        </button>
        {(filterStartDate || filterEndDate) && (
            <span className="text-xs text-green-600 ml-2 pb-2">
                Showing orders from: {filterStartDate || 'Beginning'} to {filterEndDate || 'Today'}
            </span>
        )}
      </div>

      {/* CBC MACHINE */}
      <section className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
        <h3 className="text-xl font-bold text-blue-600 mb-4 flex items-center">
          <span className="p-2 bg-blue-50 rounded mr-2">🔬</span> CBC Machine Consumables
        </h3>
        <p className="text-xs text-slate-500 mb-4">Shows usage since installation date (or order date if not installed). Multiple rows indicate different packs.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-2">Order Date</th>
                <th className="px-4 py-2">Install Date</th>
                <th className="px-4 py-2">Reagent</th>
                <th className="px-4 py-2 text-center">Ordered Unit/Vol</th>
                <th className="px-4 py-2 text-center">Tests Performed</th>
              </tr>
            </thead>
            <tbody>
              {stats.cbc.map((i, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i.orderDate}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">{i.installationDate || '-'}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{i.statsOrdered}</td>
                  <td className="px-4 py-3 text-center text-amber-600 font-semibold">{i.statsUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* BLOOD GROUP */}
      <section className="bg-white p-5 rounded-xl border border-green-100 shadow-sm">
        <h4 className="text-lg font-bold text-green-700 mb-3 flex items-center">🩸 Blood Group Test Kit</h4>
        <p className="text-xs text-slate-500 mb-4">Shows usage between order dates.</p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
            <tr>
                <th className="px-4 py-2">Order Date</th>
                <th className="px-4 py-2">Kit Name</th>
                <th className="px-4 py-2 text-center">Ordered Qty</th>
                <th className="px-4 py-2 text-center">Tests Performed</th>
            </tr>
            </thead>
            <tbody>
            {stats.bloodGroup.map((i, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{i.orderDate}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{i.statsOrdered}</td>
                    <td className="px-4 py-3 text-center font-mono text-amber-600 font-semibold">{i.statsUsed}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
      </section>

      {/* REAGENTS */}
      <section className="bg-white p-5 rounded-xl border border-red-100 shadow-sm">
        <h4 className="text-lg font-bold text-red-600 mb-3 flex items-center">💊 Reagents (HIV, HBsAg, VDRL, BSL, Urine Strip)</h4>
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
            <tr>
                <th className="px-4 py-2">Order Date</th>
                <th className="px-4 py-2">Item Name</th>
                <th className="px-4 py-2 text-center">Ordered Strips</th>
                <th className="px-4 py-2 text-center">Used Strips</th>
                <th className="px-4 py-2 text-right">Remaining Strips</th>
            </tr>
            </thead>
            <tbody>
            {stats.reagents.map((i, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{i.orderDate}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{i.statsOrdered}</td>
                    <td className="px-4 py-3 text-center text-red-500 font-bold">{i.statsUsed}</td>
                    <td className={`px-4 py-3 text-right font-bold ${i.statsRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{i.statsRemaining}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
      </section>

      {/* FINE CARE LAB */}
      <section className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm">
        <h3 className="text-xl font-bold text-purple-600 mb-4 flex items-center">
          <span className="p-2 bg-purple-50 rounded mr-2">✨</span> Fine Care Lab (Diabetes & Hormones)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-2">Order Date</th>
                <th className="px-4 py-2">Kit Name</th>
                <th className="px-4 py-2 text-center">Ordered Strips</th>
                <th className="px-4 py-2 text-center">Used Strips</th>
                <th className="px-4 py-2 text-right">Remaining Strips</th>
              </tr>
            </thead>
            <tbody>
              {stats.fincare.map((i, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i.orderDate}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{i.statsOrdered}</td>
                  <td className="px-4 py-3 text-center text-red-500 font-bold">{i.statsUsed}</td>
                  <td className={`px-4 py-3 text-right font-bold ${i.statsRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{i.statsRemaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default StatisticsScreen;
