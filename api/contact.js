import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Team notification email
const TEAM_EMAIL = process.env.CONTACT_TEAM_EMAIL || 'info@iting.cz';
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'CHJ Terminal <noreply@iting.cz>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    // 1. Notify team
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_EMAIL,
      subject: `[CHJ Kontakt] ${name}`,
      html: `
        <div style="font-family:monospace;background:#02040a;color:#e2e8f0;padding:2rem;border-left:3px solid #06b6d4;">
          <p style="color:#06b6d4;margin:0 0 1rem;">// CHJ_CONTACT_TERMINAL — nová zpráva</p>
          <p><strong>Jméno:</strong> ${name}</p>
          <p><strong>E-mail:</strong> <a href="mailto:${email}" style="color:#06b6d4">${email}</a></p>
          <p><strong>Zpráva:</strong></p>
          <p style="background:#0f172a;padding:1rem;border-radius:6px;">${message.replace(/\n/g, '<br>')}</p>
        </div>
      `,
    });

    // 2. Autoresponder to user
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `[ STATUS: ZPRÁVA_PŘIJATA ] — Chytré já`,
      html: `
        <div style="font-family:monospace;background:#02040a;color:#e2e8f0;padding:2rem;max-width:500px;">
          <p style="color:#06b6d4;margin:0 0 1.5rem;letter-spacing:0.1em;">
            CHJ_CONTACT_TERMINAL v1.0
          </p>
          <p style="color:#888;">Ahoj ${name},</p>
          <p style="color:#e2e8f0;margin:1rem 0;">
            Tvoje zpráva dorazila do systému. Ozývám se zpět na tento e-mail — obvykle do 24 hodin.
          </p>
          <p style="color:#555;border-top:1px solid #1e293b;padding-top:1rem;margin-top:2rem;font-size:0.85em;">
            Chytré já &nbsp;·&nbsp; <a href="https://iting.cz" style="color:#06b6d4;text-decoration:none;">iting.cz</a>
          </p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Contact email error:', err);
    return res.status(500).json({ error: 'Failed to send' });
  }
}
