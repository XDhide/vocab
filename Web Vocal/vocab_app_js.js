// Dữ liệu ứng dụng
let appData = {
    apiKey: '',           // API key người dùng nhập
    sheetUrl: '',         // URL Google Sheet
    scriptUrl: '',        // URL Google Apps Script
    spreadsheetId: '',    // Spreadsheet ID tách từ sheetUrl
    sheetRange: 'Sheet1!A2:D',  // Range mặc định của Sheet
    words: []
};

let currentQuiz = {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false
};

// Khởi tạo ứng dụng khi người dùng "đăng nhập"
function initApp() {
    const savedKey = localStorage.getItem('apiKey');
    const savedUrl = localStorage.getItem('sheetUrl');
    const savedScriptUrl = localStorage.getItem('scriptUrl');

    if (!savedKey || !savedUrl || !savedScriptUrl || !isValidSheetUrl(savedUrl)) {
        showSetupModal();
        return;
    }

    appData.apiKey = savedKey;
    appData.sheetUrl = savedUrl;
    appData.scriptUrl = savedScriptUrl;
    appData.spreadsheetId = extractSpreadsheetId(savedUrl);

    if (!appData.spreadsheetId) {
        showSetupModal();
        return;
    }

    fetchSheetData()
        .then(() => console.log('Đã tải dữ liệu từ Google Sheet', appData.words))
        .catch(err => {
            console.error(err);
            alert('Lỗi tải dữ liệu. Vui lòng kiểm tra lại API key và Sheet URL.');
            showSetupModal();
        });
}

// Hiển thị modal thiết lập
function showSetupModal() {
    document.getElementById('setupModal').style.display = 'block';
}

// Lưu cấu hình người dùng
function saveSetup() {
    const apiKey = document.getElementById('setupApiKey').value.trim();
    const sheetUrl = document.getElementById('setupSheetUrl').value.trim();
    const scriptUrl = document.getElementById('setupScriptUrl').value.trim();

    if (!apiKey || !sheetUrl || !scriptUrl || !isValidSheetUrl(sheetUrl)) {
        alert('Vui lòng nhập đầy đủ thông tin hợp lệ!');
        return;
    }

    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('sheetUrl', sheetUrl);
    localStorage.setItem('scriptUrl', scriptUrl);

    closeModal('setupModal');
    initApp();
    alert('Thiết lập thành công! Đang tải dữ liệu...');
}

function isValidSheetUrl(url) {
    try {
        const u = new URL(url);
        return /docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9-_]+/.test(u.href);
    } catch {
        return false;
    }
}

function extractSpreadsheetId(sheetUrl) {
    try {
        const u = new URL(sheetUrl);
        const match = u.pathname.match(/\/spreadsheets\/d\/([^\/]+)/);
        return match ? match[1] : '';
    } catch {
        return '';
    }
}

async function fetchSheetData() {
    const { apiKey, spreadsheetId, sheetRange } = appData;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    const data = await res.json();
    parseSheetValues(data.values || []);
}

function parseSheetValues(rows) {
    appData.words = rows.map(r => ({
        english: r[0] || '',
        vietnamese: r[1] || '',
        type: r[2] || '',
        example: r[3] || ''
    }));
}

async function addWordToSheet(word) {
    try {
        const res = await fetch(appData.scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(word)
        });
        if (!res.ok) throw new Error('Gửi không thành công');
        appData.words.push(word);
        renderWordList();
        alert('Đã thêm từ vào Google Sheet!');
    } catch (err) {
        alert('Lỗi khi gửi dữ liệu: ' + err.message);
    }
}

// Hiển thị danh sách từ
function showWordList() {
    const modal = document.getElementById('wordListModal');
    const content = document.getElementById('wordListContent');
    content.innerHTML = '<div class="loading">Đang tải danh sách từ...</div>';
    modal.style.display = 'block';
    setTimeout(renderWordList, 500);
}

function renderWordList() {
    const content = document.getElementById('wordListContent');
    if (appData.words.length === 0) {
        content.innerHTML = '<p>Chưa có từ vựng nào. Hãy thêm từ mới!</p>';
        return;
    }
    let html = '<div class="word-list">';
    appData.words.forEach((word, index) => {
        html += `
            <div class="word-item">
                <h3>${word.english}</h3>
                <div class="vietnamese">${word.vietnamese}</div>
                <div class="type">${word.type}</div>
                <div class="example">"${word.example}"</div>
                <button class="btn btn-danger" onclick="deleteWord(${index})">🗑️ Xóa</button>
            </div>
        `;
    });
    html += '</div>';
    content.innerHTML = html;
}

function showAddWordForm() {
    document.getElementById('addWordModal').style.display = 'block';
}

function addWord() {
    const english = document.getElementById('englishWord').value.trim();
    const vietnamese = document.getElementById('vietnameseWord').value.trim();
    const type = document.getElementById('wordType').value;
    const example = document.getElementById('exampleSentence').value.trim();

    if (!english || !vietnamese || !example) {
        alert('Vui lòng nhập đầy đủ thông tin!');
        return;
    }

    const word = {
        english: english.toLowerCase(),
        vietnamese,
        type,
        example
    };

    addWordToSheet(word); // Ghi vào Google Sheet

    ['englishWord','vietnameseWord','exampleSentence'].forEach(id =>
        document.getElementById(id).value = ''
    );

    closeModal('addWordModal');
}

function deleteWord(index) {
    if (confirm('Bạn có chắc muốn xóa từ này?')) {
        appData.words.splice(index,1);
        renderWordList();
    }
}

function startQuiz() {
    if (appData.words.length < 4) { 
        alert('Cần ít nhất 4 từ để bắt đầu ôn tập!'); 
        return; 
    }
    generateQuiz();
    document.getElementById('quizModal').style.display = 'block';
    showQuestion();
}

function generateQuiz() {
    currentQuiz = { questions: [], currentIndex: 0, score: 0, answered: false };
    
    for (let i = 0; i < Math.min(10, appData.words.length); i++) {
        const typeQ = Math.random() > 0.5 ? 'word' : 'sentence';
        const word = appData.words[Math.floor(Math.random() * appData.words.length)];
        let q = { type: typeQ, question: '', correctAnswer: '', options: [] };
        
        if (typeQ === 'word') {
            q.question = `Nghĩa của từ "${word.english}" là gì?`;
            q.correctAnswer = word.vietnamese;
            let wrong = appData.words
                .filter(w => w.vietnamese !== word.vietnamese)
                .map(w => w.vietnamese)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
            q.options = [word.vietnamese, ...wrong].sort(() => Math.random() - 0.5);
        } else {
            const ws = word.example.split(' ');
            const idx = ws.findIndex(w => w.toLowerCase().replace(/[.,!?]/, '') === word.english);
            
            if (idx !== -1) {
                ws[idx] = '____';
                q.question = `Điền từ thích hợp vào chỗ trống: "${ws.join(' ')}"`;
                q.correctAnswer = word.english;
                let wrong = appData.words
                    .filter(w => w.english !== word.english)
                    .map(w => w.english)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3);
                q.options = [word.english, ...wrong].sort(() => Math.random() - 0.5);
            } else {
                // fallback
                q.question = `Nghĩa của từ "${word.english}" là gì?`;
                q.correctAnswer = word.vietnamese;
                let wrong = appData.words
                    .filter(w => w.vietnamese !== word.vietnamese)
                    .map(w => w.vietnamese)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3);
                q.options = [word.vietnamese, ...wrong].sort(() => Math.random() - 0.5);
            }
        }
        currentQuiz.questions.push(q);
    }
}

function showQuestion() {
    const c = currentQuiz;
    const q = c.questions[c.currentIndex];
    
    if (!q) { 
        showQuizResult(); 
        return; 
    }
    
    let html = `
        <div class="quiz-container">
            <div class="score">Câu ${c.currentIndex + 1}/${c.questions.length} - Điểm: ${c.score}</div>
            <div class="question">${q.question}</div>
            <div class="answers">`;
    
    q.options.forEach(opt => {
        html += `<button class="answer-btn" onclick="selectAnswer('${opt}',this)">${opt}</button>`;
    });
    
    html += '</div></div>';
    document.getElementById('quizContent').innerHTML = html;
    c.answered = false;
}

function selectAnswer(answer, btn) {
    const c = currentQuiz;
    if (c.answered) return;
    c.answered = true;
    
    const correct = c.questions[c.currentIndex].correctAnswer;
    
    document.querySelectorAll('.answer-btn').forEach(b => {
        if (b.textContent.trim() === correct) {
            b.classList.add('correct');
        }
    });
    
    if (answer !== correct) {
        btn.classList.add('incorrect');
    } else {
        c.score++;
    }
    
    document.querySelectorAll('.answer-btn').forEach(b => {
        b.style.pointerEvents = 'none';
    });
    
    setTimeout(() => {
        c.currentIndex++;
        showQuestion();
    }, 2000);
}

function showQuizResult() {
    const c = currentQuiz;
    const pct = Math.round(c.score / c.questions.length * 100);
    let msg = pct >= 80 ? 'Xuất sắc! 🎉' : pct >= 60 ? 'Tốt! 👍' : 'Cần cố gắng thêm! 💪';
    
    document.getElementById('quizContent').innerHTML = `
        <div class="quiz-container">
            <h2>Kết quả ôn tập</h2>
            <div class="score">Điểm: ${c.score}/${c.questions.length} (${pct}%)</div>
            <div class="question">${msg}</div>
            <button class="btn btn-primary" onclick="startQuiz()">Làm lại</button>
            <button class="btn" onclick="closeModal('quizModal')">Đóng</button>
        </div>`;
}

function showSettings() {
    document.getElementById('settingsApiKey').value = appData.apiKey;
    document.getElementById('settingsSheetUrl').value = appData.sheetUrl;
    document.getElementById('settingsScriptUrl').value = appData.scriptUrl;
    document.getElementById('settingsModal').style.display = 'block';
}

function updateSettings() {
    const key = document.getElementById('settingsApiKey').value.trim();
    const url = document.getElementById('settingsSheetUrl').value.trim();
    const scriptUrl = document.getElementById('settingsScriptUrl').value.trim();
    
    if (!key || !url || !scriptUrl) { 
        alert('Vui lòng nhập đầy đủ thông tin!'); 
        return; 
    }
    
    appData.apiKey = key;
    appData.sheetUrl = url;
    appData.scriptUrl = scriptUrl;
    
    localStorage.setItem('apiKey', key);
    localStorage.setItem('sheetUrl', url);
    localStorage.setItem('scriptUrl', scriptUrl);
    
    closeModal('settingsModal');
    alert('Cập nhật thành công!');
    initApp();
}

// Đóng modal theo ID
function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
}

// Đóng modal khi click ngoài
window.onclick = function(e) {
    document.querySelectorAll('.modal').forEach(m => {
        if (e.target === m) m.style.display = 'none';
    });
};

// Khởi tạo ứng dụng khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', initApp);