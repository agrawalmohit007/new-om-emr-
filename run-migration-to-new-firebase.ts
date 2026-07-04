import 'dotenv/config';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore/lite';
import fs from 'fs';

const newFirebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const COLLECTION = 'lab_app_data';

const oldFirebaseConfig = {
  apiKey: "AIzaSyAKGpjbTrvwlOd7DBFtvzMW3jpMzVLTlRc",
  authDomain: "om-emr.firebaseapp.com",
  projectId: "om-emr",
  storageBucket: "om-emr.firebasestorage.app",
  messagingSenderId: "1042034377181",
  appId: "1:1042034377181:web:f85c9ccc8ab8cdc0ecf634"
};

const appOld = initializeApp(oldFirebaseConfig, 'old');
const firestoreOld = getFirestore(appOld);

const appNew = initializeApp(newFirebaseConfig, 'new');
const firestoreNew = getFirestore(appNew, newFirebaseConfig.firestoreDatabaseId);

const keys = [
    'patients', 'visits', 'labOrders', 'clinicalTemplates', 'notifications', 
    'labInventory', 'reportHistory', 'medicationMaster', 'consultants', 
    'wards', 'ipdAdmissions', 'billingRates',
    'pharmacyInventory', 'pharmacySuppliers', 'pharmacySales', 'specialties', 'systemUsers'
];

async function migrate() {
  console.log("Starting migration from Old Firebase to New Firebase Studio DB...");
  for (const key of keys) {
    try {
      console.log(`Fetching ${key} from Old Firebase...`);
      const docRefOld = doc(firestoreOld, COLLECTION, key);
      const docSnap = await getDoc(docRefOld);
      if (docSnap.exists()) {
        const payload = docSnap.data()?.payload;
        if (!payload) {
            console.log(`Skipping ${key}, no payload`);
            continue;
        }

        console.log(`Found ${payload.length || Object.keys(payload).length} items in ${key}`);
        
        // Save to NEW Firebase
        const docRefNew = doc(firestoreNew, 'omStore', key);
        await setDoc(docRefNew, { payload });
        console.log(`Saved ${key} to New Firebase`);
      } else {
        console.log(`No document found for ${key}`);
      }
    } catch (e: any) {
        console.error(`Unexpected error migrating ${key}:`, e);
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate();
