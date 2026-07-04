
import React, { useState, useRef, useEffect } from 'react';
import { BillData, BillItem, AppPrintSettings, ServicePrices } from '../types';
import BillPreview from './BillPreview';
import { PrintIcon } from './icons/PrintIcon';
import { getAllBillableItems, DEFAULT_PRICES } from '../services/billingService';

interface BillScreenProps {
    initialBillData: BillData;
    isManual: boolean;
    printSettings?: AppPrintSettings;
    billingRates?: ServicePrices;
    onClose: () => void;
}

const BillScreen: React.FC<BillScreenProps> = ({ initialBillData, isManual, printSettings, billingRates = DEFAULT_PRICES, onClose }) => {
    const [billData, setBillData] = useState<BillData>(initialBillData);
    const [useCustomBillNumber, setUseCustomBillNumber] = useState(false);
    const [customBillNumber, setCustomBillNumber] = useState('');
    const billPreviewRef = useRef<HTMLDivElement>(null);
    const [allBillableItems, setAllBillableItems] = useState<BillItem[]>([]);
    const [selectedTestId, setSelectedTestId] = useState('');

    useEffect(() => {
        // Initialize billable items based on current rates
        setAllBillableItems(getAllBillableItems(billingRates));
    }, [billingRates]);

    useEffect(() => {
        const total = billData.items.reduce((sum, item) => sum + Number(item.price), 0);
        setBillData(prev => ({ ...prev, total }));
    }, [billData.items]);
    
    const handlePriceChange = (index: number, newPrice: string) => {
        const updatedItems = [...billData.items];
        updatedItems[index].price = Number(newPrice) || 0;
        setBillData({ ...billData, items: updatedItems });
    };

    const handlePatientDetailChange = (field: 'patientName' | 'refBy', value: string) => {
        setBillData(prev => ({...prev, [field]: value}));
    };
    
    const handleAddItem = () => {
        if (!selectedTestId) return;
        const testToAdd = allBillableItems.find(item => item.id === selectedTestId);
        if (testToAdd && !billData.items.some(item => item.id === selectedTestId)) {
            setBillData(prev => ({
                ...prev,
                items: [...prev.items, { ...testToAdd }]
            }));
        }
        setSelectedTestId(''); // Reset dropdown
    };

    const handleRemoveItem = (idToRemove: string) => {
        setBillData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== idToRemove)
        }));
    };

    const handlePrint = () => {
        const printContent = billPreviewRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`<html><head><title>Print Bill</title><script src="https://cdn.tailwindcss.com"></script><style>@media print { body { -webkit-print-color-adjust: exact !important; font-family: 'monospace' !important; } .report-page { box-shadow: none !important; margin: 0; border: none; } }</style></head><body>${printContent}</body></html>`);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
            }
        }
    };
    
    const effectiveBillNumber = useCustomBillNumber ? customBillNumber : billData.billNumber;
    const billDataForPreview = { ...billData, billNumber: effectiveBillNumber };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">Bill No: {billData.billNumber}</h2>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center space-x-3 mb-4">
                        <input
                            id="custom-bill-no-checkbox"
                            type="checkbox"
                            checked={useCustomBillNumber}
                            onChange={(e) => setUseCustomBillNumber(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                        />
                        <label htmlFor="custom-bill-no-checkbox" className="font-medium text-slate-700">Use Custom Bill Number</label>
                    </div>
                    {useCustomBillNumber && (
                        <input 
                            placeholder="Enter Custom Bill Number" 
                            value={customBillNumber} 
                            onChange={e => setCustomBillNumber(e.target.value)} 
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" 
                        />
                    )}
                </div>

                {isManual && (
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-600 mb-4">Patient Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input placeholder="Patient's Name" value={billData.patientName} onChange={e => handlePatientDetailChange('patientName', e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                            <input placeholder="Ref. By" value={billData.refBy} onChange={e => handlePatientDetailChange('refBy', e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                        </div>
                    </div>
                )}
                {isManual && (
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                        <select value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)} className="flex-grow bg-white border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                            <option value="">-- Add a test --</option>
                            {allBillableItems.map(item => <option key={item.id} value={item.id}>{item.testName}</option>)}
                        </select>
                        <button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm">Add</button>
                    </div>
                )}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
                    {billData.items.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                            <span className="text-slate-700 flex-grow">{item.testName}</span>
                            <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handlePriceChange(index, e.target.value)}
                                className="w-24 bg-white border border-slate-300 rounded-md px-2 py-1 text-right focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                            />
                            {isManual && (
                                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">&times;</button>
                            )}
                        </div>
                    ))}
                    <div className="flex items-center justify-between font-bold text-lg border-t border-slate-200 pt-3">
                        <span className="text-slate-900">Total</span>
                        <span className="text-slate-900">₹ {billData.total.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex space-x-4">
                    <button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg inline-flex items-center justify-center shadow-md">
                        <PrintIcon /> <span className="ml-2">Print Bill</span>
                    </button>
                    <button onClick={onClose} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg shadow-md">
                        {isManual ? 'Back to Selection' : 'Back to Report'}
                    </button>
                </div>
            </div>
            <div className="lg:col-span-1">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Bill Preview</h2>
                 <div className="p-2 bg-slate-200 rounded-lg shadow-inner border border-slate-300 h-[70vh] overflow-auto">
                    <div className="origin-top mx-auto transform scale-[0.7]">
                         <BillPreview billData={billDataForPreview} ref={billPreviewRef} settings={printSettings} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillScreen;
