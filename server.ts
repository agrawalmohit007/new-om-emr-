import 'dotenv/config';
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.js";
import { 
  fallbackStore, appSettings, patients, visits, labOrders, consultants, systemUsers, ipdAdmissions,
  pharmacyItems, pharmacySales, savedReports, clinicalTemplates, labInventoryItems, wards
} from "./src/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { EventEmitter } from "events";

const eventEmitter = new EventEmitter();

export const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

  app.get("/api/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    const onUpdate = (collection: string) => {
        res.write(`data: ${JSON.stringify({ collection })}\n\n`);
    };

    eventEmitter.on('update', onUpdate);

    req.on('close', () => {
        eventEmitter.off('update', onUpdate);
    });
  });

  import fs from "fs/promises";

  async function readFromLocalJSON(collectionId: string): Promise<any> {
      try {
          const filePath = path.join(process.cwd(), 'data', 'collections', `${collectionId}.json`);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
      } catch {
          return null;
      }
  }

  async function writeToLocalJSON(collectionId: string, payload: any): Promise<void> {
      try {
          const dirPath = path.join(process.cwd(), 'data', 'collections');
          await fs.mkdir(dirPath, { recursive: true });
          const filePath = path.join(dirPath, `${collectionId}.json`);
          await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (e) {
          console.error("Failed to write local JSON:", e);
      }
  }

  app.get("/api/collection/:id", async (req, res) => {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

    try {
      const fetchTable = async (table: any) => {
        let query: any = db.select().from(table);
        if (limit !== undefined) query = query.limit(limit);
        if (offset !== undefined) query = query.offset(offset);
        const payload = await query;
        const response: any = { payload, updatedAt: new Date() };

        if (limit !== undefined || offset !== undefined) {
          const [{ count }] = await db.select({ count: sql`count(*)` }).from(table);
          response.totalCount = Number(count);
          response.limit = limit;
          response.offset = offset;
        }

        return res.json(response);
      };

      if (id === 'patients') {
          return fetchTable(patients);
      } else if (id === 'visits') {
          return fetchTable(visits);
      } else if (id === 'labOrders') {
          return fetchTable(labOrders);
      } else if (id === 'consultants') {
          return fetchTable(consultants);
      } else if (id === 'systemUsers') {
          return fetchTable(systemUsers);
      } else if (id === 'ipdAdmissions') {
          return fetchTable(ipdAdmissions);
      } else if (id === 'pharmacyInventory') {
          return fetchTable(pharmacyItems);
      } else if (id === 'pharmacySales') {
          return fetchTable(pharmacySales);
      } else if (id === 'reportHistory') {
          return fetchTable(savedReports);
      } else if (id === 'clinicalTemplates') {
          return fetchTable(clinicalTemplates);
      } else if (id === 'labInventory') {
          return fetchTable(labInventoryItems);
      } else if (id === 'wards') {
          return fetchTable(wards);
      }

      // Check appSettings
      const settingResult = await db.select().from(appSettings).where(eq(appSettings.key, id));
      if (settingResult.length > 0) {
        return res.json({ payload: settingResult[0].value, updatedAt: settingResult[0].updatedAt });
      }

      // Fallback
      const result = await db.select().from(fallbackStore).where(eq(fallbackStore.collection, id));
      if (result.length > 0) {
        let payload = result[0].payload as any[];
        let totalCount;
        if (Array.isArray(payload)) {
          if (limit !== undefined || offset !== undefined) {
            totalCount = payload.length;
            const start = offset || 0;
            const end = limit !== undefined ? start + limit : undefined;
            payload = payload.slice(start, end);
          }
        }
        const resp: any = { payload, updatedAt: result[0].updatedAt };
        if (totalCount !== undefined) {
          resp.totalCount = totalCount;
          resp.limit = limit;
          resp.offset = offset;
        }
        res.json(resp);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (error: any) {
      console.warn(`Database connection failed for GET collection ${id}, falling back to local JSON:`, error.message);
      const localData = await readFromLocalJSON(id);
      if (localData) {
          let payload = localData;
          let totalCount;
          if (Array.isArray(payload)) {
              if (limit !== undefined || offset !== undefined) {
                  totalCount = payload.length;
                  const start = offset || 0;
                  const end = limit !== undefined ? start + limit : undefined;
                  payload = payload.slice(start, end);
              }
          }
          const resp: any = { payload, updatedAt: new Date() };
          if (totalCount !== undefined) {
              resp.totalCount = totalCount;
              resp.limit = limit;
              resp.offset = offset;
          }
          return res.json(resp);
      }
      return res.json({ payload: [], updatedAt: new Date() });
    }
  });

  app.post("/api/generateRegistryFields", async (req, res) => {
    try {
      const { description } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      
      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a medical assistant designing hospital registries (registers). 
The user wants a registry for: "${description}".
Generate a strictly JSON object with the following structure:
{
  "fields": ["Patient Name", "Age", "Date", ...],
  "fieldConfigs": [
    {
      "name": "Patient Name",
      "type": "text",
      "source": "Patient Registration"
    },
    {
      "name": "Age",
      "type": "number",
      "source": "Patient Registration"
    },
    {
      "name": "NS1 Antigen",
      "type": "select",
      "options": ["Positive", "Negative"],
      "source": "OPD Consultation"
    }
  ]
}

Available sources to map columns to:
1. "Patient Registration" - for demographic details (Name, Age, Address, mobile, etc.)
2. "OPD Consultation" - for outpatient clinical details (symptoms, test values, prescriptions)
3. "IPD Admission" - for inpatient rounds, beds, ward info
4. "Surgical Notes" - for operations details (surgeon, procedure, baby stats, anesthesia)
5. "General" - fallback for general indicators

Ensure standard columns like "Patient Name", "Age", "Date" are mapped to "Patient Registration" (or "General").
Return ONLY the JSON object. Do not include markdown blocks like \`\`\`json.`;

      let response;
      try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
      } catch (err: any) {
          if (err.status === 400 && err.message?.includes("API key not valid")) {
              return res.status(400).json({ error: "Invalid Gemini API Key. Please configure a valid GEMINI_API_KEY in Settings." });
          }
          throw err;
      }

      let jsonText = response.text || "{}";
      // Clean up markdown block if present
      if (jsonText.includes("```json")) {
          jsonText = jsonText.split("```json")[1].split("```")[0].trim();
      } else if (jsonText.includes("```")) {
          jsonText = jsonText.split("```")[1].split("```")[0].trim();
      }
      
      const parsed = JSON.parse(jsonText);
      res.json({
        fields: parsed.fields || [],
        fieldConfigs: parsed.fieldConfigs || []
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to generate fields" });
    }
  });

  app.post("/api/populateRegistryData", async (req, res) => {
    try {
      const { description, fields, sourceData, dateRange } = req.body;
      const { GoogleGenAI } = await import("@google/genai");

      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing" });
      }

      // Truncate sourceData if too large to prevent context window overflow
      let processedSourceData = sourceData;
      if (JSON.stringify(sourceData).length > 800000) {
          processedSourceData = Array.isArray(sourceData) ? sourceData.slice(0, 100) : sourceData;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a medical assistant populating hospital registries.
We have created a new registry for: "${description}".
Columns of the registry: ${JSON.stringify(fields)}
${dateRange ? `Focus on records between ${dateRange.start} and ${dateRange.end}.` : ""}

Here is the source data from the hospital database (contains patient profiles, consultations, admissions, surgery notes, and custom field values):
${JSON.stringify(processedSourceData)}

Based on this source data, extract and compile all matching records that belong in this registry. 
For each matching patient record, construct a JSON object mapping each of the registry columns to the extracted/inferred value from their history.
- Extract only what is present or can be directly inferred from the records (do not invent data).
- If a column value is missing for a record, use "" as the value.
- If data seems irrelevant to the registry description, ignore it.
- Return a strictly JSON array of objects representing the rows.
Example output:
[
  {
    "Patient Name": "Jane Doe",
    "Age": "28",
    "Date": "2026-06-25",
    "Parity": "G2 P1",
    "High Risk Factors": "Preeclampsia"
  }
]
Return ONLY the JSON array. Do not include markdown blocks like \`\`\`json.`;

      let response;
      try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
      } catch (err: any) {
          if (err.status === 400 && err.message?.includes("API key not valid")) {
              return res.status(400).json({ error: "Invalid Gemini API Key. Please configure a valid GEMINI_API_KEY in Settings." });
          }
          throw err;
      }

      let jsonText = response.text || "[]";
      // Clean up markdown block if present
      if (jsonText.includes("```json")) {
          jsonText = jsonText.split("```json")[1].split("```")[0].trim();
      } else if (jsonText.includes("```")) {
          jsonText = jsonText.split("```")[1].split("```")[0].trim();
      }

      const records = JSON.parse(jsonText);
      res.json({ records });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to populate registry data" });
    }
  });

  app.post("/api/ocrPrescription", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      const { GoogleGenAI } = await import("@google/genai");

      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing" });
      }
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a medical assistant reading a prescription image.
Carefully read all text in this prescription/doctor's note image and extract structured information.

Return ONLY a valid JSON object with these exact keys:
{
  "diagnosis": "The diagnosis or clinical impression written",
  "medicines": "List of medicines with dose and frequency, each on a new line. Format: DrugName DoseMg - Frequency - Duration",
  "advice": "General advice or instructions given to the patient",
  "labsAdvised": "Any laboratory tests or investigations advised",
  "followUpDays": "Number of days for follow-up if mentioned, else empty string"
}

- If any field is not present in the prescription, use an empty string "".
- Do not invent or add any information not present in the image.
- Return ONLY the JSON. No markdown, no explanation.`;

      const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
            prompt
          ],
        });
      } catch (err: any) {
        if (err.status === 400 && err.message?.includes("API key not valid")) {
          return res.status(400).json({ error: "Invalid Gemini API Key." });
        }
        throw err;
      }

      let jsonText = response.text || "{}";
      if (jsonText.includes("```json")) {
        jsonText = jsonText.split("```json")[1].split("```")[0].trim();
      } else if (jsonText.includes("```")) {
        jsonText = jsonText.split("```")[1].split("```")[0].trim();
      }

      const result = JSON.parse(jsonText);
      res.json(result);
    } catch (e: any) {
      console.error("OCR Prescription error:", e);
      res.status(500).json({ error: e.message || "Failed to read prescription" });
    }
  });

  app.post("/api/parseVoiceRegistration", async (req, res) => {
    try {
      const { text } = req.body;
      const { GoogleGenAI } = await import("@google/genai");

      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing. Please configure it in Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a medical receptionist assistant.
We received the following dictated patient registration information: "${text}".
Extract the structured patient details and return ONLY a valid JSON object matching this structure:
{
  "name": "Patient Name (Title-cased)",
  "age": "Age in years (number as string, or empty string)",
  "gender": "Male" or "Female" or "Other",
  "mobile": "10-digit mobile number (string, or empty string)",
  "address": "City/Area name (string, or empty string)",
  "type": "general" or "obstetric" or "gynecology" or "infertility"
}
If type is not clear: infer "general". If the user says "pregnancy", "anc", "delivery" infer "obstetric". If the user says "infertility", "unable to conceive", "fertility" infer "infertility". If the user says "periods", "discharge", "menopause" infer "gynecology".
Do not return any extra characters, explanation, or markdown backticks. Return raw JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let jsonText = response.text || "{}";
      jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(jsonText));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to parse voice registration data" });
    }
  });

  app.post("/api/parseConsultationConversation", async (req, res) => {
    try {
      const { text } = req.body;
      const { GoogleGenAI } = await import("@google/genai");

      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing. Please configure it in Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a medical assistant transcribing a doctor-patient consultation dialogue.
We received the following raw transcript of the consultation: "${text}".

Analyze this dialogue and extract structured patient record details. Return ONLY a valid JSON object matching this structure:
{
  "complaints": "Extracted symptoms and chief complaints (string)",
  "obstetricHistory": "G-P-A-L obstetric summary or notes (string, or empty)",
  "menstrualHistory": "Brief cycle description if mentioned (string, or empty)",
  "lmp": "Last Menstrual Period date in YYYY-MM-DD format (string, or empty)",
  "generalNotes": "General exam notes, pallor, edema, etc. (string, or empty)",
  "physicalExam": "Systemic/local examination findings (string, or empty)",
  "bp": "Blood pressure e.g. 120/80 (string, or empty)",
  "pulse": "Pulse rate in bpm (string, or empty)",
  "weight": "Weight in kg (string, or empty)",
  "spo2": "Oxygen saturation % (string, or empty)",
  "rx": "List of prescribed medications with dosages (one drug per line, string)",
  "remarks": "Special instructions, follow-up advice, tests recommended (string, or empty)"
}

Rules:
1. Return ONLY the JSON object. Do not wrap in markdown backticks or explanation.
2. In the "rx" field, list medications clearly (e.g. "Tab Calcium 500mg daily\\nTab Iron twice daily").
3. Make sure dates are in YYYY-MM-DD format. If date is described relative to today, compute it. Today is ${new Date().toISOString().split('T')[0]}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let jsonText = response.text || "{}";
      jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(jsonText));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to parse consultation dialogue" });
    }
  });

  app.post("/api/analyzeUsg", async (req, res) => {
    try {
      const { imageBase64, clinicianNotes, templateId, patientDetails } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      
      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing. Please configure it in Settings." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are the core intelligence engine of a specialized OB-GYN Ultrasound Reporting and Indian PCPNDT Compliance under usg section. 
Your primary responsibility is to analyze multimodal inputs (ultrasound console screenshots, unstructured clinician notes, or raw clinical text) and generate structured, developer-ready JSON payloads.

### 1. REPORT TEMPLATE INJECTION LOGIC
You will receive an input containing patient details, ultrasound metrics, and a requested 'template_id' (e.g., ROUTINE_1ST_TRIMESTER, ANOMALY_SCAN, 3RD_TRIMESTER_GROWTH).
1. Read the raw metrics via OCR from the uploaded image (extracting BPD, HC, AC, FL, AFI, and Doppler values like UA PI/RI).
2. Compute clinical milestones: Calculate Gestational Age (GA) based on fetal biometry and determine any mismatch against the stated Last Menstrual Period (LMP).
3. Inject these variables into a highly polished, professional medical report narrative that matches the standard boilerplate text of the requested template.

### 2. MAHARASHTRA PCPNDT PORTAL MAPPER (FORM F)
You must translate clinical findings into the precise structured data points required by the online Maharashtra PCPNDT portal (https://pcpndt.maharashtra.gov.in).
* Map history parameters cleanly: Gravida, Para, Living Sons, Living Daughters, Abortions.
* Map clinical indications to standard regulatory classifications. Translate the reason for the scan into the official portal dropdown categories (e.g., "Routine tracking of growth", "Suspected IUGR/FGR", "AFI evaluation").
* ABSOLUTE LEGAL MANDATE: Never under any circumstances parse, mention, infer, or output any text regarding the sex of the fetus. Completely filter out any such references to ensure absolute compliance with the PCPNDT Act.

### 3. LEGAL DOCS GENERATION
Generate clear, print-ready text strings for required physical signatures:
* 'patient_consent_text': Form G declaration stating that no sex selection/disclosure has occurred, formatted clearly for standard A4 document printing.
* 'doctor_declaration_text': Standard legal declaration confirming the medical necessity of the diagnostic procedure under local laws.

### 4. MANDATORY OUTPUT FORMAT
You must return ONLY a valid JSON object. Do not include introductory text, conversational notes, or markdown formatting outside the JSON block. Use this exact schema:

{
  "meta": {
    "processing_status": "SUCCESS",
    "applied_template": "String (ID of the template used)"
  },
  "clinical_report": {
    "patient_name": "String",
    "age": "Number",
    "lmp": "YYYY-MM-DD or null",
    "biometry_data": {
      "bpd_mm": "Number or null",
      "hc_mm": "Number or null",
      "ac_mm": "Number or null",
      "fl_mm": "Number or null",
      "efw_grams": "Number or null",
      "afi_cm": "Number or null"
    },
    "calculated_ga_weeks_days": "String (e.g., 22w+3d)",
    "calculated_edd": "YYYY-MM-DD",
    "final_report_html_markdown": "String (The complete formatted report with injected numbers, structured with headers for printing)"
  },
  "maharashtra_portal_payload": {
    "field_mappings": {
      "txt_PatientName": "String",
      "txt_Age": "Number",
      "txt_LMPDate": "DD/MM/YYYY",
      "txt_Gravida": "Number",
      "txt_Para": "Number",
      "txt_LivingSons": "Number",
      "txt_LivingDaughters": "Number",
      "txt_NoOfAbortions": "Number",
      "ddl_IndicationForScan": "String (Optimized selector value for the portal dropdown)",
      "txt_ClinicalDiagnosis": "String (Concise narrative matching the chosen indication)"
    }
  },
  "print_compliance_forms": {
    "form_g_patient_consent": "String (Complete, print-ready legal text for patient sign-off)",
    "doctor_declaration": "String (Complete legal text for doctor sign-off)"
  }
}

--- INPUTS ---
Requested Template ID: ${templateId}
Patient Details: ${patientDetails || 'None provided'}
Clinician Notes: ${clinicianNotes || 'None provided'}`;

      const contents: any[] = [];
      
      if (imageBase64) {
          // Remove prefix if exists
          const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
          contents.push({
              inlineData: {
                  data: base64Data,
                  mimeType: "image/jpeg"
              }
          });
      }
      
      contents.push(prompt);

      let response;
      try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
          });
      } catch (err: any) {
          if (err.status === 400 && err.message?.includes("API key not valid")) {
              return res.status(400).json({ error: "Invalid Gemini API Key. Please configure a valid GEMINI_API_KEY in Settings." });
          }
          throw err;
      }

      let jsonText = response.text || "{}";
      if (jsonText.includes("\`\`\`json")) {
          jsonText = jsonText.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
      } else if (jsonText.includes("\`\`\`")) {
          jsonText = jsonText.split("\`\`\`")[1].split("\`\`\`")[0].trim();
      }
      
      const result = JSON.parse(jsonText);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to analyze USG" });
    }
  });

  app.post("/api/collection/:id", async (req, res) => {
    const { id } = req.params;
    let { payload } = req.body;
    
    // Always backup to local JSON file
    await writeToLocalJSON(id, payload);

    try {
      const isObjectInsteadOfArray = !Array.isArray(payload);
      const itemsToUpdate = isObjectInsteadOfArray ? [payload] : payload;

      if (id === 'patients') {
          for (const p of itemsToUpdate) {
             const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
             const mappedData = { ...p, uhid: p.uhid || `UHID-${p.id}`, createdAt };
             const { id: _, ...mappedRest } = mappedData;
             await db.insert(patients).values(mappedData).onConflictDoUpdate({ target: patients.id, set: mappedRest });
          }
      } else if (id === 'visits') {
          for (const v of itemsToUpdate) {
             const createdAt = v.createdAt ? new Date(v.createdAt) : new Date();
             const mappedData = { ...v, createdAt };
             const { id: _, ...mappedRest } = mappedData;
             await db.insert(visits).values(mappedData).onConflictDoUpdate({ target: visits.id, set: mappedRest });
          }
      } else if (id === 'labOrders') {
          for (const l of itemsToUpdate) {
             const { id: _, ...rest } = l;
             await db.insert(labOrders).values(l).onConflictDoUpdate({ target: labOrders.id, set: { ...rest } });
          }
      } else if (id === 'consultants') {
          for (const c of itemsToUpdate) {
             const { id: _, ...rest } = c;
             await db.insert(consultants).values(c).onConflictDoUpdate({ target: consultants.id, set: { ...rest } });
          }
      } else if (id === 'systemUsers') {
          for (const u of itemsToUpdate) {
             const { id: _, ...rest } = u;
             await db.insert(systemUsers).values(u).onConflictDoUpdate({ target: systemUsers.id, set: { ...rest } });
          }
      } else if (id === 'ipdAdmissions') {
          for (const a of itemsToUpdate) {
             const { id: _, ...rest } = a;
             await db.insert(ipdAdmissions).values(a).onConflictDoUpdate({ target: ipdAdmissions.id, set: { ...rest } });
          }
      } else if (id === 'pharmacyInventory') {
          for (const i of itemsToUpdate) {
             const { id: _, ...rest } = i;
             await db.insert(pharmacyItems).values(i).onConflictDoUpdate({ target: pharmacyItems.id, set: { ...rest } });
          }
      } else if (id === 'pharmacySales') {
          for (const s of itemsToUpdate) {
             const { id: _, ...rest } = s;
             await db.insert(pharmacySales).values(s).onConflictDoUpdate({ target: pharmacySales.id, set: { ...rest } });
          }
      } else if (id === 'reportHistory') {
          for (const r of itemsToUpdate) {
             const reportId = r.id || `report_${r.timestamp}`;
             const mappedData = { ...r, id: reportId };
             const { id: _, ...rest } = mappedData;
             await db.insert(savedReports).values(mappedData).onConflictDoUpdate({ target: savedReports.id, set: { ...rest } });
          }
      } else if (id === 'clinicalTemplates') {
          for (const t of itemsToUpdate) {
             const { id: _, ...rest } = t;
             await db.insert(clinicalTemplates).values(t).onConflictDoUpdate({ target: clinicalTemplates.id, set: { ...rest } });
          }
      } else if (id === 'labInventory') {
          for (const l of itemsToUpdate) {
             const { id: _, ...rest } = l;
             await db.insert(labInventoryItems).values(l).onConflictDoUpdate({ target: labInventoryItems.id, set: { ...rest } });
          }
      } else if (id === 'wards') {
          for (const w of itemsToUpdate) {
             const { id: _, ...rest } = w;
             await db.insert(wards).values(w).onConflictDoUpdate({ target: wards.id, set: { ...rest } });
          }
      } else if (id === 'medicationMaster' || id === 'billingRates' || id === 'printSettings' || id === 'hospitalInfo') {
          await db.insert(appSettings).values({ key: id, value: req.body.payload })
            .onConflictDoUpdate({ target: appSettings.key, set: { value: req.body.payload, updatedAt: new Date() } });
      } else {
          const existing = await db.select().from(fallbackStore).where(eq(fallbackStore.collection, id));
          if (existing.length > 0) {
            await db.update(fallbackStore)
              .set({ payload: req.body.payload, updatedAt: new Date() })
              .where(eq(fallbackStore.collection, id));
          } else {
            await db.insert(fallbackStore)
              .values({ collection: id, payload: req.body.payload, updatedAt: new Date() });
          }
      }

      eventEmitter.emit('update', id);
      res.json({ success: true });
    } catch (error: any) {
      console.warn(`Database connection failed for POST collection ${id}, saved locally:`, error.message);
      eventEmitter.emit('update', id);
      res.json({ success: true, localOnly: true });
    }
  });

  app.post("/api/save-env", async (req, res) => {
    try {
      const { databaseUrl, geminiKey, firebaseStudioLink } = req.body;
      const fs = await import('fs/promises');
      const path = await import('path');
      
      let envContent = '';
      if (databaseUrl) {
          envContent += `DATABASE_URL="${databaseUrl}"\n`;
      } else if (process.env.DATABASE_URL) {
          envContent += `DATABASE_URL="${process.env.DATABASE_URL}"\n`;
      }
      
      if (geminiKey) {
          envContent += `GEMINI_API_KEY="${geminiKey}"\n`;
      } else if (process.env.GEMINI_API_KEY) {
          envContent += `GEMINI_API_KEY="${process.env.GEMINI_API_KEY}"\n`;
      }

      if (firebaseStudioLink) {
          envContent += `FIREBASE_STUDIO_LINK="${firebaseStudioLink}"\n`;
      } else if (process.env.FIREBASE_STUDIO_LINK) {
          envContent += `FIREBASE_STUDIO_LINK="${process.env.FIREBASE_STUDIO_LINK}"\n`;
      }

      await fs.writeFile(path.join(process.cwd(), '.env'), envContent, 'utf-8');
      res.json({ success: true, message: "Environment settings saved. Please restart the backend server to apply database connection changes." });
    } catch (e: any) {
      console.error("Failed to write .env file:", e);
      res.status(500).json({ error: "Failed to write environment configuration" });
    }
  });

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 5, simply use a catch-all middleware instead of path-to-regexp wildcards
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
