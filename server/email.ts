import { Resend } from 'resend';
import { format, parseISO, addMinutes, getYear, addWeeks, addHours } from 'date-fns';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not defined. Email service will run in MOCK mode.');
}

export async function sendSessionInviteEmail(to: string[], sessionDetails: any) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Session invite to ${to.join(', ')}: ${JSON.stringify(sessionDetails)}`);
    return;
  }

  const { patientName, psychologistName, date, startTime, endTime, meetLink, isRecurring, frequency } = sessionDetails;

  const icsContent = generateICSContent(sessionDetails);

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Convite de Sessão de Terapia</h1>
      <p>Olá,</p>
      <p>Uma nova sessão de terapia foi agendada:</p>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Paciente:</strong> ${patientName}</p>
        <p style="margin: 5px 0;"><strong>Terapeuta:</strong> ${psychologistName}</p>
        <p style="margin: 5px 0;"><strong>Data:</strong> ${date.split('-').reverse().join('/')}</p>
        <p style="margin: 5px 0;"><strong>Horário:</strong> ${startTime} - ${endTime}</p>
        ${isRecurring ? `<p style="margin: 5px 0;"><strong>Recorrência:</strong> ${frequency === 'weekly' ? 'Semanal' : 'Quinzenal'}</p>` : ''}
        <p style="margin: 15px 0 5px 0;"><strong>Link da Reunião:</strong> <br /><a href="${meetLink}" style="color: #1a1a1a; font-weight: bold;">${meetLink}</a></p>
      </div>
      <p>O arquivo de convite (.ics) está em anexo para que você possa adicionar ao seu calendário.</p>
      <br />
      <p>Atenciosamente,<br />Equipe PsyQ</p>
    </div>
  `;

  try {
    const from = process.env.EMAIL_FROM || 'PsyQ <onboarding@resend.dev>';
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Convite: Sessão de Terapia - ${date.split('-').reverse().join('/')} às ${startTime}`,
      html,
      attachments: [
        {
          filename: 'convite_sessao.ics',
          content: Buffer.from(icsContent).toString('base64'),
        },
      ],
    });

    if (error) {
      console.error('Resend error sending session invite:', error);
    } else {
      console.log('Session invite email sent successfully:', data?.id);
    }
  } catch (error) {
    console.error('Unexpected error sending session invite:', error);
  }
}

function generateICSContent(details: any) {
  const { date, startTime: startTimeStr, duration, isRecurring, frequency, psychologistName, psychologistEmail, patientEmail, meetLink } = details;
  
  const startDateTime = addHours(parseISO(`${date}T${startTimeStr}`), 3);
  const endDateTime = addMinutes(startDateTime, duration || 50);
  
  const getUTCString = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const dtStart = getUTCString(startDateTime);
  const dtEnd = getUTCString(endDateTime);
  const now = getUTCString(new Date());
  
  const title = "Sessão de Terapia";
  const description = `Sessão com ${psychologistName}.\\nLink: ${meetLink}`;
  const location = meetLink;
  const organizer = `MAILTO:${psychologistEmail || 'contato@psyq.com'}`;
  const attendee = `MAILTO:${patientEmail}`;
  
  let rrule = '';
  if (isRecurring) {
    const intervalWeeks = frequency === 'biweekly' ? 2 : 1;
    const currentYear = getYear(startDateTime);
    
    let nextDate = addWeeks(startDateTime, intervalWeeks);
    let count = 1;
    
    while (getYear(nextDate) === currentYear) {
      count++;
      nextDate = addWeeks(nextDate, intervalWeeks);
    }

    if (frequency === 'weekly') {
      rrule = `RRULE:FREQ=WEEKLY;COUNT=${count}`;
    } else if (frequency === 'biweekly') {
      rrule = `RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=${count}`;
    }
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PsyQ//Terapia//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${Math.random().toString(36).substring(2)}@psyq.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${psychologistName}:${organizer}`,
    `ATTENDEE;RSVP=TRUE;CN=Paciente:${attendee}`,
    rrule,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return icsLines.join('\r\n');
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

export async function sendBulkPaymentConfirmationEmail(to: string[], details: any) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Bulk payment confirmation to ${to.join(', ')}: ${JSON.stringify(details)}`);
    return;
  }

  const { 
    payerName, 
    receiverName, 
    totalAmount, 
    date, 
    checkouts, 
    type 
  } = details;

  const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
  const formattedDate = date.split('-').reverse().join('/');

  const title = 'Recibo de Pagamento Consolidado';
  const subject = `Confirmação de Pagamento - ${formattedTotal}`;

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
      <div style="background: #1a1a1a; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8;">Pagamento múltiplo concluído com sucesso</p>
      </div>
      <div style="padding: 30px;">
        <p>Olá,</p>
        <p>Confirmamos o recebimento do pagamento referente às sessões de terapia dos meses abaixo:</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid #eee;">
                <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #666;">ID</th>
                <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #666;">Mês/Ano</th>
                <th style="text-align: right; padding: 8px 0; font-size: 12px; color: #666;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${checkouts.map((c: any) => `
                <tr style="border-bottom: 1px solid #f4f4f4;">
                  <td style="padding: 10px 0; font-family: monospace; font-size: 12px;">${c.id}</td>
                  <td style="padding: 10px 0; font-size: 14px;">${c.monthYear}</td>
                  <td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">
                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.amount)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 15px 0 0 0; font-weight: bold; text-align: right;">Total Pago:</td>
                <td style="padding: 15px 0 0 0; font-weight: bold; text-align: right; color: #059669; font-size: 18px;">${formattedTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top: 20px; font-size: 14px;">
          <p style="margin: 5px 0;"><strong>Pagador:</strong> ${payerName}</p>
          <p style="margin: 5px 0;"><strong>Recebedor:</strong> ${receiverName}</p>
          <p style="margin: 5px 0;"><strong>Data do Pagamento:</strong> ${formattedDate}</p>
        </div>
        
        <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
          Este é um e-mail automático de confirmação. Guarde este comprovante para seus registros.
        </p>
      </div>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} PsyQ - Plataforma para Terapeutas
      </div>
    </div>
  `;

  try {
    const from = process.env.EMAIL_FROM || 'PsyQ <onboarding@resend.dev>';
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error sending bulk payment confirmation:', error);
    } else {
      console.log('Bulk payment confirmation email sent successfully:', data?.id);
    }
  } catch (error) {
    console.error('Unexpected error sending bulk payment confirmation:', error);
  }
}

export async function sendPaymentConfirmationEmail(to: string[], details: any) {
  if (!resend) {
    console.log(`[EMAIL MOCK] Payment confirmation to ${to.join(', ')}: ${JSON.stringify(details)}`);
    return;
  }

  const { 
    payerName, 
    receiverName, 
    amount, 
    date, 
    description, 
    transactionId, 
    type // 'patient_to_therapist' or 'therapist_to_platform'
  } = details;

  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formattedDate = date.split('-').reverse().join('/');

  const title = type === 'patient_to_therapist' ? 'Recibo de Pagamento de Sessão' : 'Recibo de Pagamento de Taxa de Serviço';
  const subject = `Confirmação de Pagamento - ${formattedAmount}`;

  const html = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
      <div style="background: #1a1a1a; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8;">Pagamento concluído com sucesso</p>
      </div>
      <div style="padding: 30px;">
        <p>Olá,</p>
        <p>Confirmamos o recebimento do pagamento via PIX referente a <strong>${description}</strong>.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Pagador:</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Recebedor:</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${receiverName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Data:</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Valor:</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #059669; font-size: 18px;">${formattedAmount}</td>
            </tr>
            ${transactionId ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">ID da Transação:</td>
              <td style="padding: 8px 0; font-family: monospace; font-size: 12px; text-align: right;">${transactionId}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
          Este é um e-mail automático de confirmação. Guarde este comprovante para seus registros.
        </p>
      </div>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} PsyQ - Plataforma para Terapeutas
      </div>
    </div>
  `;

  try {
    const from = process.env.EMAIL_FROM || 'PsyQ <onboarding@resend.dev>';
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error sending payment confirmation:', error);
    } else {
      console.log('Payment confirmation email sent successfully:', data?.id);
    }
  } catch (error) {
    console.error('Unexpected error sending payment confirmation:', error);
  }
}
