import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function emailConfig() {
  const host = process.env['EMAIL_HOST'];
  const port = Number(process.env['EMAIL_PORT'] ?? 587);
  const user = process.env['EMAIL_USER'];
  const pass = process.env['EMAIL_PASS'];
  const from = process.env['EMAIL_FROM'] ?? user;
  const secure = process.env['EMAIL_SECURE'] === 'true' || port === 465;
  const rejectUnauthorized = process.env['EMAIL_TLS_REJECT_UNAUTHORIZED'] !== 'false';

  if (!host || !from) return null;
  return { host, port, user, pass, from, secure, rejectUnauthorized };
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const config = emailConfig();
  if (!config) {
    console.info(`[email:fallback] To: ${payload.to} | ${payload.subject}\n${payload.text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    console.info(`[email:sent] to=${payload.to} messageId=${info.messageId || 'n/a'}`);
  } catch (error) {
    console.error(
      `[email:error] host=${config.host} port=${config.port} secure=${config.secure} user=${config.user || 'none'}`,
      error,
    );
    throw error;
  }
}
