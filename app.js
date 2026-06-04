let topicsData = {};
let currentTopicName = "";
let flashcards = [];
let topicProgress = {}; // Lưu trữ bộ đếm index của từng chủ đề: { "TopicA": 2, "TopicB": 0 }
let allCheckedState = false;

// Biến lưu trữ đường dẫn URL cấu hình của từng chủ đề từ API Index danh mục
let topicUrls = {};
// Mảng ghi nhớ các chủ đề hệ thống tải từ API/GitHub để thực hiện làm mờ (disabled) khi quản lý
let systemTopics = [];

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
const modalOverlay = document.getElementById('modalOverlay');
const checkerPanel = document.getElementById('checkerPanel');
const checkerList = document.getElementById('checkerList');

// Các phần tử phục vụ tính năng Ôn tập tổng hợp
const reviewCountSelect = document.getElementById('reviewCountSelect');
const startReviewBtn = document.getElementById('startReviewBtn');

// === 1. Xử lý Giao diện sáng / tối (Theme) ===
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeBtn) themeBtn.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

// Khôi phục cài đặt Theme từ bộ nhớ khi tải trang
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeBtn) themeBtn.textContent = '☀️';
} else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeBtn) themeBtn.textContent = '🌙';
}

// === 2. Tính năng Phát âm (Text-to-Speech) ===
function speakWord(event) {
    if (event) event.stopPropagation(); // Ngăn hành vi lật thẻ khi bấm nút loa

    const currentIndex = topicProgress[currentTopicName] || 0;
    if (flashcards.length === 0 || !flashcards[currentIndex]) return;

    const wordText = flashcards[currentIndex].word;
    window.speechSynthesis.cancel(); // Hủy các âm thanh đang chờ xếp hàng

    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// === 3. Cập nhật trạng thái hiển thị Flashcard ===
function updateCard() {
    const currentIndex = topicProgress[currentTopicName] || 0;

    if (flashcards.length === 0) {
        frontWord.textContent = "Welcome";
        backMeaning.textContent = "Chào mừng";
        counter.textContent = "Vui lòng chọn hoặc nạp file";
        progressBar.style.width = "0%";

        prevBtn.disabled = true;
        nextBtn.disabled = true;
        shuffleBtn.disabled = true;
        return;
    }

    if (currentIndex >= flashcards.length) {
        topicProgress[currentTopicName] = 0;
    }

    const currentCard = flashcards[topicProgress[currentTopicName]];
    frontWord.textContent = currentCard.word;
    backMeaning.textContent = currentCard.meaning;

    card.classList.remove('flipped');
    counter.textContent = `Từ ${topicProgress[currentTopicName] + 1} / ${flashcards.length} (Chủ đề: ${currentTopicName})`;

    const progressPercent = ((topicProgress[currentTopicName] + 1) / flashcards.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    prevBtn.disabled = (topicProgress[currentTopicName] === 0);
    nextBtn.disabled = (topicProgress[currentTopicName] === flashcards.length - 1);
    shuffleBtn.disabled = false;
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

// === 4. Cơ chế Lazy-Loading: Nạp dữ liệu từ API danh mục khi chuyển đổi ===
function switchTopic() {
    const selectedTopic = listSelect.value;
    if (!selectedTopic) {
        resetToEmptyState();
        return;
    }

    currentTopicName = selectedTopic;

    // Nếu chủ đề thuộc API hệ thống và chưa được tải chi tiết từ vựng xuống bộ nhớ máy
    if (topicsData[selectedTopic] && topicsData[selectedTopic].length === 0 && topicUrls[selectedTopic]) {
        fileLabel.textContent = `⏳ Đang tải từ vựng cho "${selectedTopic}"...`;

        fetch(topicUrls[selectedTopic])
            .then(res => {
                if (!res.ok) throw new Error("Không thể tải dữ liệu.");
                return res.json();
            })
            .then(wordList => {
                if (!Array.isArray(wordList)) {
                    if (typeof wordList === 'object' && wordList[selectedTopic]) {
                        wordList = wordList[selectedTopic];
                    }
                }

                topicsData[selectedTopic] = Array.isArray(wordList) ? wordList : [];

                const currentOption = listSelect.querySelector(`option[value="${selectedTopic}"]`);
                if (currentOption) {
                    currentOption.textContent = `${selectedTopic} (${topicsData[selectedTopic].length} từ)`;
                }

                renderCheckerList();
                proceedToLoadCard();
                fileLabel.textContent = `📁 Đã nạp dữ liệu chủ đề: ${selectedTopic}`;
            })
            .catch(err => {
                console.error(err);
                fileLabel.textContent = `❌ Lỗi nạp dữ liệu chủ đề ${selectedTopic}`;
                topicsData[selectedTopic] = [];
                proceedToLoadCard();
            });
    } else {
        proceedToLoadCard();
    }
}

function proceedToLoadCard() {
    if (!topicsData[currentTopicName] || !Array.isArray(topicsData[currentTopicName])) {
        flashcards = [];
    } else {
        flashcards = [...topicsData[currentTopicName]];
    }

    if (topicProgress[currentTopicName] === undefined || topicProgress[currentTopicName] >= flashcards.length) {
        topicProgress[currentTopicName] = 0;
    }

    mainTitle.textContent = currentTopicName.charAt(0).toUpperCase() + currentTopicName.slice(1);

    prevBtn.disabled = (flashcards.length === 0);
    nextBtn.disabled = (flashcards.length === 0);
    shuffleBtn.disabled = (flashcards.length === 0);
    if (manageBtn) manageBtn.disabled = false;

    checkGlobalReviewButtonState();
    updateCard();
    saveProgressToStorage();
}

// === 5. Cập nhật danh sách Dropdown chủ đề ===
function updateSelectDropdown(defaultActiveTopic = "") {
    if (!listSelect) return;
    listSelect.innerHTML = "";
    const keys = Object.keys(topicsData);

    if (keys.length === 0) {
        resetToEmptyState();
        return;
    }

    keys.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        const countText = (topicsData[topic] && topicsData[topic].length > 0) ? ` (${topicsData[topic].length} từ)` : "";
        option.textContent = topic + countText;
        listSelect.appendChild(option);
    });

    if (defaultActiveTopic && keys.includes(defaultActiveTopic)) {
        listSelect.value = defaultActiveTopic;
    } else {
        listSelect.value = keys[0];
    }

    renderCheckerList();
    switchTopic();
}

function resetToEmptyState() {
    if (listSelect) listSelect.innerHTML = '<option value="">-- Chưa có dữ liệu chủ đề --</option>';
    currentTopicName = "";
    flashcards = [];
    mainTitle.textContent = "Sight Words Flashcards";
    updateCard();
    renderCheckerList();
    checkGlobalReviewButtonState();
}

// === 6. Đọc File thủ công (Hỗ trợ cấu trúc file .txt dạng từ: nghĩa; giống Foods.txt) ===
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        let loadedCount = 0;
        let firstNewTopic = "";

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            const fileNameLower = file.name.toLowerCase();
            const topicName = file.name.replace(/\.[^/.]+$/, ""); // Cắt đuôi .txt hoặc .json

            reader.onload = function (event) {
                try {
                    let parsedWords = [];

                    // Xử lý file văn bản .txt (Dạng: từ: nghĩa;)
                    if (fileNameLower.endsWith('.txt')) {
                        const textContent = event.target.result;
                        const lines = textContent.split('\n');

                        lines.forEach(line => {
                            const cleanLine = line.trim();
                            if (!cleanLine) return;

                            const parts = cleanLine.split(':');
                            if (parts.length >= 2) {
                                const word = parts[0].trim();
                                const meaning = parts.slice(1).join(':').replace(/;$/, '').trim();

                                if (word && meaning) {
                                    parsedWords.push({ word: word, meaning: meaning });
                                }
                            }
                        });

                        if (parsedWords.length > 0) {
                            topicsData[topicName] = parsedWords;
                            if (topicProgress[topicName] === undefined) topicProgress[topicName] = 0;
                            if (!firstNewTopic) firstNewTopic = topicName;
                        }
                    }
                    // Xử lý cấu trúc file định dạng .json chuẩn
                    else {
                        const jsonData = JSON.parse(event.target.result);
                        if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
                            Object.keys(jsonData).forEach((topic) => {
                                if (Array.isArray(jsonData[topic])) {
                                    topicsData[topic] = jsonData[topic];
                                    if (topicProgress[topic] === undefined) topicProgress[topic] = 0;
                                    if (!firstNewTopic) firstNewTopic = topic;
                                }
                            });
                        } else if (Array.isArray(jsonData)) {
                            topicsData[topicName] = jsonData;
                            if (topicProgress[topicName] === undefined) topicProgress[topicName] = 0;
                            if (!firstNewTopic) firstNewTopic = topicName;
                        }
                    }

                    loadedCount++;

                    if (loadedCount === files.length) {
                        fileLabel.textContent = `📁 Đã nạp thành công ${files.length} file cục bộ`;
                        updateSelectDropdown(firstNewTopic || Object.keys(topicsData)[0]);
                        saveProgressToStorage();
                    }
                } catch (err) {
                    console.error("Lỗi phân tích tệp dữ liệu:", err);
                    alert(`Không thể đọc tệp "${file.name}".`);
                    loadedCount++;
                }
            };
            reader.readAsText(file);
        });
    });
}

// === 7. Quản lý Bảng điều khiển Checklist (LÀM MỜ FILE API, POPUP ĐỘC LẬP) ===
function toggleCheckerPanel() {
    if (!modalOverlay) return;
    if (modalOverlay.classList.contains('active')) {
        modalOverlay.classList.remove('active');
    } else {
        renderCheckerList();
        modalOverlay.classList.add('active');
    }
}

function closeModalOnOverlay(e) {
    // Đóng modal khi click ra vùng ngoài overlay tối màu
    if (e.target === modalOverlay) {
        toggleCheckerPanel();
    }
}

function renderCheckerList() {
    if (!checkerList) return;
    checkerList.innerHTML = "";

    const allKeys = Object.keys(topicsData).filter(topic => topic !== "🔄 Ôn tập tổng hợp");

    if (allKeys.length === 0) {
        checkerList.innerHTML = "<div style='padding:20px; color:var(--text-secondary); text-align:center; font-size: 14px; font-style: italic;'>Danh sách trống</div>";
        return;
    }

    allKeys.forEach(topic => {
        const isSystem = systemTopics.includes(topic);
        const item = document.createElement('div');

        // Thêm class phân loại hệ thống để định dạng CSS làm mờ và chặn tương tác
        item.className = isSystem ? "checker-item system-item" : "checker-item";

        const checkbox = document.createElement('input');
        checkbox.type = "checkbox";
        checkbox.value = topic;
        checkbox.id = `check-${topic}`;

        // Vô hiệu hóa nút tích chọn nếu thuộc hệ thống API trực tuyến
        if (isSystem) {
            checkbox.disabled = true;
        }

        const label = document.createElement('label');
        label.htmlFor = `check-${topic}`;
        const countText = (topicsData[topic] && topicsData[topic].length > 0) ? ` (${topicsData[topic].length} từ)` : " (Chưa tải)";

        // Tạo thẻ span chứa tên chủ đề
        const textSpan = document.createElement('span');
        textSpan.textContent = topic + countText;

        // Tạo Badge ghi chú loại chủ đề rõ ràng và đẹp mắt
        const badge = document.createElement('span');
        badge.className = isSystem ? "checker-badge badge-system" : "checker-badge badge-local";
        badge.textContent = isSystem ? "Hệ thống" : "Cá nhân";

        label.appendChild(textSpan);
        label.appendChild(badge);

        item.appendChild(checkbox);
        item.appendChild(label);
        checkerList.appendChild(item);
    });
}

function toggleSelectAllCheckboxes() {
    allCheckedState = !allCheckedState;
    const checkboxes = checkerList.querySelectorAll('.checker-item:not(.system-item) input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = allCheckedState);
}

function deleteSelectedTopics() {
    const checkboxes = checkerList.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert("Vui lòng tích chọn ít nhất một bộ từ vựng Local (Cá nhân) để thực hiện thao tác xóa.");
        return;
    }

    if (confirm(`Bạn có chắc muốn xóa vĩnh viễn ${checkboxes.length} chủ đề nạp thủ công được chọn?`)) {
        checkboxes.forEach(cb => {
            const topicToDelete = cb.value;
            // Chỉ cho xóa nếu bộ từ đó không thuộc mảng systemTopics (bảo mật lớp 2)
            if (!systemTopics.includes(topicToDelete)) {
                delete topicsData[topicToDelete];
                delete topicProgress[topicToDelete];
            }
        });

        allCheckedState = false;

        const remainingKeys = Object.keys(topicsData);
        let nextActiveTopic = "";
        if (remainingKeys.length > 0) {
            nextActiveTopic = remainingKeys.includes(currentTopicName) ? currentTopicName : remainingKeys[0];
        }

        updateSelectDropdown(nextActiveTopic);
        saveProgressToStorage();
        alert("Đã gỡ bỏ thành công dữ liệu các chủ đề local.");
    }
}

// === 8. Tính năng: Ôn tập tổng hợp kết hợp nhiều chủ đề ===
function checkGlobalReviewButtonState() {
    if (!startReviewBtn) return;
    const loadedTopics = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp" && topicsData[k] && topicsData[k].length > 0);
    startReviewBtn.disabled = (loadedTopics.length === 0);
}

function startGlobalReview() {
    const loadedTopics = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp" && topicsData[k] && topicsData[k].length > 0);

    if (loadedTopics.length === 0) {
        alert("Không có từ vựng khả dụng.");
        return;
    }

    let globalPool = [];
    loadedTopics.forEach(topic => {
        globalPool = globalPool.concat(topicsData[topic]);
    });

    for (let i = globalPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [globalPool[i], globalPool[j]] = [globalPool[j], globalPool[i]];
    }

    const limitCount = parseInt(reviewCountSelect.value, 10);
    if (limitCount > 0 && globalPool.length > limitCount) {
        globalPool = globalPool.slice(0, limitCount);
    }

    const reviewSessionName = "🔄 Ôn tập tổng hợp";
    topicsData[reviewSessionName] = globalPool;
    topicProgress[reviewSessionName] = 0;

    let reviewOption = listSelect.querySelector(`option[value="${reviewSessionName}"]`);
    if (!reviewOption) {
        reviewOption = document.createElement('option');
        reviewOption.value = reviewSessionName;
        listSelect.appendChild(reviewOption);
    }
    reviewOption.textContent = `${reviewSessionName} (${globalPool.length} từ)`;

    listSelect.value = reviewSessionName;
    switchTopic();

    if (modalOverlay.classList.contains('active')) {
        modalOverlay.classList.remove('active');
    }
}

// === 9. Đồng bộ dữ liệu qua LocalStorage trình duyệt ===
function saveProgressToStorage() {
    const cleanTopicsData = { ...topicsData };
    const cleanTopicProgress = { ...topicProgress };
    delete cleanTopicsData["🔄 Ôn tập tổng hợp"];
    delete cleanTopicProgress["🔄 Ôn tập tổng hợp"];

    localStorage.setItem('flashcard_topics_data', JSON.stringify(cleanTopicsData));
    localStorage.setItem('flashcard_topic_progress', JSON.stringify(cleanTopicProgress));
    localStorage.setItem('flashcard_topic_urls', JSON.stringify(topicUrls));
    localStorage.setItem('flashcard_system_topics', JSON.stringify(systemTopics));
    if (currentTopicName && currentTopicName !== "🔄 Ôn tập tổng hợp") {
        localStorage.setItem('flashcard_current_topic', currentTopicName);
    }
}

function loadProgressFromStorage() {
    try {
        const storedData = localStorage.getItem('flashcard_topics_data');
        const storedProgress = localStorage.getItem('flashcard_topic_progress');
        const storedUrls = localStorage.getItem('flashcard_topic_urls');
        const storedSystem = localStorage.getItem('flashcard_system_topics');
        const storedCurrent = localStorage.getItem('flashcard_current_topic');

        if (storedData && storedProgress) {
            topicsData = JSON.parse(storedData);
            topicProgress = JSON.parse(storedProgress);
            if (storedUrls) topicUrls = JSON.parse(storedUrls);
            if (storedSystem) systemTopics = JSON.parse(storedSystem);

            const keys = Object.keys(topicsData);
            if (keys.length > 0) {
                //fileLabel.textContent = `💾 Đã khôi phục tiến trình học tập từ bộ nhớ máy`;
                const activeTopic = (storedCurrent && keys.includes(storedCurrent)) ? storedCurrent : keys[0];
                updateSelectDropdown(activeTopic);
                return true;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return false;
}

function clearSavedData() {
    if (confirm("Xóa toàn bộ tiến trình học và bộ từ vựng cục bộ?")) {
        localStorage.clear();
        window.location.reload();
    }
}

// === 10. Quản lý Sự kiện phím tắt bàn phím ===
document.addEventListener('keydown', (e) => {
    if (flashcards.length === 0) return;
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
    } else if (e.code === 'ArrowRight') {
        nextCard();
    } else if (e.code === 'ArrowLeft') {
        prevCard();
    } else if (e.code === 'Escape') {
        // Đóng modal quản lý bằng phím ESC
        if (modalOverlay && modalOverlay.classList.contains('active')) {
            toggleCheckerPanel();
        }
    }
});

// === 11. KHỞI CHẠY KHI TẢI TRANG XONG ===
window.addEventListener('DOMContentLoaded', () => {
    const hasSavedData = loadProgressFromStorage();

    if (!hasSavedData) {
        fileLabel.textContent = `⏳ Đang kết nối danh mục chủ đề từ hệ thống API...`;

        // Trỏ đến file mục lục tổng của bạn trên GitHub
        const indexApiUrl = 'https://raw.githubusercontent.com/nghia46/English_Flashcard/refs/heads/master/index.json';

        fetch(indexApiUrl)
            .then(response => {
                if (!response.ok) throw new Error("Lỗi API cấu hình.");
                return response.json();
            })
            .then(indexData => {
                const baseUrl = indexData.baseUrl || "";
                const topics = indexData.topics || {};

                topicUrls = {};
                topicsData = {};
                systemTopics = [];

                Object.keys(topics).forEach(topic => {
                    topicUrls[topic] = baseUrl + topics[topic];
                    topicsData[topic] = []; // Sử dụng cơ chế Lazy Loading
                    systemTopics.push(topic); // ĐĂNG KÝ: Đánh dấu các chủ đề thuộc API trực tuyến

                    if (topicProgress[topic] === undefined) {
                        topicProgress[topic] = 0;
                    }
                });

                const keys = Object.keys(topicsData);
                if (keys.length > 0) {
                    fileLabel.textContent = `📁 Đồng bộ dữ liệu API danh mục thành công`;
                    updateSelectDropdown(keys[0]);
                } else {
                    resetToEmptyState();
                }
            })
            .catch(error => {
                console.error(error);
                fileLabel.textContent = `❌ Không thể đồng bộ danh mục từ hệ thống API`;
                resetToEmptyState();
            });
    }
});