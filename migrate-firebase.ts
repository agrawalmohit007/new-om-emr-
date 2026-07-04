import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore/lite';
import { db } from './src/db/index.js';
import { systemUsers, consultants, patients, visits, labOrders, fallbackStore } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const COLLECTION = 'lab_app_data';

const firebaseConfig = {
  apiKey: "AIzaSyAKGpjbTrvwlOd7DBFtvzMW3jpMzVLTlRc",
  authDomain: "om-emr.firebaseapp.com",
  projectId: "om-emr",
  storageBucket: "om-emr.firebasestorage.app",
  messagingSenderId: "1042034377181",
  appId: "1:1042034377181:web:f85c9ccc8ab8cdc0ecf634"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const keys = [
    'patients', 'visits', 'labOrders', 'clinicalTemplates', 'notifications', 
    'labInventory', 'reportHistory', 'medicationMaster', 'consultants', 
    'wards', 'ipdAdmissions', 'billingRates',
    'pharmacyInventory', 'pharmacySuppliers', 'pharmacySales', 'specialties', 'systemUsers'
];

async function migrate() {
  console.log("Starting migration from Firebase to Postgres...");
  for (const key of keys) {
    try {
      console.log(`Fetching ${key} from Firebase...`);
      const docRef = doc(firestore, COLLECTION, key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const payload = docSnap.data()?.payload;
        if (!payload) {
            console.log(`Skipping ${key}, no payload`);
            continue;
        }

        console.log(`Found ${payload.length || Object.keys(payload).length} items in ${key}`);

        // Insert into proper tables
        if (key === 'systemUsers' && Array.isArray(payload)) {
          for (const u of payload) {
             await db.insert(systemUsers).values(u).onConflictDoNothing();
          }
        } else if (key === 'consultants' && Array.isArray(payload)) {
          for (const c of payload) {
             await db.insert(consultants).values(c).onConflictDoNothing();
          }
        } else if (key === 'patients' && Array.isArray(payload)) {
          for (const p of payload) {
             try {
                 await db.insert(patients).values({
                     ...p,
                     uhid: p.uhid || `UHID-${p.id}`,
                     createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
                 }).onConflictDoNothing();
             } catch(e) {
                 console.error(`Error inserting patient ${p.id}:`, e);
             }
          }
        } else if (key === 'visits' && Array.isArray(payload)) {
          for (const v of payload) {
             try {
                 await db.insert(visits).values({
                     ...v,
                     createdAt: v.createdAt ? new Date(v.createdAt) : new Date()
                 }).onConflictDoNothing();
             } catch(e) {
                 console.error(`Error inserting visit ${v.id}:`, e);
             }
          }
        } else if (key === 'labOrders' && Array.isArray(payload)) {
          for (const l of payload) {
             try {
                 await db.insert(labOrders).values(l).onConflictDoNothing();
             } catch (e) {
                 console.error(`Error inserting labOrder ${l.id}:`, e);
             }
          }
        } else {
            // Un-normalized or other type fallback
            await db.insert(fallbackStore).values({
                collection: key,
                payload: payload
            }).onConflictDoUpdate({
                target: fallbackStore.collection,
                set: { payload: payload }
            });
            console.log(`Saved ${key} to fallbackStore`);
        }
        
      } else {
        console.log(`No document found for ${key}`);
      }
    } catch (e: any) {
        if (e?.code === 'not-found' || e?.code === 'permission-denied') {
            console.warn(`Permission denied or not found for ${key}`);
        } else {
            console.error(`Unexpected error migrating ${key}:`, e);
        }
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate();
