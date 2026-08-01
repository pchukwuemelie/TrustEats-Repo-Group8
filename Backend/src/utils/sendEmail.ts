// import { Resend } from 'resend';

// const resend = new Resend(process.env.RESEND_API_KEY);

// interface SendEmailOptions {
//   to: string;
//   subject: string;
//   html: string;
// }

// export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
//   const { error } = await resend.emails.send({
//     from: process.env.EMAIL_FROM as string,
//     to: options.to,
//     subject: options.subject,
//     html: options.html,
//   });

//   if (error) {
//     console.error('[Email Error]', error);
//     throw new Error(`Failed to send email: ${error.message}`);
//   }
// };

// DEMO MODE: email sending disabled — OTP logged to console and returned in response
export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  console.log(`[DEMO EMAIL] To: ${options.to} | Subject: ${options.subject}`);
};
