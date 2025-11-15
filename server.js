const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const keyFile = path.join(__dirname, 'credentials.json');
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const spreadsheetId = '1dYTQ2B7qcR_t7U5HI1YqWdJAX0il95gZJOLGEshXZhc';

async function appendToSheet(row) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A:C',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function getAllRows() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A:C',
  });
  return result.data.values || [];
}

async function getMateriList() {
  const rows = await getAllRows();
  const materiSet = new Set();
  for (let i = 1; i < rows.length; i++) {
    const materi = rows[i][0];
    if (materi) materiSet.add(materi);
  }
  return Array.from(materiSet);
}

async function getQuestionsByMateri(materi) {
  const rows = await getAllRows();
  return rows
    .filter(row => row[0] === materi)
    .map(row => ({ question: row[1], answer: row[2] }));
}

// Reset endpoint clears session for user
const sessions = {};
app.post('/reset-session', (req, res) => {
  const user = req.body.user || 'default';
  delete sessions[user];
  res.json({ ok: true });
});

app.get('/materi-list', async (req, res) => {
  try {
    const materiList = await getMateriList();
    res.json({ materiList });
  } catch (err) {
    res.status(500).json({ materiList: [], error: String(err) });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const user = req.body.user || 'default';
    const message = req.body.message?.trim();

    if (!sessions[user]) {
      sessions[user] = {
        step: 'main_menu',
        materi: '',
        questions: [],
        quizQuestions: [],
        quizIndex: 0,
        score: 0,
        qIndex: 0,
        currentQuestion: '',
        materiList: [],
      };
    }
    const session = sessions[user];
    let reply = '';

    switch (session.step) {
      case 'main_menu':
        reply =
          'Selamat datang di Chatbot Quiz.\nApa yang ingin kamu lakukan hari ini?\n1. Tambah materi\n2. Gunakan materi yang sudah ada\nKetik 1 atau 2 untuk melanjutkan.';
        session.step = 'main_menu_choice';
        break;

      case 'main_menu_choice':
        if (!message) {
          reply = 'Silakan ketik 1 untuk menambah materi, atau 2 untuk menggunakan materi yang tersedia.';
        } else if (message === '1') {
          reply = 'Masukkan judul materi baru:';
          session.step = 'add_materi_title';
        } else if (message === '2') {
          const materiList = await getMateriList();
          session.materiList = materiList;
          if (!materiList.length) {
            reply = 'Belum ada materi yang tersedia. Tambahkan materi baru dengan memilih 1 di menu utama.';
          } else {
            reply = 'Pilih materi yang tersedia dengan mengetik angkanya:\n' +
              materiList.map((m, i) => `${i + 1}. ${m}`).join('\n');
            session.step = 'materi_choice';
          }
        } else {
          reply = 'Pilihan tidak valid. Silakan ketik angka 1 atau 2!';
        }
        break;

      case 'materi_choice':
        const idx = parseInt(message);
        if (!isNaN(idx) && idx >= 1 && idx <= session.materiList.length) {
          session.materi = session.materiList[idx - 1];
          session.quizQuestions = await getQuestionsByMateri(session.materi);
          session.score = 0;
          session.quizIndex = 0;
          if (!session.quizQuestions.length) {
            reply = "Belum ada soal pada materi ini.";
            session.step = 'main_menu';
          } else {
            reply = `Materi dipilih: ${session.materi}\nQuiz akan dimulai.\nSoal 1:\n${session.quizQuestions[0].question}`;
            session.step = 'quiz_answer';
          }
        } else {
          reply = 'Pilihan tidak valid. Silakan ketik nomor materi yang tersedia!';
        }
        break;

      case 'add_materi_title':
        session.materi = message;
        session.qIndex = 1;
        session.questions = [];
        reply = `Materi [${message}] berhasil ditambahkan!\nMasukkan pertanyaan ke-1:`;
        session.step = 'add_question';
        break;

      case 'add_question':
        session.currentQuestion = message;
        reply = 'Masukkan jawaban yang benar untuk pertanyaan ini:';
        session.step = 'add_answer';
        break;

      case 'add_answer':
        session.questions.push({
          materi: session.materi,
          question: session.currentQuestion,
          answer: message,
        });
        reply =
          'Apakah ingin menambah pertanyaan lagi?\n1. Ya, tambah pertanyaan\n2. Mulai quiz dari materi ini\nKetik 1 untuk menambah pertanyaan, atau 2 untuk langsung mulai quiz.';
        session.step = 'add_another_question';
        break;

      case 'add_another_question':
        if (message === '1') {
          session.qIndex++;
          reply = `Masukkan pertanyaan ke-${session.qIndex}:`;
          session.step = 'add_question';
        } else if (message === '2') {
          for (const q of session.questions) {
            try {
              await appendToSheet([q.materi, q.question, q.answer]);
            } catch (err) {
              console.error('Sheet append error', err);
            }
          }
          session.quizQuestions = session.questions.slice();
          session.score = 0;
          session.quizIndex = 0;
          reply = `Semua pertanyaan berhasil disimpan!\nQuiz pada materi [${session.materi}] dimulai.\nSoal 1:\n${session.quizQuestions[0].question}`;
          session.step = 'quiz_answer';
        } else {
          reply = 'Pilihan tidak valid. Ketik 1 untuk menambah pertanyaan, atau 2 untuk mulai quiz.';
        }
        break;

      case 'quiz_answer':
        const currentQ = session.quizQuestions[session.quizIndex];
        if (!currentQ) {
          reply = 'Tidak ditemukan soal, quiz dihentikan.';
          session.step = 'main_menu';
          break;
        }
        if (message.toLowerCase() === (currentQ.answer || '').toLowerCase()) {
          reply = 'Jawaban benar! ';
          session.score++;
        } else {
          reply = `Jawaban salah. Jawaban yang benar adalah: ${currentQ.answer}\n`;
        }
        session.quizIndex++;
        if (session.quizIndex >= session.quizQuestions.length) {
          const percent = Math.round(session.score / session.quizQuestions.length * 100);
          reply += `Quiz selesai! Skor kamu: ${session.score}/${session.quizQuestions.length} (${percent}%)\nTerima kasih sudah menggunakan Chatbot Quiz!`;
          session.step = 'main_menu';
        }else {
          reply += `Soal berikutnya (${session.quizIndex + 1}):\n${session.quizQuestions[session.quizIndex].question}`;
        }
        break;

      default:
        reply = "Terjadi kesalahan. Silakan mulai ulang dengan memilih 1 atau 2 di menu utama.";
        session.step = 'main_menu_choice';
        break;
    }

    res.json({ reply });
  } catch (err) {
    console.error('Handler error:', err);
    res.json({ reply: 'Maaf, terjadi kesalahan pada sistem.' });
  }
});

app.listen(3000, () =>
  console.log('Server berjalan di http://localhost:3000')
);
