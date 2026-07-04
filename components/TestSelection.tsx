

import React, { useState, useEffect } from 'react';
import { SelectedTests } from '../types';
import { BillIcon } from './icons/BillIcon';

interface TestSelectionProps {
    onContinue: (selectedTests: SelectedTests) => void;
    onCreateBill: () => void;
}

const TestSelection: React.FC<TestSelectionProps> = ({ onContinue, onCreateBill }) => {
    const [selectedTests, setSelectedTests] = useState<SelectedTests>({
        cbc: false,
        serology: false,
        urine: false,
        other: false,
        widal: false,
        crp: false,
        hormone: false,
        semen: false,
    });

    const handleTestChange = (test: keyof SelectedTests) => {
        setSelectedTests(prev => ({ ...prev, [test]: !prev[test] }));
    };

    const testOptions: { key: keyof SelectedTests; label: string }[] = [
        { key: 'cbc', label: 'Complete Blood Count (CBC)' },
        { key: 'other', label: 'Other Blood Tests (RBS, Grouping)' },
        { key: 'serology', label: 'Serology Report' },
        { key: 'urine', label: 'Urine Report' },
        { key: 'widal', label: 'Widal Test Report'},
        { key: 'crp', label: 'CRP Report'},
        { key: 'hormone', label: 'Hormone & Diabetes Report'},
        { key: 'semen', label: 'Semen Analysis Report'},
    ];

    return (
        <div className="text-center p-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">Select Tests For New Report</h2>
            <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-slate-200 shadow-xl">
                <div className="space-y-4 text-left">
                     <button 
                        onClick={onCreateBill}
                        className="w-full text-left flex items-center space-x-3 p-3 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors border border-purple-200"
                     >
                        <BillIcon />
                        <span className="font-bold text-lg text-purple-700">Create Direct Bill</span>
                     </button>

                    <div className="relative my-4">
                        <hr className="border-slate-300"/>
                        <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-2 text-slate-500 text-xs uppercase tracking-widest font-semibold">or create report</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                        {testOptions.map(option => (
                            <label key={option.key} className="flex items-center space-x-3 p-2 rounded-md cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedTests[option.key] as boolean}
                                    onChange={() => handleTestChange(option.key)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                                />
                                <span className="text-slate-700 font-medium">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <button
                    onClick={() => onContinue(selectedTests)}
                    disabled={!Object.values(selectedTests).some(v => v)}
                    className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-xl shadow-lg transform active:scale-95"
                >
                    Generate New Report
                </button>
            </div>
        </div>
    );
};

export default TestSelection;
