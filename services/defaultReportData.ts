
import { CbcReportData } from '../types';

export const DEFAULT_CBC_REPORT_DATA: CbcReportData = {
  serialNumber: 0,
  billNumber: '',
  patientName: '',
  refBy: '',
  date: '',
  age: '',
  address: '',
  haematologyParameters: [
    { investigation: 'HGB', result: '', referenceRange: '13.0 – 17.0', unit: 'g/dL', aliases: ['haemoglobin', 'hb'] },
    { investigation: 'RBC', result: '', referenceRange: '4.5 – 5.5', unit: '10^6/μL', aliases: ['rbc count', 'red blood cell count'] },
    { investigation: 'HCT', result: '', referenceRange: '37-47', unit: '%', aliases: ['hematocrit'] },
    { investigation: 'MCV', result: '', referenceRange: '80 – 100', unit: 'fL' },
    { investigation: 'MCH', result: '', referenceRange: '27 – 32', unit: 'pg' },
    { investigation: 'MCHC', result: '', referenceRange: '32 – 36', unit: 'g/dL' },
    { investigation: 'RDW-CV', result: '', referenceRange: '11-16', unit: '%' },
    { investigation: 'RDW-SD', result: '', referenceRange: '39-47', unit: 'fL', aliases: ['red cell distribution width'] },
  ],
  whiteBloodCellParameters: [
    { investigation: 'WBC', result: '', referenceRange: '4000 – 11000', unit: '/μL', aliases: ['total wbc count', 'leucocyte count'] },
    { investigation: 'Lymph%', result: '', referenceRange: '20 – 40', unit: '%', aliases: ['lymphocytes'] },
    { investigation: 'Mid%', result: '', referenceRange: '2 – 10', unit: '%', aliases: ['monocytes'] },
    { investigation: 'Gran%', result: '', referenceRange: '50 - 70%', unit: '%', aliases: ['granulocytes'] },
  ],
  plateletParameters: [
    { investigation: 'PLT', result: '', referenceRange: '150000 – 400000 (Borderline)', unit: '/μL', aliases: ['platelet count'] },
    { investigation: 'MPV', result: '', referenceRange: '8-11', unit: 'fL' },
    { investigation: 'PCT', result: '', referenceRange: '0.11 - 0.28', unit: '%' },
    { investigation: 'PDW', result: '', referenceRange: '9-17', unit: 'fL' },
  ],
  otherTests: {
    randomBloodSugar: '',
    bloodGroup: '',
    rhType: ''
  },
  serology: {
    results: {
      hiv1: 'Non-Reactive',
      hiv2: 'Non-Reactive',
      hbsag: 'Non-Reactive',
      vdrl: 'Non-Reactive',
      hcv: 'Non-Reactive'
    },
    selection: {
      hiv: false,
      hbsag: false,
      vdrl: false,
      hcv: false
    }
  },
  urineReport: {
    physicalExamination: {
      quantity: '',
      urineColor: '',
      appearance: '',
      specificGravity: ''
    },
    chemicalExamination: {
      albumin: '',
      sugar: '',
      bileSalt: '',
      ketoneBody: '',
      ph: ''
    },
    microscopicExamination: {
      pusCells: '',
      rbc: '',
      epithelialCell: '',
      crystal: '',
      bacteria: '',
      cast: ''
    },
    pregnancyTest: '',
    urineLh: ''
  },
  widalReport: {
      parameters: [
        { investigation: 'Salmonella typhi O (TO)', result: '', titre: '', referenceValue: '> 1:80', unit: 'Titre' },
        { investigation: 'Salmonella typhi H (TH)', result: '', titre: '', referenceValue: '> 1:160', unit: 'Titre' },
        { investigation: 'Salmonella paratyphi A, H (AH)', result: '', titre: '', referenceValue: '> 1:320', unit: 'Titre' },
        { investigation: 'Salmonella paratyphi B, H (BH)', result: '', titre: '', referenceValue: '> 1:320', unit: 'Titre' },
      ]
  },
  crpReport: {
    result: '',
    referenceRange: '< 6.0',
    unit: 'mg/L'
  },
  hormoneReport: {
    selection: {
        ft3: false,
        ft4: false,
        t3: false,
        t4: false,
        tsh: false,
        hba1c: false,
        fsh: false,
        lh: false,
        amh: false,
        prolactin: false,
    },
    results: {
        ft3: { result: '', unit: 'pg/mL', referenceRange: '2.3 - 4.2' },
        ft4: { result: '', unit: 'ng/dL', referenceRange: '0.8 - 1.8' },
        t3: { result: '', unit: 'ng/dL', referenceRange: '80 - 220' },
        t4: { result: '', unit: 'ug/dL', referenceRange: '5.0 - 12.0' },
        tsh: { result: '', unit: 'mIU/L', referenceRange: '0.4 - 4.0' },
        hba1c: { result: '', unit: '%', referenceRange: '< 5.7' },
        fsh: { result: '', unit: 'mIU/mL', referenceRange: 'Follicular: 3.5-12.5, Ovulation: 4.7-21.5, Luteal: 1.7-7.7, Post-Menopause: 25.8-134.8' },
        lh: { result: '', unit: 'mIU/mL', referenceRange: 'Follicular: 2.4-12.6, Ovulation: 14.0-95.6, Luteal: 1.0-11.4, Post-Menopause: 7.7-58.5' },
        amh: { result: '', unit: 'ng/mL', referenceRange: '<30y: 2.5-6.3, 31-35y: 1.9-4.7, 36-40y: 1.1-3.0, 41-45y: 0.2-1.3' },
        prolactin: { result: '', unit: 'ng/mL', referenceRange: 'Male: 2.1-17.7, Female: 2.8-29.2, Pregnant: 9.7-208.5' },
    },
    otherHormones: []
  },
  semenAnalysis: {
      physicalExamination: {
          volume: '',
          colour: '',
          ph: '',
          liquefactionTime: '',
          viscosity: ''
      },
      microscopicExamination: {
          spermCount: '',
          totalSpermCount: '',
          progressiveMotility: '',
          nonProgressiveMotility: '',
          immotile: '',
          totalMotility: '',
          pusCells: '',
          deadSperm: ''
      }
  },
  doctorName: 'Dr. Mohit Agrawal',
  
  // AI Interpretations
  cbcInterpretation: '',
  otherTestsInterpretation: '',
  serologyInterpretation: '',
  urineReportInterpretation: '',
  widalReportInterpretation: '',
  crpReportInterpretation: '',
  hormoneReportInterpretation: '',
  semenAnalysisInterpretation: '',
};
