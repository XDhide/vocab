// Global variables
let vocabularyData = [];
let currentSheetUrl = '';
let selectedQuestionTypes = [];
let currentQuestionIndex = 0;
let currentQuestions = [];
let userAnswers = [];
let selectedAnswer = -1;
let recognition = null;
let spokenText = '';

// Initialize app
function initApp() {
    const savedUrl = localStorage.getItem('sheetUrl');
    if (savedUrl) {
        document.getElementById('sheetUrl').value = savedUrl;
        document.getElementById('newSheetUrl').value = savedUrl;
        connectSheet();
    }
    showSetupScreen();
    initSpeechRecognition();
}

function showSetupScreen() {
    hideAllScreens();
    document.getElementById('setupScreen').classList.remove('hidden');
}

function showMainMenu() {
    hideAllScreens();
    document.getElementById('mainMenu').classList.remove('hidden');
}

function showPracticeOptions() {
    hideAllScreens();
    document.getElementById('practiceOptions').classList.remove('hidden');
}

function showSettings() {
    hideAllScreens();
    document.getElementById('settingsScreen').classList.remove('hidden');
    const savedUrl = localStorage.getItem('sheetUrl');
    if (savedUrl) {
        document.getElementById('newSheetUrl').value = savedUrl;
    }
}

function hideAllScreens() {
    const screens = ['setupScreen', 'mainMenu', 'practiceOptions', 'practiceScreen', 'resultsScreen', 'settingsScreen'];
    screens.forEach(screen => {
        document.getElementById(screen).classList.add('hidden');
    });
}

function connectSheet() {
    const sheetUrl = document.getElementById('sheetUrl').value.trim();
    
    if (!sheetUrl || !sheetUrl.startsWith('https://docs.google.com/spreadsheets/d/') || !sheetUrl.includes('/edit')) {
        document.getElementById('setupError').classList.remove('hidden');
        document.getElementById('setupError').innerHTML = '<p>Vui lòng nhập link Google Sheet share hợp lệ!</p>';
        return;
    }

    const csvUrl = sheetUrl.replace(/\/edit.*/, '/export?format=csv');
    localStorage.setItem('sheetUrl', sheetUrl);
    currentSheetUrl = sheetUrl;

    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể tải dữ liệu! Đảm bảo sheet được chia sẻ với quyền "Anyone with the link can view" và sheet "Review" là sheet đầu tiên.');
            }
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                complete: function(results) {
                    try {
                        const data = results.data;
                        if (data.length < 1) {
                            throw new Error('Sheet không chứa dữ liệu hợp lệ!');
                        }

                        if (data[0][1] !== 'English' || data[0][2] !== 'Vietnamese' || 
                            data[0][3] !== 'Type' || data[0][4] !== 'Example') {
                            throw new Error('Header không đúng! Đảm bảo sheet "Review" có header "English", "Vietnamese", "Type", "Example" ở hàng 1 (cột B đến E).');
                        }

                        vocabularyData = data.slice(1).map(row => ({
                            english: row[1] || '',
                            vietnamese: row[2] || '',
                            type: row[3] || '',
                            example: row[4] || ''
                        })).filter(row => 
                            row.english && row.vietnamese && row.type && row.example
                        );

                        if (vocabularyData.length === 0) {
                            throw new Error('Không tìm thấy dữ liệu hợp lệ trong sheet "Review"!');
                        }

                        document.getElementById('setupError').classList.add('hidden');
                        showMainMenu();
                    } catch (error) {
                        document.getElementById('setupError').classList.remove('hidden');
                        document.getElementById('setupError').innerHTML = `<p>Lỗi: ${error.message}</p>`;
                    }
                },
                error: function(error) {
                    document.getElementById('setupError').classList.remove('hidden');
                    document.getElementById('setupError').innerHTML = `<p>Lỗi khi parse CSV: ${error.message}</p>`;
                }
            });
        })
        .catch(error => {
            document.getElementById('setupError').classList.remove('hidden');
            document.getElementById('setupError').innerHTML = `<p>Lỗi: ${error.message}</p>`;
        });
}

function updateSheetUrl() {
    const newUrl = document.getElementById('newSheetUrl').value.trim();
    
    if (!newUrl || !newUrl.startsWith('https://docs.google.com/spreadsheets/d/') || !newUrl.includes('/edit')) {
        alert('Vui lòng nhập link Google Sheet share hợp lệ!');
        return;
    }
    
    const csvUrl = newUrl.replace(/\/edit.*/, '/export?format=csv');
    localStorage.setItem('sheetUrl', newUrl);
    currentSheetUrl = newUrl;

    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể tải dữ liệu! Đảm bảo sheet được chia sẻ với quyền "Anyone with the link can view" và sheet "Review" là sheet đầu tiên.');
            }
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                complete: function(results) {
                    try {
                        const data = results.data;
                        if (data.length < 1) {
                            throw new Error('Sheet không chứa dữ liệu hợp lệ!');
                        }

                        if (data[0][1] !== 'English' || data[0][2] !== 'Vietnamese' || 
                            data[0][3] !== 'Type' || data[0][4] !== 'Example') {
                            throw new Error('Header không đúng! Đảm bảo sheet "Review" có header "English", "Vietnamese", "Type", "Example" ở hàng 1 (cột B đến E).');
                        }

                        vocabularyData = data.slice(1).map(row => ({
                            english: row[1] || '',
                            vietnamese: row[2] || '',
                            type: row[3] || '',
                            example: row[4] || ''
                        })).filter(row => 
                            row.english && row.vietnamese && row.type && row.example
                        );

                        if (vocabularyData.length === 0) {
                            throw new Error('Không tìm thấy dữ liệu hợp lệ trong sheet "Review"!'); 
                        }

                        alert('Đã cập nhật link Google Sheet thành công!');
                        showMainMenu();
                    } catch (error) {
                        alert(`Lỗi: ${error.message}`);
                    }
                },
                error: function(error) {
                    alert(`Lỗi khi parse CSV: ${error.message}`);
                }
            });
        })
        .catch(error => {
            alert(`Lỗi: ${error.message}`);
        });
}

// Initialize SpeechRecognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = function(event) {
            spokenText = event.results[0][0].transcript.trim().toLowerCase();
            document.getElementById('speechFeedback').classList.remove('hidden');
            document.getElementById('speechFeedback').textContent = `Bạn nói: "${spokenText}"`;
        };

        recognition.onerror = function(event) {
            document.getElementById('speechFeedback').classList.remove('hidden');
            document.getElementById('speechFeedback').textContent = `Lỗi nhận diện: ${event.error}. Vui lòng thử lại!`;
        };

        recognition.onend = function() {
            document.getElementById('startRecord').classList.remove('hidden');
            document.getElementById('stopRecord').classList.add('hidden');
        };
    } else {
        alert('Trình duyệt của bạn không hỗ trợ Speech Recognition. Vui lòng sử dụng Chrome hoặc Edge.');
    }
}

function startPractice() {
    const checkboxes = document.querySelectorAll('#practiceOptions input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('Vui lòng chọn ít nhất một loại câu hỏi!');
        return;
    }
    
    selectedQuestionTypes = Array.from(checkboxes).map(cb => cb.value);
    generateQuestions();
    showPracticeScreen();
}

function generateQuestions() {
    currentQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = [];
    
    vocabularyData.forEach((word, index) => {
        selectedQuestionTypes.forEach(type => {
            currentQuestions.push(generateQuestion(word, type, index));
        });
    });
    
    currentQuestions = shuffleArray(currentQuestions);
    
    document.getElementById('totalQuestions').textContent = currentQuestions.length;
}

function generateQuestion(word, type, wordIndex) {
    const question = {
        word: word,
        type: type,
        wordIndex: wordIndex,
        correctAnswer: '',
        options: []
    };
    
    switch(type) {
        case 'multipleChoice':
            if (Math.random() > 0.5) {
                question.text = `Từ "${word.english}" có nghĩa là:`;
                question.correctAnswer = word.vietnamese;
                question.options = generateOptions(word.vietnamese, 'vietnamese');
            } else {
                question.text = `Chọn từ phù hợp để điền vào chỗ trống: "${word.example.replace(word.english, '___')}"`;
                question.correctAnswer = word.english;
                question.options = generateOptions(word.english, 'english');
            }
            break;
            
        case 'fillBlank':
            if (Math.random() > 0.5) {
                question.text = `Từ "${word.english}" có nghĩa tiếng Việt là gì?`;
                question.correctAnswer = word.vietnamese.toLowerCase();
            } else {
                question.text = `Điền từ tiếng Anh phù hợp: "${word.example.replace(word.english, '___')}"`;
                question.correctAnswer = word.english.toLowerCase();
            }
            break;
            
        case 'listening':
            question.text = 'Nghe và chọn nghĩa đúng của từ được phát:';
            question.correctAnswer = word.vietnamese;
            question.options = generateOptions(word.vietnamese, 'vietnamese');
            break;
            
        case 'speaking':
            question.text = `Phát âm từ: "${word.english}"`;
            question.correctAnswer = word.english.toLowerCase();
            break;
    }
    
    return question;
}

function generateOptions(correctAnswer, field) {
    const options = [correctAnswer];
    const allWords = vocabularyData.map(w => w[field]);
    
    while (options.length < 4) {
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (!options.includes(randomWord) && randomWord) {
            options.push(randomWord);
        }
    }
    
    return shuffleArray(options);
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function showPracticeScreen() {
    hideAllScreens();
    document.getElementById('practiceScreen').classList.remove('hidden');
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    selectedAnswer = -1;
    spokenText = '';
    
    document.getElementById('questionNumber').textContent = currentQuestionIndex + 1;
    document.getElementById('questionText').textContent = question.text;
    
    const progress = (currentQuestionIndex / currentQuestions.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    
    document.getElementById('multipleChoiceOptions').classList.add('hidden');
    document.getElementById('fillBlankInput').classList.add('hidden');
    document.getElementById('listeningControls').classList.add('hidden');
    document.getElementById('speakingControls').classList.add('hidden');
    document.getElementById('speechFeedback').classList.add('hidden');
    
    switch(question.type) {
        case 'multipleChoice':
        case 'listening':
            document.getElementById('questionType').textContent = question.type === 'multipleChoice' ? 'Trắc nghiệm' : 'Nghe';
            document.getElementById('multipleChoiceOptions').classList.remove('hidden');
            const options = document.querySelectorAll('.option');
            question.options.forEach((option, index) => {
                options[index].textContent = `${String.fromCharCode(65 + index)}. ${option}`;
                options[index].classList.remove('selected');
            });
            if (question.type === 'listening') {
                document.getElementById('listeningControls').classList.remove('hidden');
            }
            break;
            
        case 'fillBlank':
            document.getElementById('questionType').textContent = 'Tự luận';
            document.getElementById('fillBlankInput').classList.remove('hidden');
            document.getElementById('userAnswer').value = '';
            break;
            
        case 'speaking':
            document.getElementById('questionType').textContent = 'Nói';
            document.getElementById('speakingControls').classList.remove('hidden');
            document.getElementById('startRecord').classList.remove('hidden');
            document.getElementById('stopRecord').classList.add('hidden');
            break;
    }
}

function selectOption(index) {
    selectedAnswer = index;
    const options = document.querySelectorAll('.option');
    options.forEach(option => option.classList.remove('selected'));
    options[index].classList.add('selected');
}

// Play word for listening
function playWord() {
    const question = currentQuestions[currentQuestionIndex];
    const utterance = new SpeechSynthesisUtterance(question.word.english);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

// Start recording for speaking
function startRecording() {
    if (!recognition) {
        alert('Speech Recognition không được hỗ trợ trên trình duyệt này!');
        return;
    }

    document.getElementById('startRecord').classList.add('hidden');
    document.getElementById('stopRecord').classList.remove('hidden');
    document.getElementById('speechFeedback').classList.remove('hidden');
    document.getElementById('speechFeedback').textContent = 'Đang ghi âm...';

    spokenText = '';
    recognition.start();
}

// Stop recording for speaking
function stopRecording() {
    if (recognition) {
        recognition.stop();
    }
}

function nextQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    let userAnswer = '';
    let isCorrect = false;
    
    switch(question.type) {
        case 'multipleChoice':
        case 'listening':
            if (selectedAnswer !== -1) {
                userAnswer = question.options[selectedAnswer];
                isCorrect = userAnswer === question.correctAnswer;
            }
            break;
            
        case 'fillBlank':
            userAnswer = document.getElementById('userAnswer').value.trim().toLowerCase();
            isCorrect = userAnswer === question.correctAnswer;
            break;
            
        case 'speaking':
            userAnswer = spokenText;
            isCorrect = spokenText.toLowerCase() === question.correctAnswer;
            break;
    }
    
    userAnswers.push({
        question: question,
        userAnswer: userAnswer,
        isCorrect: isCorrect
    });
    
    currentQuestionIndex++;
    
    if (currentQuestionIndex >= currentQuestions.length) {
        showResults();
    } else {
        displayCurrentQuestion();
    }
}

function showResults() {
    hideAllScreens();
    document.getElementById('resultsScreen').classList.remove('hidden');
    
    const totalQuestions = userAnswers.length;
    const correctAnswers = userAnswers.filter(answer => answer.isCorrect).length;
    const wrongAnswers = totalQuestions - correctAnswers;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    document.getElementById('totalAnswered').textContent = totalQuestions;
    document.getElementById('correctAnswers').textContent = correctAnswers;
    document.getElementById('wrongAnswers').textContent = wrongAnswers;
    document.getElementById('score').textContent = score;
    
    const wrongWords = userAnswers.filter(answer => !answer.isCorrect);
    if (wrongWords.length > 0) {
        document.getElementById('wrongWordsList').classList.remove('hidden');
        const wrongWordsList = document.getElementById('wrongWords');
        wrongWordsList.innerHTML = '';
        
        wrongWords.forEach(wrong => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${wrong.question.word.english}</strong> - ${wrong.question.word.vietnamese} (Bạn trả lời: ${wrong.userAnswer || 'Không trả lời'})`;
            wrongWordsList.appendChild(li);
        });
    } else {
        document.getElementById('wrongWordsList').classList.add('hidden');
    }
}

window.onload = initApp;