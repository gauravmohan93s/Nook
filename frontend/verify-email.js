const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
  const envPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/RESEND_API_KEY=(.*)/);
    if (match && match[1]) {
      process.env.RESEND_API_KEY = match[1].trim();
      console.log("Found API Key in .env.local");
    } else {
      console.log("RESEND_API_KEY not found in .env.local file content.");
    }
  } else {
    console.log(".env.local file not found at:", envPath);
  }
} catch (e) {
  console.error("Error reading .env.local:", e);
}

if (!process.env.RESEND_API_KEY) {
  console.error("❌ Aborting: RESEND_API_KEY is missing.");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  console.log("Attempting to send test email to delivered@resend.dev...");
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'delivered@resend.dev',
      subject: 'Nook Test',
      html: '<p>Resend integration is <strong>working</strong>!</p>'
    });

    if (error) {
      console.error("❌ Resend API returned an error:", error);
    } else {
      console.log("✅ Success! Email sent.");
      console.log("ID:", data.id);
    }
  } catch (err) {
    console.error("❌ Script Execution Error:", err);
  }
}

test();
