
import React, { useState } from 'react';
import { InventoryItem, InventoryCategory, SavedReport } from '../types';

interface InventoryScreenProps {
    inventory: InventoryItem[];
    reportHistory: SavedReport[];
    onUpdate: (data: InventoryItem[]) => void;
    onBack: () => void;
}

const InventoryScreen: React.FC<InventoryScreenProps> = ({ inventory, reportHistory, onUpdate, onBack }) => {
  const [activeTab, setActiveTab] = useState<InventoryCategory>('cbc_machine');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(0);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemStrips, setItemStrips] = useState(0);
  const [itemDate, setItemDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemInstallDate, setItemInstallDate] = useState('');

  const handleAdd = () => {
    if (!itemName) return;
    const remaining = (itemStrips || 1) * itemQty;
    const newItem: InventoryItem = {
      id: editingId || Date.now().toString(),
      category: activeTab,
      name: itemName,
      quantity: itemQty,
      pricePerUnit: itemPrice,
      totalPrice: itemQty * itemPrice,
      orderDate: itemDate,
      installationDate: itemInstallDate || undefined,
      useBeforeDate: '',
      isOpen: false,
      remainingTests: remaining,
      stripsPerBox: itemStrips,
      pricePerStrip: itemStrips ? itemPrice / itemStrips : 0
    };

    if (editingId) {
      onUpdate(inventory.map(i => i.id === editingId ? newItem : i));
    } else {
      onUpdate([...inventory, newItem]);
    }
    reset();
  };

  const reset = () => {
    setEditingId(null); setItemName(''); setItemQty(0); setItemPrice(0); setItemStrips(0);
    setItemDate(new Date().toISOString().slice(0, 10)); setItemInstallDate('');
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id); setItemName(item.name); setItemQty(item.quantity);
    setItemPrice(item.pricePerUnit); setItemStrips(item.stripsPerBox || 0);
    setItemDate(item.orderDate); setItemInstallDate(item.installationDate || '');
  };

  const remove = (id: string) => {
    if (confirm("Confirm Deletion?")) onUpdate(inventory.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Inventory Console</h2>
        <button onClick={onBack} className="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest">Back</button>
      </div>

      <div className="bg-white p-1 rounded-2xl border border-slate-200 flex w-fit shadow-lg">
        {(['cbc_machine', 'finecare_machine', 'routine_consumable'] as InventoryCategory[]).map(cat => (
          <button key={cat} onClick={() => { setActiveTab(cat); reset(); }} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Reagent/Item Identity</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Full nomenclature..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
          </div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Units Ordered</label><input type="number" value={itemQty || ''} onChange={e => setItemQty(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" /></div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Unit Cost</label><input type="number" value={itemPrice || ''} onChange={e => setItemPrice(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" /></div>
          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Tests Per Pack</label><input type="number" value={itemStrips || ''} onChange={e => setItemStrips(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95">{editingId ? 'Update Master Record' : 'Commit New Entry'}</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              <th className="px-8 py-5">Item Details</th>
              <th className="px-8 py-5">Stock Metrics</th>
              <th className="px-8 py-5 text-right">Management</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.filter(i => i.category === activeTab).map(i => (
              <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-8 py-6">
                    <p className="font-black text-slate-800 text-lg">{i.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Order: {i.orderDate}</p>
                </td>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-6">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">Ordered</p><p className="font-bold text-slate-800">{i.quantity} Boxes</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">Available Tests</p><p className="font-black text-green-600 text-lg">{i.remainingTests}</p></div>
                    </div>
                </td>
                <td className="px-8 py-6 text-right space-x-4">
                    <button onClick={() => startEdit(i)} className="text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline">Edit</button>
                    <button onClick={() => remove(i.id)} className="text-red-500 font-black uppercase text-[10px] tracking-widest hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryScreen;
