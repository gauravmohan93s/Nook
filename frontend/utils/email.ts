import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

// Only instantiate if key exists to prevent build errors
export const resend = apiKey ? new Resend(apiKey) : null;

export const SENDER_EMAIL = 'Nook <onboarding@resend.dev>'; // Default Resend testing email. Change to 'onboarding@yourdomain.com' later.
