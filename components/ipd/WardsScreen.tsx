import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIpdContext } from './IpdContext';
import { Ward, IpdAdmission, Patient } from '../../types';

interface WardsScreenProps {
  wards: Ward[];
  onUpdatePatients: (data: Patient[]) => void;
  onUpdateAdmissions: (data: IpdAdmission[]) => void;
}

const WardsScreen: React.FC<WardsScreenProps> = ({ wards, onUpdatePatients, onUpdateAdmissions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { admissions, getPatient, patients, consultants, userRole } = useIpdContext();

  const isRegisters = location.pathname.includes('/ipd/registers');
  const params = new URLSearchParams(location.search);
  const [registerTab, setRegisterTab] = useState(params.get('tab') || 'labour');

  const [showAdmissionForm, setShowAdmissionForm] = useState<{wardId: string, bedId: string, bedNumber: string, wardName: string} | null>(null);
  const [newAdmissionState, setNewAdmissionState] = useState<{patientId: string, diagnosis: string, doctor: string, isNewPatient: boolean, name: string, age: string, mobile: string, gender: string}>({
    patientId: '', diagnosis: '', doctor: '', isNewPatient: false, name: '', age: '', mobile: '', gender: 'Male'
  });

  const renderRegisters = () => {
    const validAdmissions = Array.isArray(admissions) ? admissions : [];
    const filteredAdmissions = validAdmissions.filter((a) => {
      if (registerTab === "mrd") return a.status === "discharged";
      if (registerTab === "labour") {
        const hasLabour = getPatient(a.patientId)?.type === "obstetric" || getPatient(a.patientId)?.type === "gynecology";
        const hasDelivery = a.deliveryDetails || (a.labourProgress && a.labourProgress.length > 0) || (a.operativeNotes && Array.isArray(a.operativeNotes) && a.operativeNotes.some((n: any) => n?.procedureName?.toLowerCase()?.includes("lscs") || n?.procedureName?.toLowerCase()?.includes("delivery")));
        return hasLabour && hasDelivery;
      }
      if (registerTab === "ot") return a.operativeNotes && Array.isArray(a.operativeNotes) && a.operativeNotes.length > 0;
      return true;
    });

    return (
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] mt-6 mx-6">
        <div className="flex bg-slate-100 p-2 gap-2 border-b overflow-x-auto">
          {["labour", "ot", "consent", "blood", "mrd"].map((tab) => (
            <button key={tab} onClick={() => { setRegisterTab(tab); navigate('/ipd/registers?tab=' + tab); }} className={`px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest whitespace-nowrap ${registerTab === tab ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
              {tab === "mrd" ? "MRD" : tab + " Register"}
            </button>
          ))}
        </div>
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              {registerTab === "labour" ? (
                <tr>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Date & Time</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Patient Name (Age)</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Mode</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Indication</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Baby Sex & Wt</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Apgar (1m/5m)</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Liquor / Blood Loss</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Conducted By</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Action</th>
                </tr>
              ) : registerTab === "ot" ? (
                <tr>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Date</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Patient Name</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Procedure</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Surgeon / Assistant</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Anesthesia / Anesthetist</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Incision / Liquor</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Est. Blood Loss</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Action</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Date</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Patient Name</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Doctor</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Details / Procedures</th>
                  <th className="p-3 font-black uppercase text-slate-500 border-b">Action</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredAdmissions.map((a) => {
                const p = getPatient(a.patientId);
                
                if (registerTab === "labour") {
                  const deliveryDateStr = a.deliveryDetails 
                    ? `${a.deliveryDetails.deliveryDate} ${a.deliveryDetails.deliveryTime}` 
                    : new Date(a.admissionDate).toLocaleString();
                  const mode = a.deliveryDetails?.method || "-";
                  const indication = a.deliveryDetails?.indication || "-";
                  const baby = a.deliveryDetails 
                    ? `${a.deliveryDetails.babySex} (${a.deliveryDetails.babyWeight}kg)` 
                    : "-";
                  const apgar = a.deliveryDetails?.apgar1Min
                    ? `${a.deliveryDetails.apgar1Min} / ${a.deliveryDetails.apgar5Min || "-"}`
                    : "-";
                  const liqBlood = a.deliveryDetails 
                    ? `Liq: ${a.deliveryDetails.liquor || "-"} / EBL: ${a.deliveryDetails.bloodLoss || "-"}` 
                    : "-";
                  const conductedBy = a.deliveryDetails?.conductedBy || a.primaryDoctor;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50 border-b">
                      <td className="p-3 font-bold">{deliveryDateStr}</td>
                      <td className="p-3 font-black text-slate-800">
                        {p?.name || "Unknown Patient"} {p?.age ? `(${p.age})` : ""}
                      </td>
                      <td className="p-3 font-semibold text-pink-600">{mode}</td>
                      <td className="p-3">{indication}</td>
                      <td className="p-3">{baby}</td>
                      <td className="p-3">{apgar}</td>
                      <td className="p-3 text-slate-500">{liqBlood}</td>
                      <td className="p-3">{conductedBy}</td>
                      <td className="p-3">
                        <button onClick={() => navigate('/ipd/admission/' + a.id + '/rounds')} className="text-blue-600 font-bold hover:underline">View File</button>
                      </td>
                    </tr>
                  );
                }

                if (registerTab === "ot") {
                  const op = a.operativeNotes?.[0]; // Show first note details
                  const opDate = op ? new Date(op.date).toLocaleDateString() : new Date(a.admissionDate).toLocaleDateString();
                  const procNames = Array.isArray(a.operativeNotes) ? a.operativeNotes.map((n: any) => n?.procedureName || "").join(", ") : "-";
                  const surgeonStr = op ? `${op.surgeonName} ${op.assistantSurgeonName ? ` / ${op.assistantSurgeonName}` : ""}` : a.primaryDoctor;
                  const anesthesiaStr = op ? `${op.anesthesiaType || "-"} (${op.anesthetistName || "-"})` : "-";
                  const incisionLiquor = op ? `Inc: ${op.incisionType || "-"} / Liq: ${op.liquor || "-"}` : "-";
                  const bloodLoss = op?.bloodLoss || "-";

                  return (
                    <tr key={a.id} className="hover:bg-slate-50 border-b">
                      <td className="p-3 font-bold">{opDate}</td>
                      <td className="p-3 font-black text-slate-800">{p?.name || "Unknown Patient"}</td>
                      <td className="p-3 font-semibold text-slate-700">{procNames}</td>
                      <td className="p-3">{surgeonStr}</td>
                      <td className="p-3">{anesthesiaStr}</td>
                      <td className="p-3 text-slate-500">{incisionLiquor}</td>
                      <td className="p-3">{bloodLoss}</td>
                      <td className="p-3">
                        <button onClick={() => navigate('/ipd/admission/' + a.id + '/rounds')} className="text-blue-600 font-bold hover:underline">View File</button>
                      </td>
                    </tr>
                  );
                }

                // Default MRC/blood/consent tabs
                let details = a.diagnosis;
                return (
                  <tr key={a.id} className="hover:bg-slate-50 border-b">
                    <td className="p-3 font-bold">{new Date(a.admissionDate).toLocaleDateString()}</td>
                    <td className="p-3 font-black text-slate-800">{p?.name || "Unknown Patient"}</td>
                    <td className="p-3">{a.primaryDoctor}</td>
                    <td className="p-3">{details}</td>
                    <td className="p-3">
                      <button onClick={() => navigate('/ipd/admission/' + a.id + '/rounds')} className="text-blue-600 font-bold hover:underline">View File</button>
                    </td>
                  </tr>
                );
              })}
              {filteredAdmissions.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-slate-400 italic">No records found for this register.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const validWards = Array.isArray(wards) ? wards : [];
  const validAdmissions = Array.isArray(admissions) ? admissions : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-slate-200 p-1 rounded-2xl w-fit mx-6 mt-6">
        <button onClick={() => navigate('/ipd/wards')} className={`px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest ${!isRegisters ? "bg-white text-blue-600 shadow" : "text-slate-500"}`}>Ward View</button>
        <button onClick={() => navigate('/ipd/registers')} className={`px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest ${isRegisters ? "bg-white text-purple-600 shadow" : "text-slate-500"}`}>Registers</button>
      </div>

      {isRegisters ? (
        <div className="px-6">{renderRegisters()}</div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {validWards.length === 0 ? (
            <div className="col-span-3 text-center text-slate-500 font-bold mt-10">No wards configured or available yet. Use Admin Panel to manage Wards</div>
          ) : validWards.map((ward) => (
            <div key={ward.id} className="bg-white rounded-xl shadow p-4 border border-slate-200">
              <h3 className="font-bold text-lg mb-4">{ward.name}</h3>
              <div className="grid grid-cols-2 gap-3">
                {Array.isArray(ward.beds) ? ward.beds.map((bed: any) => {
                  const adm = validAdmissions.find((a) => a.wardId === ward.id && a.bedId === bed.id && a.status === "active");
                  const pat = adm ? getPatient(adm.patientId) : null;
                  return (
                    <div key={bed.id} onClick={() => adm ? navigate('/ipd/admission/' + adm.id + (userRole === 'nurse' ? '/nursing' : '/rounds')) : setShowAdmissionForm({wardId: ward.id, bedId: bed.id, bedNumber: bed.number, wardName: ward.name})} className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${adm ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300"}`}>
                      <div className="flex justify-between items-center"><span className="font-black text-xs uppercase">{bed.number}</span><span className={`w-2 h-2 rounded-full ${adm ? "bg-blue-500" : "bg-green-500"}`}></span></div>
                      {adm && pat ? (<div className="mt-2"><p className="font-bold text-sm truncate">{pat.name}</p><p className="text-[10px] text-slate-500">{adm.primaryDoctor}</p></div>) : (<div className="mt-2 text-xs text-slate-400 font-bold uppercase">Available</div>)}
                    </div>
                  );
                }) : <div className="col-span-2 text-xs text-slate-400">No beds configured.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admission Form */}
      {showAdmissionForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white"><div><h3 className="font-black text-xl">Admit New Patient</h3><p className="text-sm opacity-80 mt-1">Ward {showAdmissionForm.wardName} - Bed {showAdmissionForm.bedNumber}</p></div><button onClick={() => { setShowAdmissionForm(null); setNewAdmissionState({patientId: '', diagnosis: '', doctor: '', isNewPatient: false, name: '', age: '', mobile: '', gender: 'Male'}); }} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button></div>
            <div className="p-6 space-y-6">
              <div className="flex gap-4 border-b border-slate-200 pb-4"><button onClick={() => setNewAdmissionState({...newAdmissionState, isNewPatient: false, patientId: ''})} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${!newAdmissionState.isNewPatient ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Existing Patient</button><button onClick={() => setNewAdmissionState({...newAdmissionState, isNewPatient: true, name: '', age: '', mobile: ''})} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${newAdmissionState.isNewPatient ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>New Patient</button></div>
              {!newAdmissionState.isNewPatient ? (<div><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-2">Select Patient</label><select title="Select Patient" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-50 outline-none" value={newAdmissionState.patientId} onChange={(e) => setNewAdmissionState({...newAdmissionState, patientId: e.target.value})}><option value="">-- Choose Patient --</option>{patients.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.age}) - {p.mobile}</option>))}</select></div>) : (<div className="grid grid-cols-2 gap-4"><div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Full Name</label><input title="Name" placeholder="Patient Name" value={newAdmissionState.name} onChange={e => setNewAdmissionState({...newAdmissionState, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" /></div><div><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Age / Sex</label><div className="flex gap-2"><input title="Age" placeholder="Age" value={newAdmissionState.age} onChange={e => setNewAdmissionState({...newAdmissionState, age: e.target.value})} className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" /><select title="Gender" value={newAdmissionState.gender} onChange={e => setNewAdmissionState({...newAdmissionState, gender: e.target.value})} className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none"><option>Male</option><option>Female</option><option>Other</option></select></div></div><div><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Mobile</label><input title="Mobile" placeholder="Mobile Number" value={newAdmissionState.mobile} onChange={e => setNewAdmissionState({...newAdmissionState, mobile: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" /></div></div>)}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100"><div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Provisional Diagnosis / Reason</label><input title="Diagnosis" placeholder="e.g. Acute Appendicitis" value={newAdmissionState.diagnosis} onChange={e => setNewAdmissionState({...newAdmissionState, diagnosis: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" /></div><div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase ml-1 mb-1">Admitting Doctor</label><select title="Select Doctor" value={newAdmissionState.doctor} onChange={e => setNewAdmissionState({...newAdmissionState, doctor: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none"><option value="">-- Assign Doctor --</option>{consultants?.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div></div>
              <div className="pt-4 flex justify-end"><button onClick={() => { let pid = newAdmissionState.patientId; if (newAdmissionState.isNewPatient) { if (!newAdmissionState.name) { alert("Name required"); return; } const newP: Patient = { id: 'pat-' + Date.now().toString() + Math.floor(Math.random()*1000).toString(), name: newAdmissionState.name, age: newAdmissionState.age, type: newAdmissionState.gender === 'Female' ? 'gynecology' : 'general', mobile: newAdmissionState.mobile, address: '', registeredDate: new Date().toISOString() }; onUpdatePatients([...patients, newP]); pid = newP.id; } if (!pid) { alert("Please select or create a patient."); return; } if (!newAdmissionState.doctor) { alert("Please select an admitting doctor."); return;} const newAdm: IpdAdmission = { id: 'adm-' + Date.now().toString() + Math.floor(Math.random()*1000).toString(), patientId: pid, admissionDate: new Date().toISOString(), wardId: showAdmissionForm.wardId, bedId: showAdmissionForm.bedId, diagnosis: newAdmissionState.diagnosis, status: 'active', primaryDoctor: newAdmissionState.doctor, dailyCharges: 0, roundNotes: [], medications: [], nursingNotes: [], fluidBalance: [], charges: [] }; onUpdateAdmissions([...admissions, newAdm]); setShowAdmissionForm(null); setNewAdmissionState({patientId: '', diagnosis: '', doctor: '', isNewPatient: false, name: '', age: '', mobile: '', gender: 'Male'}); }} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-700 transition">Admit Patient</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default WardsScreen;
