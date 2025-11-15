const chatArea = document.getElementById('chatArea');
const inputForm = document.getElementById('inputForm');
const userInput = document.getElementById('userInput');

const startQuizBtn = document.getElementById('startQuizBtn');
const restartBtn = document.getElementById('restartBtn');
const stopBtn = document.getElementById('stopBtn');
const scoreValue = document.getElementById('scoreValue');
const materiListDiv = document.getElementById('materiList');

const userId = 'demo-user1';

// tambah pesan ke area chat
function addMessage(text, from = 'user') {
  const msg = document.createElement('div');
  msg.className = 'chat-row';

  if (from === 'bot') {
    msg.style.background = "#f3f7fb";
    msg.style.color = "#213547";
    msg.style.alignSelf = "flex-start";
    msg.style.textAlign = "left";
    msg.style.fontWeight = "normal";
    msg.style.marginRight = "auto";
    msg.style.marginLeft = "0";
    msg.style.borderRadius = "16px 16px 16px 5px";
    msg.style.boxShadow = "0 2px 16px rgba(20, 70, 200, 0.10)";
    msg.style.border = "1.5px solid #dbeafe";
    msg.style.maxWidth = "55%";
    msg.innerHTML = `<span style="font-size:1.4em;vertical-align:bottom;margin-right:8px;">🤖 : <br></span>${text.replace(/\n/g, '<br>')}`;
  } else {
    msg.classList.add('user'); // add this line for correct alignment
    msg.style.background = "linear-gradient(90deg, #43e17d 10%, #36b05c 90%)";
    msg.style.color = "#fff";
    msg.style.alignSelf = "flex-end";
    msg.style.textAlign = "right";
    msg.style.fontWeight = "bold";
    msg.style.marginLeft = "auto";
    msg.style.marginRight = "0";
    msg.style.borderRadius = "15px 15px 4px 15px";
    msg.style.boxShadow = "0 2px 8px rgba(35,160,80,0.11)";
    msg.style.maxWidth = "55%";
    msg.innerText = text;
  }

  msg.style.minWidth = "0";
  msg.style.marginTop = "20px";
  msg.style.marginBottom = "20px";
  msg.style.padding = "14px 22px";

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// Reset backend session untuk user
async function resetBackendSession() {
  await fetch('http://localhost:3000/reset-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userId }),
  });
}

// Kirim pesan chat ke backend dan tangani balasan
async function sendMessage(text) {
  addMessage(text, 'user');
  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userId, message: text }),
    });
    const data = await response.json();
    if (data.reply) {
      addMessage(data.reply, 'bot');

      // update skor quiz
      const percentRegex = /Skor (?:kamu|sementara):\s*(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)/i;
      const percentOnlyRegex = /Skor (?:kamu|sementara):\s*(\d+)%/i;

      let match = data.reply.match(percentRegex);
      if (match) {
        scoreValue.innerText = `${match[3]}%`;
      } else {
        match = data.reply.match(percentOnlyRegex);
        if (match) {
          scoreValue.innerText = `${match[1]}%`;
        }
      }

      // refresh materi sidebar jika sudah terupload ke sheets
      if (data.reply.includes('All questions saved!')) {
        updateMateriSidebar();
      }
    }
  } catch (e) {
    addMessage('Network error, please try again later.', 'bot');
  }
}

// refresh daftar materi di sidebar
async function updateMateriSidebar() {
  try {
    const res = await fetch('http://localhost:3000/materi-list');
    const data = await res.json();
    materiListDiv.innerHTML = '';
    (data.materiList || []).forEach(materi => {
      const el = document.createElement('div');
      el.className = 'materi-item';
      el.innerHTML = '📚 ' + materi;
      materiListDiv.appendChild(el);
    });
  } catch {
    materiListDiv.innerHTML = '<div class="materi-item" style="color:red;">Failed to load materi</div>';
  }
}

// Form submit handler
inputForm.onsubmit = function (e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (text) sendMessage(text);
  userInput.value = '';
};

// jalankan saat halaman dimuat
window.onload = function () {
  sendMessage('');
  updateMateriSidebar();
};

// Start Quiz button: kirim pesan '2' untuk memulai quiz
startQuizBtn.onclick = function () {
  sendMessage('2');
};

// Restart button: reset backend session, clear UI, restart quiz
restartBtn.onclick = async function () {
  chatArea.innerHTML = '';
  scoreValue.innerText = '0%';
  await resetBackendSession();
  sendMessage('');
  updateMateriSidebar();
};

// Stop button: reset backend session, clear UI, display message
stopBtn.onclick = async function () {
  addMessage('Quiz stopped. You can restart anytime.', 'bot');
  scoreValue.innerText = '0%';
  await resetBackendSession();
  sendMessage('');
  updateMateriSidebar();
};
