require('dotenv').config();
const { transporter } = require('./src/services/email.service');

async function testEmail() {
  console.log('--- Iniciando Prueba de Correo ---');
  console.log('User:', process.env.EMAIL_USER);
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Enviarnos un correo a nosotros mismos
    subject: 'Prueba Técnica de Conexión SMTP',
    text: 'Si recibes esto, la configuración de Gmail es CORRECTA.'
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ ÉXITO: Correo enviado!');
    console.log('ID del mensaje:', info.messageId);
  } catch (error) {
    console.error('❌ ERROR FATAL:', error.message);
    if (error.message.includes('Invalid login')) {
      console.error('CONSEJO: La contraseña de aplicación de Gmail podría haber expirado o ser incorrecta.');
    }
  }
}

testEmail();
