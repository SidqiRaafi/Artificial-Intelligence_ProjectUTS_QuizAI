const { google } = require('googleapis');
const path = require('path');

async function main() {
  // Service Account Google Cloud
  const keyFile = path.join(__dirname, 'credentials.json');

  // Auth Sheet API menggunakan Service Account
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();

  // Init Sheets API
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Spreadsheet ID
  const spreadsheetId = '1dYTQ2B7qcR_t7U5HI1YqWdJAX0il95gZJOLGEshXZhc';

  // Data yang diambil dari Sheet
  const range = 'Sheet1!A1:F20';

  try {
    // Baca data dari Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (rows.length) {
      console.log('Data from spreadsheet:');
      rows.forEach((row, index) => {
        console.log(`${index + 1}: ${row.join(' | ')}`);
      });
    } else {
      console.log('No data found in spreadsheet.');
    }
  } catch (error) {
    console.error('Error reading spreadsheet:', error);
  }
}

main();
