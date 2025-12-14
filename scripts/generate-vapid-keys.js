import webpush from 'web-push';

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env.local file:\n');
console.log(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@flyerboard.com`);
console.log('\nAlso add to Vercel environment variables for production.\n');
