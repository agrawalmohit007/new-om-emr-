import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKeyVal = process.env.GEMINI_API_KEY;
console.log("Injected API Key starting with:", apiKeyVal ? apiKeyVal.substring(0, 10) : "undefined");

const ai = new GoogleGenAI({ apiKey: apiKeyVal });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Hello, are you functional?',
    });
    console.log("Success! Output:", response.text);
  } catch (err: any) {
    console.error("Error details:", err);
  }
}

run();
