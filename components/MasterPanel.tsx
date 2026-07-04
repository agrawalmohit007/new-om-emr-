
import React, { useState } from 'react';
import { ClinicalTemplate, MedicationMasterData, PharmacyItem, MedicationDrug } from '../types';

interface MasterPanelProps {
  clinicalTemplates: ClinicalTemplate[];
  onUpdateTemplates: (templates: ClinicalTemplate[]) => void;
  medicationMaster: MedicationMasterData;
  onUpdateMedicationMaster: (data: MedicationMasterData) => void;
  pharmacyInventory: PharmacyItem[];
  onUpdatePharmacyInventory: (items: PharmacyItem[]) => void;
}

const MasterPanel: React.FC<MasterPanelProps> = ({ 
    clinicalTemplates, onUpdateTemplates, medicationMaster, onUpdateMedicationMaster, pharmacyInventory, onUpdatePharmacyInventory 
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'med_groups' | 'med_drugs' | 'med_freq' | 'med_advice' | 'pharmacy_link'>('templates');

  // Template State
  const [newTemplate, setNewTemplate] = useState<{ title: string; content: string; category: ClinicalTemplate['category'] }>({
    title: '', content: '', category: 'consent'
  });

  // Medication States
  const [newGroup, setNewGroup] = useState('');
  const [newFreq, setNewFreq] = useState('');
  const [newAdvice, setNewAdvice] = useState('');
  
  // Drug Editing State
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [newDrug, setNewDrug] = useState<Partial<MedicationDrug>>({ group: '', name: '', defaultDose: '', defaultFrequency: '', defaultDuration: '', defaultAdvice: '' });

  // Template Handlers
  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.title || !newTemplate.content) { alert("Please fill all fields"); return; }
    onUpdateTemplates([...clinicalTemplates, { id: Date.now().toString(), ...newTemplate }]);
    setNewTemplate({ title: '', content: '', category: newTemplate.category });
    alert("Template added!");
  };
  const handleDeleteTemplate = (id: string) => {
    if (confirm("Delete template?")) onUpdateTemplates(clinicalTemplates.filter(t => t.id !== id));
  };

  // Medication Handlers
  const addGroup = () => {
      if(!newGroup) return;
      if(medicationMaster.groups.includes(newGroup)) { alert('Group exists'); return; }
      onUpdateMedicationMaster({ ...medicationMaster, groups: [...medicationMaster.groups, newGroup] });
      setNewGroup('');
  };
  const delGroup = (g: string) => {
      if(confirm('Delete group? This will affect linked drugs.')) {
          onUpdateMedicationMaster({ 
              ...medicationMaster, 
              groups: medicationMaster.groups.filter(x => x !== g),
              drugs: medicationMaster.drugs.filter(d => d.group !== g) // Cleanup drugs
          });
      }
  };

  const handleSaveDrug = () => {
      if(!newDrug.group || !newDrug.name) { alert('Select Group and Enter Name'); return; }
      
      let updatedDrugs = [...medicationMaster.drugs];

      if (editingDrugId) {
          // Update existing drug
          updatedDrugs = updatedDrugs.map(d => d.id === editingDrugId ? {
              ...d,
              group: newDrug.group!,
              name: newDrug.name!,
              defaultDose: newDrug.defaultDose,
              defaultFrequency: newDrug.defaultFrequency,
              defaultDuration: newDrug.defaultDuration,
              defaultAdvice: newDrug.defaultAdvice
          } : d);
      } else {
          // Add new drug
          updatedDrugs.push({ 
              id: Date.now().toString(), 
              group: newDrug.group!, 
              name: newDrug.name!,
              defaultDose: newDrug.defaultDose,
              defaultFrequency: newDrug.defaultFrequency,
              defaultDuration: newDrug.defaultDuration,
              defaultAdvice: newDrug.defaultAdvice
          });
      }

      onUpdateMedicationMaster({ ...medicationMaster, drugs: updatedDrugs });
      
      // Reset
      setNewDrug({ group: newDrug.group, name: '', defaultDose: '', defaultFrequency: '', defaultDuration: '', defaultAdvice: '' }); // Keep group for convenience
      setEditingDrugId(null);
  };

  const handleEditDrug = (drug: MedicationDrug) => {
      setNewDrug({
          group: drug.group,
          name: drug.name,
          defaultDose: drug.defaultDose || '',
          defaultFrequency: drug.defaultFrequency || '',
          defaultDuration: drug.defaultDuration || '',
          defaultAdvice: drug.defaultAdvice || ''
      });
      setEditingDrugId(drug.id);
      
      // Scroll to top of form
      const formElement = document.getElementById('drug-form-container');
      if(formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setNewDrug({ group: '', name: '', defaultDose: '', defaultFrequency: '', defaultDuration: '', defaultAdvice: '' });
      setEditingDrugId(null);
  };

  const delDrug = (id: string) => {
      if(confirm('Delete drug?')) onUpdateMedicationMaster({ ...medicationMaster, drugs: medicationMaster.drugs.filter(d => d.id !== id) });
  };

  const addFreq = () => {
      if(!newFreq) return;
      onUpdateMedicationMaster({ ...medicationMaster, frequencies: [...medicationMaster.frequencies, newFreq] });
      setNewFreq('');
  };
  const delFreq = (f: string) => {
      if(confirm('Delete frequency?')) onUpdateMedicationMaster({ ...medicationMaster, frequencies: medicationMaster.frequencies.filter(x => x !== f) });
  };

  const addAdvice = () => {
      if(!newAdvice) return;
      onUpdateMedicationMaster({ ...medicationMaster, instructions: [...medicationMaster.instructions, newAdvice] });
      setNewAdvice('');
  };
  const delAdvice = (a: string) => {
      if(confirm('Delete advice?')) onUpdateMedicationMaster({ ...medicationMaster, instructions: medicationMaster.instructions.filter(x => x !== a) });
  };

  const handleToggleGroup = (item: PharmacyItem, group: string) => {
      // Initialize if undefined or not an array (fix for runtime type errors)
      const currentGroups = Array.isArray(item.rxGroup) ? item.rxGroup : [];
      let newGroups: string[];

      if (currentGroups.includes(group)) {
          newGroups = currentGroups.filter(g => g !== group);
      } else {
          newGroups = [...currentGroups, group];
      }

      // 1. Update Pharmacy Item
      const updatedInventory = pharmacyInventory.map(i => i.id === item.id ? { ...i, rxGroup: newGroups } : i);
      onUpdatePharmacyInventory(updatedInventory);

      // 2. Sync to Clinical Master (Prescription List)
      // Check if this drug name already exists in the medication master
      const drugName = item.name;
      const existingDrugIndex = medicationMaster.drugs.findIndex(d => d.name.toLowerCase() === drugName.toLowerCase());
      
      let updatedDrugs = [...medicationMaster.drugs];
      if (existingDrugIndex >= 0) {
          if (!currentGroups.includes(group)) {
               updatedDrugs[existingDrugIndex] = { ...updatedDrugs[existingDrugIndex], group: group };
          }
      } else {
          updatedDrugs.push({
              id: Date.now().toString(),
              name: drugName,
              group: group
          });
      }
      onUpdateMedicationMaster({ ...medicationMaster, drugs: updatedDrugs });
  };

  const categories: { key: ClinicalTemplate['category']; label: string }[] = [
    { key: 'consent', label: 'Consent Forms' },
    { key: 'complaints', label: 'OPD Complaints' },
    { key: 'oh', label: 'Obstetric History' },
    { key: 'mh', label: 'Menstrual History' },
    { key: 'gen_exam', label: 'Gen. Examination' },
    { key: 'phys_exam', label: 'Phys. Examination' },
    { key: 'prescription', label: 'Prescription (Rx)' },
    { key: 'ipd_round', label: 'IPD Doctor Round' },
    { key: 'nursing_drug_chart', label: 'Nursing Drug Chart' },
    { key: 'nursing_complaint', label: 'Nursing Complaint' },
    { key: 'nursing_gen_cond', label: 'Nursing Gen. Cond' },
    { key: 'nursing_pa', label: 'Nursing P/A' },
    { key: 'nursing_pv', label: 'Nursing P/V' },
    { key: 'nursing_plan', label: 'Nursing Plan' },
    { key: 'bill_package', label: 'Bill Template' },
    { key: 'round_gc', label: 'Doctor Round: GC' },
    { key: 'round_cvs', label: 'Doctor Round: CVS' },
    { key: 'round_rs', label: 'Doctor Round: RS' },
    { key: 'round_investigation', label: 'Doctor Round: Investigation' },
    { key: 'round_advice', label: 'Doctor Round: Advice' },
    { key: 'round_rx', label: 'Doctor Round: Rx' },
  ];

  return (
    <div className="space-y-8">
        <div className="flex space-x-2 bg-slate-200 p-1 rounded-2xl w-fit overflow-x-auto">
            <button onClick={() => setActiveTab('templates')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'templates' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500'}`}>Clinical Templates</button>
            <button onClick={() => setActiveTab('pharmacy_link')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'pharmacy_link' ? 'bg-white text-green-600 shadow-lg' : 'text-slate-500'}`}>Pharmacy Stock Medication</button>
            <button onClick={() => setActiveTab('med_groups')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'med_groups' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500'}`}>Rx Groups</button>
            <button onClick={() => setActiveTab('med_drugs')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'med_drugs' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500'}`}>Rx Drugs</button>
            <button onClick={() => setActiveTab('med_freq')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'med_freq' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500'}`}>Rx Frequency</button>
            <button onClick={() => setActiveTab('med_advice')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'med_advice' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500'}`}>Rx Advice</button>
        </div>

      {activeTab === 'templates' && (
        <>
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Clinical Template Management</h2>
                <form onSubmit={handleAddTemplate} className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Category</label>
                    <select value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value as any })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold">
                        {categories.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
                    </select>
                    </div>
                    <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Title</label>
                    <input placeholder="e.g. LSCS Consent" value={newTemplate.title} onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold" />
                    </div>
                    <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Content (Use {'{{PATIENT}}'} and {'{{DOCTOR}}'} as placeholders)</label>
                    <textarea rows={4} placeholder="Enter text..." value={newTemplate.content} onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm" />
                    </div>
                </div>
                <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-700 transition-all">Add Template</button>
                </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => {
                const catTemplates = clinicalTemplates.filter(t => t.category === cat.key);
                if (catTemplates.length === 0) return null;
                return (
                    <div key={cat.key} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-800 text-white p-4 font-black uppercase text-[10px] tracking-[0.2em] flex justify-between">{cat.label}<span>{catTemplates.length}</span></div>
                    <div className="p-4 flex-grow overflow-y-auto max-h-[300px] space-y-3 custom-scrollbar">
                        {catTemplates.map(t => (
                        <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 group relative">
                            <p className="font-bold text-slate-800 text-xs mb-1">{t.title}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-2 italic truncate">{t.content.length > 50 ? t.content.substring(0, 50) + '...' : t.content}</p>
                            <button onClick={() => handleDeleteTemplate(t.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                        </div>
                        ))}
                    </div>
                    </div>
                );
                })}
            </div>
        </>
      )}

      {/* Pharmacy Stock Link Tab */}
      {activeTab === 'pharmacy_link' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pharmacy Stock Medication</h2>
                      <p className="text-xs text-slate-500 mt-1">Assign clinical groups to pharmacy items. Items can belong to multiple groups.</p>
                  </div>
                  <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase border border-green-100">
                      {(pharmacyInventory || []).length} Items In Stock
                  </div>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[600px] custom-scrollbar">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase border-b border-slate-200 sticky top-0">
                          <tr>
                              <th className="p-4 w-1/4 bg-slate-50">Drug Name</th>
                              <th className="p-4 w-1/4 bg-slate-50">Generic / Salt</th>
                              <th className="p-4 w-1/6 text-center bg-slate-50">Stock</th>
                              <th className="p-4 w-1/3 bg-slate-50">Assigned Rx Groups</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(pharmacyInventory || []).map(item => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="p-4 font-bold text-slate-800">{item.name}</td>
                                  <td className="p-4 text-slate-500 text-xs">{item.genericName || '-'}</td>
                                  <td className="p-4 text-center font-mono font-bold text-blue-600">{item.quantity}</td>
                                  <td className="p-4">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                          {(Array.isArray(item.rxGroup) ? item.rxGroup : []).map(g => (
                                              <span key={g} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 border border-blue-200">
                                                  {g}
                                                  <button onClick={() => handleToggleGroup(item, g)} className="text-blue-400 hover:text-red-500">&times;</button>
                                              </span>
                                          ))}
                                          {(Array.isArray(item.rxGroup) ? item.rxGroup : []).length === 0 && <span className="text-slate-400 text-xs italic">No groups assigned</span>}
                                      </div>
                                      <select 
                                          value=""
                                          onChange={(e) => {
                                              if(e.target.value) handleToggleGroup(item, e.target.value);
                                          }}
                                          className="w-full border rounded-lg px-2 py-1 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                      >
                                          <option value="">+ Add Group</option>
                                          {medicationMaster.groups.filter(g => !(Array.isArray(item.rxGroup) ? item.rxGroup : []).includes(g)).map(g => (
                                              <option key={g} value={g}>{g}</option>
                                          ))}
                                      </select>
                                  </td>
                              </tr>
                          ))}
                          {(pharmacyInventory || []).length === 0 && (
                              <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No pharmacy inventory items found. Add items in Pharmacy Dashboard first.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Medication Groups */}
      {activeTab === 'med_groups' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-2xl">
              {/* ... same content ... */}
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">Medication Groups</h2>
              <div className="flex gap-4 mb-6">
                  <input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="e.g. Antibiotics, Analgesics" className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold uppercase text-xs" />
                  <button onClick={addGroup} className="bg-purple-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700">Add</button>
              </div>
              <ul className="space-y-2 max-h-[500px] overflow-auto custom-scrollbar">
                  {medicationMaster.groups.map(g => (
                      <li key={g} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700 text-sm uppercase">{g}</span>
                          <button onClick={() => delGroup(g)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                      </li>
                  ))}
              </ul>
          </div>
      )}

      {/* Medication Drugs */}
      {activeTab === 'med_drugs' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
              {/* ... same content ... */}
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">Medication Inventory (Manual)</h2>
              <div id="drug-form-container" className={`bg-purple-50 p-6 rounded-2xl border mb-6 transition-all ${editingDrugId ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50' : 'border-purple-100'}`}>
                  {/* ... Drug form ... */}
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                          {editingDrugId ? `Editing Drug` : 'Add New Drug'}
                      </h3>
                      {editingDrugId && (
                          <button onClick={handleCancelEdit} className="text-xs font-bold text-red-500 hover:underline">Cancel Edit</button>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <select value={newDrug.group} onChange={e => setNewDrug({...newDrug, group: e.target.value})} className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs uppercase">
                          <option value="">Select Group</option>
                          {medicationMaster.groups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <div className="md:col-span-2">
                          <input value={newDrug.name} onChange={e => setNewDrug({...newDrug, name: e.target.value})} placeholder="Drug Name & Strength (e.g. Tab. Calpol 500mg)" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs" />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <input value={newDrug.defaultDose || ''} onChange={e => setNewDrug({...newDrug, defaultDose: e.target.value})} placeholder="Default Dose (e.g. 1 Tab)" className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs" />
                      <select value={newDrug.defaultFrequency || ''} onChange={e => setNewDrug({...newDrug, defaultFrequency: e.target.value})} className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs">
                          <option value="">Def. Freq</option>
                          {medicationMaster.frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <input value={newDrug.defaultDuration || ''} onChange={e => setNewDrug({...newDrug, defaultDuration: e.target.value})} placeholder="Def. Days (e.g. 5)" type="number" className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs" />
                      <select value={newDrug.defaultAdvice || ''} onChange={e => setNewDrug({...newDrug, defaultAdvice: e.target.value})} className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs">
                          <option value="">Def. Advice</option>
                          {medicationMaster.instructions.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                  </div>

                  <div className="flex gap-4">
                      <button onClick={handleSaveDrug} className={`flex-grow text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md ${editingDrugId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                          {editingDrugId ? 'Update Drug Details' : 'Add Drug to List'}
                      </button>
                      {editingDrugId && (
                          <button onClick={handleCancelEdit} className="bg-slate-200 text-slate-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300">
                              Cancel
                          </button>
                      )}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {medicationMaster.groups.map(g => (
                      <div key={g} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                          <div className="bg-slate-200 p-3 font-black text-slate-700 text-xs uppercase">{g}</div>
                          <div className="p-3 max-h-[250px] overflow-auto custom-scrollbar space-y-1">
                              {medicationMaster.drugs.filter(d => d.group === g).map(d => (
                                  <div key={d.id} className={`flex justify-between items-start text-xs p-2 rounded border transition-colors ${editingDrugId === d.id ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                      <div>
                                          <p className="font-bold text-slate-800">{d.name}</p>
                                          {(d.defaultFrequency || d.defaultDuration) && (
                                              <p className="text-[9px] text-slate-500">
                                                  {d.defaultDose} {d.defaultFrequency} x {d.defaultDuration}d ({d.defaultAdvice})
                                              </p>
                                          )}
                                      </div>
                                      <div className="flex gap-1">
                                          <button onClick={() => handleEditDrug(d)} className="text-blue-500 hover:text-blue-700 font-bold p-1" title="Edit">✏️</button>
                                          <button onClick={() => delDrug(d.id)} className="text-red-400 hover:text-red-600 font-bold p-1" title="Delete">&times;</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Medication Frequencies */}
      {activeTab === 'med_freq' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-2xl">
              {/* ... same content ... */}
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">Prescription Frequencies</h2>
              <div className="flex gap-4 mb-6">
                  <input value={newFreq} onChange={e => setNewFreq(e.target.value)} placeholder="e.g. BD, OD, TDS, HS" className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold uppercase text-xs" />
                  <button onClick={addFreq} className="bg-purple-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700">Add</button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                  {medicationMaster.frequencies.map(f => (
                      <li key={f} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700 text-sm uppercase">{f}</span>
                          <button onClick={() => delFreq(f)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                      </li>
                  ))}
              </ul>
          </div>
      )}

      {/* Medication Advice */}
      {activeTab === 'med_advice' && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-2xl">
              {/* ... same content ... */}
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">Standard Instructions/Advice</h2>
              <div className="flex gap-4 mb-6">
                  <input value={newAdvice} onChange={e => setNewAdvice(e.target.value)} placeholder="e.g. After Food, Empty Stomach" className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold uppercase text-xs" />
                  <button onClick={addAdvice} className="bg-purple-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700">Add</button>
              </div>
              <ul className="space-y-2 max-h-[500px] overflow-auto custom-scrollbar">
                  {medicationMaster.instructions.map(a => (
                      <li key={a} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700 text-sm">{a}</span>
                          <button onClick={() => delAdvice(a)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                      </li>
                  ))}
              </ul>
          </div>
      )}
    </div>
  );
};

export default MasterPanel;
