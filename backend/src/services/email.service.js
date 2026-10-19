import nodemailer from 'nodemailer';

export function createEmailService(config) {
  const configured = Boolean(config.host && config.user && config.password && config.from && config.supportTo);
  const transporter = configured ? nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } }) : null;
  return {
    configured,
    async sendSupportNotification({ ticket, user }) {
      if (!configured) return { status: 'skipped' };
      await transporter.sendMail({
        from: config.from,
        to: config.supportTo,
        subject: `[Meritx Support] ${ticket.subject}`,
        text: `A new support request was saved.\n\nFrom: ${user.name} <${user.email}>\nTicket: ${ticket.id}\nSubject: ${ticket.subject}\n\n${ticket.message}`,
      });
      return { status: 'sent' };
    },
  };
}
