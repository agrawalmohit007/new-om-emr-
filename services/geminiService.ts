
import { GoogleGenAI, Type } from "@google/genai";
import { CbcReportData, PharmacyItem, DailyRoundNote, LabourProgressEntry, PostOperativeNote, IpdDischargeSummary, IpdMedicationChartEntry, IpdAdmissionNote, IpdRoundNote } from '../types';

// Fix: Ensure GoogleGenAI initialization uses named parameter with API key from process.env.API_KEY
const apiKeyVal = process.env.API_KEY || process.env.GEMINI_API_KEY || "DUMMY_KEY";
const ai = new GoogleGenAI({ apiKey: apiKeyVal });

export const extractPatientDataFromId = async (base64Image: string, mimeType: string) => {
  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: `Extract the following details from this identity document (e.g. Aadhar card):
    - Full Name
    - Age or Date of Birth
    - Address
    - Gender
    Provide the result in JSON format.`
  };

  const schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      age: { type: Type.STRING },
      address: { type: Type.STRING },
      gender: { type: Type.STRING }
    }
  };

  // Fix: Property .text is used correctly from GenerateContentResponse
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [imagePart, textPart] },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    },
  });

  return JSON.parse(response.text.trim());
};

const cbcParameterSchema = {
  type: Type.OBJECT,
  properties: {
    investigation: { type: Type.STRING },
    result: { type: Type.STRING },
    referenceRange: { type: Type.STRING },
    unit: { type: Type.STRING },
  },
  required: ["investigation", "result", "referenceRange", "unit"]
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    patientName: { type: Type.STRING },
    refBy: { type: Type.STRING },
    date: { type: Type.STRING },
    age: { type: Type.STRING },
    address: { type: Type.STRING },
    haematologyParameters: { type: Type.ARRAY, items: cbcParameterSchema },
    whiteBloodCellParameters: { type: Type.ARRAY, items: cbcParameterSchema },
    plateletParameters: { type: Type.ARRAY, items: cbcParameterSchema }
  },
  required: ["patientName", "refBy", "date", "age", "address", "haematologyParameters", "whiteBloodCellParameters", "plateletParameters"]
};

export const extractCbcDataFromImage = async (base64Image: string, mimeType: string): Promise<CbcReportData> => {
  const imagePart = {
    inlineData: { data: base64Image, mimeType: mimeType },
  };

  const textPart = {
    text: `Analyze this CBC report image and extract all parameters in JSON format.`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [imagePart, textPart] },
    config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
    },
  });

  return JSON.parse(response.text.trim());
};

export const generateInterpretation = async (
  sectionTitle: string,
  sectionData: any,
  patientData: { patientName: string; age: string }
): Promise<string> => {
  const prompt = `
    You are a medical expert in surgery and obstetrics. Interpret these results concisely for a clinician:
    Patient: ${patientData.patientName}, Age: ${patientData.age}
    Section: ${sectionTitle}
    Data: ${JSON.stringify(sectionData)}
    `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text.trim();
};

export const translateMedicalText = async (text: string, language: 'Marathi' | 'Hindi'): Promise<string> => {
    const prompt = `Translate the following medical advice/prescription details into ${language}. 
    Keep medical terms (like drug names) in English if they are commonly used that way, but explain instructions (frequency, food intake) in ${language}.
    
    Text to translate:
    "${text}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });

    return response.text.trim();
};

export const extractMedicinesFromBill = async (base64Image: string, mimeType: string): Promise<Partial<PharmacyItem>[]> => {
    const imagePart = {
        inlineData: { data: base64Image, mimeType: mimeType },
    };

    const textPart = {
        text: `Analyze this pharmacy purchase bill/invoice image. 
        Extract a list of medicines. For each item, extract:
        - Name
        - Quantity (default 0)
        - Batch Number
        - Expiry Date
        - MRP (Maximum Retail Price)
        - Purchase Rate (Rate / Trade Rate / Unit Price).
        
        If batch or expiry is missing, leave empty string.
        If numeric values are missing, default to 0.`
    };

    const itemSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
            batchNumber: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            mrp: { type: Type.NUMBER },
            purchaseRate: { type: Type.NUMBER }
        },
        required: ["name", "quantity"]
    };

    const listSchema = {
        type: Type.OBJECT,
        properties: {
            items: { type: Type.ARRAY, items: itemSchema }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: listSchema
        }
    });

    try {
        const data = JSON.parse(response.text.trim());
        return data.items || [];
    } catch (e) {
        console.error("Failed to parse pharmacy extraction", e);
        return [];
    }
};

export const findGenericName = async (drugName: string): Promise<string> => {
    const prompt = `Identify the generic name / salt composition for the medicine: "${drugName}". Return ONLY the generic name string. If unknown, return the input string.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text.trim();
};

export const extractMedicinesForPos = async (base64Image: string, mimeType: string): Promise<{name: string, qty: number}[]> => {
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { 
        text: `Analyze this prescription or medicine wrapper image. List all visible medicine names and estimated quantity (default to 1 if not specified). Return a JSON array.` 
    };
    
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                qty: { type: Type.NUMBER }
            }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    return JSON.parse(response.text.trim());
};

// --- IPD AI MODULES ---

export const parseDailyRoundNote = async (transcript: string): Promise<Partial<IpdRoundNote>> => {
    const prompt = `
    You are a medical scribe. Parse the following doctor's dictation for a daily round note and extract the structured data.
    
    Dictation: "${transcript}"
    
    SPECIAL RULE: 
    If the dictation mentions "Post LSCS" or "LSCS Round" or "Normal LSCS", YOU MUST OUTPUT EXACTLY THE FOLLOWING VALUES (unless the dictation specifically overrides a value):
    - GC: Fair
    - Pulse: 88
    - BP: 120/80
    - CVS: Normal
    - RS: Normal
    - Physical Examination: P/A Uterus well retracted, P/V No active bleeding
    - Medication: 
      INJ XONE 1 GM IV 12 HOURLY
      INJ PAND IV 12 HOURLY
      INJ DICLO IM 12 HOURLY
      INJ EMSET IN DRIP 12 HOURLY
      IVF RL DNS NS
    - Advice: Exclusive breast feeding of the baby for 6 months
    
    General Rules:
    1. If "Normal" or "All Normal" is said (without LSCS context), use defaults: GC: Fair, Pulse: 72, BP: 120/80, CVS: Normal, RS: Normal, Phys Exam: Abdomen Soft.
    2. Extract specific values if mentioned.
    3. Extract Medication and Advice.
    
    Return JSON.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            gc: { type: Type.STRING },
            pulse: { type: Type.STRING },
            bp: { type: Type.STRING },
            cvs: { type: Type.STRING },
            rs: { type: Type.STRING },
            physicalExamination: { type: Type.STRING },
            medication: { type: Type.STRING },
            investigation: { type: Type.STRING },
            advice: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text.trim());
};

export const expandNursingNote = async (transcript: string): Promise<string> => {
    const prompt = `
    Expand the following short-hand nursing note into a professional full-sentence medical note.
    If the input says "all normal", assume "Patient is conscious, oriented. Vitals stable. No active complaints. Taking oral feeds."
    
    Input: "${transcript}"
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });

    return response.text.trim();
};

export const generateAdmissionNote = async (transcriptOrClues: string): Promise<Partial<IpdAdmissionNote>> => {
    const prompt = `
    You are a medical scribe. Generate a comprehensive Hospital Admission Note based on the clues/dictation provided.
    
    Clues/Dictation: "${transcriptOrClues}"
    
    Rules:
    1. Expand brief points into professional medical sentences.
    2. Infer standard normal values if "Normal" is mentioned for examination.
    3. Ensure flow: Complaints -> HPI -> Past History -> Obs/Menstrual History -> Examination -> Diagnosis -> Plan.
    4. Return structured JSON.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            chiefComplaints: { type: Type.STRING },
            historyOfPresentIllness: { type: Type.STRING },
            pastHistory: { type: Type.STRING },
            obstetricHistory: { type: Type.STRING },
            menstrualHistory: { type: Type.STRING },
            generalExamination: { type: Type.STRING },
            systemicExamination: { type: Type.STRING },
            localExamination: { type: Type.STRING },
            provisionalDiagnosis: { type: Type.STRING },
            planOfCare: { type: Type.STRING },
            bp: { type: Type.STRING },
            pulse: { type: Type.STRING },
            weight: { type: Type.STRING },
            spo2: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text.trim());
};

export const generatePartographData = async (
    clinicalDetails: string
): Promise<LabourProgressEntry[]> => {
    const prompt = `
    Generate a realistic, synthetic dataset of hourly labour progress entries (Partograph data) for a patient.
    
    Clinical details and constraints:
    ${clinicalDetails}
    
    Generate hourly or half-hourly entries covering the active phase of labour up through delivery.
    Follow WHO guidelines for labour progression where appropriate, unless the clinical details specify interventions, specific times or outcomes.
    Ensure cervix dilatation progresses logically.
    Ensure fetal head descent moves from 5/5 to 0/5.
    Vitals should be stable or show typical labour stress.
    
    Return strict JSON array.
    `;

    const entrySchema = {
        type: Type.OBJECT,
        properties: {
            dateTime: { type: Type.STRING },
            fhr: { type: Type.STRING },
            amnioticFluid: { type: Type.STRING },
            moulding: { type: Type.STRING },
            cervixDilatation: { type: Type.NUMBER },
            descent: { type: Type.NUMBER },
            contractionFreq: { type: Type.STRING },
            contractionDur: { type: Type.STRING },
            drugsIvFluids: { type: Type.STRING },
            vitals: { 
                type: Type.OBJECT, 
                properties: { pulse: {type: Type.STRING}, bp: {type: Type.STRING}, temp: {type: Type.STRING} } 
            },
            urine: { 
                type: Type.OBJECT,
                properties: { protein: {type: Type.STRING}, acetone: {type: Type.STRING}, volume: {type: Type.STRING} }
            }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: entrySchema
            }
        }
    });

    const entries = JSON.parse(response.text.trim());
    // Add IDs
    return entries.map((e: any) => ({ ...e, id: Date.now().toString() + Math.random() }));
};

export const generateOperativeNote = async (
    transcriptOrClues: string
): Promise<Partial<PostOperativeNote>> => {
    const prompt = `
    Generate a detailed operative note based on the following dictation/clues.
    Input: "${transcriptOrClues}"
    
    If "All Normal" is mentioned for a specific procedure (e.g. LSCS), assume standard steps and normal findings.
    
    Include sections: Pre-op Diagnosis, Procedure Details (steps, incision, finding, closure), Hemostasis, Post-op Orders.
    Return JSON.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            procedureName: { type: Type.STRING },
            preOpDiagnosis: { type: Type.STRING },
            procedureDetails: { type: Type.STRING },
            hemostasis: { type: Type.STRING },
            closure: { type: Type.STRING },
            postOpOrders: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text.trim());
};

export const generateDischargeSummary = async (
    transcriptOrClues: string
): Promise<Partial<IpdDischargeSummary>> => {
    const prompt = `
    Generate discharge summary sections based on the following dictation.
    Input: "${transcriptOrClues}"
    
    If "All Normal" is mentioned for course in hospital, assume "Uneventful recovery, vitals stable, afebrile, tolerant to oral diet."
    
    Return JSON with fields: Course in Hospital, Treatment Given, Findings on Discharge, Advice on Discharge.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            courseInHospital: { type: Type.STRING }, 
            treatmentGiven: { type: Type.STRING },
            findingsOnDischarge: { type: Type.STRING },
            adviceOnDischarge: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text.trim());
};

export const extractVitalsFromImage = async (base64Image: string, mimeType: string) => {
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: "Read the digital display of this medical monitor or BP machine. Extract Systolic BP, Diastolic BP, Pulse Rate, and SpO2. If a value is missing, return empty string." };
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            bpSystolic: { type: Type.STRING },
            bpDiastolic: { type: Type.STRING },
            pulse: { type: Type.STRING },
            spo2: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    return JSON.parse(response.text.trim());
};

export const identifyMedicationFromImage = async (base64Image: string, mimeType: string) => {
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: "Identify the medication name, strength, and type (tablet/injection/syrup) from this image. Return just the Name and Strength." };
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            medicationName: { type: Type.STRING },
            strength: { type: Type.STRING },
            type: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    return JSON.parse(response.text.trim());
};

export const extractMedicationChartFromImage = async (base64Image: string, mimeType: string): Promise<IpdMedicationChartEntry[]> => {
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { 
        text: `Analyze this medical medication chart or prescription image. 
        Extract a list of all medications mentioned. For each, extract Name, Frequency (e.g. BD, TDS), and Route (Oral/IV).
        If dates/times are visible, use them, otherwise default to current date.
        Return a JSON array.` 
    };

    const entrySchema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING },
            nameOfMedication: { type: Type.STRING },
            frequency: { type: Type.STRING },
            route: { type: Type.STRING },
            morningTime: { type: Type.STRING },
            afternoonTime: { type: Type.STRING },
            eveningTime: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: { 
            responseMimeType: "application/json", 
            responseSchema: { type: Type.ARRAY, items: entrySchema }
        }
    });

    return JSON.parse(response.text.trim());
};

export const predictPrescription = async (
    currentComplaints: string,
    currentRx: string,
    currentPhysExam: string,
    pastRecordsContext: string,
    patientType: "general" | "obstetric" | "pediatric"
): Promise<{complaints: string, rx: string, physExam: string}> => {
    const prompt = `
        You are an AI assistant helping a doctor autocomplete an OPD prescription based on their past usage patterns and current inputs.
        
        Doctor's Historic Data / Relevant Past Consultations (Learn from this): 
        ${pastRecordsContext}
        
        Current Patient Type: ${patientType}
        
        Current Form State:
        - Complaints: ${currentComplaints}
        - Physical Exam / Vitals: ${currentPhysExam}
        - Prescription: ${currentRx}

        Tasks:
        1. Analyze the doctor's historic patterns (e.g., if "Nausea" -> usually prescribes "Tab Doxinate", or vice versa). 
        2. If the user provided Complaints but no Meds (or partial), predict Meds.
        3. If the user provided Meds but no Complaints (or partial), predict Complaints.
        4. In obstetric patients: classify the patient into 1st, 2nd, or 3rd trimester based on gestational age (e.g., LMP, EDD, "5 months", "14 weeks") if available. Then automatically add the doctor's preferred routine supplements for that trimester (e.g., folic acid, iron, calcium) depending on their historic usage patterns.
        5. In hypertensive range (e.g., BP 140/90 or 160/100), add the doctor's preferred antihypertensive meds (e.g., Tab Labetalol) to the prescription if not already present.
        6. This process must be refined dynamically based on the provided Past Consultations context.
        
        Return the updated text for ALL fields. Keep existing text, just append or integrate the new predictions seamlessly in the doctor's writing style.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            complaints: { type: Type.STRING, description: "Updated full text for complaints" },
            physExam: { type: Type.STRING, description: "Updated full text for physical examination and vitals" },
            rx: { type: Type.STRING, description: "Updated full text for prescription" }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text.trim());
};

export const generateConsent = async (promptText: string): Promise<string> => {
    const prompt = `Draft a clinical consent form for the following request/procedure: "${promptText}". 
    Use the placeholders {{PATIENT}} and {{DOCTOR}} where appropriate.
    Make it legally sound, including risks, benefits, and alternatives if relevant, but clear and concise.
    Return ONLY the raw consent text.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    
    return response.text.trim();
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    const prompt = `Translate the following medical consent form/text into ${targetLanguage}. Maintain all placeholders like {{PATIENT}} and {{DOCTOR}}.\n\nText:\n${text}`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    
    return response.text.trim();
};

export interface StructuredPrescriptionOcr {
    complaints?: string;
    bp?: string;
    pulse?: string;
    weight?: string;
    spo2?: string;
    prescription?: string;
    remarks?: string;
}

export const extractPrescriptionFromImage = async (base64Image: string, mimeType: string): Promise<StructuredPrescriptionOcr> => {
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { 
        text: `Analyze this manual prescription image (handwritten or printed). 
        Extract the following fields if present:
        - complaints: symptoms, chief complaints, patient history
        - bp: blood pressure (e.g. 120/80)
        - pulse: pulse rate or heart rate
        - weight: patient weight in kg
        - spo2: blood oxygen level in %
        - prescription: list of medicines, strength, frequency, duration (written in standard format)
        - remarks: advice, special notes, clinical instruction`
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            complaints: { type: Type.STRING },
            bp: { type: Type.STRING },
            pulse: { type: Type.STRING },
            weight: { type: Type.STRING },
            spo2: { type: Type.STRING },
            prescription: { type: Type.STRING },
            remarks: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    try {
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Failed to parse prescription OCR JSON", e);
        return { remarks: response.text.trim() };
    }
};

export const executeAiComplete = async (
    formType: 'opd' | 'admission' | 'rounds' | 'surgery' | 'discharge',
    currentFields: Record<string, string>,
    customPrompt?: string
): Promise<Record<string, string>> => {
    let schemaProperties: any = {};
    const schemaRequired: string[] = [];

    if (formType === 'opd') {
        schemaProperties = {
            complaints: { type: Type.STRING },
            menstrualHistory: { type: Type.STRING },
            obstetricHistory: { type: Type.STRING },
            genNotes: { type: Type.STRING },
            physExam: { type: Type.STRING },
            rx: { type: Type.STRING }
        };
    } else if (formType === 'admission') {
        schemaProperties = {
            chiefComplaints: { type: Type.STRING },
            historyOfPresentIllness: { type: Type.STRING },
            pastHistory: { type: Type.STRING },
            obstetricHistory: { type: Type.STRING },
            menstrualHistory: { type: Type.STRING },
            generalExamination: { type: Type.STRING },
            systemicExamination: { type: Type.STRING },
            localExamination: { type: Type.STRING },
            provisionalDiagnosis: { type: Type.STRING },
            planOfCare: { type: Type.STRING }
        };
    } else if (formType === 'rounds') {
        schemaProperties = {
            gc: { type: Type.STRING },
            pulse: { type: Type.STRING },
            bp: { type: Type.STRING },
            cvs: { type: Type.STRING },
            rs: { type: Type.STRING },
            physicalExamination: { type: Type.STRING },
            medication: { type: Type.STRING },
            investigation: { type: Type.STRING },
            advice: { type: Type.STRING }
        };
    } else if (formType === 'surgery') {
        schemaProperties = {
            procedureName: { type: Type.STRING },
            preOpDiagnosis: { type: Type.STRING },
            procedureDetails: { type: Type.STRING },
            hemostasis: { type: Type.STRING },
            closure: { type: Type.STRING },
            postOpOrders: { type: Type.STRING }
        };
    } else if (formType === 'discharge') {
        schemaProperties = {
            courseInHospital: { type: Type.STRING },
            treatmentGiven: { type: Type.STRING },
            findingsOnDischarge: { type: Type.STRING },
            adviceOnDischarge: { type: Type.STRING }
        };
    }

    // Minify context: Only send non-empty fields to reduce input tokens
    const currentFieldsStr = Object.entries(currentFields)
        .filter(([_, v]) => v && v.trim() !== "")
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

    const prompt = `
You are an expert clinical EMR assistant. Your task is to perform an autocompletion or complete fill of the current clinical form type: "${formType}".

Current Populated Fields State:
${currentFieldsStr || "(All fields are currently empty)"}

${customPrompt ? `The doctor has provided the following custom instruction/diagnosis/brief: "${customPrompt}"` : `Autofill empty fields by analyzing what information is already filled in the form to save the doctor time.`}

CRITICAL MEDICAL & AUTOFILL RULES:
1. Only return the fields that need to be populated or modified. Do NOT include fields that should remain unchanged or empty. This is crucial for performance.
2. If "all normal" or similar phrase is specified (either in fields or custom prompt), fill all empty fields with typical normal values matching this form.
3. For Pregnancy / Obstetric Cases:
   - If Chief Complaint is "ANC" / "Pregnancy" (e.g., "anc 5 months") or LMP/EDD/POG is filled:
     - Deduce the trimester and gestational age in weeks (e.g. 5 months amenorrhea corresponds to 20-22 weeks).
     - Populate Physical/Abdominal Examination (physExam or localExamination or physicalExamination depending on form) with: "UT 20 to 24 weeks, relaxed, FHR+" (or matching POG weeks).
     - If the doctor already typed partial notes like "uterus irritable" or "pa irritable" in the physical exam, integrate it, e.g.: "20 to 24 weeks, uterus irritable, FHR+".
     - If Chief Complaint is empty but LMP/EDD/POG is filled and physical/abdominal exam has "pa irritable" or "uterus irritable", populate Chief Complaint with: "H/o amenorrhea since 5 months, c/o pain in abdomen" (using corresponding months based on POG), and Physical/Abdominal Examination with "20 to 24 weeks, uterus irritable, FHR+".
     - Set Chief Complaint for follow-ups as: "Follow up case, [months] months amenorrhea, no new complaints" if the custom prompt is "anc [months] months all normal".
4. Return a delta JSON containing ONLY modified properties.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: schemaProperties
            },
            temperature: 0.1,
            maxOutputTokens: 1000
        }
    });

    return JSON.parse(response.text.trim());
};

