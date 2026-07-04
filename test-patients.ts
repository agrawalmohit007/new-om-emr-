import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore/lite';

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

async function test() {
    const docSnap = await getDoc(doc(firestore, 'lab_app_data', 'patients'));
    if (docSnap.exists()) {
        const payload = docSnap.data().payload;
        console.log("Patients length:", payload.length);
        console.log("First patient:", payload[0]);
    }
}
test();
