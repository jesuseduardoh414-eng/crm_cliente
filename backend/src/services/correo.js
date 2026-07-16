const { transporter } = require('./email.service');

/**
 * Envía un correo de invitación usando Nodemailer (Gmail).
 */
const enviarInvitacion = async ({ nombre, email, token }) => {
  const enlace = `${process.env.FRONTEND_URL}/invitacion/${token}`;
  console.log(`[SMTP]: Intentando enviar invitación a ${email}...`);

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Panel Interno" <jesuseduardoh414@gmail.com>',
    to: email,
    subject: 'Te han invitado al CRM',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Hola ${nombre},</h2>
        <p>Has sido invitado a unirte al CRM de tu equipo.</p>
        <p>Este enlace expira en 48 horas.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${enlace}"
             style="background:#2563eb;color:white;padding:14px 28px;
                    border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
            Activar mi cuenta
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Si no esperabas esta invitación, ignora este correo.</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [SMTP]: Invitación enviada exitosamente. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [SMTP] ERROR DETALLADO AL ENVIAR:', {
      mensaje: error.message,
      codigo: error.code,
      comando: error.command,
      respuesta: error.response,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = { enviarInvitacion };
