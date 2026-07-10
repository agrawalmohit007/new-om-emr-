import React, { useState } from 'react';
import { AppConfig, SystemUser, Consultant, MedicationMasterData, ServicePrices, UserRole } from '../types';
import { syncToCloud } from '../services/firebaseService';

interface AppConfigModalProps {
    appConfig: AppConfig;
    systemUsers: SystemUser[];
    consultants: Consultant[];
    medicationMaster: MedicationMasterData;
    billingRates: ServicePrices;
    onClose: () => void;
    onUpdateConfig: (newConfig: AppConfig) => void;
    onUpdateSystemUsers: (users: SystemUser[]) => void;
    onUpdateConsultants: (consultants: Consultant[]) => void;
    onUpdateMedicationMaster: (data: MedicationMasterData) => void;
    onUpdateBillingRates: (rates: ServicePrices) => void;
}

const AppConfigModal: React.FC<AppConfigModalProps> = ({
    appConfig,
    systemUsers,
    consultants,
    medicationMaster,
    billingRates,
    onClose,
    onUpdateConfig,
    onUpdateSystemUsers,
    onUpdateConsultants,
    onUpdateMedicationMaster,
    onUpdateBillingRates
}) => {
    const [activeTab, setActiveTab] = useState<'general' | 'users' | 'meds' | 'billing'>('general');
    
    // Gemini & Serial & Toggles State
    const [configState, setConfigState] = useState<AppConfig>({
        ...appConfig,
        activatedFacilities: appConfig.activatedFacilities || {
            opd: true,
            ipd: true,
            lab: true,
            pharmacy: true,
            usg: true
        }
    });

    // User Creation State
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('opd');
    const [newUserPin, setNewUserPin] = useState('');

    // Billing Setup State
    const [opdFee, setOpdFee] = useState<number>(billingRates['opd_consultation']?.price || 200);
    const [followUpFee, setFollowUpFee] = useState<number>(billingRates['opd_followup']?.price || 100);
    const [labCbcFee, setLabCbcFee] = useState<number>(billingRates['cbc']?.price || 350);
    const [usgPelvisFee, setUsgPelvisFee] = useState<number>(billingRates['ultrasound']?.price || 800);
    const [lscsFee, setLscsFee] = useState<number>(billingRates['lscs']?.price || 15000);
    const [spinalAnesFee, setSpinalAnesFee] = useState<number>(billingRates['spinal_anesthesia']?.price || 3500);

    const handleSaveGeneralConfig = async () => {
        // Save local override for frontend Gemini calls
        localStorage.setItem('gemini_api_key', configState.geminiKey);
        
        try {
            await fetch('/api/save-env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    databaseUrl: configState.databaseUrl,
                    geminiKey: configState.geminiKey,
                    firebaseStudioLink: configState.firebaseStudioLink
                })
            });
        } catch (e) {
            console.error("Failed to sync environment configuration:", e);
        }

        onUpdateConfig(configState);
        alert("System Configuration Saved. Please restart the backend server to apply database connection changes.");
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserName.trim() || newUserPin.length !== 4) {
            alert("Please enter a valid Name and a 4-digit PIN.");
            return;
        }

        const id = `u_${Date.now()}`;
        const newUser: SystemUser = {
            id,
            name: newUserName.trim(),
            pin: newUserPin,
            roles: [newUserRole],
            isActive: true
        };

        const updatedUsers = [...systemUsers, newUser];
        onUpdateSystemUsers(updatedUsers);
        syncToCloud('systemUsers', updatedUsers);

        // Also add to consultants list if they are a doctor
        if (newUserRole === 'doctor') {
            const newConsultant: Consultant = {
                id: `c_${Date.now()}`,
                name: newUserName.trim(),
                department: 'surgery',
                baseFee: opdFee,
                followUpFee: followUpFee,
                isActive: true
            };
            const updatedConsultants = [...consultants, newConsultant];
            onUpdateConsultants(updatedConsultants);
            syncToCloud('consultants', updatedConsultants);
        }

        setNewUserName('');
        setNewUserPin('');
        alert(`Account created successfully for ${newUserName}`);
    };

    const handleDeleteUser = (userId: string) => {
        if (!confirm("Are you sure you want to delete this user login?")) return;
        const updatedUsers = systemUsers.filter(u => u.id !== userId);
        onUpdateSystemUsers(updatedUsers);
        syncToCloud('systemUsers', updatedUsers);
    };

    const handleInitializeMeds = () => {
        if (!confirm("Initialize default Medication Master data? This will overwrite or initialize standard clinical medications.")) return;
        const defaultMeds: MedicationMasterData = {
            groups: ['Antibiotics', 'Analgesics', 'Antacids', 'Antihypertensives', 'IV Fluids', 'Vitamins', 'Anti-allergics'],
            drugs: [
                { id: 'm1', name: 'Paracetamol 500mg', group: 'Analgesics', instructions: 'After Food' },
                { id: 'm2', name: 'Amoxicillin 500mg', group: 'Antibiotics', instructions: 'After Food' },
                { id: 'm3', name: 'Pantoprazole 40mg', group: 'Antacids', instructions: 'Before Food' },
                { id: 'm4', name: 'Amlodipine 5mg', group: 'Antihypertensives', instructions: 'After Food' },
                { id: 'm5', name: 'Ringer Lactate 500ml', group: 'IV Fluids', instructions: 'As Directed' },
                { id: 'm6', name: 'Cetirizine 10mg', group: 'Anti-allergics', instructions: 'At Bedtime' }
            ],
            frequencies: ['OD', 'BD', 'TDS', 'QID', 'PRN', 'STAT'],
            instructions: ['After Food', 'Before Food', 'With Water', 'At Bedtime', 'Empty Stomach']
        };
        onUpdateMedicationMaster(defaultMeds);
        syncToCloud('medicationMaster', defaultMeds);
        
        setConfigState(prev => ({ ...prev, isMedMasterSetupDone: true }));
        onUpdateConfig({ ...configState, isMedMasterSetupDone: true });
        alert("Standard Medication Master Initialized successfully.");
    };

    const handleSaveBilling = () => {
        const updatedRates: ServicePrices = {
            ...billingRates,
            opd_consultation: { name: 'OPD Consultation', price: Number(opdFee), category: 'consultation' },
            opd_followup: { name: 'OPD Follow-up', price: Number(followUpFee), category: 'consultation' },
            cbc: { name: 'Complete Blood Count (CBC)', price: Number(labCbcFee), category: 'lab' },
            ultrasound: { name: 'Diagnostic Ultrasound (USG)', price: Number(usgPelvisFee), category: 'usg' },
            lscs: { name: 'Lower Segment Cesarean Section (LSCS)', price: Number(lscsFee), category: 'operation' },
            spinal_anesthesia: { name: 'Spinal Anesthesia', price: Number(spinalAnesFee), category: 'anesthesia' }
        };
        onUpdateBillingRates(updatedRates);
        syncToCloud('billingRates', updatedRates);
        
        setConfigState(prev => ({ ...prev, isBillingSetupDone: true }));
        onUpdateConfig({ ...configState, isBillingSetupDone: true });
        alert("Hospital Billing setup configured successfully.");
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250] p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px] border border-slate-100">
                <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Hospital Installation Setup</h2>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">App Configuration & Role Activation (Super Admin Mode)</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold">&times;</button>
                </div>
                
                <div className="flex bg-slate-100 p-2 gap-2 border-b border-slate-200 flex-shrink-0">
                    <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'general' ? 'bg-white text-slate-800 shadow' : 'text-slate-500'}`}>1. General & Facilities</button>
                    <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>2. Create Logins</button>
                    <button onClick={() => setActiveTab('meds')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'meds' ? 'bg-white text-purple-600 shadow' : 'text-slate-500'}`}>3. Med Master</button>
                    <button onClick={() => setActiveTab('billing')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === 'billing' ? 'bg-white text-amber-600 shadow' : 'text-slate-500'}`}>4. Billing Rates</button>
                </div>

                <div className="p-8 overflow-y-auto flex-grow custom-scrollbar">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                             <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-4">Gemini API Key</h3>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Enter Key for AI Registry Auto-Population & Voice features</label>
                                <input
                                    type="password"
                                    value={configState.geminiKey}
                                    onChange={e => setConfigState({ ...configState, geminiKey: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all text-sm font-mono"
                                    placeholder="AIzaSy..."
                                />
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-4">Firebase Studio Storage Link</h3>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Firebase cloud backup synchronization link (optional)</label>
                                <input
                                    type="text"
                                    value={configState.firebaseStudioLink || ''}
                                    onChange={e => setConfigState({ ...configState, firebaseStudioLink: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all text-sm font-mono"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-4">Database Connection String (Supabase/PostgreSQL)</h3>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Drizzle connection URI for this facility's local or cloud database</label>
                                <input
                                    type="password"
                                    value={configState.databaseUrl || ''}
                                    onChange={e => setConfigState({ ...configState, databaseUrl: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all text-sm font-mono"
                                    placeholder="postgresql://user:pass@host:port/db"
                                />
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-4">Serial Number Activation</h3>
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        disabled
                                        value={configState.serialNumber}
                                        onChange={e => setConfigState({ ...configState, serialNumber: e.target.value })}
                                        className="flex-grow bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none text-sm font-mono text-slate-400"
                                        placeholder="Hospital License Serial Code"
                                    />
                                    <button disabled className="bg-slate-200 text-slate-400 px-6 rounded-xl text-xs font-black uppercase tracking-wider">Activate</button>
                                </div>
                                <p className="text-[10px] text-pink-600 font-bold uppercase tracking-wider mt-2">🔒 License Serial Code Activation: Inactive (Development Mode)</p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-4">Activated Modules / Facilities</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.keys(configState.activatedFacilities).map(facility => (
                                        <label key={facility} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={configState.activatedFacilities[facility as keyof typeof configState.activatedFacilities]}
                                                onChange={e => {
                                                    setConfigState({
                                                        ...configState,
                                                        activatedFacilities: {
                                                            ...configState.activatedFacilities,
                                                            [facility]: e.target.checked
                                                        }
                                                    });
                                                }}
                                                className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                            />
                                            <span className="font-black text-xs text-slate-700 uppercase tracking-wider">{facility} Module</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleSaveGeneralConfig} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow hover:bg-black transition-all">Save Config & Facility Options</button>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <form onSubmit={handleAddUser} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b pb-2">Add New Account</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Full Name</label>
                                        <input
                                            required
                                            value={newUserName}
                                            onChange={e => setNewUserName(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                            placeholder="e.g. Dr. Rajesh Patil"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Role Type</label>
                                        <select
                                            value={newUserRole}
                                            onChange={e => setNewUserRole(e.target.value as UserRole)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        >
                                            <option value="opd">OPD Desk</option>
                                            <option value="doctor">Doctor / Consultant</option>
                                            <option value="lab">Lab Operator</option>
                                            <option value="ipd">IPD Nurse/Staff</option>
                                            <option value="pharmacy">Pharmacist</option>
                                            <option value="admin">Administrator</option>
                                            <option value="master">Clinical Master</option>
                                            <option value="global_stats">Stats Reader</option>
                                            <option value="analytics">Analytics Tab</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">4-Digit PIN</label>
                                        <input
                                            required
                                            type="password"
                                            maxLength={4}
                                            value={newUserPin}
                                            onChange={e => setNewUserPin(e.target.value.replace(/\D/g,''))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-center text-xl tracking-[0.5rem]"
                                            placeholder="****"
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow hover:bg-blue-700">Create Account</button>
                            </form>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 mb-3">Created Accounts ({systemUsers.length})</h3>
                                <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {systemUsers.map(user => (
                                        <div key={user.id} className="flex justify-between items-center py-3">
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{user.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Roles: {user.roles?.join(', ')}</p>
                                            </div>
                                            <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 font-bold text-xs uppercase hover:underline">Delete</button>
                                        </div>
                                    ))}
                                    {systemUsers.length === 0 && <p className="text-slate-400 italic text-sm text-center py-4">No users configured. Setup standard logins above.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'meds' && (
                        <div className="space-y-6 text-center">
                            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-4">
                                <span className="text-5xl">💊</span>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Default Medications Setup</h3>
                                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">Initialize standard indoor/outdoor drug masters, group classifications (Antibiotics, Analgesics, etc.), dosage frequencies, and advice instructions automatically to start consulting right away.</p>
                                
                                <div className="border border-slate-100 bg-white p-4 rounded-xl text-left max-w-md mx-auto">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Configuration Summary</p>
                                    <p className="text-xs font-bold text-slate-700 mt-1">✓ Medicine Groups: {medicationMaster?.groups?.length || 0} Registered</p>
                                    <p className="text-xs font-bold text-slate-700">✓ Total Registered Medicines: {medicationMaster?.drugs?.length || 0} Records</p>
                                </div>

                                <button onClick={handleInitializeMeds} className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg">Initialize Default Drugs list</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 border-b pb-2">Setup Clinical & Surgery Pricing</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">OPD Consultation Fee</label>
                                        <input
                                            type="number"
                                            value={opdFee}
                                            onChange={e => setOpdFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">OPD Follow-up Fee</label>
                                        <input
                                            type="number"
                                            value={followUpFee}
                                            onChange={e => setFollowUpFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CBC Lab Test Price</label>
                                        <input
                                            type="number"
                                            value={labCbcFee}
                                            onChange={e => setLabCbcFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Obstetric USG Price</label>
                                        <input
                                            type="number"
                                            value={usgPelvisFee}
                                            onChange={e => setUsgPelvisFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">LSCS Operation Price</label>
                                        <input
                                            type="number"
                                            value={lscsFee}
                                            onChange={e => setLscsFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Spinal Anesthesia Fee</label>
                                        <input
                                            type="number"
                                            value={spinalAnesFee}
                                            onChange={e => setSpinalAnesFee(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleSaveBilling} className="w-full bg-amber-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow hover:bg-amber-700">Save Prices Configuration</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 flex-shrink-0">
                    <button onClick={onClose} className="bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-black uppercase text-xs">Close Setup Panel</button>
                </div>
            </div>
        </div>
    );
};

export default AppConfigModal;
