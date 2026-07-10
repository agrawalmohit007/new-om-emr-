import React from 'react';
import { Patient, VisitRecord, LabOrder } from '../types';

interface MockDataInjectorProps {
    patients: Patient[];
    visits: VisitRecord[];
    labOrders: LabOrder[];
    onUpdatePatients: (p: Patient[]) => void;
    onUpdateVisits: (v: VisitRecord[] | ((prev: VisitRecord[]) => VisitRecord[])) => void;
    onUpdateLabOrders: (o: LabOrder[]) => void;
}

const MockDataInjector: React.FC<MockDataInjectorProps> = ({ patients, visits, labOrders, onUpdatePatients, onUpdateVisits, onUpdateLabOrders }) => {
    
    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    const handleInject = () => {
        const newPatients: Patient[] = [...patients];
        const newVisits: VisitRecord[] = [...visits];
        const newLabOrders: LabOrder[] = [...labOrders];

        const today = new Date().toISOString().slice(0, 10);

        // 1. PIH Patient - 14 visits in past, 1 current visit
        const p1Id = generateId();
        newPatients.push({
            id: p1Id,
            name: "Radhika Sharma (PIH Case)",
            age: "26",
            mobile: "9876543210",
            address: "Sector 14, Delhi",
            type: "obstetric",
            uhid: "UHID-" + Math.floor(1000 + Math.random() * 9000),
            isPreviouslyRegistered: true
        });

        for(let i=0; i<14; i++) {
            newVisits.push({
                id: generateId(),
                patientId: p1Id,
                date: `2025-${(10 + Math.floor(i/3)).toString().padStart(2, '0')}-${(1 + (i*2)%28).toString().padStart(2, '0')}`,
                visitType: "follow-up-short",
                assignedDoctor: "Dr. Mohit Agrawal",
                isApproved: true,
                episodeId: `ep_anc_${p1Id}`,
                episodeName: "ANC Pregnancy",
                complaints: "Routine ANC Checkup",
                generalExamination: "G1P0A0, Pregnancy Induced Hypertension (PIH)",
                vitals: { bp: i > 8 ? "140/90" : "120/80", pulse: "80", weight: (60 + i).toString(), height: "160", spo2: "98" },
                remarks: "Patient is compliant with medication. Following WHO guidelines for PIH management.",
                prescription: "Tab. Labetalol 100mg BD x 15 Days\nInj. TT 1st Dose Given",
                fees: 0,
                orders: { id: `o-${generateId()}`, patientId: p1Id, tests: { cbc: false, serology: false, urine: false, other: false, widal: false, crp: false, hormone: false, semen: false }, ultrasound: false, status: 'pending', timestamp: Date.now() }
            });
        }
        // Current Visit (15th) - 38 Weeks
        newVisits.push({
            id: generateId(), patientId: p1Id, date: today, visitType: "follow-up-short", assignedDoctor: "Dr. Mohit Agrawal", isApproved: false, episodeId: `ep_anc_${p1Id}`, episodeName: "ANC Pregnancy",
            complaints: "38 Weeks ANC, PIH Follow-up, TT Taken 2 Times",
            generalExamination: "G1P0A0, 38 Weeks POG, PIH",
            vitals: { bp: "135/85", pulse: "82", weight: "75", height: "160", spo2: "98" },
            remarks: "WHO Guidelines followed. BP controlled. Plan for admission next week.",
            prescription: "Tab. Labetalol 100mg BD x 7 Days",
            fees: 200,
            orders: { id: `o-${generateId()}`, patientId: p1Id, tests: { cbc: true, urine: true } as any, status: 'pending', timestamp: Date.now() }
        });
        
        // Lab Orders for PIH
        newLabOrders.push({
            id: generateId(), patientId: p1Id, status: 'completed', timestamp: Date.now() - 86400000 * 5,
            tests: { cbc: true, urine: true } as any, ultrasound: false
        });

        // 2. Elderly Primi with GDM - 15 visits
        const p2Id = generateId();
        newPatients.push({
            id: p2Id,
            name: "Sunita Verma (Elderly Primi + GDM)",
            age: "36",
            mobile: "9988776655",
            address: "Phase 2, Noida",
            type: "obstetric",
            uhid: "UHID-" + Math.floor(1000 + Math.random() * 9000),
            isPreviouslyRegistered: true
        });

        for(let i=0; i<15; i++) {
            newVisits.push({
                id: generateId(),
                patientId: p2Id,
                date: `2025-${(9 + Math.floor(i/3)).toString().padStart(2, '0')}-${(5 + (i*2)%20).toString().padStart(2, '0')}`,
                visitType: "follow-up-short",
                assignedDoctor: "Dr. Mohit Agrawal",
                isApproved: true,
                episodeId: `ep_anc_${p2Id}`,
                episodeName: "ANC Pregnancy",
                complaints: "ANC Checkup for Elderly Primi",
                generalExamination: "G1P0A0, Elderly Primi, Gestational Diabetes Mellitus (GDM)",
                vitals: { bp: "120/80", pulse: "78", weight: (65 + (i*0.5)).toString(), height: "165", spo2: "98" },
                remarks: "Following strict RCOG guidelines for GDM. Blood sugar charting reviewed.",
                prescription: "Metformin 500mg BD with meals x 15 Days",
                fees: 0,
                orders: { id: `o-${generateId()}`, patientId: p2Id, tests: { cbc: false, serology: false, urine: false, other: false, widal: false, crp: false, hormone: false, semen: false }, ultrasound: false, status: 'pending', timestamp: Date.now() }
            });
        }
        // Current Visit (16th) - 37 Weeks
        newVisits.push({
            id: generateId(), patientId: p2Id, date: today, visitType: "follow-up-short", assignedDoctor: "Dr. Mohit Agrawal", isApproved: false, episodeId: `ep_anc_${p2Id}`, episodeName: "ANC Pregnancy",
            complaints: "37 Weeks ANC, GDM Monitoring",
            generalExamination: "G1P0A0, 37 Weeks POG, Elderly Primi, GDM",
            menstrualHistory: "LMP: 2025-09-10. EDD: 2026-06-17 (37 Weeks)",
            vitals: { bp: "125/80", pulse: "80", weight: "73", height: "165", spo2: "98" },
            remarks: "RCOG protocol maintained. FBS: 95, PP2BS: 110. Good glycemic control.",
            prescription: "Metformin 500mg BD x 7 Days",
            fees: 200,
            orders: { id: `o-${generateId()}`, patientId: p2Id, tests: { bloodSugar: true } as any, status: 'pending', timestamp: Date.now() }
        });

        // 3. Severe Anemia - 16 visits, received Inj FCM
        const p3Id = generateId();
        newPatients.push({
            id: p3Id,
            name: "Kavita Devi (Severe Anemia)",
            age: "24",
            mobile: "9112233445",
            address: "Village Rampur",
            type: "obstetric",
            uhid: "UHID-" + Math.floor(1000 + Math.random() * 9000),
            isPreviouslyRegistered: true
        });

        for(let i=0; i<16; i++) {
            newVisits.push({
                id: generateId(),
                patientId: p3Id,
                date: `2025-${(9 + Math.floor(i/3)).toString().padStart(2, '0')}-${(10 + (i*2)%18).toString().padStart(2, '0')}`,
                visitType: "follow-up-short",
                assignedDoctor: "Dr. Mohit Agrawal",
                isApproved: true,
                episodeId: `ep_anc_${p3Id}`,
                episodeName: "ANC Pregnancy",
                complaints: "Weakness, Fatigue",
                generalExamination: "G2P1L1, Severe Anemia in Pregnancy",
                vitals: { bp: "110/70", pulse: "90", weight: (50 + (i*0.3)).toString(), height: "155", spo2: "99" },
                remarks: i === 10 ? "Given Inj FCM on OPD basis as per AICOG guidelines." : "Monitoring Hb levels. Following AICOG guidelines.",
                prescription: i === 10 ? "Inj. Ferric Carboxymaltose (FCM) 500mg IV Infusion Stat" : "Iron & Folic Acid OD x 15 Days",
                fees: 0,
                orders: { id: `o-${generateId()}`, patientId: p3Id, tests: { cbc: false, serology: false, urine: false, other: false, widal: false, crp: false, hormone: false, semen: false }, ultrasound: false, status: 'pending', timestamp: Date.now() }
            });
        }
        // Current Visit (17th) - 36 Weeks
        newVisits.push({
            id: generateId(), patientId: p3Id, date: today, visitType: "follow-up-short", assignedDoctor: "Dr. Mohit Agrawal", isApproved: false, episodeId: `ep_anc_${p3Id}`, episodeName: "ANC Pregnancy",
            complaints: "36 Weeks ANC, Post FCM Follow-up",
            generalExamination: "G2P1L1, 36 Weeks POG, Improved Anemia",
            menstrualHistory: "LMP: 2025-09-25. EDD: 2026-07-02 (36 Weeks)",
            vitals: { bp: "115/75", pulse: "88", weight: "55", height: "155", spo2: "99" },
            remarks: "Hb improved post FCM. AICOG guidelines followed completely.",
            prescription: "Iron & Folic Acid OD x 15 Days",
            fees: 200,
            orders: { id: `o-${generateId()}`, patientId: p3Id, tests: { cbc: true } as any, status: 'pending', timestamp: Date.now() }
        });

        onUpdatePatients(newPatients);
        onUpdateVisits(newVisits);
        onUpdateLabOrders(newLabOrders);
        alert("3 Complex ANC Patients Injected Successfully for Episode Testing!");
    };

    return (
        <button 
            onClick={handleInject}
            className="fixed bottom-4 right-4 bg-orange-600 text-white px-4 py-2 rounded shadow-lg text-xs font-bold hover:bg-orange-700 z-50"
        >
            Inject Complex ANC Cases
        </button>
    );
};

export default MockDataInjector;
