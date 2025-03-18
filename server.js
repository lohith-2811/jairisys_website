const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: ['https://lohith-2811.github.io', 'https://jairisys.tech'], // Allow multiple origins
  methods: ['GET', 'POST'], // Allowed HTTP methods
  credentials: true, // Allow cookies and credentials
}));


const SHEET_ID = process.env.SHEET_ID;
const EMAIL_SHEET_ID = process.env.EMAIL_SHEET_ID;
const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const BREVO_USER = process.env.BREVO_USER; // Brevo SMTP user
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY; // Brevo SMTP key

// Authenticate with Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Function to send email using Brevo SMTP
async function sendEmail(to, subject, text) {
  if (!to) {
    throw new Error('No recipients defined');
  }

  let transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', // Brevo SMTP server
    port: 587, // Brevo SMTP port
    secure: false, // TLS
    auth: {
      user: BREVO_USER, // Brevo SMTP login
      pass: BREVO_SMTP_KEY, // Brevo SMTP key
    },
  });

  let mailOptions = {
    from: 'Jairisys <info@jairisys.tech>', // Sender name and address
    to: to,
    subject: subject,
    text: text,
  };

  console.log('Sending email to:', to); // Debug log
  console.log('Email subject:', subject); // Debug log
  console.log('Email content:', text); // Debug log

  return transporter.sendMail(mailOptions);
}

// Function to validate email addresses
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Endpoint to handle form submission
app.post('/submit', async (req, res) => {
  const formData = req.body;
  console.log('Form Data Received:', formData);

  try {
    // Append form data to the spreadsheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!B2', // Adjust the range as needed
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            formData.first_name,
            formData.middle_name,
            formData.last_name,
            formData.email,
            formData.department,
            formData.input_radio,
            formData.input_radio_1,
            formData.input_radio_2,
            formData.input_text,
            formData.description,
          ],
        ],
      },
    });
    console.log('Form data appended to Google Sheet.');

    // Retrieve specific emails from cells A1, A2, and A3
    const emailResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3'],
    });
    console.log('Email Response:', emailResponse.data);

    const emailAddresses = emailResponse.data.valueRanges
      .map(range => range.values && range.values[0] ? range.values[0][0] : null)
      .filter(email => email);
    console.log('Retrieved Email Addresses:', emailAddresses);

    // Filter out invalid email addresses
    const validEmailAddresses = emailAddresses.filter(isValidEmail);
    console.log('Valid Email Addresses:', validEmailAddresses);

    // Check if valid email addresses are retrieved
    if (validEmailAddresses.length === 0) {
      throw new Error('No valid email addresses found in specified cells');
    }

    // Send saved form data to each valid email address
    for (const email of validEmailAddresses) {
      console.log('Sending email to:', email);

      const savedData = `
        First Name: ${formData.first_name}
        Middle Name: ${formData.middle_name}
        Last Name: ${formData.last_name}
        Email: ${formData.email}
        Department: ${formData.department}
        Input Radio: ${formData.input_radio}
        Input Radio 1: ${formData.input_radio_1}
        Input Radio 2: ${formData.input_radio_2}
        Input Text: ${formData.input_text}
        Description: ${formData.description}
      `;
      
      await sendEmail(email, 'Form Submission Data', savedData);
      console.log('Email sent successfully to:', email);
    }

    res.status(200).send('Form data saved and emails sent successfully!');
  } catch (error) {
    console.error('Error saving form data or sending emails:', error);
    res.status(500).send(`Error saving form data or sending emails: ${error.message}`);
  }
});

// New route to send email with form data to a specific email address
app.post('/send-contact-email', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).send('Name, email, and message are required');
    }

    // Prepare the email content
    const emailContent = `
      Name: ${name}
      Email: ${email}
      Message: ${message}
    `;

    // Send the email
    await sendEmail('ch.lohithnaveen@gmail.com', 'New Contact Form Submission', emailContent);

    res.status(200).send('Email sent successfully!');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending email');
  }
});

app.post('/subscribe', async (req, res) => {
  const { email } = req.body;

  try {
    // Validate the email
    if (!isValidEmail(email)) {
      return res.status(400).send('Invalid email address');
    }

    // Append the email to the Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: EMAIL_SHEET_ID, // Use EMAIL_SHEET_ID from .env
      range: 'Sheet1!A1', // Adjust the range as needed
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[email]],
      },
    });

    // Send a confirmation email to the user
    const subject = '🌟 Welcome to Jairisys! Your Journey Starts Here 🚀';
    const text = `
Hello,

🌟 Welcome to Jairisys! Enjoy exciting updates, sleek products, and cutting-edge features. 💻✨

Stay tuned for exclusive previews, beta releases, and all the latest news! 🚀

Thank you for subscribing – the future of software is brighter with you on board! ✨
Best regards,
The Jairisys Team
`;

    const html = `
      <p>Hello,</p>
      <p>🌟 Welcome to Jairisys! Enjoy exciting updates, sleek products, and cutting-edge features. 💻✨</p>
      <p>Stay tuned for exclusive previews and news! 🚀</p>
      <p>Thank you for subscribing – the future is brighter with you! ✨</p>
      <p>Best regards,<br>The Jairisys Team</p>
    `;

    // Print email details for debugging
    console.log('Sending email to:', email);
    console.log('Email subject:', subject);
    console.log('Email content (text):', text);
    console.log('Email content (HTML):', html);

    // Call the sendEmail function
    await sendEmail(email, subject, text, html);

    res.status(200).send('Subscription successful!');
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).send('Error subscribing. Please try again later.');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
