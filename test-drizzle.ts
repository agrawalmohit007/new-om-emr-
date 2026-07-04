import { db } from './src/db/index.js';
import { visits, fallbackStore } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function test() {
    try {
        const fall = await db.select().from(fallbackStore).where(eq(fallbackStore.collection, 'visits'));
        if (fall.length > 0) {
            const v = fall[0].payload[0];
            const payload = (fall[0].payload as any[]).slice(0, 5); // first 5
            for (const v of payload) {
                const createdAt = v.createdAt ? new Date(v.createdAt) : new Date();
                const mappedData = { ...v, createdAt };
                const { id: _, ...mappedRest } = mappedData;
                await db.insert(visits).values(mappedData).onConflictDoUpdate({ target: visits.id, set: mappedRest });
            }
        }
        console.log("success");
    } catch (e) {
        console.error(e);
    }
}
test();
