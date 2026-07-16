/**
 * Servicio de envio de correos via API de Brevo (HTTP).
 * Este metodo evita los bloqueos de puertos SMTP de Railway.
 */
const extractEmail = (value) => {
  const raw = (value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
};

const sendEmailViaAPI = async (options = {}) => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta BREVO_API_KEY en las variables de entorno.');
  }

  const senderEmail = extractEmail(
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    'jesuseduardoh414@gmail.com'
  );

  const toEmail = extractEmail(options.to);
  const htmlContent = options.html || (options.text ? `<p>${options.text}</p>` : '');

  if (!senderEmail || !toEmail || !options.subject || !htmlContent) {
    throw new Error('Faltan datos requeridos para enviar correo por Brevo.');
  }

  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || 'Centralita CRM',
      email: senderEmail
    },
    to: [{ email: toEmail }],
    subject: options.subject,
    htmlContent
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let responseBody = responseText;

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    // Brevo normalmente responde JSON, pero preservamos texto crudo si cambia.
  }

  if (!response.ok) {
    const details = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
    throw new Error(`Brevo API Error (${response.status}): ${details}`);
  }

  return responseBody;
};

const sendResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  console.log(`[API]: Enviando correo de restablecimiento a ${email}...`);

  try {
    await sendEmailViaAPI({
      to: email,
      subject: 'Restablecer contraseña - CRM',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Restablecer tu contraseña</h2>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el boton de abajo para continuar:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Restablecer contraseña
            </a>
          </div>
          <p>Este enlace expirara en 1 hora.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('[API] Error en Reset Email:', error.message);
    throw error;
  }
};

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-account/${token}`;
  console.log(`[API]: Enviando correo de verificacion a ${email}...`);

  try {
    await sendEmailViaAPI({
      to: email,
      subject: 'Verifica tu cuenta - CRM',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Bienvenido al CRM</h2>
          <p>Por favor, verifica tu cuenta haciendo clic en el boton de abajo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background:#10b981;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Verificar cuenta
            </a>
          </div>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('[API] Error en Verification Email:', error.message);
    throw error;
  }
};

// Objeto compatible con el codigo que usa transporter.sendMail.
const transporter = {
  sendMail: (options) => sendEmailViaAPI(options)
};

module.exports = { sendResetEmail, sendVerificationEmail, transporter };
