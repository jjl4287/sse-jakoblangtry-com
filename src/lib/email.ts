import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Configure the transporter using environment variables
// Ensure these are set in your .env file
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587', 10),
  auth: {
    user: process.env.EMAIL_USER, // Your SMTP username
    pass: process.env.EMAIL_PASSWORD, // Your SMTP password
  },
  // `secure: true` for port 465, `secure: false` for all other ports e.g. 587
  secure: parseInt(process.env.EMAIL_SERVER_PORT || '587', 10) === 465,
});

export async function sendEmail({ to, subject, html, text }: MailOptions) {
  const mailOptions = {
    from: process.env.EMAIL_FROM, // Sender address (must be verified with your email provider)
    to, // List of receivers
    subject, // Subject line
    html, // HTML body
    text: text || html.replace(/<[^>]*>?/gm, ''), // Plain text body (optional, generated from HTML if not provided)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    // You can return info or a custom success object
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    // In a real app, you might throw a more specific error or handle it differently
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
} 