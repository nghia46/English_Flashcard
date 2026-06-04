let topicsData = {};
let currentTopicName = "";
let flashcards = [];
let topicProgress = {}; // Lưu trữ bộ đếm index của từng chủ đề: { "TopicA": 2, "TopicB": 0 }
let allCheckedState = false;

// Khai báo các phần tử DOM giao diện chính
const card = document.getElementById('card');
const frontWord = document.getElementById('frontWord');
const backMeaning = document.getElementById('backMeaning');
const counter = document.getElementById('counter');
const progressBar = document.getElementById('progressBar');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const listSelect = document.getElementById('listSelect');
const mainTitle = document.getElementById('mainTitle');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const themeBtn = document.getElementById('themeBtn');
const manageBtn = document.getElementById('manageBtn');
const checkerPanel = document.getElementById('checkerPanel');
const checkerList = document.getElementById('checkerList');

// Các phần tử phục vụ tính năng Ôn tập tổng hợp
const reviewCountSelect = document.getElementById('reviewCountSelect');
const startReviewBtn = document.getElementById('startReviewBtn');

// === Xử lý Giao diện sáng / tối (Theme) ===
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeBtn.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

const savedTheme = localStorage.getItem('theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeBtn.textContent = '☀️';
}

// === Tính năng Phát âm (Text-to-Speech) ===
function speakWord(e) {
    if (e) {
        e.stopPropagation();
    }
    
    if (flashcards.length === 0) return;
    const currentIndex = topicProgress[currentTopicName] || 0;
    const currentItem = flashcards[currentIndex];
    
    const utterance = new SpeechSynthesisUtterance(currentItem.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// === Xử lý bộ nhớ máy trình duyệt (localStorage) ===
function saveProgressToStorage() {
    if (Object.keys(topicsData).length === 0) {
        localStorage.removeItem('flashcard_session');
        return;
    }

    const sessionState = {
        topicsData: topicsData,
        currentTopicName: currentTopicName,
        topicProgress: topicProgress
    };
    localStorage.setItem('flashcard_session', JSON.stringify(sessionState));
}

function loadProgressFromStorage() {
    const savedSession = localStorage.getItem('flashcard_session');
    if (!savedSession) return false;

    try {
        const sessionState = JSON.parse(savedSession);
        topicsData = sessionState.topicsData || {};
        currentTopicName = sessionState.currentTopicName || "";
        topicProgress = sessionState.topicProgress || {};

        if (Object.keys(topicsData).length > 0) {
            fileLabel.textContent = `📁 Đã khôi phục dữ liệu học tập`;
            updateSelectDropdown(currentTopicName);
            return true;
        }
    } catch (e) {
        console.error("Lỗi đọc dữ liệu cũ trường localStorage:", e);
    }
    return false;
}

function resetToEmptyState() {
    topicsData = {};
    currentTopicName = "";
    flashcards = [];
    topicProgress = {};

    mainTitle.textContent = "Sight Words Flashcards";
    frontWord.textContent = "Welcome";
    backMeaning.textContent = "Chào mừng";
    counter.textContent = "Vui lòng chọn file để bắt đầu";
    progressBar.style.width = "0%";
    fileLabel.textContent = "📁 Chọn một hoặc nhiều file JSON từ vựng";

    listSelect.innerHTML = '<option value="">-- Chưa có dữ liệu chủ đề --</option>';
    checkerList.innerHTML = "";
    if (checkerPanel) checkerPanel.classList.remove('active');

    prevBtn.disabled = true;
    nextBtn.disabled = true;
    shuffleBtn.disabled = true;
    manageBtn.disabled = true;
    if (startReviewBtn) startReviewBtn.disabled = true; 
}

function clearSavedData() {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách chủ đề không?")) {
        resetToEmptyState();
        localStorage.removeItem('flashcard_session');
        alert("Đã xóa dữ liệu thành công.");
    }
}

// === Chức năng Đóng/Mở bảng Checker Quản lý dữ liệu ===
function toggleCheckerPanel() {
    if (!checkerPanel || Object.keys(topicsData).length === 0) return;
    checkerPanel.classList.toggle('active');
}

function renderCheckerList() {
    if (!checkerList) return;
    checkerList.innerHTML = "";
    const topicKeys = Object.keys(topicsData).filter(key => key !== "🔄 Ôn tập tổng hợp");

    if (topicKeys.length === 0) return;

    topicKeys.forEach((topic) => {
        const label = document.createElement('label');
        label.className = 'checker-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = topic;
        checkbox.className = 'topic-checkbox';

        const textSpan = document.createElement('span');
        textSpan.textContent = `${topic} (${topicsData[topic].length} từ)`;

        label.appendChild(checkbox);
        label.appendChild(textSpan);
        checkerList.appendChild(label);
    });
}

function toggleSelectAllCheckboxes() {
    const checkboxes = document.querySelectorAll('.topic-checkbox');
    allCheckedState = !allCheckedState;
    checkboxes.forEach(cb => cb.checked = allCheckedState);
}

function deleteCheckedCollections() {
    const checkedBoxes = document.querySelectorAll('.topic-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert("Vui lòng tích chọn ít nhất một bộ chủ đề cần xóa.");
        return;
    }

    const listToDelete = Array.from(checkedBoxes).map(cb => cb.value);

    if (confirm(`Bạn có chắc chắn muốn xóa ${listToDelete.length} chủ đề đã chọn không?`)) {
        listToDelete.forEach(topic => {
            delete topicsData[topic];
            delete topicProgress[topic];
        });

        delete topicsData["🔄 Ôn tập tổng hợp"];
        delete topicProgress["🔄 Ôn tập tổng hợp"];

        const remainingTopics = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp");

        if (remainingTopics.length > 0) {
            if (listToDelete.includes(currentTopicName)) {
                updateSelectDropdown(remainingTopics[0]);
            } else {
                updateSelectDropdown(currentTopicName);
            }
        } else {
            resetToEmptyState();
        }

        saveProgressToStorage();
        allCheckedState = false;
        alert("Đã xóa các bộ sưu tập thành công.");
    }
}

// === XỬ LÝ ĐỌC FILE JSON TẢI LÊN THỦ CÔNG ===
fileInput.addEventListener('change', function (e) {
    const files = e.target.files;
    if (files.length === 0) return;

    let filesProcessed = 0;
    fileLabel.textContent = `📁 Đã chọn ${files.length} file JSON`;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const uploadedJson = JSON.parse(e.target.result);
                
                // Hỗ trợ đồng bộ trực tiếp cấu trúc nhiều key từ file JSON ngoại vi
                Object.keys(uploadedJson).forEach(topicName => {
                    if (Array.isArray(uploadedJson[topicName])) {
                        topicsData[topicName] = uploadedJson[topicName];
                        if (topicProgress[topicName] === undefined) {
                            topicProgress[topicName] = 0;
                        }
                    }
                });
            } catch (err) {
                console.error("Lỗi định dạng file JSON tải lên:", err);
                alert(`Không thể đọc file "${file.name}". Vui lòng kiểm tra lại cấu trúc JSON.`);
            }

            filesProcessed++;
            if (filesProcessed === files.length) {
                const keys = Object.keys(topicsData);
                updateSelectDropdown(keys.length > 0 ? keys[keys.length - 1] : "");
            }
        };
        reader.readAsText(file, 'UTF-8');
    }
});

function updateSelectDropdown(defaultActiveTopic) {
    listSelect.innerHTML = "";
    const topicKeys = Object.keys(topicsData);

    if (topicKeys.length === 0) {
        resetToEmptyState();
        return;
    }

    topicKeys.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = `${topic} (${topicsData[topic].length} từ)`;
        listSelect.appendChild(option);
    });

    if (defaultActiveTopic && topicsData[defaultActiveTopic]) {
        listSelect.value = defaultActiveTopic;
    } else {
        listSelect.value = topicKeys[0];
    }

    renderCheckerList();

    if (startReviewBtn) {
        const actualTopicsCount = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp").length;
        startReviewBtn.disabled = actualTopicsCount === 0;
    }

    switchTopic();
}

function switchTopic() {
    const selectedTopic = listSelect.value;
    if (!selectedTopic || !topicsData[selectedTopic]) return;

    currentTopicName = selectedTopic;
    flashcards = [...topicsData[selectedTopic]];

    if (topicProgress[currentTopicName] === undefined || topicProgress[currentTopicName] >= flashcards.length) {
        topicProgress[currentTopicName] = 0;
    }

    mainTitle.textContent = currentTopicName.charAt(0).toUpperCase() + currentTopicName.slice(1);

    prevBtn.disabled = false;
    nextBtn.disabled = false;
    shuffleBtn.disabled = false;
    manageBtn.disabled = false;

    updateCard();
    saveProgressToStorage();
}

// === TÍNH NĂNG ÔN TẬP TỔNG HỢP ===
function startGlobalReview() {
    let allWordsCombined = [];
    
    Object.keys(topicsData).forEach(topic => {
        if (topic !== "🔄 Ôn tập tổng hợp") {
            allWordsCombined = allWordsCombined.concat(topicsData[topic]);
        }
    });

    if (allWordsCombined.length === 0) {
        alert("Chưa có từ vựng nào trong hệ thống để thực hiện trộn ôn tập!");
        return;
    }

    for (let i = allWordsCombined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWordsCombined[i], allWordsCombined[j]] = [allWordsCombined[j], allWordsCombined[i]];
    }

    const selectMode = reviewCountSelect.value;
    let finalSelection = [];
    
    if (selectMode === "all") {
        finalSelection = allWordsCombined;
    } else {
        const requestedLimit = parseInt(selectMode, 10);
        finalSelection = allWordsCombined.slice(0, Math.min(requestedLimit, allWordsCombined.length));
    }

    const reviewTopicName = "🔄 Ôn tập tổng hợp";
    topicsData[reviewTopicName] = finalSelection;
    topicProgress[reviewTopicName] = 0;

    updateSelectDropdown(reviewTopicName);
    alert(`🎯 Đã gộp và lấy ngẫu nhiên thành công ${finalSelection.length} từ từ tất cả các chủ đề để bạn ôn tập!`);
}

function updateCard() {
    if (flashcards.length === 0) return;
    card.classList.remove('flipped');

    const currentIndex = topicProgress[currentTopicName] || 0;

    setTimeout(() => {
        const currentItem = flashcards[currentIndex];
        frontWord.textContent = currentItem.word;
        backMeaning.textContent = currentItem.meaning;

        counter.textContent = `Từ ${currentIndex + 1} / ${flashcards.length}`;
        const progressPercent = ((currentIndex + 1) / flashcards.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }, 150);
}

function flipCard() {
    if (flashcards.length === 0) return;
    card.classList.toggle('flipped');
}

function nextCard() {
    const currentIndex = topicProgress[currentTopicName] || 0;
    if (currentIndex < flashcards.length - 1) {
        topicProgress[currentTopicName] = currentIndex + 1;
        updateCard();
        saveProgressToStorage();
    } else {
        alert(`🎉 Bạn đã học xong tất cả các từ trong chủ đề "${currentTopicName}"!`);
    }
}

function prevCard() {
    const currentIndex = topicProgress[currentTopicName] || 0;
    if (currentIndex > 0) {
        topicProgress[currentTopicName] = currentIndex - 1;
        updateCard();
        saveProgressToStorage();
    }
}

// Xử lý trộn vị trí các thẻ từ vựng
function shuffleCards() {
    if (flashcards.length === 0) return;
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }

    topicsData[currentTopicName] = [...flashcards];
    topicProgress[currentTopicName] = 0;

    updateCard();
    saveProgressToStorage();
}

// Bàn phím máy tính điều hướng nhanh ứng dụng
document.addEventListener('keydown', (e) => {
    if (flashcards.length === 0) return;
    if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
    } else if (e.code === 'ArrowRight') {
        nextCard();
    } else if (e.code === 'ArrowLeft') {
        prevCard();
    } else if (e.code === 'KeyV') {
        speakWord();
    }
});

// KHỞI CHẠY: Tự động kết nối nạp dữ liệu mặc định từ file JSON / API hệ thống
window.addEventListener('DOMContentLoaded', () => {
    const hasSavedData = loadProgressFromStorage();

    // Nếu bộ nhớ trình duyệt trống (chạy lần đầu), gọi lệnh fetch liên kết API dữ liệu
    if (!hasSavedData) {
        fileLabel.textContent = `⏳ Đang đồng bộ từ vựng mặc định từ hệ thống...`;
        
        // Bạn có thể đổi đường dẫn này thành link API online thật của bạn (ví dụ: MockAPI, GitHub raw)
        const targetApiUrl = 'https://raw.githubusercontent.com/nghia46/English_Flashcard/refs/heads/master/English-words.json'; 

        fetch(targetApiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Không thể tải cấu hình dữ liệu mặc định.");
                }
                return response.json();
            })
            .then(jsonData => {
                topicsData = jsonData;
                
                Object.keys(topicsData).forEach(topic => {
                    if (topicProgress[topic] === undefined) {
                        topicProgress[topic] = 0;
                    }
                });

                const keys = Object.keys(topicsData);
                if (keys.length > 0) {
                    fileLabel.textContent = `📁 Đã nạp dữ liệu JSON mặc định`;
                    updateSelectDropdown(keys[0]);
                }
            })
            .catch(error => {
                console.error("Lỗi lấy dữ liệu API tự động:", error);
                fileLabel.textContent = `❌ Không tìm thấy danh sách mặc định hệ thống`;
            });
    }
});