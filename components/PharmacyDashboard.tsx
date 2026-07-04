
import React, { useState, useMemo, useEffect } from 'react';
import { PharmacyItem, VisitRecord, Patient, AppPrintSettings, PharmacySupplier, PharmacySale, PharmacySaleItem } from '../types';
import { extractMedicinesFromBill, findGenericName, extractMedicinesForPos } from '../services/geminiService';
import { numberToWords } from '../services/numberToWords';

interface PharmacyDashboardProps {
    pharmacyInventory: PharmacyItem[];
    visits: VisitRecord[];
    patients: Patient[];
    suppliers: PharmacySupplier[];
    sales: PharmacySale[];
    printSettings?: AppPrintSettings;
    onUpdateInventory: (items: PharmacyItem[]) => void;
    onUpdateSuppliers: (suppliers: PharmacySupplier[]) => void;
    onUpdateSales: (sales: PharmacySale[]) => void;
}

const PharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ 
    pharmacyInventory, visits, patients, suppliers, sales, printSettings, onUpdateInventory, onUpdateSuppliers, onUpdateSales 
}) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventory' | 'purchase' | 'suppliers' | 'prescriptions'>('dashboard');
    
    // --- STOCK / INVENTORY STATE ---
    const [isScanning, setIsScanning] = useState(false);
    const [scannedItems, setScannedItems] = useState<Partial<PharmacyItem>[]>([]);
    const [showStockReview, setShowStockReview] = useState(false);
    const [stockSearch, setStockSearch] = useState('');
    
    // --- SUPPLIER STATE ---
    const [newSupplier, setNewSupplier] = useState({ name: '', mobile: '', gstNo: '', address: '' });

    // --- POS STATE ---
    const [cart, setCart] = useState<PharmacySaleItem[]>([]);
    const [posSearch, setPosSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [posDiscount, setPosDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
    const [showPosStaging, setShowPosStaging] = useState(false);
    const [posStagingItems, setPosStagingItems] = useState<{name: string, qty: number, matchedItem?: PharmacyItem}[]>([]);

    // --- RX STATE ---
    const [searchRx, setSearchRx] = useState('');
    const [editingPrescription, setEditingPrescription] = useState<{
        visit: VisitRecord,
        patientName: string,
        rxText: string
    } | null>(null);

    // --- UTILS ---
    const getLowStockItems = () => pharmacyInventory.filter(i => i.quantity <= i.minStockLevel);
    const getNearExpiryItems = () => {
        const today = new Date();
        return pharmacyInventory.filter(i => {
            const exp = new Date(i.expiryDate);
            const diffTime = exp.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 90 && diffDays > 0;
        });
    };

    // --- POS ACTIONS ---
    const addToCart = (item: PharmacyItem) => {
        const existing = cart.find(c => c.itemId === item.id);
        if (existing) {
            if (existing.qty + 1 > item.quantity) { alert("Insufficient Stock"); return; }
            setCart(cart.map(c => c.itemId === item.id ? { ...c, qty: c.qty + 1, amount: (c.qty + 1) * c.rate } : c));
        } else {
            if (item.quantity < 1) { alert("Out of Stock"); return; }
            setCart([...cart, { 
                itemId: item.id, 
                name: item.name, 
                batch: item.batchNumber, 
                expiry: item.expiryDate, 
                qty: 1, 
                rate: item.saleRate, 
                gst: item.gstPercentage,
                amount: item.saleRate 
            }]);
        }
        setPosSearch(''); // Clear search to allow rapid entry
    };

    const updateCartQty = (index: number, newQty: number) => {
        const item = cart[index];
        const stockItem = pharmacyInventory.find(i => i.id === item.itemId);
        if(!stockItem) return;
        
        if (newQty > stockItem.quantity) { alert(`Max available: ${stockItem.quantity}`); return; }
        if (newQty < 1) { removeFromCart(index); return; }

        const updated = [...cart];
        updated[index] = { ...item, qty: newQty, amount: newQty * item.rate };
        setCart(updated);
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const finalizeSale = () => {
        if(cart.length === 0) return;
        
        const subTotal = cart.reduce((acc, c) => acc + c.amount, 0);
        const totalGst = cart.reduce((acc, c) => acc + (c.amount * (c.gst/100)), 0);
        const grandTotal = Math.round((subTotal + totalGst) - posDiscount);

        const sale: PharmacySale = {
            id: `INV-${Date.now()}`,
            invoiceNo: `PH-${Date.now().toString().slice(-6)}`,
            date: new Date().toISOString(),
            patientName: selectedPatient || 'Cash Customer',
            doctorName: selectedDoctor || 'Self',
            items: cart,
            subTotal,
            totalGst,
            discount: posDiscount,
            grandTotal,
            paymentMethod
        };

        // Deduct Inventory
        const updatedInventory = pharmacyInventory.map(inv => {
            const cartItem = cart.find(c => c.itemId === inv.id);
            if(cartItem) {
                return { ...inv, quantity: inv.quantity - cartItem.qty };
            }
            return inv;
        });

        onUpdateSales([sale, ...sales]);
        onUpdateInventory(updatedInventory);
        
        // Print
        handlePrintInvoice(sale);

        // Reset
        setCart([]);
        setSelectedPatient('');
        setPosDiscount(0);
        alert("Sale Completed!");
    };

    const handlePrintInvoice = (sale: PharmacySale) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rows = sale.items.map((item, i) => `
            <tr>
                <td style="font-size: 10px;">${i+1}</td>
                <td style="font-size: 10px;">${item.name}<br/><span style="font-size:8px">Batch:${item.batch} Exp:${item.expiry}</span></td>
                <td style="font-size: 10px; text-align: center;">${item.qty}</td>
                <td style="font-size: 10px; text-align: right;">${item.rate.toFixed(2)}</td>
                <td style="font-size: 10px; text-align: right;">${item.amount.toFixed(2)}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice ${sale.invoiceNo}</title>
                    <style>
                        body { font-family: monospace; padding: 10px; width: 80mm; margin: 0 auto; }
                        table { width: 100%; border-collapse: collapse; }
                        th { border-bottom: 1px dashed #000; text-align: left; font-size: 10px; }
                        td { padding: 2px 0; }
                        .header { text-align: center; margin-bottom: 10px; }
                        .total { border-top: 1px dashed #000; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2 style="margin:0;">HOSPITAL PHARMACY</h2>
                        <p style="margin:0; font-size: 12px;">Pharmacist License: 123456</p>
                        <p style="margin:0; font-size: 12px;">Invoice: ${sale.invoiceNo}</p>
                        <p style="margin:0; font-size: 12px;">Date: ${new Date(sale.date).toLocaleString()}</p>
                    </div>
                    <div style="font-size: 10px; margin-bottom: 5px;">
                        Patient: ${sale.patientName}<br/>
                        Doctor: ${sale.doctorName}
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="total" style="margin-top: 5px; padding-top: 5px; text-align: right;">
                        <p style="margin:2px;">Subtotal: ${sale.subTotal.toFixed(2)}</p>
                        <p style="margin:2px;">GST: ${sale.totalGst.toFixed(2)}</p>
                        <p style="margin:2px;">Disc: -${sale.discount}</p>
                        <p style="margin:2px; font-size: 14px;">TOTAL: ₹${sale.grandTotal}</p>
                    </div>
                    <div style="text-align:center; font-size: 10px; margin-top: 10px;">
                        Thank you! Get Well Soon.
                    </div>
                    <script>window.onload = () => { window.print(); window.close(); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handlePosPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsScanning(true);
        try {
            const file = e.target.files[0];
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            
            const detectedItems = await extractMedicinesForPos(base64, file.type);
            
            // Fuzzy match against inventory
            const staging = detectedItems.map(d => {
                const matched = pharmacyInventory.find(i => 
                    i.name.toLowerCase().includes(d.name.toLowerCase()) || 
                    d.name.toLowerCase().includes(i.name.toLowerCase())
                );
                return { name: d.name, qty: d.qty || 1, matchedItem: matched };
            });
            
            setPosStagingItems(staging);
            setShowPosStaging(true);
        } catch(e) {
            alert("Failed to scan. Please try again.");
        } finally {
            setIsScanning(false);
        }
    };

    const addStagedItemsToCart = () => {
        let addedCount = 0;
        posStagingItems.forEach(staged => {
            if (staged.matchedItem) {
                // Add to cart with staged quantity
                const existing = cart.find(c => c.itemId === staged.matchedItem!.id);
                if (!existing) {
                    setCart(prev => [...prev, { 
                        itemId: staged.matchedItem!.id, 
                        name: staged.matchedItem!.name, 
                        batch: staged.matchedItem!.batchNumber, 
                        expiry: staged.matchedItem!.expiryDate, 
                        qty: staged.qty, 
                        rate: staged.matchedItem!.saleRate, 
                        gst: staged.matchedItem!.gstPercentage,
                        amount: staged.matchedItem!.saleRate * staged.qty 
                    }]);
                    addedCount++;
                }
            }
        });
        setShowPosStaging(false);
        setPosStagingItems([]);
        if (addedCount > 0) alert(`${addedCount} items added to billing.`);
    };

    // --- INVENTORY ACTIONS ---
    const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsScanning(true);
        try {
            const file = e.target.files[0];
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            
            const extracted = await extractMedicinesFromBill(base64, file.type);
            setScannedItems(extracted);
            setShowStockReview(true);
        } catch (error) {
            alert("Failed to scan bill. Please try again.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleManualEntry = () => {
        setScannedItems([{ name: '', quantity: 0, batchNumber: '', expiryDate: '', mrp: 0, purchaseRate: 0, saleRate: 0, gstPercentage: 0, rackLocation: '', genericName: '' }]);
        setShowStockReview(true);
    };

    const handleUpdateScannedItem = (index: number, field: keyof PharmacyItem, value: any) => {
        const updated = [...scannedItems];
        updated[index] = { ...updated[index], [field]: value };
        setScannedItems(updated);
    };

    const handleRemoveScannedItem = (index: number) => {
        setScannedItems(scannedItems.filter((_, i) => i !== index));
    };

    const handleFindGeneric = async (index: number) => {
        const item = scannedItems[index];
        if (!item.name) return;
        try {
            const generic = await findGenericName(item.name);
            handleUpdateScannedItem(index, 'genericName', generic);
        } catch (e) {
            alert("Could not find generic name.");
        }
    };

    const handleConfirmStock = () => {
        const newItems: PharmacyItem[] = scannedItems.map(item => ({
            id: `ph-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
            name: item.name || 'Unknown Drug',
            genericName: item.genericName || '',
            quantity: item.quantity || 0,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            addedDate: new Date().toISOString().slice(0, 10),
            mrp: item.mrp || 0,
            purchaseRate: item.purchaseRate || 0,
            saleRate: item.saleRate || (item.mrp || 0),
            gstPercentage: item.gstPercentage || 0,
            minStockLevel: item.minStockLevel || 10,
            rackLocation: item.rackLocation || '',
            supplierId: item.supplierId || ''
        }));
        
        onUpdateInventory([...pharmacyInventory, ...newItems]);
        setScannedItems([]);
        setShowStockReview(false);
        alert(`${newItems.length} items added to stock!`);
    };

    const addSupplier = () => {
        if (!newSupplier.name) return;
        onUpdateSuppliers([...suppliers, { id: Date.now().toString(), ...newSupplier }]);
        setNewSupplier({ name: '', mobile: '', gstNo: '', address: '' });
    };

    // --- RX ACTIONS ---
    const handlePrintRx = () => {
        if (!editingPrescription) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const layout = printSettings?.prescription || { marginTop: 60, marginBottom: 20, marginLeft: 20, marginRight: 20, headerHeight: 0, footerHeight: 20 };
        printWindow.document.write(`
            <html><head><title>Rx</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="p-8">
                <h1 class="text-2xl font-bold mb-4">Prescription Copy</h1>
                <pre class="font-sans whitespace-pre-wrap">${editingPrescription.rxText}</pre>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body></html>
        `);
        printWindow.document.close();
    };

    const handleConvertRxToBill = () => {
        if (!editingPrescription) return;

        const { visit, patientName, rxText } = editingPrescription;
        const doctorName = visit.assignedDoctor || '';
        
        // 1. Set Billing Headers
        setSelectedPatient(patientName);
        setSelectedDoctor(doctorName);

        // 2. Parse Rx Text for Medicines
        const lines = rxText.split('\n');
        const newCartItems: PharmacySaleItem[] = [];
        
        // Simple parser: check if inventory item name exists in the line
        // Optimization: Sort inventory by name length desc to match "Pan 40" before "Pan"
        const sortedInventory = [...pharmacyInventory].sort((a,b) => b.name.length - a.name.length);

        lines.forEach(line => {
            const cleanLine = line.toLowerCase();
            // Find the first matching drug in this line
            const matchedItem = sortedInventory.find(item => cleanLine.includes(item.name.toLowerCase()));
            
            if (matchedItem) {
                // Check if already in current newCart (deduplicate for this conversion)
                if (!newCartItems.some(c => c.itemId === matchedItem.id)) {
                    // Default Qty 1
                    if (matchedItem.quantity > 0) {
                        newCartItems.push({
                            itemId: matchedItem.id,
                            name: matchedItem.name,
                            batch: matchedItem.batchNumber,
                            expiry: matchedItem.expiryDate,
                            qty: 1, 
                            rate: matchedItem.saleRate,
                            gst: matchedItem.gstPercentage,
                            amount: matchedItem.saleRate // 1 * rate
                        });
                    }
                }
            }
        });

        if (newCartItems.length > 0) {
            setCart(newCartItems);
            setEditingPrescription(null);
            setActiveTab('pos');
            alert(`Prescription converted! ${newCartItems.length} items added to billing.`);
        } else {
            setEditingPrescription(null);
            setActiveTab('pos');
            alert("No matching stock items found in prescription text. Patient details pre-filled.");
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] bg-slate-100 overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
            
            {/* SIDEBAR NAVIGATION */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Pharmacy ERP</h2>
                    <p className="text-[10px] uppercase tracking-widest mt-1">Marg-Style Manager</p>
                </div>
                <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                        { id: 'pos', label: 'Billing / POS', icon: '💻' },
                        { id: 'inventory', label: 'Stock Manager', icon: '📦' },
                        { id: 'purchase', label: 'Purchase Entry', icon: 'truck' },
                        { id: 'suppliers', label: 'Suppliers', icon: '👥' },
                        { id: 'prescriptions', label: 'Prescriptions', icon: '📄' },
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === tab.id ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}
                        >
                            <span>{tab.icon === 'truck' ? '🚛' : tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 bg-slate-950 text-[10px] text-center text-slate-500">
                    v2.0 Enterprise Edition
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-grow p-6 overflow-y-auto">
                
                {/* DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <p className="text-xs font-black text-slate-400 uppercase">Today's Sales</p>
                                <p className="text-3xl font-black text-slate-800 mt-2">₹{sales.filter(s => s.date.startsWith(new Date().toISOString().slice(0,10))).reduce((a,b)=>a+b.grandTotal,0).toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <p className="text-xs font-black text-slate-400 uppercase">Low Stock Items</p>
                                <p className="text-3xl font-black text-amber-500 mt-2">{getLowStockItems().length}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <p className="text-xs font-black text-slate-400 uppercase">Near Expiry</p>
                                <p className="text-3xl font-black text-red-500 mt-2">{getNearExpiryItems().length}</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <p className="text-xs font-black text-slate-400 uppercase">Total Items</p>
                                <p className="text-3xl font-black text-blue-600 mt-2">{pharmacyInventory.length}</p>
                            </div>
                        </div>

                        {/* Recent Sales Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b bg-slate-50 font-black text-xs uppercase text-slate-500">Recent Invoices</div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
                                    <tr><th className="p-3">Inv No</th><th className="p-3">Date</th><th className="p-3">Patient</th><th className="p-3 text-right">Amount</th></tr>
                                </thead>
                                <tbody>
                                    {sales.slice(0, 10).map(s => (
                                        <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="p-3 font-mono text-xs">{s.invoiceNo}</td>
                                            <td className="p-3 text-xs">{new Date(s.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold">{s.patientName}</td>
                                            <td className="p-3 text-right font-bold text-green-600">₹{s.grandTotal}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* POS / BILLING VIEW */}
                {activeTab === 'pos' && (
                    <div className="flex gap-6 h-full">
                        <div className="flex-grow flex flex-col gap-4">
                            {/* Item Search */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex gap-2">
                                    <input 
                                        autoFocus
                                        placeholder="Search Medicine (Name / Generic) - Press F2" 
                                        value={posSearch}
                                        onChange={e => setPosSearch(e.target.value)}
                                        className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none p-2"
                                    />
                                    <label className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg cursor-pointer transition-all border border-purple-200 whitespace-nowrap font-bold text-xs uppercase flex items-center">
                                        📸 {isScanning ? '...' : 'Scan Rx'}
                                        <input type="file" className="hidden" accept="image/*" onChange={handlePosPhoto} disabled={isScanning} />
                                    </label>
                                </div>
                                {posSearch && (
                                    <div className="mt-2 max-h-60 overflow-y-auto border border-slate-100 rounded-lg">
                                        {pharmacyInventory.filter(i => i.name.toLowerCase().includes(posSearch.toLowerCase()) || i.genericName?.toLowerCase().includes(posSearch.toLowerCase())).map(item => (
                                            <div key={item.id} onClick={() => addToCart(item)} className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between border-b border-slate-50 text-sm">
                                                <div>
                                                    <p className="font-bold text-slate-800">{item.name}</p>
                                                    <p className="text-[10px] text-slate-500">Generic: {item.genericName} | Rack: {item.rackLocation}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-blue-600">₹{item.saleRate}</p>
                                                    <p className="text-[10px] text-slate-500">Qty: {item.quantity} | Exp: {item.expiryDate}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Cart Table */}
                            <div className="bg-white flex-grow rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="overflow-y-auto flex-grow">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-900 text-white text-xs uppercase sticky top-0">
                                            <tr>
                                                <th className="p-3">Item Name</th>
                                                <th className="p-3">Batch</th>
                                                <th className="p-3">Expiry</th>
                                                <th className="p-3 w-20">Qty</th>
                                                <th className="p-3 text-right">Rate</th>
                                                <th className="p-3 text-right">GST%</th>
                                                <th className="p-3 text-right">Amount</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cart.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3 font-bold">{item.name}</td>
                                                    <td className="p-3 text-xs font-mono">{item.batch}</td>
                                                    <td className="p-3 text-xs text-red-500">{item.expiry}</td>
                                                    <td className="p-3">
                                                        <input 
                                                            type="number" 
                                                            value={item.qty} 
                                                            onChange={e => updateCartQty(idx, parseInt(e.target.value) || 0)}
                                                            className="w-16 border rounded p-1 text-center font-bold"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right">{item.rate}</td>
                                                    <td className="p-3 text-right text-xs">{item.gst}%</td>
                                                    <td className="p-3 text-right font-bold">{(item.amount).toFixed(2)}</td>
                                                    <td className="p-3 text-center cursor-pointer text-red-500 font-bold" onClick={() => removeFromCart(idx)}>&times;</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Bill Summary Sidebar */}
                        <div className="w-80 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
                            <h3 className="font-black uppercase text-slate-800 border-b pb-2">Billing Details</h3>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400">Patient Name</label>
                                <input value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} className="w-full border-b border-slate-300 py-1 font-bold outline-none" placeholder="Guest Patient" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400">Doctor</label>
                                <input value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="w-full border-b border-slate-300 py-1 font-bold outline-none" placeholder="Self" />
                            </div>
                            
                            <div className="mt-auto space-y-2 border-t pt-4">
                                <div className="flex justify-between text-sm">
                                    <span>Sub Total</span>
                                    <span className="font-bold">₹{cart.reduce((a,b)=>a+b.amount,0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span>Discount (₹)</span>
                                    <input type="number" value={posDiscount} onChange={e => setPosDiscount(Number(e.target.value))} className="w-20 border rounded px-1 text-right font-bold" />
                                </div>
                                <div className="flex justify-between text-sm text-slate-500">
                                    <span>Tax (Included)</span>
                                    <span>₹{cart.reduce((a,b)=>a+(b.amount*(b.gst/100)),0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-black bg-slate-100 p-2 rounded">
                                    <span>Net Pay</span>
                                    <span className="text-blue-600">₹{Math.round((cart.reduce((a,b)=>a+b.amount,0) - posDiscount))}</span>
                                </div>
                            </div>

                            <button onClick={finalizeSale} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">Print Invoice (F10)</button>
                        </div>
                    </div>
                )}

                {/* INVENTORY MANAGER */}
                {activeTab === 'inventory' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                            <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Filter Inventory..." className="border border-slate-200 rounded-lg px-4 py-2 w-96 text-sm font-bold" />
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 rounded-lg border border-red-100">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div> <span className="text-xs font-bold text-red-600">Expiring</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div> <span className="text-xs font-bold text-amber-600">Low Stock</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500">
                                    <tr>
                                        <th className="p-3">Product Name</th>
                                        <th className="p-3">Generic</th>
                                        <th className="p-3">Batch</th>
                                        <th className="p-3">Expiry</th>
                                        <th className="p-3">Rack</th>
                                        <th className="p-3 text-right">MRP</th>
                                        <th className="p-3 text-right">Rate</th>
                                        <th className="p-3 text-center">Stock</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {pharmacyInventory
                                        .filter(i => i.name.toLowerCase().includes(stockSearch.toLowerCase()) || i.genericName?.toLowerCase().includes(stockSearch.toLowerCase()))
                                        .map(item => {
                                            const isLow = item.quantity <= item.minStockLevel;
                                            const isExp = new Date(item.expiryDate) < new Date(new Date().setMonth(new Date().getMonth() + 3));
                                            return (
                                                <tr key={item.id} className={`hover:bg-slate-50 ${isExp ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                                                    <td className="p-3 font-bold text-slate-800">{item.name}</td>
                                                    <td className="p-3 text-xs text-slate-500">{item.genericName}</td>
                                                    <td className="p-3 text-xs font-mono">{item.batchNumber}</td>
                                                    <td className="p-3 text-xs font-bold">{item.expiryDate}</td>
                                                    <td className="p-3 text-xs">{item.rackLocation}</td>
                                                    <td className="p-3 text-right">{item.mrp}</td>
                                                    <td className="p-3 text-right">{item.saleRate}</td>
                                                    <td className="p-3 text-center font-black">{item.quantity}</td>
                                                    <td className="p-3 text-center">
                                                        <button className="text-blue-600 text-xs font-bold underline">Edit</button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PURCHASE ENTRY */}
                {activeTab === 'purchase' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200">
                            <h3 className="text-lg font-black text-slate-800 uppercase mb-4">Stock Entry</h3>
                            <div className="flex gap-4">
                                <label className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest cursor-pointer shadow-lg inline-flex items-center gap-2">
                                    <span>{isScanning ? '🔍 Scanning...' : '📸 AI Scan Purchase Bill'}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleBillUpload} disabled={isScanning} />
                                </label>
                                <button onClick={handleManualEntry} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg inline-flex items-center gap-2">
                                    <span>📝 Manual Entry</span>
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">Upload a clear photo of the distributor invoice to auto-fill details, or enter manually.</p>
                        </div>
                    </div>
                )}

                {/* SUPPLIER MANAGEMENT */}
                {activeTab === 'suppliers' && (
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                            <h3 className="text-lg font-black text-slate-800 uppercase mb-4">Add Supplier</h3>
                            <div className="space-y-3">
                                <input placeholder="Distributor Name" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm" />
                                <input placeholder="Mobile No" value={newSupplier.mobile} onChange={e => setNewSupplier({...newSupplier, mobile: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm" />
                                <input placeholder="GSTIN" value={newSupplier.gstNo} onChange={e => setNewSupplier({...newSupplier, gstNo: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm" />
                                <textarea placeholder="Address" value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm h-20" />
                                <button onClick={addSupplier} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold uppercase text-xs">Save Supplier</button>
                            </div>
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            {suppliers.map(s => (
                                <div key={s.id} className="bg-white p-4 rounded-xl border border-slate-200">
                                    <p className="font-black text-slate-800">{s.name}</p>
                                    <p className="text-xs text-slate-500 mt-1">{s.mobile}</p>
                                    <p className="text-xs text-slate-400 uppercase mt-2 font-bold">GST: {s.gstNo}</p>
                                    <p className="text-xs text-slate-400">{s.address}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* EXISTING PRESCRIPTIONS VIEW */}
                {activeTab === 'prescriptions' && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Prescription Fulfillment</h2>
                            <input 
                                placeholder="Search Patient..." 
                                value={searchRx} 
                                onChange={e => setSearchRx(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {visits
                                .filter(v => v.prescription && v.prescription.trim().length > 0)
                                .map(v => ({ visit: v, patient: patients.find(p => p.id === v.patientId) }))
                                .filter(item => item.patient && (item.patient.name.toLowerCase().includes(searchRx.toLowerCase()) || item.visit.date.includes(searchRx)))
                                .map(({visit, patient}) => (
                                <div key={visit.id} onClick={() => setEditingPrescription({visit, patientName: patient!.name, rxText: visit.prescription || ''})} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 cursor-pointer hover:bg-purple-50 hover:border-purple-200 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase">Rx</div>
                                    <p className="font-black text-lg text-slate-800 mb-1">{patient?.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">Dr. {visit.assignedDoctor} • {visit.date}</p>
                                    <p className="text-xs text-slate-600 font-medium line-clamp-3 italic bg-white p-3 rounded-xl border border-slate-100">{visit.prescription}</p>
                                    <button className="mt-4 w-full bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">View & Print</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* POS Staging Modal */}
            {showPosStaging && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col p-8">
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Review Scanned Rx</h2>
                        <div className="flex-grow overflow-y-auto mb-6 bg-slate-50 rounded-2xl border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 mb-4 italic">Detected items from image. Match with stock before adding.</p>
                            {posStagingItems.map((item, idx) => (
                                <div key={idx} className="mb-3 border-b pb-3 last:border-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-800">{item.name} (Qty: {item.qty})</span>
                                        <button onClick={() => setPosStagingItems(posStagingItems.filter((_, i) => i !== idx))} className="text-red-500 font-bold">&times;</button>
                                    </div>
                                    {item.matchedItem ? (
                                        <div className="bg-green-100 px-3 py-1 rounded text-xs font-bold text-green-700">
                                            Matched: {item.matchedItem.name} (Stock: {item.matchedItem.quantity})
                                        </div>
                                    ) : (
                                        <div className="bg-red-100 px-3 py-1 rounded text-xs font-bold text-red-700">
                                            No direct stock match found.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={addStagedItemsToCart} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">Add Matched to Bill</button>
                            <button onClick={() => setShowPosStaging(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-4 rounded-xl font-black uppercase text-xs tracking-widest">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Review Modal (Enhanced for ERP fields) */}
            {showStockReview && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col p-8">
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Review Purchase Entry</h2>
                        <div className="flex-grow overflow-y-auto mb-6 bg-slate-50 rounded-2xl border border-slate-200 p-4">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr><th>Name</th><th>Generic</th><th>Batch</th><th>Exp</th><th>Qty</th><th>MRP</th><th>Rate</th><th>Amount</th><th>GST%</th><th>Rack</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {scannedItems.map((item, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td><input value={item.name} onChange={e => handleUpdateScannedItem(idx, 'name', e.target.value)} className="w-full p-1 border rounded" /></td>
                                            <td>
                                                <div className="flex gap-1">
                                                    <input value={item.genericName} onChange={e => handleUpdateScannedItem(idx, 'genericName', e.target.value)} className="w-full p-1 border rounded" />
                                                    <button onClick={() => handleFindGeneric(idx)} className="bg-purple-100 text-purple-700 px-2 rounded font-bold" title="AI Find Generic">✨</button>
                                                </div>
                                            </td>
                                            <td><input value={item.batchNumber} onChange={e => handleUpdateScannedItem(idx, 'batchNumber', e.target.value)} className="w-20 p-1 border rounded" /></td>
                                            <td><input value={item.expiryDate} onChange={e => handleUpdateScannedItem(idx, 'expiryDate', e.target.value)} className="w-20 p-1 border rounded" placeholder="YYYY-MM-DD" /></td>
                                            <td><input type="number" value={item.quantity} onChange={e => handleUpdateScannedItem(idx, 'quantity', Number(e.target.value))} className="w-16 p-1 border rounded" /></td>
                                            <td><input type="number" value={item.mrp} onChange={e => handleUpdateScannedItem(idx, 'mrp', Number(e.target.value))} className="w-16 p-1 border rounded" /></td>
                                            <td><input type="number" value={item.purchaseRate} onChange={e => handleUpdateScannedItem(idx, 'purchaseRate', Number(e.target.value))} className="w-16 p-1 border rounded" /></td>
                                            <td><span className="font-bold text-slate-700">{(item.quantity! * (item.purchaseRate || 0)).toFixed(2)}</span></td>
                                            <td><input type="number" value={item.gstPercentage} onChange={e => handleUpdateScannedItem(idx, 'gstPercentage', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                            <td><input value={item.rackLocation} onChange={e => handleUpdateScannedItem(idx, 'rackLocation', e.target.value)} className="w-16 p-1 border rounded" /></td>
                                            <td><button onClick={() => handleRemoveScannedItem(idx)} className="text-red-500 font-bold">&times;</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => setScannedItems([...scannedItems, { name: '', quantity: 0 }])} className="mt-4 py-2 px-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-100">+ Add Row</button>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleConfirmStock} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">Save Purchase Entry</button>
                            <button onClick={() => setShowStockReview(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-4 rounded-xl font-black uppercase text-xs tracking-widest">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prescription Modal */}
            {editingPrescription && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">View Prescription</h2>
                            <button onClick={() => setEditingPrescription(null)} className="text-slate-400 text-2xl">&times;</button>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">{editingPrescription.rxText}</pre>
                        <div className="flex gap-4">
                            <button onClick={handlePrintRx} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-black uppercase text-xs">Print</button>
                            <button onClick={handleConvertRxToBill} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black uppercase text-xs">Convert to Bill</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyDashboard;
