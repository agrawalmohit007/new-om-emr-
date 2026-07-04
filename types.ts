
export type UserRole = 'opd' | 'doctor' | 'lab' | 'admin' | 'master' | 'superadmin' | 'ipd' | 'pharmacy' | 'global_stats' | 'analytics' | 'usg' | 'nurse' | 'none';

// --- ANALYTICS / REGISTRY TYPES ---
export interface RegistryFieldConfig {
    name: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    source: 'Patient Registration' | 'OPD Consultation' | 'IPD Admission' | 'Surgical Notes' | 'General';
}

export interface RegistryTemplate {
    id: string;
    name: string;
    fields: string[];
    fieldConfigs?: RegistryFieldConfig[];
    isMandatory?: boolean;
}

export interface RegistryRecord {
    id: string;
    registryId: string;
    patientId?: string;
    data: Record<string, string>;
    timestamp: number;
}

export type PatientType = 'obgyn' | 'surgery' | 'general' | 'obstetric' | 'gynecology';
export type VisitType = 'new' | 'follow-up-short' | 'follow-up-long';

export interface Specialty {
    id: string;
    name: string;
}

export interface SystemUser {
    id: string;
    name: string;
    roles: UserRole[]; // Changed from single role to array
    role?: UserRole; // Legacy support (optional)
    pin: string;
    isActive: boolean;
}

export interface Vitals {
  bp: string;
  pulse: string;
  weight: string;
  height: string;
  spo2: string;
}

export interface PregnancyInfo {
  lmp: string; // YYYY-MM-DD
  edd: string;
  pog: string; // Weeks + Days
}

export interface Patient {
  id: string;
  uhid?: string; // Unique Health ID
  name: string;
  age: string;
  address: string;
  mobile: string;
  type: PatientType;
  isPreviouslyRegistered?: boolean;
  pregnancyInfo?: PregnancyInfo;
  obstetricHistory?: string; // Global O/H field
  customFields?: Record<string, string>;
  registeredDate?: string;
}

export interface Consultant {
  id: string;
  name: string;
  department: PatientType;
  isActive: boolean;
  qualifications?: string;
  specialty?: string;
  baseFee: number;
  followUpFee?: number;
  pin?: string;
  roles?: UserRole[]; // Added to allow Consultants to have extra roles (e.g. Admin)
}

export interface ClinicalTemplate {
  id: string;
  title: string;
  content: string; // Can be text or JSON string for complex objects
  category: 'complaints' | 'oh' | 'mh' | 'gen_exam' | 'phys_exam' | 'prescription' | 
            'ipd_round' | 'nursing_drug_chart' | 'bill_package' | 
            'nursing_complaint' | 'nursing_gen_cond' | 'nursing_pa' | 'nursing_pv' | 'nursing_plan' | 
            'consent' | 'admission_note' | 'discharge' | 'operative_note' |
            'round_gc' | 'round_cvs' | 'round_rs' | 'round_investigation' | 'round_advice' | 'round_rx';
}

export interface MedicationDrug {
    id: string;
    group: string;
    name: string;
    defaultFrequency?: string;
    defaultDuration?: string;
    defaultAdvice?: string;
    defaultDose?: string;
    instructions?: string;
}

export interface MedicationMasterData {
    groups: string[];
    drugs: MedicationDrug[];
    frequencies: string[];
    instructions: string[];
}

export interface LabOrder {
  id: string;
  patientId: string;
  tests: SelectedTests;
  ultrasound?: boolean;
  status: 'pending' | 'completed';
  reportData?: CbcReportData;
  timestamp: number;
}

export interface FinalBillStructure {
    billNumber: string;
    items: { name: string; price: number }[];
    subTotal: number;
    discount: number;
    grandTotal: number;
    collectedBy: string;
    paymentMethod: 'cash' | 'upi';
    date: string;
}

export interface VisitRecord {
  id: string;
  patientId: string;
  date: string;
  visitType: VisitType;
  fees: number;
  orders: LabOrder;
  isApproved: boolean;
  callingStatus?: 'waiting' | 'called';
  vitals?: Vitals;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: 'cash' | 'upi';
  assignedDoctor?: string;
  discount?: number;
  doctorActionStatus?: 'received' | 'not-received';
  collectedBy?: string; // Name of person who collected (Doctor or Staff)
  finalBill?: FinalBillStructure; // Stores the frozen bill details
  
  // Clinical sequence fields
  complaints?: string;
  visitObstetricHistory?: string;
  menstrualHistory?: string;
  visitLmp?: string;
  visitEdd?: string;
  visitPog?: string;
  generalExamination?: string; // Additional notes for gen exam
  examinationDetails?: string; // Physical Examination
  prescription?: string;
  
  // New Fields
  remarks?: string;
  followUpDate?: string; // YYYY-MM-DD
  caseStatus?: 'open' | 'closed'; // Status of the case
  parentVisitId?: string; // Links this visit to an older parent case branch
  episodeName?: string; // Name of the episode (e.g. 'ANC Journey')
  episodeId?: string; // Unique identifier grouping visits in the same episode
  customFields?: Record<string, string>;
}

export interface BillItem {
  id: string;
  testName: string;
  price: number;
}

export interface BillData {
  billNumber: string;
  serialNumber: number;
  patientName: string;
  refBy: string;
  date: string;
  items: BillItem[];
  total: number;
}

export interface CbcParameter {
  investigation: string;
  result: string;
  referenceRange: string;
  unit: string;
  aliases?: string[];
}

export interface OtherTestsData {
    randomBloodSugar: string;
    bloodGroup: 'A' | 'B' | 'O' | 'AB' | '';
    rhType: 'Positive' | 'Negative' | '';
}

export interface SerologyResults {
    hiv1: string;
    hiv2: string;
    hbsag: string;
    vdrl: string;
    hcv: string;
}

export interface SerologySelection {
    hiv: boolean;
    hbsag: boolean;
    vdrl: boolean;
    hcv: boolean;
}

export interface SerologyData {
    results: SerologyResults;
    selection: SerologySelection;
}

export interface UrinePhysicalExamination {
    quantity: string;
    urineColor: string;
    appearance: string;
    specificGravity: string;
}

export interface UrineChemicalExamination {
    albumin: string;
    sugar: string;
    bileSalt: string;
    ketoneBody: string;
    ph: string;
}

export interface UrineMicroscopicExamination {
    pusCells: string;
    rbc: string;
    epithelialCell: string;
    crystal: string;
    bacteria: string;
    cast: string;
}

export interface UrineReportData {
    physicalExamination: UrinePhysicalExamination;
    chemicalExamination: UrineChemicalExamination;
    microscopicExamination: UrineMicroscopicExamination;
    pregnancyTest: string;
    urineLh: string;
}

export interface WidalParameter {
  investigation: string;
  result: 'Reactive' | 'Non-Reactive' | '';
  titre: string;
  referenceValue: string;
  unit: string;
}

export interface WidalReportData {
    parameters: WidalParameter[];
}

export interface CrpReportData {
    result: string;
    referenceRange: string;
    unit: string;
}

export interface HormoneReportSelection {
    ft3: boolean;
    ft4: boolean;
    t3: boolean;
    t4: boolean;
    tsh: boolean;
    hba1c: boolean;
    fsh: boolean;
    lh: boolean; 
    amh: boolean;
    prolactin: boolean;
}

export interface HormoneParameter {
    result: string;
    unit: string;
    referenceRange: string;
}

export interface OtherHormoneParameter {
    testName: string;
    result: string;
    unit: string;
    referenceRange: string;
}

export interface HormoneReportResults {
    ft3: HormoneParameter;
    ft4: HormoneParameter;
    t3: HormoneParameter;
    t4: HormoneParameter;
    tsh: HormoneParameter;
    hba1c: HormoneParameter;
    fsh: HormoneParameter;
    lh: HormoneParameter;
    amh: HormoneParameter;
    prolactin: HormoneParameter;
}

export interface HormoneReportData {
    selection: HormoneReportSelection;
    results: HormoneReportResults;
    otherHormones: OtherHormoneParameter[];
}

export interface SemenPhysicalExamination {
    volume: string;
    colour: string;
    ph: string;
    liquefactionTime: string;
    viscosity: string;
}

export interface SemenMicroscopicExamination {
    spermCount: string;
    totalSpermCount: string;
    progressiveMotility: string;
    nonProgressiveMotility: string;
    immotile: string;
    totalMotility: string;
    pusCells: string;
    deadSperm: string;
}

export interface SemenAnalysisData {
    physicalExamination: SemenPhysicalExamination;
    microscopicExamination: SemenMicroscopicExamination;
}

export interface SelectedTests {
    cbc: boolean;
    serology: boolean;
    urine: boolean;
    other: boolean;
    widal: boolean;
    crp: boolean;
    hormone: boolean;
    semen: boolean;
    bloodSugar?: boolean;
    bloodGroup?: boolean;
    hormoneDetails?: Partial<HormoneReportSelection>;
}

export interface CbcReportData {
  serialNumber: number;
  billNumber: string;
  patientName: string;
  refBy: string;
  date: string;
  age: string;
  address: string;
  isExternal?: boolean;
  title?: string;
  externalLink?: string;
  html?: string;
  haematologyParameters: CbcParameter[];
  whiteBloodCellParameters: CbcParameter[];
  plateletParameters: CbcParameter[];
  otherTests: OtherTestsData;
  serology: SerologyData;
  urineReport: UrineReportData;
  widalReport: WidalReportData;
  crpReport: CrpReportData;
  hormoneReport: HormoneReportData;
  semenAnalysis: SemenAnalysisData;
  doctorName: string;
  
  cbcInterpretation: string;
  otherTestsInterpretation: string;
  serologyInterpretation: string;
  urineReportInterpretation: string;
  widalReportInterpretation: string;
  crpReportInterpretation: string;
  hormoneReportInterpretation: string;
  semenAnalysisInterpretation: string;
}

export interface SavedReport {
    id?: string;
    reportData: CbcReportData;
    selectedTests: SelectedTests;
    billData?: BillData;
    timestamp: number;
    isDeleted?: boolean;
    deletionReason?: string;
    deletionTimestamp?: number;
}

export type InventoryCategory = 'cbc_machine' | 'finecare_machine' | 'routine_consumable';

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  orderDate: string;
  installationDate?: string;
  useBeforeDate: string;
  isOpen: boolean;
  remainingTests: number;
  stripsPerBox?: number;
  pricePerStrip?: number;
  unitsPerBox?: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface PageMargins {
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    headerHeight: number;
    footerHeight: number;
}

export interface AppPrintSettings {
    lab: PageMargins;
    prescription: PageMargins;
    bill: PageMargins;
    headerImage?: string; // base64 or URL
    headerText?: string;
    footerImage?: string; // base64 or URL
    footerText?: string;
}

export interface AppConfig {
    geminiKey: string;
    serialNumber: string;
    isActivated: boolean;
    activatedFacilities: {
        opd: boolean;
        ipd: boolean;
        lab: boolean;
        pharmacy: boolean;
        usg: boolean;
    };
    isMedMasterSetupDone: boolean;
    isBillingSetupDone: boolean;
}

// --- IPD TYPES ---

export type BedType = 'general' | 'semi_private' | 'private' | 'icu' | 'labor';
export type BedStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance';

export interface Bed {
    id: string;
    number: string;
    type: BedType;
    status: BedStatus;
    currentAdmissionId?: string | null;
    pricePerDay: number;
}

export interface Ward {
    id: string;
    name: string;
    beds: Bed[];
}

export interface IpdRoundNote {
    id: string;
    timestamp: string; // Date/Time of the round
    doctorName: string;
    
    // Legacy support fields
    note?: string; 
    
    // New Structured Fields
    gc: string; // General Condition: Fair, Moderate, Poor
    pulse: string;
    bp: string;
    cvs: string; // S1S2, Murmur etc
    rs: string; // Air entry etc
    physicalExamination: string; // Detailed text
    nursingDirectives?: Record<string, boolean>; // Directives for Nursing MAR (Temp, BP, SpO2, I/O, FHR, AG Drain, etc)
    
    medication: string; // Rx
    investigation: string; // Labs Advised
    advice: string; // General Advice
    
    // Keeping vitals object structure for compatibility with other modules if needed
    vitals: Vitals; 
}

// Enhanced Round Note for AI Parsing
export interface DailyRoundNote {
  id: string;
  date: string;
  complaints: string;
  generalCondition: string;
  pulse: string;
  bp: string;
  spo2?: string;
  temperature: string;
  perAbdomen: string;
  perVaginum: string;
  treatmentPlan: string;
}

export interface IpdAdmissionNote {
    id: string;
    date: string;
    chiefComplaints: string;
    historyOfPresentIllness: string;
    pastHistory: string; // Medical/Surgical
    obstetricHistory: string; // If applicable (Parity etc)
    menstrualHistory: string; // LMP, EDD, POG
    generalExamination: string; // Vitals + General
    systemicExamination: string; // CVS, RS, PA, CNS
    localExamination: string; // PV / PS
    provisionalDiagnosis: string;
    planOfCare: string;
    bp: string;
    pulse: string;
    weight: string;
    spo2: string;
}

export interface LabourProgressEntry {
  id: string;
  dateTime: string;
  fhr: string; // Fetal Heart Rate
  amnioticFluid: string; // I, C, M, B
  moulding: string; // 1, 2, 3
  cervixDilatation: number; // 0-10
  descent: number; // 5 to 0
  contractionFreq: string; // per 10 mins
  contractionDur: string; // seconds
  drugsIvFluids: string;
  vitals: { pulse: string; bp: string; temp: string };
  urine: { protein: string; acetone: string; volume: string };
}

export interface DeliveryDetails {
    deliveryDate: string;
    deliveryTime: string;
    method: 'Vaginal' | 'LSCS' | 'Instrumental';
    babySex: 'Male' | 'Female';
    babyWeight: string;
    birthStatus: 'Live' | 'IUD' | 'Stillbirth';
    notes?: string;
    indication?: string;
    apgar1Min?: string;
    apgar5Min?: string;
    conductedBy?: string;
    liquor?: string;
    bloodLoss?: string;
    placenta?: string;
    complications?: string;
    episiotomy?: string;
}

export interface PostOperativeNote {
    id: string;
    date: string;
    isMaternity?: boolean;
    procedureName: string;
    surgeonName: string;
    assistantSurgeonName?: string;
    pediatricianName?: string;
    anesthetistName?: string;
    staffNurseName?: string;
    anesthesiaType?: string; 
    anesthesiaNotes?: string;
    preOpDiagnosis: string;
    preOpNotes?: string; 
    procedureDetails: string;
    hemostasis: string;
    closure: string;
    postOpNotes?: string;
    postOpOrders: string;
    indication?: string;
    incisionType?: string;
    liquor?: string;
    bloodLoss?: string;
    tubalLigation?: string;
    instrumentCount?: string;
    babyDetails?: {
        sex: 'Male' | 'Female';
        date: string;
        time: string;
        weight: string;
        presentation?: string;
        apgar1Min?: string;
        apgar5Min?: string;
        cry?: 'Immediate' | 'Delayed';
    };
    chargesAdded?: boolean;
    customFields?: Record<string, string>;
}

export interface IpdMedication {
    id: string;
    drugName: string;
    dose: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    instructions?: string;
    administrations: { timestamp: string; administeredBy: string }[];
}

// Updated Nursing Chart Structure based on image
export interface IpdMedicationChartEntry {
    id: string;
    date: string;
    nameOfMedication: string;
    frequency: string;
    route: string;
    morningTime?: string;
    morningSign?: string;
    afternoonTime?: string;
    afternoonSign?: string;
    eveningTime?: string;
    eveningSign?: string;
    fluidAmount?: number; // Auto-calculated input in ml
}

export interface NursingNote {
    id: string;
    date: string; // Converted from timestamp for consistency
    note: string;
    nurseName: string;
    
    // Structured Fields
    complaints: string;
    generalCondition: string;
    perAbdomen: string;
    perVaginum: string;
    treatmentPlan: string;
    
    // I/O Balance
    intakeIv: number;
    intakeOral: number;
    outputUrine: number;
    outputOther: number;
}

export interface FluidEntry {
    id: string;
    timestamp: string;
    type: 'intake' | 'output';
    fluidName: string; // e.g., 'Normal Saline', 'Urine'
    amountMl: number;
    route: string; // e.g., 'IV', 'Oral', 'Catheter'
}

export interface IpdCharge {
    id: string;
    date: string;
    description: string;
    amount: number;
    category: 'procedure' | 'medicine' | 'consumable' | 'other' | 'room' | 'operation' | 'anesthesia' | 'medication_package' | 'lab' | 'ipd' | 'opd' | 'day_care';
    quantity?: number;
    frequency?: string;
}

export interface IpdPayment {
    id: string;
    date: string;
    amount: number;
    method: 'cash' | 'upi' | 'card' | 'insurance';
    note?: string;
}

export interface IpdDischargeSummary {
    admissionDate: string;
    dischargeDate: string;
    diagnosis: string;
    
    // Header Info
    bloodGroup?: string;
    
    // Sections matching Discharge Card
    complaints: string; // Chief Complaints
    obstetricHistory: string;
    menstrualHistory: string; // AOM, LMP, EDD, POG details
    
    // Exam on Admission
    examinationOnAdmission: string; // Structure: GC, Febrile, P, BP, RS, CVS, P/A, UT, etc.
    
    // Operative / Delivery
    operativeNotesSummary: string; // Type, Baby Sex, Presentation, Apgar, etc.
    babyDetails?: {
        weight: string;
        time: string;
        date: string;
        sex: 'Male' | 'Female';
        presentation?: string;
    };

    // Treatment
    treatmentGiven: string; // Aggregated from rounds
    
    // Exam on Discharge
    examinationOnDischarge?: string; // GC, Afebrile, P, BP, P/A (Uterus), Breast, Baby
    
    // Advice
    adviceOnDischarge: string; // Immunization, BF, Contraception, Diet, Rx
    followUp: string;
    
    // Legacy support fields
    investigations?: string;
    courseInHospital?: string; 
    findingsOnDischarge?: string; // Mapped to examinationOnDischarge
}

export interface PatientConsent {
    id: string;
    templateId?: string;
    title: string;
    content: string;
    dateAdded: string;
}

export interface IpdAdmission {
    id: string;
    patientId: string;
    admissionDate: string;
    dischargeDate?: string;
    wardId: string;
    bedId: string;
    diagnosis: string;
    insuranceProvider?: string;
    policyNumber?: string;
    status: 'active' | 'discharged';
    primaryDoctor: string;
    dailyCharges: number;
    advanceAmount?: number;
    totalBill?: number;
    payments?: IpdPayment[];
    discount?: number;
    
    // EMR Features
    admissionNote?: IpdAdmissionNote;
    roundNotes: IpdRoundNote[]; 
    dailyRounds?: DailyRoundNote[]; 
    labourProgress?: LabourProgressEntry[];
    deliveryDetails?: DeliveryDetails; // New Field for Labour Register
    operativeNotes?: PostOperativeNote[];
    medications: IpdMedication[];
    nursingMedicationCharts?: IpdMedicationChartEntry[];
    nursingNotes: NursingNote[];
    fluidBalance: FluidEntry[];
    charges: IpdCharge[];
    dischargeSummary?: IpdDischargeSummary;
    consents?: PatientConsent[];
    customFields?: Record<string, string>;
}

export type ServicePrices = Record<string, { name: string, price: number, category?: string }>;

// --- PHARMACY ERP TYPES ---

export interface PharmacySupplier {
    id: string;
    name: string;
    mobile: string;
    gstNo?: string;
    address?: string;
}

export interface PharmacyItem {
    id: string;
    name: string;
    genericName?: string; // Salt composition
    quantity: number;
    batchNumber: string;
    expiryDate: string;
    addedDate: string;
    
    // Financials
    mrp: number;
    purchaseRate: number;
    saleRate: number;
    gstPercentage: number; // 0, 5, 12, 18, 28
    
    // Management
    supplierId?: string;
    rackLocation?: string;
    minStockLevel: number; // For Reorder alerts
    rxGroup?: string[]; // Link to Clinical Master - Supports Multiple Groups
}

export interface PharmacySaleItem {
    itemId: string;
    name: string;
    batch: string;
    expiry: string;
    qty: number;
    rate: number;
    gst: number;
    amount: number;
}

export interface PharmacySale {
    id: string;
    invoiceNo: string;
    date: string;
    patientName: string;
    doctorName: string;
    items: PharmacySaleItem[];
    subTotal: number;
    totalGst: number;
    discount: number;
    grandTotal: number;
    paymentMethod: 'cash' | 'upi' | 'card';
}
