
import React, { useState, useMemo, useEffect } from 'react';
import { Patient, VisitRecord, LabOrder, InventoryItem, SavedReport, UserRole, Consultant, PatientType, AppPrintSettings, ServicePrices, Ward, Bed, BedType, Specialty, SystemUser } from '../types';
import StatisticsScreen from './StatisticsScreen';
import InventoryScreen from './InventoryScreen';
import MockDataInjector from './MockDataInjector';
import { DEFAULT_PRICES } from '../services/billingService';
import { generatePrintText } from '../services/geminiService';

interface AdminPanelProps {
  patients: Patient[];
  visits: VisitRecord[];
  labOrders: LabOrder[];
  inventory: InventoryItem[];
  reportHistory: SavedReport[];
  consultants: Consultant[];
  specialties: Specialty[];
  printSettings: AppPrintSettings;
  billingRates?: ServicePrices;
  wards: Ward[];
  systemUsers: SystemUser[];
  onUpdateInventory: (data: InventoryItem[]) => void;
  onUpdateReports: (data: SavedReport[]) => void;
  onUpdatePatients: (data: Patient[]) => void;
  onUpdateLabOrders: (data: LabOrder[]) => void;
  onUpdateVisits: (data: VisitRecord[] | ((prev: VisitRecord[]) => VisitRecord[])) => void;
  onUpdateConsultants: (data: Consultant[]) => void;
  onUpdateSpecialties: (data: Specialty[]) => void;
  onUpdateBillingRates: (data: ServicePrices) => void;
  onUpdateWards: (data: Ward[]) => void;
  onUpdateSystemUsers: (data: SystemUser[]) => void;
  onUpdatePrintSettings: (data: AppPrintSettings) => void;
  userRole: UserRole;
}

// --- SUB-COMPONENTS EXTRACTED TO PREVENT RE-RENDER FOCUS LOSS ---

const UserManager: React.FC<{ systemUsers: SystemUser[]; consultants: Consultant[]; onUpdateUsers: (data: SystemUser[]) => void; onUpdateConsultants: (data: Consultant[]) => void }> = ({ systemUsers, consultants, onUpdateUsers, onUpdateConsultants }) => {
    const [newUser, setNewUser] = useState<Partial<SystemUser>>({ name: '', roles: ['opd'], pin: '', isActive: true });
    
    // Edit Mode State
    const [editMode, setEditMode] = useState<{ type: 'user' | 'consultant', id: string } | null>(null);
    const [editForm, setEditForm] = useState<{ pin: string, roles: UserRole[] }>({ pin: '', roles: [] });

    // Available Roles excluding 'doctor' for simple users (doctors are managed in consultants mostly, but can have other roles)
    const availableRoles: UserRole[] = ['opd', 'lab', 'ipd', 'pharmacy', 'admin', 'master', 'superadmin', 'global_stats', 'analytics', 'usg', 'nurse'];

    const toggleNewUserRole = (role: UserRole) => {
        setNewUser(prev => {
            const currentRoles = prev.roles || [];
            if (currentRoles.includes(role)) {
                return { ...prev, roles: currentRoles.filter(r => r !== role) };
            } else {
                return { ...prev, roles: [...currentRoles, role] };
            }
        });
    };

    const handleAddUser = () => {
        if (!newUser.name || !newUser.pin) return;
        
        const user: SystemUser = {
            id: Date.now().toString(),
            name: newUser.name,
            roles: newUser.roles || ['opd'],
            pin: newUser.pin,
            isActive: true
        };
        onUpdateUsers([...systemUsers, user]);
        setNewUser({ name: '', roles: ['opd'], pin: '', isActive: true });
    };

    const handleDeleteUser = (id: string) => {
        if(confirm("Delete this user?")) {
            onUpdateUsers(systemUsers.filter(u => u.id !== id));
        }
    };

    const handleEditStart = (type: 'user' | 'consultant', item: any) => {
        setEditMode({ type, id: item.id });
        // Handle legacy single role or new roles array
        const currentRoles = item.roles && item.roles.length > 0 ? item.roles : (item.role ? [item.role] : (type === 'consultant' ? ['doctor'] : []));
        setEditForm({ pin: item.pin || '', roles: currentRoles });
    };

    const toggleEditRole = (role: UserRole) => {
        setEditForm(prev => {
            if (prev.roles.includes(role)) {
                return { ...prev, roles: prev.roles.filter(r => r !== role) };
            } else {
                return { ...prev, roles: [...prev.roles, role] };
            }
        });
    };

    const handleSaveEdit = () => {
        if (!editMode) return;
        if (editMode.type === 'user') {
            onUpdateUsers(systemUsers.map(u => u.id === editMode.id ? { ...u, pin: editForm.pin, roles: editForm.roles } : u));
        } else {
            // For consultants, ensure 'doctor' role is preserved if logic requires, but allow flexible assignment
            // Logic: If they are in consultants list, they are implicitly doctors, but we store roles for login access
            let finalRoles = editForm.roles;
            if (!finalRoles.includes('doctor')) finalRoles.push('doctor');
            
            onUpdateConsultants(consultants.map(c => c.id === editMode.id ? { ...c, pin: editForm.pin, roles: finalRoles } : c));
        }
        setEditMode(null);
        setEditForm({ pin: '', roles: [] });
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Add System User</h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-grow min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name / Identifier</label>
                        <input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full border p-2 rounded-xl text-sm font-bold" placeholder="e.g. Front Desk 1" />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login PIN</label>
                        <input value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full border p-2 rounded-xl text-sm font-bold" maxLength={4} placeholder="4 Digits" />
                    </div>
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Roles</label>
                        <div className="flex flex-wrap gap-2">
                            {availableRoles.map(role => (
                                <button 
                                    key={role} 
                                    onClick={() => toggleNewUserRole(role)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${newUser.roles?.includes(role) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleAddUser} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs hover:bg-blue-700 h-fit">Add User</button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Active Users & Roles</h3>
                    <span className="text-xs font-bold text-slate-500">{systemUsers.length + consultants.length} Accounts</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {/* System Users */}
                    {systemUsers.map(user => (
                        <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                            {editMode?.type === 'user' && editMode.id === user.id ? (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest">Editing: {user.name}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveEdit} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase">Save Changes</button>
                                            <button onClick={() => setEditMode(null)} className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold uppercase">Cancel</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 items-start">
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">PIN</label>
                                            <input value={editForm.pin} onChange={e => setEditForm({...editForm, pin: e.target.value})} className="w-24 border p-2 rounded-lg text-sm font-bold text-center" maxLength={4} />
                                        </div>
                                        <div className="flex-grow">
                                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Roles</label>
                                            <div className="flex flex-wrap gap-2">
                                                {availableRoles.map(role => (
                                                    <button 
                                                        key={role} 
                                                        onClick={() => toggleEditRole(role)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${editForm.roles.includes(role) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                                    >
                                                        {role}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                                        <div className="flex gap-1 mt-1">
                                            {(user.roles || (user.role ? [user.role] : [])).map(r => (
                                                <span key={r} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-slate-200">{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300 transition-all" onClick={() => handleEditStart('user', user)}>
                                            <span className="text-slate-400 text-xs font-bold">PIN</span>
                                            <span className="font-mono font-black text-slate-800 tracking-widest">****</span>
                                            <span className="text-blue-600 text-[10px] uppercase font-black ml-2">Edit / Roles</span>
                                        </div>
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg font-bold text-lg">&times;</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Consultants (Editable Roles & PIN) */}
                    {consultants.map(c => (
                        <div key={c.id} className="p-4 bg-purple-50/30 hover:bg-purple-50 transition-colors">
                            {editMode?.type === 'consultant' && editMode.id === c.id ? (
                                <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-purple-800 uppercase text-xs tracking-widest">Editing Consultant: {c.name}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveEdit} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase">Save Changes</button>
                                            <button onClick={() => setEditMode(null)} className="bg-slate-200 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold uppercase">Cancel</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 items-start">
                                        <div>
                                            <label className="block text-[10px] font-bold text-purple-400 uppercase mb-1">PIN</label>
                                            <input value={editForm.pin} onChange={e => setEditForm({...editForm, pin: e.target.value})} className="w-24 border p-2 rounded-lg text-sm font-bold text-center" maxLength={4} />
                                        </div>
                                        <div className="flex-grow">
                                            <label className="block text-[10px] font-bold text-purple-400 uppercase mb-1">Additional Roles (Doctor implied)</label>
                                            <div className="flex flex-wrap gap-2">
                                                {availableRoles.map(role => (
                                                    <button 
                                                        key={role} 
                                                        onClick={() => toggleEditRole(role)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${editForm.roles.includes(role) ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                    >
                                                        {role}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{c.name} <span className="text-purple-600 text-[10px] uppercase font-bold ml-2">(Consultant)</span></p>
                                        <div className="flex gap-1 mt-1">
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-purple-200">DOCTOR</span>
                                            {(c.roles || []).filter(r => r !== 'doctor').map(r => (
                                                <span key={r} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-slate-200">{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-purple-300 transition-all" onClick={() => handleEditStart('consultant', c)}>
                                            <span className="text-slate-400 text-xs font-bold">PIN</span>
                                            <span className="font-mono font-black text-slate-800 tracking-widest">****</span>
                                            <span className="text-purple-600 text-[10px] uppercase font-black ml-2">Edit / Roles</span>
                                        </div>
                                        <span className="text-slate-300 text-[10px] italic px-2">Consultant</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ConsultantsManager: React.FC<{ consultants: Consultant[]; specialties: Specialty[]; onUpdate: (data: Consultant[]) => void }> = ({ consultants, specialties, onUpdate }) => {
    const [newConsultant, setNewConsultant] = useState<Partial<Consultant>>({ name: '', department: 'surgery', baseFee: 200, followUpFee: 100, isActive: true, pin: '', specialty: '' });
    
    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Consultant>>({});

    const handleAdd = () => {
        if (!newConsultant.name) return;
        const consultant: Consultant = {
            id: Date.now().toString(),
            name: newConsultant.name!,
            department: newConsultant.department as PatientType,
            baseFee: newConsultant.baseFee || 200,
            followUpFee: newConsultant.followUpFee || 100,
            isActive: true,
            specialty: newConsultant.specialty || '',
            pin: newConsultant.pin,
            roles: ['doctor'] // Default role
        };
        onUpdate([...consultants, consultant]);
        setNewConsultant({ name: '', department: 'surgery', baseFee: 200, followUpFee: 100, isActive: true, specialty: '', pin: '' });
    };

    const toggleStatus = (id: string) => {
        onUpdate(consultants.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
    };

    const startEdit = (c: Consultant) => {
        setEditingId(c.id);
        setEditForm(c);
    };

    const saveEdit = () => {
        if (!editingId || !editForm.name) return;
        onUpdate(consultants.map(c => c.id === editingId ? { ...c, ...editForm } as Consultant : c));
        setEditingId(null);
        setEditForm({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const deleteConsultant = (id: string) => {
        if (confirm("Are you sure you want to delete this consultant?")) {
            onUpdate(consultants.filter(c => c.id !== id));
        }
    };

    const handleLoadDefaults = () => {
        const defaults: Consultant[] = [
            { id: '1', name: 'Dr. Mohit Agrawal', department: 'obgyn', isActive: true, baseFee: 200, followUpFee: 100, pin: '1401', specialty: 'Obstetrician & Gynecologist', roles: ['doctor'] },
            { id: '2', name: 'Dr. Parul Agrawal', department: 'obgyn', isActive: true, baseFee: 200, followUpFee: 100, pin: '0608', specialty: 'Obstetrician & Gynecologist', roles: ['doctor'] },
            { id: '3', name: 'Dr. Manjulata Agrawal', department: 'obgyn', isActive: true, baseFee: 200, followUpFee: 100, pin: '1411', specialty: 'Obstetrician & Gynecologist', roles: ['doctor'] },
            { id: '4', name: 'Dr. Omprakash Agrawal', department: 'surgery', isActive: true, baseFee: 200, followUpFee: 100, pin: '0709', specialty: 'General Surgeon', roles: ['doctor'] }
        ];

        let updatedList = [...consultants];
        let addedCount = 0;
        let updatedCount = 0;

        defaults.forEach(def => {
            // Find existing by name (case-insensitive)
            const index = updatedList.findIndex(c => c.name.trim().toLowerCase() === def.name.trim().toLowerCase());
            
            if (index >= 0) {
                // Update existing record (Preserve ID, but update PIN/Details)
                updatedList[index] = { 
                    ...updatedList[index], 
                    ...def, 
                    id: updatedList[index].id // Keep existing ID
                }; 
                updatedCount++;
            } else {
                // Add new record
                updatedList.push({ 
                    ...def, 
                    id: Date.now().toString() + Math.random().toString().slice(2, 5) 
                });
                addedCount++;
            }
        });

        onUpdate(updatedList);
        alert(`Sync Complete:\n- Added ${addedCount} new consultants.\n- Updated ${updatedCount} existing records with correct PINs.`);
    };

    const grouped = consultants.reduce((acc, curr) => {
        if (!acc[curr.department]) acc[curr.department] = [];
        acc[curr.department].push(curr);
        return acc;
    }, {} as Record<string, Consultant[]>);

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Add New Consultant</h3>
                    <button onClick={handleLoadDefaults} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 border border-blue-200 transition-all">
                        + Load / Sync Default Doctors
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                        <input value={newConsultant.name} onChange={e => setNewConsultant({...newConsultant, name: e.target.value})} className="w-full border p-2 rounded-xl text-sm font-bold" placeholder="Dr. Name" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                        <select value={newConsultant.department} onChange={e => setNewConsultant({...newConsultant, department: e.target.value as PatientType})} className="w-full border p-2 rounded-xl text-sm font-bold">
                            <option value="surgery">Surgery</option>
                            <option value="obgyn">ObGyn</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specialty</label>
                        <select value={newConsultant.specialty} onChange={e => setNewConsultant({...newConsultant, specialty: e.target.value})} className="w-full border p-2 rounded-xl text-sm font-bold">
                            <option value="">Select</option>
                            {specialties.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login PIN</label>
                        <input value={newConsultant.pin || ''} onChange={e => setNewConsultant({...newConsultant, pin: e.target.value})} className="w-full border p-2 rounded-xl text-sm font-bold" placeholder="4-digit" maxLength={4} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rates (New/Old)</label>
                        <div className="flex gap-1">
                            <input type="number" value={newConsultant.baseFee} onChange={e => setNewConsultant({...newConsultant, baseFee: Number(e.target.value)})} className="w-1/2 border p-2 rounded-xl text-xs font-bold" placeholder="New" />
                            <input type="number" value={newConsultant.followUpFee} onChange={e => setNewConsultant({...newConsultant, followUpFee: Number(e.target.value)})} className="w-1/2 border p-2 rounded-xl text-xs font-bold" placeholder="Old" />
                        </div>
                    </div>
                    <button onClick={handleAdd} className="bg-blue-600 text-white py-2 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700">Add</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(grouped).map(([dept, list]) => (
                    <div key={dept} className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 p-3 font-black text-slate-600 uppercase text-xs tracking-widest">{dept === 'obgyn' ? 'Obstetrics & Gynecology' : dept}</div>
                        <div className="divide-y divide-slate-100">
                            {(list as Consultant[]).map(c => (
                                <div key={c.id} className="p-4">
                                    {editingId === c.id ? (
                                        <div className="flex flex-col gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
                                            <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="border p-2 rounded text-sm font-bold w-full" placeholder="Name" />
                                            <div className="grid grid-cols-2 gap-2">
                                                <select value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value as PatientType})} className="border p-2 rounded text-xs">
                                                    <option value="surgery">Surgery</option>
                                                    <option value="obgyn">ObGyn</option>
                                                </select>
                                                <select value={editForm.specialty} onChange={e => setEditForm({...editForm, specialty: e.target.value})} className="border p-2 rounded text-xs">
                                                    <option value="">Select Specialty</option>
                                                    {specialties.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input value={editForm.pin || ''} onChange={e => setEditForm({...editForm, pin: e.target.value})} className="border p-2 rounded text-xs" placeholder="PIN" maxLength={4} />
                                                <input type="number" value={editForm.baseFee} onChange={e => setEditForm({...editForm, baseFee: Number(e.target.value)})} className="border p-2 rounded text-xs" placeholder="New Fee" />
                                                <input type="number" value={editForm.followUpFee} onChange={e => setEditForm({...editForm, followUpFee: Number(e.target.value)})} className="border p-2 rounded text-xs" placeholder="Old Fee" />
                                            </div>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={saveEdit} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase flex-grow">Save</button>
                                                <button onClick={cancelEdit} className="bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold uppercase">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`font-bold text-sm ${c.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{c.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold">{c.specialty}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <p className="text-[10px] text-slate-400">PIN: <span className="font-mono text-slate-600 font-bold">{c.pin || 'N/A'}</span></p>
                                                        <span className="text-slate-300">|</span>
                                                        <p className="text-[10px] text-slate-400">Fees: <span className="font-bold text-green-600">₹{c.baseFee}</span> (New) / <span className="font-bold text-blue-600">₹{c.followUpFee || c.baseFee}</span> (Old)</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 items-end">
                                                    <button onClick={() => toggleStatus(c.id)} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {c.isActive ? 'Active' : 'Inactive'}
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => startEdit(c)} className="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                                        <button onClick={() => deleteConsultant(c.id)} className="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SpecialtiesManager: React.FC<{ specialties: Specialty[]; onUpdate: (data: Specialty[]) => void }> = ({ specialties, onUpdate }) => {
    const [name, setName] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;
        onUpdate([...specialties, { id: Date.now().toString(), name }]);
        setName('');
    };

    const handleDelete = (id: string) => {
        if(confirm('Delete specialty?')) onUpdate(specialties.filter(s => s.id !== id));
    };

    return (
        <div className="max-w-2xl bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Manage Specialties</h3>
            <div className="flex gap-4 mb-6">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cardiologist, General Surgeon" className="flex-grow border p-2 rounded-xl text-sm font-bold" />
                <button onClick={handleAdd} className="bg-purple-600 text-white px-6 rounded-xl font-black uppercase text-xs hover:bg-purple-700">Add</button>
            </div>
            <ul className="space-y-2">
                {specialties.map(s => (
                    <li key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-700">{s.name}</span>
                        <button onClick={() => handleDelete(s.id)} className="text-red-500 font-bold">&times;</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const BillingRatesManager: React.FC<{ billingRates: ServicePrices; onUpdate: (data: ServicePrices) => void }> = ({ billingRates, onUpdate }) => {
    const [activeCategory, setActiveCategory] = useState('all');
    const [newItem, setNewItem] = useState({ name: '', price: 0, category: 'opd' });

    // Helper to determine category if not explicitly set
    const getCategory = (key: string, item: any) => {
        if (item.category) return item.category;
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('opd') || lowerKey.includes('consult')) return 'opd';
        if (lowerKey.includes('ipd') || lowerKey.includes('bed') || lowerKey.includes('round')) return 'ipd';
        if (lowerKey.includes('lab') || lowerKey.includes('test') || lowerKey.includes('cbc')) return 'lab';
        if (lowerKey.includes('operation') || lowerKey.includes('surg')) return 'operation';
        if (lowerKey.includes('day')) return 'day_care';
        return 'other';
    };

    const allKeys = Array.from(new Set([...Object.keys(DEFAULT_PRICES), ...Object.keys(billingRates)]));
    const items = allKeys.map(key => {
        const item = billingRates[key] || DEFAULT_PRICES[key];
        return { key, ...item, category: getCategory(key, item) };
    });

    const filteredItems = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory);

    const handleUpdateItem = (key: string, field: string, value: any) => {
        const current = billingRates[key] || DEFAULT_PRICES[key];
        const baseCategory = current.category || getCategory(key, current);
        
        onUpdate({
            ...billingRates,
            [key]: { 
                ...current, 
                category: baseCategory, // Ensure base category is set first
                [field]: value // Overwrite with new value (works for both 'category' and 'price')
            }
        });
    };

    const handleDeleteItem = (key: string) => {
        if(confirm("Delete this billing item?")) {
            const newRates = { ...billingRates };
            delete newRates[key];
            onUpdate(newRates);
        }
    };

    const handleAddItem = () => {
        if (!newItem.name) return;
        const key = `custom_${Date.now()}`;
        onUpdate({
            ...billingRates,
            [key]: { name: newItem.name, price: newItem.price, category: newItem.category }
        });
        setNewItem({ name: '', price: 0, category: activeCategory !== 'all' ? activeCategory : 'opd' });
    };

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
                {['all', 'lab', 'opd', 'ipd', 'operation', 'anesthesia', 'medication_package', 'day_care'].map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${activeCategory === cat ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                        {cat.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                <div className="flex gap-4 mb-6 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 flex-wrap">
                    <div className="flex-grow">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">New Service Name</label>
                        <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full border p-2 rounded-lg text-sm font-bold" />
                    </div>
                    <div className="w-32">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                        <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} className="w-full border p-2 rounded-lg text-sm font-bold" />
                    </div>
                    <div className="w-40">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                        <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full border p-2 rounded-lg text-sm font-bold uppercase">
                            <option value="opd">OPD</option>
                            <option value="lab">Lab</option>
                            <option value="ipd">IPD</option>
                            <option value="operation">Operation</option>
                            <option value="anesthesia">Anesthesia</option>
                            <option value="medication_package">Med Package</option>
                            <option value="day_care">Day Care</option>
                        </select>
                    </div>
                    <button onClick={handleAddItem} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-black uppercase text-xs">Add</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.key} className="bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-2 shadow-sm relative group">
                            <button 
                                onClick={() => handleDeleteItem(item.key)} 
                                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Item"
                            >
                                🗑️
                            </button>
                            <input value={item.name} onChange={e => handleUpdateItem(item.key, 'name', e.target.value)} className="font-bold text-sm border-b border-transparent focus:border-blue-500 outline-none pr-6" />
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-xs">₹</span>
                                    <input type="number" value={item.price} onChange={e => handleUpdateItem(item.key, 'price', Number(e.target.value))} className="w-20 font-bold text-green-600 bg-slate-50 rounded px-1" />
                                </div>
                                <select 
                                    value={item.category} 
                                    onChange={(e) => handleUpdateItem(item.key, 'category', e.target.value)}
                                    className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded border-none outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="opd">OPD</option>
                                    <option value="lab">Lab</option>
                                    <option value="ipd">IPD</option>
                                    <option value="operation">Operation</option>
                                    <option value="anesthesia">Anesthesia</option>
                                    <option value="medication_package">Med Pkg</option>
                                    <option value="day_care">Day Care</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BedMasterManager: React.FC<{ wards: Ward[], onUpdateWards: (data: Ward[]) => void }> = ({ wards, onUpdateWards }) => {
    const [newWardName, setNewWardName] = useState('');
    const [activeWardId, setActiveWardId] = useState<string | null>(wards.length > 0 ? wards[0].id : null);
    const [newBed, setNewBed] = useState<{ number: string; type: BedType; price: number }>({ number: '', type: 'general', price: 500 });
    
    // NEW STATE
    const [editingWard, setEditingWard] = useState<{ id: string, name: string } | null>(null);

    const activeWard = wards.find(w => w.id === activeWardId);

    const addWard = () => {
        if (!newWardName.trim()) return;
        const newWard: Ward = { id: `w-${Date.now()}`, name: newWardName, beds: [] };
        onUpdateWards([...wards, newWard]);
        setNewWardName('');
        setActiveWardId(newWard.id);
    };

    const deleteWard = (id: string) => {
        const ward = wards.find(w => w.id === id);
        if (ward && ward.beds.length > 0) {
            if (!confirm(`Ward "${ward.name}" has ${ward.beds.length} beds configured. Delete anyway?`)) return;
        }
        if (confirm("Are you sure? This cannot be undone.")) {
            const updated = wards.filter(w => w.id !== id);
            onUpdateWards(updated);
            if (activeWardId === id) setActiveWardId(updated.length > 0 ? updated[0].id : null);
        }
    };

    // NEW FUNCTION
    const updateWardName = () => {
        if (!editingWard || !editingWard.name.trim()) return;
        onUpdateWards(wards.map(w => w.id === editingWard.id ? { ...w, name: editingWard.name } : w));
        setEditingWard(null);
    };

    const addBed = () => {
        if (!activeWard || !newBed.number) return;
        const bed: Bed = {
            id: `b-${Date.now()}`,
            number: newBed.number,
            type: newBed.type,
            status: 'available',
            pricePerDay: newBed.price
        };
        const updatedWards = wards.map(w => w.id === activeWardId ? { ...w, beds: [...w.beds, bed] } : w);
        onUpdateWards(updatedWards);
        setNewBed({ ...newBed, number: '' });
    };

    const deleteBed = (bedId: string) => {
        if (!activeWard) return;
        const bed = activeWard.beds.find(b => b.id === bedId);
        if (bed?.status === 'occupied') {
            alert("Cannot delete an occupied bed!");
            return;
        }
        if (confirm("Delete this bed?")) {
            const updatedWards = wards.map(w => w.id === activeWardId ? { ...w, beds: w.beds.filter(b => b.id !== bedId) } : w);
            onUpdateWards(updatedWards);
        }
    };

    const updateBed = (bedId: string, field: keyof Bed, value: any) => {
        if (!activeWard) return;
        const updatedWards = wards.map(w => {
            if (w.id === activeWardId) {
                return {
                    ...w,
                    beds: w.beds.map(b => b.id === bedId ? { ...b, [field]: value } : b)
                };
            }
            return w;
        });
        onUpdateWards(updatedWards);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full min-h-[500px]">
            <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Wards</h3>
                <div className="flex-grow overflow-y-auto space-y-2 mb-4">
                    {(Array.isArray(wards) ? wards : []).map(w => (
                        <div 
                            key={w.id} 
                            onClick={() => setActiveWardId(w.id)}
                            className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${activeWardId === w.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {editingWard?.id === w.id ? (
                                <div className="flex gap-1 w-full" onClick={e => e.stopPropagation()}>
                                    <input 
                                        autoFocus 
                                        value={editingWard.name} 
                                        onChange={e => setEditingWard({ ...editingWard, name: e.target.value })} 
                                        className="w-full border p-1 rounded text-xs font-bold"
                                    />
                                    <button onClick={updateWardName} className="text-green-600 font-bold px-1">✓</button>
                                    <button onClick={() => setEditingWard(null)} className="text-red-500 font-bold px-1">✕</button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <p className={`font-bold text-sm ${activeWardId === w.id ? 'text-blue-800' : 'text-slate-700'}`}>{w.name}</p>
                                        <p className="text-[10px] text-slate-500 font-bold">{w.beds.length} Beds</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingWard({ id: w.id, name: w.name }); }} className="text-slate-400 hover:text-blue-500 p-1" title="Rename">✎</button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteWard(w.id); }} className="text-slate-400 hover:text-red-500 p-1" title="Delete">&times;</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={newWardName} onChange={e => setNewWardName(e.target.value)} placeholder="New Ward Name" className="flex-grow border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"/>
                    <button onClick={addWard} className="bg-slate-800 text-white px-4 rounded-xl font-bold text-xs uppercase">Add</button>
                </div>
            </div>

            <div className="w-full md:w-2/3 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col">
                {activeWard ? (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{activeWard.name} Configuration</h3></div>
                            <div className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500 uppercase">ID: {activeWard.id}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex gap-3 items-end">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bed No</label><input value={newBed.number} onChange={e => setNewBed({...newBed, number: e.target.value})} className="w-24 border p-2 rounded-lg text-sm font-bold" placeholder="G-1" /></div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                                <select value={newBed.type} onChange={e => setNewBed({...newBed, type: e.target.value as BedType})} className="w-32 border p-2 rounded-lg text-sm font-bold bg-white">
                                    <option value="general">General</option>
                                    <option value="semi_private">Semi-Pvt</option>
                                    <option value="private">Private</option>
                                    <option value="icu">ICU</option>
                                    <option value="labor">Labor</option>
                                </select>
                            </div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price/Day</label><input type="number" value={newBed.price} onChange={e => setNewBed({...newBed, price: Number(e.target.value)})} className="w-24 border p-2 rounded-lg text-sm font-bold" /></div>
                            <button onClick={addBed} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-black uppercase text-xs shadow-md hover:bg-green-700 h-fit">Add Bed</button>
                        </div>
                        <div className="flex-grow overflow-y-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-xs font-black text-slate-500 uppercase sticky top-0"><tr><th className="p-3">Bed Number</th><th className="p-3">Type</th><th className="p-3">Price (₹)</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activeWard.beds.map(bed => (
                                        <tr key={bed.id} className="hover:bg-slate-50">
                                            <td className="p-3"><input value={bed.number} onChange={e => updateBed(bed.id, 'number', e.target.value)} className="w-full bg-transparent font-bold text-slate-800 focus:bg-white focus:border-b border-blue-500 outline-none"/></td>
                                            <td className="p-3"><select value={bed.type} onChange={e => updateBed(bed.id, 'type', e.target.value as BedType)} className="bg-transparent text-xs font-bold uppercase outline-none focus:bg-white"><option value="general">General</option><option value="semi_private">Semi-Pvt</option><option value="private">Private</option><option value="icu">ICU</option><option value="labor">Labor</option></select></td>
                                            <td className="p-3"><input type="number" value={bed.pricePerDay} onChange={e => updateBed(bed.id, 'pricePerDay', Number(e.target.value))} className="w-20 bg-transparent font-mono font-bold text-green-700 focus:bg-white focus:border-b border-green-500 outline-none"/></td>
                                            <td className="p-3 text-center"><span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${bed.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{bed.status}</span></td>
                                            <td className="p-3 text-center"><button onClick={() => deleteBed(bed.id)} className="text-red-400 hover:text-red-600 font-bold">&times;</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (<div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest text-xs">Select or create a ward to manage beds</div>)}
            </div>
        </div>
    );
};

const PrintSettingsManager: React.FC<{
    settings: AppPrintSettings;
    onUpdate: (data: AppPrintSettings) => void;
}> = ({ settings, onUpdate }) => {
    const [activeSection, setActiveSection] = useState<'lab' | 'prescription' | 'bill'>('lab');
    const [configTab, setConfigTab] = useState<'margins' | 'header' | 'footer'>('margins');
    
    const [headerAiPrompt, setHeaderAiPrompt] = useState('');
    const [footerAiPrompt, setFooterAiPrompt] = useState('');
    const [isHeaderAiLoading, setIsHeaderAiLoading] = useState(false);
    const [isFooterAiLoading, setIsFooterAiLoading] = useState(false);

    const handleChange = (section: keyof AppPrintSettings, field: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        if (section === 'headerImage' || section === 'footerImage' || section === 'headerText' || section === 'footerText') return;
        
        onUpdate({
            ...settings,
            [section]: {
                ...settings[section] as any,
                [field]: numValue
            }
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onUpdate({
                    ...settings,
                    headerImage: base64
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        onUpdate({
            ...settings,
            headerImage: ''
        });
    };

    const handleFooterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onUpdate({
                    ...settings,
                    footerImage: base64
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveFooterLogo = () => {
        onUpdate({
            ...settings,
            footerImage: ''
        });
    };

    const handleGenerateHeaderWithAi = async () => {
        if (!headerAiPrompt.trim()) return;
        setIsHeaderAiLoading(true);
        try {
            const text = await generatePrintText(headerAiPrompt, 'header');
            onUpdate({ ...settings, headerText: text });
            setHeaderAiPrompt('');
        } catch (err) {
            alert("Failed to generate header text. Please try again.");
        } finally {
            setIsHeaderAiLoading(false);
        }
    };

    const handleGenerateFooterWithAi = async () => {
        if (!footerAiPrompt.trim()) return;
        setIsFooterAiLoading(true);
        try {
            const text = await generatePrintText(footerAiPrompt, 'footer');
            onUpdate({ ...settings, footerText: text });
            setFooterAiPrompt('');
        } catch (err) {
            alert("Failed to generate footer text. Please try again.");
        } finally {
            setIsFooterAiLoading(false);
        }
    };

    const currentMargins = settings[activeSection] || { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, headerHeight: 0, footerHeight: 0 };

    return (
        <div className="space-y-6">
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-2 w-fit">
                <button onClick={() => setConfigTab('margins')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-1.5 ${configTab === 'margins' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>📋 Margins & Layout</button>
                <button onClick={() => setConfigTab('header')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-1.5 ${configTab === 'header' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>🖼️ Custom Header</button>
                <button onClick={() => setConfigTab('footer')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-1.5 ${configTab === 'footer' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>🦶 Custom Footer</button>
            </div>

            {configTab === 'margins' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                        <div>
                            <h3 className="text-base font-black uppercase text-slate-800">Print Margins Layout</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adjust Page Paddings per Module (in millimeters)</p>
                        </div>
                        
                        <div className="flex bg-slate-100 p-1.5 rounded-xl gap-2">
                            <button onClick={() => setActiveSection('lab')} className={`flex-grow py-2 rounded-lg font-bold text-xs uppercase transition-all ${activeSection === 'lab' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>Lab Report</button>
                            <button onClick={() => setActiveSection('prescription')} className={`flex-grow py-2 rounded-lg font-bold text-xs uppercase transition-all ${activeSection === 'prescription' ? 'bg-white text-purple-600 shadow' : 'text-slate-500'}`}>Prescription</button>
                            <button onClick={() => setActiveSection('bill')} className={`flex-grow py-2 rounded-lg font-bold text-xs uppercase transition-all ${activeSection === 'bill' ? 'bg-white text-green-600 shadow' : 'text-slate-500'}`}>Bill / Invoice</button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Header Space (mm)</label>
                                <input type="number" value={currentMargins.headerHeight} onChange={e => handleChange(activeSection, 'headerHeight', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                                <p className="text-[9px] text-slate-400 mt-1 font-medium">Blank space at top reserved for logo/letterhead</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Footer Space (mm)</label>
                                <input type="number" value={currentMargins.footerHeight} onChange={e => handleChange(activeSection, 'footerHeight', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Margin Top (mm)</label>
                                <input type="number" value={currentMargins.marginTop} onChange={e => handleChange(activeSection, 'marginTop', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Margin Bottom (mm)</label>
                                <input type="number" value={currentMargins.marginBottom} onChange={e => handleChange(activeSection, 'marginBottom', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Margin Left (mm)</label>
                                <input type="number" value={currentMargins.marginLeft} onChange={e => handleChange(activeSection, 'marginLeft', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Margin Right (mm)</label>
                                <input type="number" value={currentMargins.marginRight} onChange={e => handleChange(activeSection, 'marginRight', e.target.value)} className="w-full border p-2.5 rounded-xl text-sm font-semibold" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {configTab === 'header' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                        <h3 className="text-base font-black uppercase text-slate-800 border-b pb-4">Hospital Header Text</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Header Copy Text (HTML/CSS allowed)</label>
                                <textarea 
                                    value={settings.headerText || ''} 
                                    onChange={e => onUpdate({ ...settings, headerText: e.target.value })} 
                                    className="w-full h-32 border p-3 rounded-xl text-xs font-mono" 
                                    placeholder="Enter clinic header details (e.g. Hospital Name, Doctors, Contact info...)" 
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                                <label className="block text-[9px] font-black text-blue-600 uppercase">✨ Write / Format Header with AI</label>
                                <input 
                                    type="text" 
                                    value={headerAiPrompt} 
                                    onChange={e => setHeaderAiPrompt(e.target.value)} 
                                    className="w-full border border-blue-200 p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100" 
                                    placeholder="e.g. Generate header for J.J. Hospital with Dr. Mohit Agrawal (OB/GYN) and contact details" 
                                />
                                <button 
                                    onClick={handleGenerateHeaderWithAi} 
                                    disabled={isHeaderAiLoading} 
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {isHeaderAiLoading ? 'Generating text...' : 'Generate Header'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4">
                        <h3 className="text-base font-black uppercase text-slate-800 border-b pb-4">Hospital Header Logo / Banner</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Upload a hospital logo or letterhead banner. Set the margin space to place this logo at the absolute top of print outs.</p>
                        
                        {settings.headerImage ? (
                            <div className="space-y-4">
                                <div className="border border-slate-200 p-2.5 rounded-xl bg-slate-50 flex items-center justify-center h-36 overflow-hidden">
                                    <img src={settings.headerImage} alt="Header Preview" className="max-h-full max-w-full object-contain" />
                                </div>
                                <button onClick={handleRemoveLogo} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all">Remove Header Image</button>
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all text-center h-48">
                                <span className="text-3xl mb-2">🖼️</span>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Choose Header File</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">PNG, JPG or SVG (Max 1MB)</span>
                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            </label>
                        )}
                    </div>
                </div>
            )}

            {configTab === 'footer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                        <h3 className="text-base font-black uppercase text-slate-800 border-b pb-4">Hospital Footer Text</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Footer Copy Text (HTML/CSS allowed)</label>
                                <textarea 
                                    value={settings.footerText || ''} 
                                    onChange={e => onUpdate({ ...settings, footerText: e.target.value })} 
                                    className="w-full h-32 border p-3 rounded-xl text-xs font-mono" 
                                    placeholder="Enter footer terms (e.g. Valid for 10 days, Not valid for medico-legal cases...)" 
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                                <label className="block text-[9px] font-black text-blue-600 uppercase">✨ Write / Format Footer with AI</label>
                                <input 
                                    type="text" 
                                    value={footerAiPrompt} 
                                    onChange={e => setFooterAiPrompt(e.target.value)} 
                                    className="w-full border border-blue-200 p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100" 
                                    placeholder="e.g. Generate standard clinical disclaimer, valid for 7 days, and doctor signature note" 
                                />
                                <button 
                                    onClick={handleGenerateFooterWithAi} 
                                    disabled={isFooterAiLoading} 
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {isFooterAiLoading ? 'Generating text...' : 'Generate Footer'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4">
                        <h3 className="text-base font-black uppercase text-slate-800 border-b pb-4">Hospital Footer Logo / Image</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Upload a custom footer graphic, stamp, or signature image. This image will automatically scale to print at the bottom of the page.</p>
                        
                        {settings.footerImage ? (
                            <div className="space-y-4">
                                <div className="border border-slate-200 p-2.5 rounded-xl bg-slate-50 flex items-center justify-center h-36 overflow-hidden">
                                    <img src={settings.footerImage} alt="Footer Preview" className="max-h-full max-w-full object-contain" />
                                </div>
                                <button onClick={handleRemoveFooterLogo} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all">Remove Footer Image</button>
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all text-center h-48">
                                <span className="text-3xl mb-2">🖼️</span>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Choose Footer File</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">PNG, JPG or SVG (Max 1MB)</span>
                                <input type="file" accept="image/*" onChange={handleFooterFileChange} className="hidden" />
                            </label>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  patients, visits, labOrders, inventory, reportHistory, consultants, specialties, printSettings, billingRates = DEFAULT_PRICES, wards, systemUsers,
  onUpdateInventory, onUpdateReports, onUpdatePatients, onUpdateLabOrders, onUpdateVisits, onUpdateConsultants, onUpdateSpecialties, onUpdateBillingRates, onUpdateWards, onUpdateSystemUsers, onUpdatePrintSettings, userRole 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'search' | 'consultants' | 'specialties' | 'billing' | 'bed_master' | 'print_config' | 'mock_data'>('users');
  
  // Master Search State
  const [searchParams, setSearchParams] = useState({ startDate: '', endDate: '', query: '' });
  const [searchResults, setSearchResults] = useState<VisitRecord[]>([]);

  useEffect(() => {
      if (searchParams.query || (searchParams.startDate && searchParams.endDate)) {
          const lowerQ = searchParams.query.toLowerCase();
          const results = visits.filter(v => {
              const p = patients.find(pat => pat.id === v.patientId);
              const matchesQuery = !lowerQ || (p?.name.toLowerCase().includes(lowerQ) || v.assignedDoctor?.toLowerCase().includes(lowerQ));
              const matchesDate = (!searchParams.startDate || v.date >= searchParams.startDate) && (!searchParams.endDate || v.date <= searchParams.endDate);
              return matchesQuery && matchesDate;
          });
          setSearchResults(results);
      } else {
          setSearchResults([]);
      }
  }, [searchParams, visits, patients]);

  return (
    <div className="space-y-8">
      {/* HEADER TABS */}
      <div className="flex flex-wrap gap-2 bg-slate-200 p-1.5 rounded-2xl w-fit">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>Users & Roles</button>
          <button onClick={() => setActiveTab('search')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'search' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>Master Search</button>
          <button onClick={() => setActiveTab('consultants')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'consultants' ? 'bg-white text-purple-600 shadow' : 'text-slate-500'}`}>Consultants</button>
          <button onClick={() => setActiveTab('specialties')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'specialties' ? 'bg-white text-pink-600 shadow' : 'text-slate-500'}`}>Specialties</button>
          <button onClick={() => setActiveTab('billing')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'billing' ? 'bg-white text-amber-600 shadow' : 'text-slate-500'}`}>Billing Rates</button>
          <button onClick={() => setActiveTab('bed_master')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'bed_master' ? 'bg-white text-teal-600 shadow' : 'text-slate-500'}`}>Bed Master</button>
          <button onClick={() => setActiveTab('print_config')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'print_config' ? 'bg-white text-rose-600 shadow' : 'text-slate-500'}`}>Print Settings</button>
          <button onClick={() => setActiveTab('mock_data')} className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'mock_data' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500'}`}>Test Data</button>
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[500px]">
          {activeTab === 'users' && <UserManager systemUsers={systemUsers} consultants={consultants} onUpdateUsers={onUpdateSystemUsers} onUpdateConsultants={onUpdateConsultants} />}

          {activeTab === 'search' && (
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex gap-4 items-end">
                      <div><label className="block text-[10px] font-bold uppercase text-slate-400">Start Date</label><input type="date" value={searchParams.startDate} onChange={e => setSearchParams({...searchParams, startDate: e.target.value})} className="border p-2 rounded-lg text-sm font-bold" /></div>
                      <div><label className="block text-[10px] font-bold uppercase text-slate-400">End Date</label><input type="date" value={searchParams.endDate} onChange={e => setSearchParams({...searchParams, endDate: e.target.value})} className="border p-2 rounded-lg text-sm font-bold" /></div>
                      <div className="flex-grow"><label className="block text-[10px] font-bold uppercase text-slate-400">Search Query</label><input placeholder="Patient Name / Doctor Name" value={searchParams.query} onChange={e => setSearchParams({...searchParams, query: e.target.value})} className="w-full border p-2 rounded-lg text-sm font-bold" /></div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase"><tr><th className="p-4">Date</th><th className="p-4">Patient</th><th className="p-4">Doctor</th><th className="p-4 text-right">Fee/Bill</th></tr></thead>
                          <tbody>
                              {searchResults.map(v => {
                                  const p = patients.find(pat => pat.id === v.patientId);
                                  return (
                                      <tr key={v.id} className="hover:bg-slate-50 border-b">
                                          <td className="p-4">{v.date}</td>
                                          <td className="p-4 font-bold">{p?.name}</td>
                                          <td className="p-4">{v.assignedDoctor}</td>
                                          <td className="p-4 text-right font-mono">₹{v.finalBill?.grandTotal || v.fees}</td>
                                      </tr>
                                  )
                              })}
                              {searchResults.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No records found.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'consultants' && <ConsultantsManager consultants={consultants} specialties={specialties} onUpdate={onUpdateConsultants} />}
          {activeTab === 'specialties' && <SpecialtiesManager specialties={specialties} onUpdate={onUpdateSpecialties} />}
          {activeTab === 'billing' && <BillingRatesManager billingRates={billingRates} onUpdate={onUpdateBillingRates} />}
          {activeTab === 'bed_master' && <BedMasterManager wards={wards} onUpdateWards={onUpdateWards} />}
          {activeTab === 'print_config' && <PrintSettingsManager settings={printSettings} onUpdate={onUpdatePrintSettings} />}
          {activeTab === 'mock_data' && <MockDataInjector patients={patients} visits={visits} onUpdatePatients={onUpdatePatients} onUpdateVisits={onUpdateVisits} />}
      </div>
    </div>
  );
};

export default AdminPanel;
