import { WelcomeEmail } from '@/emails/WelcomeTemplate';
import { resend, SENDER_EMAIL } from '@/utils/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!resend) {
      console.error('Resend API Key is missing. Skipping email send.');
      return NextResponse.json(
        { error: 'Email service not configured', success: false }, 
        { status: 500 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [email],
      subject: 'Welcome to Nook',
      react: WelcomeEmail({ userFirstname: name || 'Reader' }),
    });

    if (error) {
      console.error('Resend Error:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('Email Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
