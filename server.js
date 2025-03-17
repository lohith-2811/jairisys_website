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
  origin: 'https://lohith-2811.github.io/jairisys_main_website', // Allow requests from your frontend
  methods: ['GET', 'POST'], // Allowed HTTP methods
  credentials: true, // Allow cookies and credentials
}));

const SHEET_ID = process.env.SHEET_ID;
const EMAIL_SHEET_ID = process.env.EMAIL_SHEET_ID;
const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

// Authenticate with Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Function to send email
async function sendEmail(to, subject, text) {
  if (!to) {
    throw new Error('No recipients defined');
  }

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });

  let mailOptions = {
    from: EMAIL_USER,
    to: to,
    subject: subject,
    text: text,
  };

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

    // Retrieve specific emails from cells A1, A2, and A3
    const emailResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3'],
    });

    const emailAddresses = emailResponse.data.valueRanges
      .map(range => range.values && range.values[0] ? range.values[0][0] : null)
      .filter(email => email);

    console.log('Retrieved Email Addresses:', emailAddresses); // Debug log to check email addresses

    // Filter out invalid email addresses
    const validEmailAddresses = emailAddresses.filter(isValidEmail);
    console.log('Valid Email Addresses:', validEmailAddresses); // Debug log to check valid email addresses

    // Check if valid email addresses are retrieved
    if (validEmailAddresses.length === 0) {
      throw new Error('No valid email addresses found in specified cells');
    }

    // Send saved form data to each valid email address
    for (const email of validEmailAddresses) {
      console.log('Sending email to:', email); // Debug log to check email sending

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
    }

    res.status(200).send('Form data saved and emails sent successfully!');
  } catch (error) {
    console.error('Error saving form data or sending emails:', error);
    res.status(500).send('Error saving form data or sending emails');
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

// New route to handle "Get Updates" form submission
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
    const subject = 'Thank You for Subscribing!';
    const text = `You have successfully subscribed to Jairisys updates. We will notify you about upcoming products and new updates.`;
    await sendEmail(email, subject, text);

    res.status(200).send('Subscription successful!');
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).send('Error subscribing. Please try again later.');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
