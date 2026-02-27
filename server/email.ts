import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not defined. Email service will run in MOCK mode.');
}

export async function sendWelcomeEmail(to: string, name: string, role: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Welcome to ${to} (${name}) as ${role}`);
    return;
  }

  const roleLabel = role === 'psychologist' ? 'Terapeuta' : 'Paciente';
  
  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Bem-vindo(a) ao PsyQ!</h1>
      <p>Olá <strong>${name}</strong>,</p>
      <p>Ficamos muito felizes em ter você conosco como <strong>${roleLabel}</strong>.</p>
      <p>Sua conta foi criada com sucesso e você já pode acessar nossa plataforma para gerenciar seus atendimentos.</p>
      <br />
      <p>Atenciosamente,<br />Equipe PsyQ</p>
    </div>
  `;

  try {
    const from = process.env.EMAIL_FROM || 'PsyQ <onboarding@resend.dev>';
    console.log(`Attempting to send welcome email from ${from} to ${to}...`);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: 'Bem-vindo(a) ao PsyQ!',
      html,
    });
    
    if (error) {
      console.error('Resend error sending welcome email:', error);
    } else {
      console.log('Welcome email sent successfully:', data?.id);
    }
  } catch (error) {
    console.error('Unexpected error sending welcome email:', error);
  }
}

export async function sendPasswordResetEmail(to: string, name: string, newPassword: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Password reset to ${to} (${name}): ${newPassword}`);
    return;
  }

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Recuperação de Senha</h1>
      <p>Olá <strong>${name}</strong>,</p>
      <p>Conforme solicitado, geramos uma nova senha temporária para o seu acesso:</p>
      <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0;">
        ${newPassword}
      </div>
      <p><strong>Recomendamos que você altere esta senha assim que fizer o login em seu perfil.</strong></p>
      <br />
      <p>Atenciosamente,<br />Equipe PsyQ</p>
    </div>
  `;

  try {
    const from = process.env.EMAIL_FROM || 'PsyQ <onboarding@resend.dev>';
    console.log(`Attempting to send password reset email from ${from} to ${to}...`);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: 'Sua nova senha do PsyQ',
      html,
    });

    if (error) {
      console.error('Resend error sending password reset email:', error);
    } else {
      console.log('Password reset email sent successfully:', data?.id);
    }
  } catch (error) {
    console.error('Unexpected error sending password reset email:', error);
  }
}
