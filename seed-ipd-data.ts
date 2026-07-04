
/**
 * Removes undefined values by JSON round-trip
 * Firestore does not support undefined field values
 */
const clean = (obj: any): any => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));

/**
 * IPD TEST DATA SEED SCRIPT
 * Creates 40 IPD admissions: 10 LSCS, 10 FTND, 10 Hysterectomy, 10 MTP
 * Run: npx tsx seed-ipd-data.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// --- INIT FIREBASE ---
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// --- HELPERS ---
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const dateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const timeStr = (hour: number, min: number = 0): string => {
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const datetimeStr = (daysAgo: number, hour = 10, min = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString().slice(0, 16);
};

const isoStr = (daysAgo: number, hour = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Female Indian names
const patientNames = [
  'Sunita Patil', 'Priya Sharma', 'Kavita Deshmukh', 'Rekha Jadhav', 'Anita More',
  'Shubhangi Kulkarni', 'Sushma Yadav', 'Meena Sawant', 'Vandana Pawar', 'Rohini Bhosale',
  'Lata Waghmare', 'Geeta Shinde', 'Ashwini Gaikwad', 'Sarika Kale', 'Pallavi Surve',
  'Kiran Raut', 'Manda Bhor', 'Seema Kadam', 'Nanda Gavhane', 'Puja Nimkar',
  'Surekha Thakur', 'Jyoti Kamble', 'Bharati Deokar', 'Sindhu Naik', 'Swati Wagh',
  'Ratna Shedge', 'Revati Dalvi', 'Chanda Ghuge', 'Durga Bansode', 'Sumitra Mhatre',
  'Uma Patane', 'Vijaya Dhavale', 'Smita Nangare', 'Asha Kasar', 'Ranjana Ovhal',
  'Savita Kokate', 'Alka Jagtap', 'Pushpa Ingale', 'Archana Munde', 'Nirmala Lokhande'
];

const addresses = [
  'Near Bus Stand, Dondaicha', 'Village Shirpur', 'Ward No 3, Shahada',
  'Taloda Road, Nandurbar', 'Near Hanuman Mandir, Dondaicha',
  'Village Chopda', 'Akkalkuwa Road', 'Near Police Station, Shindkheda',
  'Village Navapur', 'Raver Road, Jalgaon',
  'Near School, Dondaicha', 'Prakash Nagar, Shahada', 'Near Market, Taloda'
];

const doctors = ['Dr. Rajesh Patil', 'Dr. Priya Deshmukh', 'Dr. Suresh More'];
const nurses = ['Nurse Rekha', 'Nurse Anita', 'Nurse Kavita', 'Nurse Sunita'];
const wardId = 'ward-maternity';
const bedIds = Array.from({ length: 40 }, (_, i) => `bed-${i + 1}`);

// --- ROUND NOTE GENERATOR ---
const makeRoundNote = (dayOffset: number, hour: number, doctor: string, dx: string, day: number): any => ({
  id: uid(),
  timestamp: datetimeStr(dayOffset, hour),
  doctorName: doctor,
  gc: day === 0 ? 'Fair' : day === 1 ? 'Improving' : 'Good',
  pulse: `${72 + Math.floor(Math.random() * 12)}/min`,
  bp: `${110 + Math.floor(Math.random() * 20)}/${70 + Math.floor(Math.random() * 10)} mmHg`,
  cvs: 'S1S2 Heard, No Murmur',
  rs: 'Air Entry Bilateral Equal, Clear',
  physicalExamination: day === 0
    ? `Post ${dx} Day ${day + 1}. Patient comfortable. Wound/Suture site clean. Uterus well contracted. Bleeding minimal.`
    : `Post ${dx} Day ${day + 1}. General condition ${day === 1 ? 'improving' : 'good'}. Wound healing well. Afebrile. Uterus well contracted.`,
  medication: day === 0
    ? 'Inj Oxytocin 10U IV in 500ml NS\nInj Metronidazole 500mg IV TDS\nInj Ampicillin 1gm IV BD\nInj Diclofenac 75mg IV SOS\nTab Pantoprazole 40mg BD'
    : day === 1
    ? 'Tab Amoxycillin+Clavulanate 625mg TDS\nTab Metronidazole 400mg TDS\nTab Ibuprofen 400mg TDS\nTab Iron+Folic Acid BD\nTab Pantoprazole 40mg BD'
    : 'Tab Amoxycillin+Clavulanate 625mg TDS\nTab Iron+Folic Acid BD\nCap Vitamin C 500mg OD',
  investigation: day === 0 ? 'CBC, LFT, RFT\nUrine R/M' : day === 1 ? 'CBC' : '-',
  advice: day === 0
    ? 'NBM until bowel sounds return\nCatheter in situ\nIV fluids maintenance\nMonitor vitals 4 hourly'
    : day === 1
    ? 'Oral fluids started\nBladder care\nWound care\nBreastfeeding initiated'
    : 'Normal diet\nAmbulation encouraged\nDischarge planning',
  note: `Post ${dx} Day ${day + 1} - condition ${day < 2 ? 'stable' : 'satisfactory'}`,
  vitals: {
    bp: `${110 + Math.floor(Math.random() * 20)}/${70 + Math.floor(Math.random() * 10)}`,
    pulse: `${72 + Math.floor(Math.random() * 12)}`,
    weight: '',
    height: '',
    spo2: '98'
  }
});

// --- NURSING NOTE GENERATOR ---
const makeNursingNote = (dayOffset: number, shift: string, nurse: string, dx: string, day: number): any => ({
  id: uid(),
  date: datetimeStr(dayOffset, shift === 'morning' ? 8 : shift === 'afternoon' ? 14 : 20),
  note: `${shift.charAt(0).toUpperCase() + shift.slice(1)} shift nursing note. Post ${dx} Day ${day + 1}. Patient ${day === 0 ? 'resting comfortably' : day === 1 ? 'improving' : 'ambulatory and comfortable'}.`,
  nurseName: nurse,
  complaints: day === 0 ? 'Mild pain at surgical site' : day === 1 ? 'Minimal discomfort' : 'No complaints',
  generalCondition: day === 0 ? 'Fair, Afebrile' : 'Good, Afebrile',
  perAbdomen: day === 0
    ? 'Uterus contracted, dressing intact, minimal per vaginal bleeding'
    : 'Uterus well contracted, wound healing, lochia normal',
  perVaginum: day < 2 ? 'Minimal bleeding, lochia rubra' : 'Lochia serosa, minimal',
  treatmentPlan: `Administered medications as per prescription. Vitals monitoring ${day === 0 ? '4 hourly' : '6 hourly'}.`,
  intakeIv: day === 0 ? 1000 : day === 1 ? 500 : 0,
  intakeOral: day === 0 ? 200 : day === 1 ? 800 : 1200,
  outputUrine: 600 + Math.floor(Math.random() * 400),
  outputOther: 0
});

// --- CHARGE GENERATOR ---
const makeCharges = (type: string, days: number, admDate: string): any[] => {
  const baseCharges: any[] = [
    { id: uid(), date: admDate, description: `${type} Package`, amount: type === 'LSCS' ? 18000 : type === 'FTND' ? 8000 : type === 'Hysterectomy' ? 25000 : 5000, category: 'operation' },
    { id: uid(), date: admDate, description: 'Anesthesia Charges', amount: type === 'LSCS' || type === 'Hysterectomy' ? 4000 : type === 'MTP' ? 1500 : 0, category: 'anesthesia' },
    { id: uid(), date: admDate, description: `Room Charges (${days} days)`, amount: days * 1000, category: 'room' },
    { id: uid(), date: admDate, description: 'OT Charges', amount: type === 'LSCS' ? 5000 : type === 'Hysterectomy' ? 6000 : type === 'MTP' ? 2000 : 0, category: 'procedure' },
    { id: uid(), date: admDate, description: 'Medicines & Consumables', amount: type === 'LSCS' ? 3500 : type === 'Hysterectomy' ? 4000 : type === 'FTND' ? 2000 : 1500, category: 'medicine' },
    { id: uid(), date: admDate, description: 'Nursing Charges', amount: days * 500, category: 'other' },
    { id: uid(), date: admDate, description: 'Lab Investigations', amount: 1200, category: 'lab' },
  ];
  if (type === 'FTND') {
    baseCharges.splice(1, 1); // remove anesthesia for FTND
  }
  return baseCharges.filter(c => c.amount > 0);
};

// === LSCS ADMISSION BUILDER ===
const makeLSCS = (patIdx: number, patient: any): any => {
  const admDaysAgo = 5 + patIdx;
  const dischDaysAgo = admDaysAgo - 3;
  const doctor = doctors[patIdx % doctors.length];
  const nurse = nurses[patIdx % nurses.length];
  const baby = { sex: patIdx % 2 === 0 ? 'Male' : 'Female', weight: `${2.8 + (patIdx * 0.1).toFixed(1)}`, date: dateStr(admDaysAgo), time: '10:30', presentation: 'Cephalic', apgar1Min: '8', apgar5Min: '9', cry: 'Immediate' };
  const admDate = dateStr(admDaysAgo);
  const dischDate = dateStr(dischDaysAgo);

  const id = `lscs-${uid()}`;
  return {
    id,
    patientId: patient.id,
    admissionDate: admDate,
    dischargeDate: dischDate,
    wardId,
    bedId: bedIds[patIdx],
    diagnosis: 'Previous LSCS with Oligohydramnios / Term Pregnancy',
    status: 'discharged',
    primaryDoctor: doctor,
    dailyCharges: 1000,
    advanceAmount: 10000,
    totalBill: 28000,
    discount: 500,
    payments: [{ id: uid(), date: admDate, amount: 10000, method: 'cash', note: 'Advance' }, { id: uid(), date: dischDate, amount: 18000, method: 'cash', note: 'Final Payment' }],
    admissionNote: {
      id: uid(),
      date: admDate,
      chiefComplaints: 'Full term pregnancy with previous LSCS, decreased fetal movements',
      historyOfPresentIllness: `G${2 + patIdx % 2}P${1 + patIdx % 2}L${1 + patIdx % 2}, ${38 + patIdx % 3} weeks by LMP, came with complaints of decreased fetal movements since 2 days. Anterior wall low transverse scar present.`,
      pastHistory: 'Previous LSCS 2 years ago. No other significant medical or surgical history.',
      obstetricHistory: `G${2 + patIdx % 2}P${1 + patIdx % 2}L${1 + patIdx % 2} - Previous LSCS for fetal distress, Live baby, healthy.`,
      menstrualHistory: `LMP: ${dateStr(280 + admDaysAgo)}, EDD: ${admDate}, POG: 38-39 weeks`,
      generalExamination: 'Afebrile, Pallor absent, Icterus absent, Edema +, BP: 120/80 mmHg, Pulse: 84/min, Weight: 68 kg, SpO2: 99%',
      systemicExamination: 'CVS: S1S2 heard, no murmur. RS: Bilateral air entry clear. CNS: Conscious and oriented.',
      localExamination: 'P/A: Uterus 38 weeks size, cephalic presentation, FHR 142 bpm regular. Previous LSCS scar present. P/V: Os closed, effacement 0%, station -3.',
      provisionalDiagnosis: 'Term pregnancy with previous LSCS, Oligohydramnios, Decreased fetal movements',
      planOfCare: 'LSCS under spinal anesthesia after fitness, pre-op investigations, informed consent',
      bp: '120/80',
      pulse: '84',
      weight: '68',
      spo2: '99'
    },
    operativeNotes: [{
      id: uid(),
      date: admDate,
      isMaternity: true,
      procedureName: 'Lower Segment Caesarean Section (LSCS)',
      surgeonName: doctor,
      assistantSurgeonName: doctors[(patIdx + 1) % doctors.length],
      pediatricianName: 'Dr. Anil Kumar',
      anesthetistName: 'Dr. Sunil Joshi',
      staffNurseName: nurse,
      anesthesiaType: 'Spinal Anesthesia',
      anesthesiaNotes: 'Spinal given at L3-L4, 2.5ml 0.5% Bupivacaine heavy. Level adequate.',
      preOpDiagnosis: 'Term pregnancy with previous LSCS and oligohydramnios',
      procedureDetails: 'Patient placed in supine position under spinal anesthesia. Pfannenstiel incision given. Uterus opened with lower segment transverse incision. Baby delivered by fundal pressure as cephalic presentation. Placenta delivered completely. Uterine angles secured. Uterus closed in 2 layers with no. 1 chromic catgut. Haemostasis secured. Abdomen closed in layers.',
      indication: 'Previous LSCS + Oligohydramnios',
      incisionType: 'Pfannenstiel (Transverse)',
      liquor: 'Reduced, clear',
      bloodLoss: '450 ml',
      tubalLigation: patIdx % 3 === 0 ? 'Yes - Pomeroy Method' : 'No',
      instrumentCount: 'Correct',
      hemostasis: 'Secured with sutures and electrocautery',
      closure: 'Abdomen closed in anatomical layers. Skin closed with staples.',
      postOpOrders: 'NBM x 8 hours\nIV fluids - RL 1L + NS 1L\nInj Oxytocin 20U in 500ml NS\nInj Ampicillin 1gm IV Q8H x 3 days\nInj Metronidazole 500mg IV TDS x 3 days\nInj Diclofenac 75mg IV SOS\nCatheter in situ for 24 hours\nMonitor vitals 4 hourly',
      babyDetails: baby,
      chargesAdded: true
    }],
    roundNotes: [
      makeRoundNote(admDaysAgo, 18, doctor, 'LSCS', 0),
      makeRoundNote(admDaysAgo - 1, 9, doctor, 'LSCS', 1),
      makeRoundNote(admDaysAgo - 1, 20, doctor, 'LSCS', 1),
      makeRoundNote(admDaysAgo - 2, 9, doctor, 'LSCS', 2),
    ],
    nursingNotes: [
      makeNursingNote(admDaysAgo, 'evening', nurse, 'LSCS', 0),
      makeNursingNote(admDaysAgo, 'night', nurses[(patIdx + 1) % nurses.length], 'LSCS', 0),
      makeNursingNote(admDaysAgo - 1, 'morning', nurse, 'LSCS', 1),
      makeNursingNote(admDaysAgo - 1, 'afternoon', nurses[(patIdx + 2) % nurses.length], 'LSCS', 1),
      makeNursingNote(admDaysAgo - 1, 'night', nurses[(patIdx + 1) % nurses.length], 'LSCS', 1),
      makeNursingNote(admDaysAgo - 2, 'morning', nurse, 'LSCS', 2),
    ],
    medications: [
      { id: uid(), drugName: 'Inj Oxytocin 10U', dose: '10U', frequency: 'In 500ml NS drip', startDate: admDate, endDate: admDate, instructions: 'IV', administrations: [{ timestamp: isoStr(admDaysAgo, 12), administeredBy: nurse }] },
      { id: uid(), drugName: 'Inj Ampicillin', dose: '1gm', frequency: 'IV BD', startDate: admDate, endDate: dateStr(admDaysAgo - 2), instructions: 'IV', administrations: [] },
      { id: uid(), drugName: 'Inj Metronidazole', dose: '500mg', frequency: 'IV TDS', startDate: admDate, endDate: dateStr(admDaysAgo - 2), instructions: 'IV', administrations: [] },
      { id: uid(), drugName: 'Tab Iron + Folic Acid', dose: '1 tab', frequency: 'BD', startDate: dateStr(admDaysAgo - 1), instructions: 'After food', administrations: [] },
    ],
    nursingMedicationCharts: [],
    fluidBalance: [
      { id: uid(), timestamp: isoStr(admDaysAgo, 12), type: 'intake', fluidName: 'Ringer Lactate', amountMl: 500, route: 'IV' },
      { id: uid(), timestamp: isoStr(admDaysAgo, 16), type: 'intake', fluidName: 'Normal Saline', amountMl: 500, route: 'IV' },
      { id: uid(), timestamp: isoStr(admDaysAgo, 20), type: 'output', fluidName: 'Urine (Catheter)', amountMl: 800, route: 'Catheter' },
      { id: uid(), timestamp: isoStr(admDaysAgo - 1, 8), type: 'intake', fluidName: 'Oral Fluids', amountMl: 500, route: 'Oral' },
      { id: uid(), timestamp: isoStr(admDaysAgo - 1, 12), type: 'output', fluidName: 'Urine', amountMl: 700, route: 'Voluntary' },
    ],
    charges: makeCharges('LSCS', 3, admDate),
    deliveryDetails: {
      deliveryDate: admDate,
      deliveryTime: '10:30',
      method: 'LSCS',
      babySex: baby.sex,
      babyWeight: baby.weight,
      birthStatus: 'Live',
      indication: 'Previous LSCS + Oligohydramnios',
      apgar1Min: '8',
      apgar5Min: '9',
      conductedBy: doctor,
      liquor: 'Reduced, clear',
      bloodLoss: '450 ml',
      placenta: 'Complete',
      complications: 'None'
    },
    dischargeSummary: {
      admissionDate: admDate,
      dischargeDate: dischDate,
      diagnosis: 'Term Pregnancy with Previous LSCS - Post LSCS Day 3',
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][patIdx % 4],
      complaints: 'Full term pregnancy with decreased fetal movements, previous LSCS scar',
      obstetricHistory: `G${2 + patIdx % 2}P${1 + patIdx % 2}L${1 + patIdx % 2} - Previous LSCS`,
      menstrualHistory: `LMP: ${dateStr(280 + admDaysAgo)}, EDD: ${admDate}, POG: 38-39 weeks`,
      examinationOnAdmission: 'Afebrile, BP 120/80 mmHg, Pulse 84/min, SpO2 99%\nCVS: S1S2 heard, RS: Clear bilaterally\nP/A: 38 weeks uterus, Cephalic, FHR 142 bpm',
      operativeNotesSummary: `LSCS done under spinal anesthesia. Baby ${baby.sex} ${baby.weight}kg delivered. Apgar 8/9. Placenta complete.${patIdx % 3 === 0 ? ' Tubectomy done by Pomeroy method.' : ''}`,
      babyDetails: { weight: baby.weight, time: '10:30', date: admDate, sex: baby.sex, presentation: 'Cephalic' },
      treatmentGiven: 'Inj Oxytocin, Inj Ampicillin, Inj Metronidazole, Inj Diclofenac, Tab Iron+Folic Acid, IV Fluids',
      examinationOnDischarge: 'Afebrile, BP 110/70 mmHg, Pulse 78/min\nUterus well contracted\nWound healing well\nBaby active and feeding well',
      adviceOnDischarge: '1. Tab Amoxycillin+Clavulanate 625mg TDS x 5 days\n2. Tab Metronidazole 400mg TDS x 5 days\n3. Tab Iron+Folic Acid BD x 3 months\n4. Breastfeeding exclusively for 6 months\n5. Wound care - keep dry, suture removal after 7 days\n6. No heavy lifting for 6 weeks\n7. Contraception counselling done',
      followUp: `After 7 days for suture removal, then at 6 weeks for postnatal check`,
      investigations: 'CBC, Blood Group, Urine R/M done',
      courseInHospital: 'Patient had uncomplicated LSCS. Post-op recovery smooth. Baby doing well.'
    },
    consents: [{ id: uid(), title: 'LSCS Consent', content: 'Patient and attendant counselled about LSCS and its risks. Written informed consent taken.', dateAdded: admDate }]
  };
};

// === FTND ADMISSION BUILDER ===
const makeFTND = (patIdx: number, patient: any): any => {
  const admDaysAgo = 4 + patIdx;
  const dischDaysAgo = admDaysAgo - 2;
  const doctor = doctors[patIdx % doctors.length];
  const nurse = nurses[patIdx % nurses.length];
  const baby = { sex: patIdx % 2 === 0 ? 'Female' : 'Male', weight: `${2.9 + (patIdx * 0.08).toFixed(1)}`, date: dateStr(admDaysAgo), time: '14:20' };
  const admDate = dateStr(admDaysAgo);
  const dischDate = dateStr(dischDaysAgo);
  const id = `ftnd-${uid()}`;

  return {
    id,
    patientId: patient.id,
    admissionDate: admDate,
    dischargeDate: dischDate,
    wardId,
    bedId: bedIds[10 + patIdx],
    diagnosis: 'Term Pregnancy in Labour / FTND',
    status: 'discharged',
    primaryDoctor: doctor,
    dailyCharges: 800,
    advanceAmount: 5000,
    totalBill: 10500,
    discount: 500,
    payments: [{ id: uid(), date: admDate, amount: 5000, method: 'cash', note: 'Advance' }, { id: uid(), date: dischDate, amount: 5500, method: 'upi', note: 'Balance' }],
    admissionNote: {
      id: uid(),
      date: admDate,
      chiefComplaints: 'Labour pains since morning, leaking per vaginum',
      historyOfPresentIllness: `G${1 + patIdx % 3}P${patIdx % 3}L${patIdx % 3}, ${38 + patIdx % 3} weeks by LMP, came in early active labour. Membranes spontaneously ruptured.`,
      pastHistory: 'No significant history. No previous surgeries.',
      obstetricHistory: patIdx % 3 === 0 ? 'Primigravida' : `G${1 + patIdx % 3}P${patIdx % 3}L${patIdx % 3} - Previous FTND, healthy baby`,
      menstrualHistory: `LMP: ${dateStr(274 + admDaysAgo)}, EDD: ${admDate}, POG: 38-40 weeks`,
      generalExamination: 'Afebrile, Pallor absent, BP: 110/70 mmHg, Pulse: 82/min, Weight: 62 kg, SpO2: 99%',
      systemicExamination: 'CVS: S1S2 heard, no murmur. RS: Clear bilaterally.',
      localExamination: `P/A: Uterus 38 weeks, Cephalic, FHR 148 bpm, 2-3 contractions in 10 min each lasting 30-40 sec. P/V: Os ${3 + patIdx % 4}cm dilated, 50% effaced, membranes absent, vertex at station -1.`,
      provisionalDiagnosis: 'Term pregnancy in active labour, ROA presentation',
      planOfCare: 'Monitor labour progress, partograph, FHR monitoring, IV access, prepare for delivery',
      bp: '110/70',
      pulse: '82',
      weight: '62',
      spo2: '99'
    },
    labourProgress: Array.from({ length: 6 }, (_, i) => ({
      id: uid(),
      dateTime: datetimeStr(admDaysAgo, 8 + i * 2),
      fhr: `${140 + Math.floor(Math.random() * 15)} bpm`,
      amnioticFluid: i === 0 ? 'C' : 'C',
      moulding: '0',
      cervixDilatation: 3 + i * Math.ceil((10 - 3) / 5),
      descent: 5 - i,
      contractionFreq: `${2 + i}/10 min`,
      contractionDur: `${30 + i * 10} sec`,
      drugsIvFluids: i === 0 ? 'NS 500ml IV, Epidural analgesia not given' : '-',
      vitals: { pulse: `${80 + i * 2}/min`, bp: `${110 + i}/${70 + i} mmHg`, temp: '98.6°F' },
      urine: { protein: 'Nil', acetone: 'Nil', volume: '200ml' }
    })),
    deliveryDetails: {
      deliveryDate: admDate,
      deliveryTime: '14:20',
      method: 'Vaginal',
      babySex: baby.sex,
      babyWeight: baby.weight,
      birthStatus: 'Live',
      apgar1Min: '8',
      apgar5Min: '9',
      conductedBy: doctor,
      liquor: 'Clear',
      bloodLoss: '200 ml',
      placenta: 'Complete, delivered spontaneously',
      complications: 'None',
      episiotomy: patIdx % 2 === 0 ? 'Mediolateral episiotomy given and repaired' : 'No episiotomy'
    },
    roundNotes: [
      makeRoundNote(admDaysAgo, 18, doctor, 'FTND', 0),
      makeRoundNote(admDaysAgo - 1, 9, doctor, 'FTND', 1),
    ],
    nursingNotes: [
      makeNursingNote(admDaysAgo, 'evening', nurse, 'FTND', 0),
      makeNursingNote(admDaysAgo, 'night', nurses[(patIdx + 1) % nurses.length], 'FTND', 0),
      makeNursingNote(admDaysAgo - 1, 'morning', nurse, 'FTND', 1),
      makeNursingNote(admDaysAgo - 1, 'afternoon', nurses[(patIdx + 2) % nurses.length], 'FTND', 1),
    ],
    medications: [
      { id: uid(), drugName: 'Inj Oxytocin 10U', dose: '10U', frequency: 'In 500ml NS drip', startDate: admDate, endDate: admDate, instructions: 'IV', administrations: [{ timestamp: isoStr(admDaysAgo, 14), administeredBy: nurse }] },
      { id: uid(), drugName: 'Tab Amoxycillin', dose: '500mg', frequency: 'TDS', startDate: admDate, endDate: dateStr(admDaysAgo - 2), instructions: 'After food', administrations: [] },
      { id: uid(), drugName: 'Tab Iron + Folic Acid', dose: '1 tab', frequency: 'BD', startDate: admDate, instructions: 'After food', administrations: [] },
    ],
    nursingMedicationCharts: [],
    fluidBalance: [
      { id: uid(), timestamp: isoStr(admDaysAgo, 10), type: 'intake', fluidName: 'Normal Saline', amountMl: 500, route: 'IV' },
      { id: uid(), timestamp: isoStr(admDaysAgo, 16), type: 'output', fluidName: 'Urine', amountMl: 500, route: 'Voluntary' },
    ],
    charges: makeCharges('FTND', 2, admDate),
    dischargeSummary: {
      admissionDate: admDate,
      dischargeDate: dischDate,
      diagnosis: 'Term Pregnancy - FTND - Post Delivery Day 2',
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][patIdx % 4],
      complaints: 'Labour pains, leaking per vaginum',
      obstetricHistory: patIdx % 3 === 0 ? 'Primigravida' : `G${1 + patIdx % 3}P${patIdx % 3}L${patIdx % 3}`,
      menstrualHistory: `LMP: ${dateStr(274 + admDaysAgo)}, EDD: ${admDate}, POG: 38-40 weeks`,
      examinationOnAdmission: 'Afebrile, BP 110/70 mmHg, Pulse 82/min, SpO2 99%\nP/A: 38 weeks, Cephalic, FHR 148 bpm, uterine contractions present',
      operativeNotesSummary: `FTND conducted. Baby ${baby.sex} ${baby.weight}kg born at 14:20. Apgar 8/9. Placenta complete.${patIdx % 2 === 0 ? ' Episiotomy given and repaired.' : ''}`,
      babyDetails: { weight: baby.weight, time: '14:20', date: admDate, sex: baby.sex, presentation: 'Cephalic' },
      treatmentGiven: 'Inj Oxytocin, Tab Amoxycillin, Tab Iron+Folic Acid, IV Fluids',
      examinationOnDischarge: 'Afebrile, BP 110/70, Pulse 78/min\nUterus well contracted\nEpisiotomy healing well\nBreasts: Lactation established, baby feeding well',
      adviceOnDischarge: '1. Tab Amoxycillin 500mg TDS x 5 days\n2. Tab Iron+Folic Acid BD x 3 months\n3. Exclusive breastfeeding for 6 months\n4. Perineal hygiene\n5. Immunization of baby\n6. Contraception counselling done',
      followUp: 'After 6 weeks for postnatal check',
      courseInHospital: 'Spontaneous onset of labour, progressed normally. Uncomplicated FTND. Baby vigorous, feeding well.'
    }
  };
};

// === HYSTERECTOMY ADMISSION BUILDER ===
const makeHysterectomy = (patIdx: number, patient: any): any => {
  const admDaysAgo = 6 + patIdx;
  const dischDaysAgo = admDaysAgo - 3;
  const doctor = doctors[patIdx % doctors.length];
  const nurse = nurses[patIdx % nurses.length];
  const admDate = dateStr(admDaysAgo);
  const dischDate = dateStr(dischDaysAgo);
  const types = ['Total Abdominal Hysterectomy (TAH)', 'Total Abdominal Hysterectomy with BSO', 'Vaginal Hysterectomy with Pelvic Floor Repair'];
  const dxList = ['Dysfunctional Uterine Bleeding (DUB) unresponsive to medical therapy', 'Large Fibroid Uterus with Menorrhagia', 'Adenomyosis with Severe Dysmenorrhea', 'Prolapse Uterus 3rd Degree with Cystocele'];
  const indication = dxList[patIdx % dxList.length];
  const procedure = types[patIdx % types.length];
  const id = `hyst-${uid()}`;

  return {
    id,
    patientId: patient.id,
    admissionDate: admDate,
    dischargeDate: dischDate,
    wardId,
    bedId: bedIds[20 + patIdx],
    diagnosis: indication,
    status: 'discharged',
    primaryDoctor: doctor,
    dailyCharges: 1000,
    advanceAmount: 15000,
    totalBill: 38000,
    discount: 1000,
    payments: [{ id: uid(), date: admDate, amount: 15000, method: 'cash', note: 'Advance' }, { id: uid(), date: dischDate, amount: 23000, method: 'cash', note: 'Final Payment' }],
    admissionNote: {
      id: uid(),
      date: admDate,
      chiefComplaints: `Heavy menstrual bleeding for ${4 + patIdx % 6} months, severe pain`,
      historyOfPresentIllness: `P${2 + patIdx % 3}L${2 + patIdx % 3}, Age ${38 + patIdx * 2} years, presenting with complaints of heavy menstrual bleeding and severe dysmenorrhea for ${4 + patIdx % 6} months, not responding to medical management.`,
      pastHistory: 'No significant surgical history. Hypertension on Tab Amlodipine 5mg.',
      obstetricHistory: `P${2 + patIdx % 3}L${2 + patIdx % 3} - All normal deliveries, last delivery 8 years ago. Family complete.`,
      menstrualHistory: 'Irregular menstrual cycle, heavy flow with clots, dysmenorrhea. LMP 15 days ago.',
      generalExamination: `Moderately built and nourished. Pallor +. Afebrile. BP: ${120 + patIdx * 2}/${80} mmHg, Pulse: 88/min, Weight: ${60 + patIdx * 2} kg, SpO2: 98%`,
      systemicExamination: 'CVS: S1S2 heard, no murmur. RS: Clear bilaterally. CNS: Conscious and oriented.',
      localExamination: `P/A: Uterus ${10 + patIdx * 2} weeks size, firm, irregular surface. P/V: Uterus enlarged, mobile, no adnexal mass, OS closed.`,
      provisionalDiagnosis: indication,
      planOfCare: `${procedure} under general/spinal anesthesia. Pre-op investigations, blood grouping, fitness from physician.`,
      bp: `${120 + patIdx * 2}/80`,
      pulse: '88',
      weight: `${60 + patIdx * 2}`,
      spo2: '98'
    },
    operativeNotes: [{
      id: uid(),
      date: admDate,
      isMaternity: false,
      procedureName: procedure,
      surgeonName: doctor,
      assistantSurgeonName: doctors[(patIdx + 1) % doctors.length],
      anesthetistName: 'Dr. Sunil Joshi',
      staffNurseName: nurse,
      anesthesiaType: patIdx % 3 === 2 ? 'Spinal Anesthesia' : 'General Anesthesia',
      anesthesiaNotes: patIdx % 3 === 2 ? 'Spinal given at L3-L4, level adequate T6.' : 'ET intubation, maintained on isoflurane. Smooth induction and recovery.',
      preOpDiagnosis: indication,
      procedureDetails: `Patient placed in lithotomy/supine position. ${procedure} performed. Uterus removed with haemostasis at all pedicles. Peritoneum closed. Vault secured.`,
      indication: indication,
      incisionType: patIdx % 3 === 2 ? 'Vaginal approach' : 'Pfannenstiel (Transverse)',
      bloodLoss: `${350 + patIdx * 30} ml`,
      instrumentCount: 'Correct',
      hemostasis: 'Secured at all pedicles',
      closure: 'Vault sutured. Abdomen closed in layers.',
      postOpOrders: 'NBM x 6 hours\nIV fluids - RL 1L + NS 1L\nInj Ampicillin 1gm IV Q8H x 3 days\nInj Metronidazole 500mg IV TDS x 3 days\nInj Diclofenac 75mg IV SOS\nCatheter in situ for 48 hours\nMonitor vitals 4 hourly',
      chargesAdded: true
    }],
    roundNotes: [
      makeRoundNote(admDaysAgo, 18, doctor, 'Hysterectomy', 0),
      makeRoundNote(admDaysAgo - 1, 9, doctor, 'Hysterectomy', 1),
      makeRoundNote(admDaysAgo - 1, 20, doctor, 'Hysterectomy', 1),
      makeRoundNote(admDaysAgo - 2, 9, doctor, 'Hysterectomy', 2),
    ],
    nursingNotes: [
      makeNursingNote(admDaysAgo, 'evening', nurse, 'Hysterectomy', 0),
      makeNursingNote(admDaysAgo, 'night', nurses[(patIdx + 1) % nurses.length], 'Hysterectomy', 0),
      makeNursingNote(admDaysAgo - 1, 'morning', nurse, 'Hysterectomy', 1),
      makeNursingNote(admDaysAgo - 1, 'afternoon', nurses[(patIdx + 2) % nurses.length], 'Hysterectomy', 1),
      makeNursingNote(admDaysAgo - 1, 'night', nurses[(patIdx + 3) % nurses.length], 'Hysterectomy', 1),
      makeNursingNote(admDaysAgo - 2, 'morning', nurse, 'Hysterectomy', 2),
    ],
    medications: [
      { id: uid(), drugName: 'Inj Ampicillin', dose: '1gm', frequency: 'IV Q8H', startDate: admDate, endDate: dateStr(admDaysAgo - 2), instructions: 'IV', administrations: [] },
      { id: uid(), drugName: 'Inj Metronidazole', dose: '500mg', frequency: 'IV TDS', startDate: admDate, endDate: dateStr(admDaysAgo - 2), instructions: 'IV', administrations: [] },
      { id: uid(), drugName: 'Tab Iron + Folic Acid', dose: '1 tab', frequency: 'BD', startDate: dateStr(admDaysAgo - 1), instructions: 'After food', administrations: [] },
    ],
    nursingMedicationCharts: [],
    fluidBalance: [
      { id: uid(), timestamp: isoStr(admDaysAgo, 12), type: 'intake', fluidName: 'Ringer Lactate', amountMl: 1000, route: 'IV' },
      { id: uid(), timestamp: isoStr(admDaysAgo, 20), type: 'output', fluidName: 'Urine (Catheter)', amountMl: 900, route: 'Catheter' },
      { id: uid(), timestamp: isoStr(admDaysAgo - 1, 8), type: 'intake', fluidName: 'Oral Fluids', amountMl: 600, route: 'Oral' },
    ],
    charges: makeCharges('Hysterectomy', 3, admDate),
    dischargeSummary: {
      admissionDate: admDate,
      dischargeDate: dischDate,
      diagnosis: `Post ${procedure} - Day 3`,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][patIdx % 4],
      complaints: `Heavy menstrual bleeding and dysmenorrhea for ${4 + patIdx % 6} months`,
      obstetricHistory: `P${2 + patIdx % 3}L${2 + patIdx % 3} - All normal deliveries, family complete`,
      menstrualHistory: 'Irregular heavy cycles with clots, dysmenorrhea. Conservative management failed.',
      examinationOnAdmission: `Pallor +, BP ${120 + patIdx * 2}/80 mmHg, Pulse 88/min\nUterus ${10 + patIdx * 2} weeks size, irregular`,
      operativeNotesSummary: `${procedure} performed under ${patIdx % 3 === 2 ? 'spinal' : 'general'} anesthesia. Blood loss ${350 + patIdx * 30}ml. Specimen sent for HPE.`,
      treatmentGiven: 'Inj Ampicillin, Inj Metronidazole, Inj Diclofenac, IV Fluids, Tab Iron+Folic Acid',
      examinationOnDischarge: `Afebrile, BP ${110 + patIdx}/70, Pulse 76/min\nWound healing well, no signs of infection\nAbdomen soft, non-tender`,
      adviceOnDischarge: '1. Tab Amoxycillin+Clavulanate 625mg TDS x 5 days\n2. Tab Metronidazole 400mg TDS x 5 days\n3. Tab Iron+Folic Acid BD x 3 months\n4. No heavy lifting for 6 weeks\n5. Wound care - keep dry\n6. Await HPE report\n7. If fever, wound gaping, or heavy discharge - report immediately',
      followUp: 'After 7 days for wound check and HPE report, then 6 weeks',
      courseInHospital: `Uncomplicated ${procedure}. Post-op recovery smooth. Wound healing well.`
    }
  };
};

// === MTP ADMISSION BUILDER ===
const makeMTP = (patIdx: number, patient: any): any => {
  const admDaysAgo = 3 + patIdx;
  const dischDaysAgo = admDaysAgo - 1;
  const doctor = doctors[patIdx % doctors.length];
  const nurse = nurses[patIdx % nurses.length];
  const admDate = dateStr(admDaysAgo);
  const dischDate = dateStr(dischDaysAgo);
  const pogWks = [6, 7, 8, 9, 10, 7, 8, 6, 9, 10][patIdx];
  const methods = ['Suction Evacuation under GA', 'Medical MTP with Mifepristone + Misoprostol', 'Suction Evacuation under LA'];
  const method = methods[patIdx % methods.length];
  const id = `mtp-${uid()}`;

  return {
    id,
    patientId: patient.id,
    admissionDate: admDate,
    dischargeDate: dischDate,
    wardId,
    bedId: bedIds[30 + patIdx],
    diagnosis: `MTP at ${pogWks} weeks POG`,
    status: 'discharged',
    primaryDoctor: doctor,
    dailyCharges: 800,
    advanceAmount: 3000,
    totalBill: 6500,
    discount: 0,
    payments: [{ id: uid(), date: admDate, amount: 3000, method: 'cash', note: 'Advance' }, { id: uid(), date: dischDate, amount: 3500, method: 'upi', note: 'Balance' }],
    admissionNote: {
      id: uid(),
      date: admDate,
      chiefComplaints: `Unwanted pregnancy at ${pogWks} weeks, requesting MTP`,
      historyOfPresentIllness: `G${1 + patIdx % 4}P${patIdx % 4}L${patIdx % 4}, presenting with unwanted pregnancy at ${pogWks} weeks by LMP. MTP requested under MTP Act 1971. Pre-counselling done. Consent obtained.`,
      pastHistory: 'No significant history.',
      obstetricHistory: patIdx % 4 === 0 ? 'Primigravida' : `G${1 + patIdx % 4}P${patIdx % 4}L${patIdx % 4} - Previous normal deliveries`,
      menstrualHistory: `LMP: ${dateStr(pogWks * 7 + admDaysAgo)}, POG: ${pogWks} weeks`,
      generalExamination: 'Afebrile, Pallor absent, BP: 110/70 mmHg, Pulse: 78/min, Weight: 58 kg, SpO2: 99%',
      systemicExamination: 'CVS: S1S2 heard, no murmur. RS: Clear bilaterally.',
      localExamination: `P/A: Uterus ${pogWks} weeks size. P/V: Os closed, cervix soft, uterus anteverted, no adnexal mass.`,
      provisionalDiagnosis: `Unwanted pregnancy ${pogWks} weeks - MTP requested`,
      planOfCare: `MTP by ${method}. Pre-op investigations, informed consent, counselling`,
      bp: '110/70',
      pulse: '78',
      weight: '58',
      spo2: '99'
    },
    operativeNotes: patIdx % 3 !== 1 ? [{
      id: uid(),
      date: admDate,
      isMaternity: false,
      procedureName: method,
      surgeonName: doctor,
      anesthetistName: patIdx % 3 === 0 ? 'Dr. Sunil Joshi' : 'Local anesthesia only',
      anesthesiaType: patIdx % 3 === 0 ? 'General Anesthesia' : 'Local Anesthesia',
      preOpDiagnosis: `Unwanted pregnancy ${pogWks} weeks`,
      procedureDetails: `MTP performed by ${method}. Products of conception evacuated completely. Uterus well contracted post procedure. Blood loss minimal.`,
      bloodLoss: '100 ml',
      instrumentCount: 'Correct',
      hemostasis: 'Adequate, uterus well contracted',
      closure: 'N/A - Procedure complete',
      postOpOrders: 'Tab Misoprostol 400mcg sublingual given\nMonitor for 4 hours post procedure\nTab Amoxycillin 500mg TDS x 5 days\nTab Metronidazole 400mg TDS x 5 days\nContraception counselling done',
      chargesAdded: true
    }] : [],
    roundNotes: [
      makeRoundNote(admDaysAgo, 18, doctor, 'MTP', 0),
    ],
    nursingNotes: [
      makeNursingNote(admDaysAgo, 'evening', nurse, 'MTP', 0),
      makeNursingNote(admDaysAgo, 'night', nurses[(patIdx + 1) % nurses.length], 'MTP', 0),
    ],
    medications: [
      { id: uid(), drugName: 'Tab Amoxycillin', dose: '500mg', frequency: 'TDS', startDate: admDate, endDate: dateStr(admDaysAgo - 1), instructions: 'After food', administrations: [] },
      { id: uid(), drugName: 'Tab Metronidazole', dose: '400mg', frequency: 'TDS', startDate: admDate, endDate: dateStr(admDaysAgo - 1), instructions: 'After food', administrations: [] },
      { id: uid(), drugName: 'Tab Iron + Folic Acid', dose: '1 tab', frequency: 'BD', startDate: admDate, instructions: 'After food', administrations: [] },
      ...(patIdx % 3 === 1 ? [
        { id: uid(), drugName: 'Tab Mifepristone', dose: '200mg', frequency: 'Once', startDate: admDate, endDate: admDate, instructions: 'Day 1 morning', administrations: [] },
        { id: uid(), drugName: 'Tab Misoprostol', dose: '800mcg', frequency: 'Once (after 48h)', startDate: admDate, endDate: admDate, instructions: 'Sublingual', administrations: [] },
      ] : [])
    ],
    nursingMedicationCharts: [],
    fluidBalance: [
      { id: uid(), timestamp: isoStr(admDaysAgo, 12), type: 'intake', fluidName: 'Oral Fluids', amountMl: 400, route: 'Oral' },
      { id: uid(), timestamp: isoStr(admDaysAgo, 16), type: 'output', fluidName: 'Urine', amountMl: 300, route: 'Voluntary' },
    ],
    charges: makeCharges('MTP', 1, admDate),
    dischargeSummary: {
      admissionDate: admDate,
      dischargeDate: dischDate,
      diagnosis: `MTP done at ${pogWks} weeks POG - Stable`,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][patIdx % 4],
      complaints: `Unwanted pregnancy at ${pogWks} weeks`,
      obstetricHistory: patIdx % 4 === 0 ? 'Primigravida' : `G${1 + patIdx % 4}P${patIdx % 4}L${patIdx % 4}`,
      menstrualHistory: `LMP: ${dateStr(pogWks * 7 + admDaysAgo)}, POG: ${pogWks} weeks`,
      examinationOnAdmission: 'Afebrile, BP 110/70 mmHg, Pulse 78/min\nUterus palpable, no tenderness',
      operativeNotesSummary: `MTP by ${method} performed at ${pogWks} weeks POG. Uterus well contracted post procedure. No complications.`,
      treatmentGiven: `${method}. Tab Amoxycillin, Tab Metronidazole, Tab Iron+Folic Acid`,
      examinationOnDischarge: 'Afebrile, BP 110/70, Pulse 76/min\nAbdomen soft, non-tender\nMinimal vaginal bleeding\nNo fever, no foul-smelling discharge',
      adviceOnDischarge: '1. Tab Amoxycillin 500mg TDS x 5 days\n2. Tab Metronidazole 400mg TDS x 5 days\n3. Tab Iron+Folic Acid BD x 3 months\n4. No intercourse for 2 weeks\n5. Contraception counselling done\n6. Report immediately if heavy bleeding, fever, or severe pain\n7. Follow up after 2 weeks for check up',
      followUp: 'After 2 weeks for review USG and check up',
      courseInHospital: `Uncomplicated MTP at ${pogWks} weeks. Procedure uneventful. Patient stable at discharge.`
    },
    consents: [{ id: uid(), title: 'MTP Consent Form', content: 'Patient counselled about MTP procedure, risks, alternatives and contraception. Written informed consent taken as per MTP Act 1971.', dateAdded: admDate }]
  };
};

// --- MAIN SEED FUNCTION ---
const seed = async () => {
  console.log('🚀 Starting IPD test data seed...');

  // Load existing data
  const patientsSnap = await getDoc(doc(db, 'omStore', 'patients'));
  const admissionsSnap = await getDoc(doc(db, 'omStore', 'ipdAdmissions'));

  let existingPatients: any[] = patientsSnap.exists() ? (patientsSnap.data()?.payload || []) : [];
  let existingAdmissions: any[] = admissionsSnap.exists() ? (admissionsSnap.data()?.payload || []) : [];

  console.log(`📋 Existing patients: ${existingPatients.length}, Admissions: ${existingAdmissions.length}`);

  const newPatients: any[] = [];
  const newAdmissions: any[] = [];

  const uhidStart = 3000 + existingPatients.length;

  // Build 40 patients
  for (let i = 0; i < 40; i++) {
    const name = patientNames[i];
    const addr = addresses[i % addresses.length];
    const age = `${25 + Math.floor(i * 1.5)} years`;
    const patType = i < 10 ? 'obstetric' : i < 20 ? 'obstetric' : i < 30 ? 'gynecology' : 'gynecology';

    const patient = {
      id: uid(),
      uhid: `JJ${String(uhidStart + i).padStart(4, '0')}`,
      name,
      age,
      address: addr,
      mobile: `98${String(70000000 + i * 1111 + Math.floor(Math.random() * 9999)).padStart(8, '0')}`,
      type: patType,
      isPreviouslyRegistered: i % 3 !== 0,
      obstetricHistory: i < 30 ? `G${1 + i % 3}P${i % 3}L${i % 3}` : '',
    };
    newPatients.push(patient);

    let admission;
    if (i < 10) {
      admission = makeLSCS(i, patient);
    } else if (i < 20) {
      admission = makeFTND(i - 10, patient);
    } else if (i < 30) {
      admission = makeHysterectomy(i - 20, patient);
    } else {
      admission = makeMTP(i - 30, patient);
    }
    newAdmissions.push(admission);
  }

  // Merge with existing
  const allPatients = [...existingPatients, ...newPatients];
  const allAdmissions = [...existingAdmissions, ...newAdmissions];

  // Save to Firestore
  console.log('💾 Saving patients...');
  await setDoc(doc(db, 'omStore', 'patients'), { payload: clean(allPatients) });

  console.log('💾 Saving admissions...');
  await setDoc(doc(db, 'omStore', 'ipdAdmissions'), { payload: clean(allAdmissions) });

  console.log('');
  console.log('✅ DONE! Seeded:');
  console.log(`  👶 10 LSCS cases (3 days each, with OT notes, rounds, nursing)`);
  console.log(`  🤱 10 FTND cases (2 days each, with labour progress, rounds, nursing)`);
  console.log(`  🏥 10 Hysterectomy cases (3 days each, with OT notes, rounds, nursing)`);
  console.log(`  💊 10 MTP cases (1 day each, with procedure notes, rounds, nursing)`);
  console.log(`  📋 Total: 40 patients, 40 IPD admissions`);
  console.log(`  🔥 Data pushed to Firestore project: gen-lang-client-0175658349`);
};

seed().catch(e => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
