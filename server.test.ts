import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import { app } from './server';
import { db } from './src/db/index.js';
import { patients } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

// Mock the Google Gen AI SDK to avoid making real API calls or crashing without an API Key
vi.mock('@google/genai', () => {
  class GoogleGenAIMock {
    models = {
      generateContent: vi.fn().mockImplementation((args) => {
        const prompt = args.contents || "";
        if (prompt.includes("populating hospital registries")) {
          return {
            text: JSON.stringify([
              {
                "Patient Name": "Jane Doe",
                "Age": "28",
                "Date": "2026-06-25",
                "Parity": "G2 P1",
                "High Risk Factors": "Preeclampsia"
              }
            ])
          };
        }
        return {
          text: JSON.stringify({
            fields: ["Patient Name", "Age", "Date", "Parity", "High Risk Factors", "Doctor Signature"],
            fieldConfigs: [
              { name: "Patient Name", type: "text", source: "Patient Registration" },
              { name: "Age", type: "number", source: "Patient Registration" },
              { name: "Date", type: "text", source: "Patient Registration" }
            ]
          })
        };
      })
    };
  }
  return {
    GoogleGenAI: GoogleGenAIMock
  };
});

describe('Backend API Integration Tests', () => {
  
  // Clean up any test database records after tests run
  afterAll(async () => {
    try {
      await db.delete(patients).where(eq(patients.id, 'test_patient_unique_123'));
      console.log('Test database records cleaned up successfully.');
    } catch (e) {
      console.warn('Test cleanup warning (might not have inserted record):', e);
    }
  });

  describe('GET /api/collection/:id', () => {
    it('should successfully fetch patients list', async () => {
      const response = await request(app)
        .get('/api/collection/patients')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('payload');
      expect(Array.isArray(response.body.payload)).toBe(true);
    });

    it('should return 404 for a non-existent collection', async () => {
      const response = await request(app)
        .get('/api/collection/nonexistent_collection_name')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });

  describe('POST /api/collection/:id', () => {
    it('should insert or update a patient record successfully', async () => {
      const testPatient = {
        id: 'test_patient_unique_123',
        uhid: 'UHID-test-123',
        name: 'Test integration patient',
        age: '30',
        type: 'opd',
        address: '123 Test Street'
      };

      const postResponse = await request(app)
        .post('/api/collection/patients')
        .send({ payload: testPatient })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(postResponse.body).toEqual({ success: true });

      // Verify the record was inserted by fetching it
      const fetchResponse = await request(app)
        .get('/api/collection/patients')
        .expect(200);

      const foundPatient = fetchResponse.body.payload.find(
        (p: any) => p.id === 'test_patient_unique_123'
      );
      expect(foundPatient).toBeDefined();
      expect(foundPatient.name).toBe('Test integration patient');
    });
  });

  describe('POST /api/generateRegistryFields', () => {
    it('should call mocked Gemini API and return fields when key is configured', async () => {
      // Temporarily inject dummy key for testing endpoint logic
      process.env.GEMINI_API_KEY = 'TEST_KEY_VALUE';

      const response = await request(app)
        .post('/api/generateRegistryFields')
        .send({ description: 'High Risk OB Registry' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('fields');
      expect(Array.isArray(response.body.fields)).toBe(true);
      expect(response.body.fields).toContain('Patient Name');
      expect(response.body).toHaveProperty('fieldConfigs');
      expect(Array.isArray(response.body.fieldConfigs)).toBe(true);

      delete process.env.GEMINI_API_KEY;
    });

    it('should return 500 when Gemini API key is missing', async () => {
      // Ensure key is missing
      const oldKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const response = await request(app)
        .post('/api/generateRegistryFields')
        .send({ description: 'High Risk OB Registry' })
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Gemini API key is missing');

      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    });
  });

  describe('POST /api/populateRegistryData', () => {
    it('should call mocked Gemini API and return auto-populated records when key is configured', async () => {
      process.env.GEMINI_API_KEY = 'TEST_KEY_VALUE';

      const response = await request(app)
        .post('/api/populateRegistryData')
        .send({
          description: 'High Risk OB Registry',
          fields: ["Patient Name", "Age", "Date", "Parity", "High Risk Factors"],
          sourceData: { patients: [], admissions: [], visits: [] }
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('records');
      expect(Array.isArray(response.body.records)).toBe(true);
      expect(response.body.records[0]).toHaveProperty('Patient Name', 'Jane Doe');

      delete process.env.GEMINI_API_KEY;
    });

    it('should return 500 when Gemini API key is missing', async () => {
      const oldKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const response = await request(app)
        .post('/api/populateRegistryData')
        .send({
          description: 'High Risk OB Registry',
          fields: ["Patient Name"],
          sourceData: {}
        })
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Gemini API key is missing');

      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    });
  });
});
