import 'dotenv/config';

async function test() {
    const res = await fetch('http://localhost:3000/api/collection/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payload: [{
                id: '123',
                patientId: '123',
                date: '2026-06-21',
                visitType: 'consultation',
                fees: 500,
                isApproved: false,
                createdAt: new Date().toISOString()
            }]
        })
    });
    console.log(await res.json());
}
test();
