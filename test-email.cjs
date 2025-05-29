const nodemailer = require('nodemailer');

const config = {
  host: 'smtp.mail.me.com',
  port: 587,
  secure: false,
  auth: {
    user: 'jjalangtry@icloud.com',
    pass: 'bjrl-ycdc-fwom-nxag'
  }
};

console.log('Creating transporter with config:', {
  host: config.host,
  port: config.port,
  secure: config.secure,
  user: config.auth.user,
  hasPass: !!config.auth.pass
});

const transporter = nodemailer.createTransporter(config);

transporter.verify(function(error, success) {
  if (error) {
    console.log('SMTP configuration error:', error);
  } else {
    console.log('SMTP server is ready to take our messages');
  }
  process.exit(error ? 1 : 0);
}); 