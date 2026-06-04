let topicsData = {};
let currentTopicName = "";
let flashcards = [];
let topicProgress = {}; // Lưu trữ bộ đếm index của từng chủ đề: { "TopicA": 2, "TopicB": 0 }
let allCheckedState = false;

// Biến lưu trữ đường dẫn URL cấu hình của từng chủ đề từ API Index danh mục
let topicUrls = {}; 

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

// === 1. Xử lý Giao diện sáng / tối (Theme) ===
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
    
    // Hủy các giọng đọc đang bị xếp hàng chờ (nếu có) để phát âm ngay lập tức
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US'; // Thiết lập chuẩn tiếng Anh - Mỹ
    utterance.rate = 0.9;     // Tốc độ đọc vừa phải giúp dễ nghe
    
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

    // Đảm bảo chỉ mục index không vượt quá giới hạn mảng từ vựng
    if (currentIndex >= flashcards.length) {
        topicProgress[currentTopicName] = 0;
    }

    const currentCard = flashcards[topicProgress[currentTopicName]];
    frontWord.textContent = currentCard.word;
    backMeaning.textContent = currentCard.meaning;

    // Trả thẻ về mặt trước (Xóa hiệu ứng lật đang xoay)
    card.classList.remove('flipped');

    // Cập nhật số đếm Tiến trình văn bản (Ví dụ: 3 / 20 từ)
    counter.textContent = `Từ ${topicProgress[currentTopicName] + 1} / ${flashcards.length} (Chủ đề: ${currentTopicName})`;

    // Cập nhật Thanh Tiến độ (Progress Bar) hình ảnh
    const progressPercent = ((topicProgress[currentTopicName] + 1) / flashcards.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    // Cập nhật trạng thái bật/tắt của 2 nút bấm điều hướng
    prevBtn.disabled = (topicProgress[currentTopicName] === 0);
    nextBtn.disabled = (topicProgress[currentTopicName] === flashcards.length - 1);
    shuffleBtn.disabled = false;
}

// Hiệu ứng lật mặt thẻ Flashcard
function flipCard() {
    if (flashcards.length === 0) return;
    card.classList.toggle('flipped');
}

// Chuyển sang thẻ tiếp theo
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

// Lùi lại thẻ phía trước
function prevCard() {
    const currentIndex = topicProgress[currentTopicName] || 0;
    if (currentIndex > 0) {
        topicProgress[currentTopicName] = currentIndex - 1;
        updateCard();
        saveProgressToStorage();
    }
}

// Trộn ngẫu nhiên danh sách từ vựng hiện tại
function shuffleCards() {
    if (flashcards.length === 0) return;
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }

    topicsData[currentTopicName] = [...flashcards];
    topicProgress[currentTopicName] = 0; // Đưa tiến trình về từ đầu tiên sau khi trộn

    updateCard();
    saveProgressToStorage();
}

// === 4. Cơ chế Lazy-Loading: Nạp dữ liệu khi chuyển đổi Chủ đề ===
function switchTopic() {
    const selectedTopic = listSelect.value;
    if (!selectedTopic) {
        resetToEmptyState();
        return;
    }

    currentTopicName = selectedTopic;

    // NẾU CHỦ ĐỀ CHƯA TỪNG ĐƯỢC TẢI CHI TIẾT (Mảng rỗng và có URL liên kết) -> Thực hiện Fetch dữ liệu file JSON tương ứng
    if (topicsData[selectedTopic] && topicsData[selectedTopic].length === 0 && topicUrls[selectedTopic]) {
        fileLabel.textContent = `⏳ Đang tải từ vựng cho "${selectedTopic}"...`;
        
        fetch(topicUrls[selectedTopic])
            .then(res => {
                if (!res.ok) throw new Error("Không thể tải danh sách từ vựng của chủ đề này.");
                return res.json();
            })
            .then(wordList => {
                // SỬA LỖI KHÔNG PHẢI MẢNG (Iterable Error): Ép kiểu cứu vãn nếu file JSON lỡ bị bọc bởi key tên chủ đề
                if (!Array.isArray(wordList)) {
                    if (typeof wordList === 'object' && wordList[selectedTopic]) {
                        wordList = wordList[selectedTopic];
                    } else if (typeof wordList === 'object') {
                        const firstKey = Object.keys(wordList)[0];
                        if (Array.isArray(wordList[firstKey])) {
                            wordList = wordList[firstKey];
                        }
                    }
                }

                // Nếu sau khi kiểm tra vẫn không đúng cấu trúc mảng, chuyển về mảng rỗng để không crash web
                topicsData[selectedTopic] = Array.isArray(wordList) ? wordList : []; 
                
                // Cập nhật hiển thị số lượng từ trên thẻ select option
                const currentOption = listSelect.querySelector(`option[value="${selectedTopic}"]`);
                if (currentOption) {
                    currentOption.textContent = `${selectedTopic} (${topicsData[selectedTopic].length} từ)`;
                }

                // Cập nhật danh sách bảng điều khiển quản lý checklist
                renderCheckerList();

                // Tiến hành đưa dữ liệu lên màn hình Flashcard
                proceedToLoadCard();
                fileLabel.textContent = `📁 Đã nạp dữ liệu chủ đề: ${selectedTopic}`;
            })
            .catch(err => {
                console.error(err);
                fileLabel.textContent = `❌ Lỗi nạp dữ liệu chủ đề ${selectedTopic}`;
                topicsData[selectedTopic] = []; // Tạo mảng rỗng phòng ngừa lỗi lặp lại
                proceedToLoadCard();
            });
    } else {
        // Nếu dữ liệu đã có sẵn trong bộ nhớ (được nạp từ trước hoặc nạp thủ công bằng kéo thả file)
        proceedToLoadCard();
    }
}

// Xử lý nạp mảng từ vựng vào khung Flashcard sau khi hoàn tất tải dữ liệu
function proceedToLoadCard() {
    // SỬA LỖI KHÔNG PHẢI MẢNG: Kiểm tra an toàn biến mảng trước khi clone [...]
    if (!topicsData[currentTopicName] || !Array.isArray(topicsData[currentTopicName])) {
        flashcards = [];
    } else {
        flashcards = [...topicsData[currentTopicName]];
    }

    if (topicProgress[currentTopicName] === undefined || topicProgress[currentTopicName] >= flashcards.length) {
        topicProgress[currentTopicName] = 0;
    }

    mainTitle.textContent = currentTopicName.charAt(0).toUpperCase() + currentTopicName.slice(1);

    // Kích hoạt lại các nút chức năng chính dựa theo số lượng từ khả dụng
    if (flashcards.length > 0) {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        shuffleBtn.disabled = false;
    } else {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        shuffleBtn.disabled = true;
    }
    manageBtn.disabled = false;

    // Kiểm tra kích hoạt nút Ôn tập tổng hợp
    checkGlobalReviewButtonState();

    updateCard();
    saveProgressToStorage();
}

// === 5. Cập nhật danh sách Dropdown hiển thị danh mục chủ đề ===
function updateSelectDropdown(defaultActiveTopic = "") {
    listSelect.innerHTML = "";
    const keys = Object.keys(topicsData);

    if (keys.length === 0) {
        resetToEmptyState();
        return;
    }

    keys.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        // Nếu từ vựng đã tải về thì hiển thị kèm số lượng từ, ngược lại giữ nguyên tên
        const countText = (topicsData[topic] && topicsData[topic].length > 0) ? ` (${topicsData[topic].length} từ)` : "";
        option.textContent = topic + countText;
        listSelect.appendChild(option);
    });

    // Chỉ định chủ đề hoạt động mặc định ban đầu
    if (defaultActiveTopic && keys.includes(defaultActiveTopic)) {
        listSelect.value = defaultActiveTopic;
    } else {
        listSelect.value = keys[0];
    }

    renderCheckerList();
    switchTopic();
}

// Đưa ứng dụng về trạng thái trống khi không có dữ liệu học
function resetToEmptyState() {
    listSelect.innerHTML = '<option value="">-- Chưa có dữ liệu chủ đề --</option>';
    currentTopicName = "";
    flashcards = [];
    mainTitle.textContent = "Sight Words Flashcards";
    updateCard();
    renderCheckerList();
    checkGlobalReviewButtonState();
}

// === 6. Đọc File JSON thủ công qua khu vực Kéo / Thả hoặc Chọn file ===
fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    let loadedCount = 0;
    let firstNewTopic = "";

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                // Trường hợp 1: File cấu hình chứa nhiều chủ đề cùng lúc: { "Chủ đề 1": [...], "Chủ đề 2": [...] }
                if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
                    Object.keys(jsonData).forEach((topic) => {
                        if (Array.isArray(jsonData[topic])) {
                            topicsData[topic] = jsonData[topic];
                            if (topicProgress[topic] === undefined) topicProgress[topic] = 0;
                            if (!firstNewTopic) firstNewTopic = topic;
                        }
                    });
                } 
                // Trường hợp 2: File JSON đơn lẻ chứa danh sách từ của đúng 1 chủ đề, lấy tên file làm tên chủ đề
                else if (Array.isArray(jsonData)) {
                    const topicName = file.name.replace(/\.[^/.]+$/, ""); // Cắt đuôi mở rộng .json
                    topicsData[topicName] = jsonData;
                    if (topicProgress[topicName] === undefined) topicProgress[topicName] = 0;
                    if (!firstNewTopic) firstNewTopic = topicName;
                }

                loadedCount++;

                // Khi tất cả các file tải lên hoàn tất xử lý thành công
                if (loadedCount === files.length) {
                    fileLabel.textContent = `📁 Đã nạp thành công ${files.length} file dữ liệu`;
                    updateSelectDropdown(firstNewTopic);
                    saveProgressToStorage();
                }
            } catch (err) {
                console.error("Lỗi cấu trúc dữ liệu tệp JSON:", err);
                alert(`Không thể đọc file "${file.name}". Vui lòng kiểm tra lại định dạng chuẩn JSON.`);
            }
        };
        reader.readAsText(file);
    });
});

// === 7. Quản lý Bảng điều khiển Checklist (Bật/Tắt và Xóa nhiều chủ đề) ===
function toggleCheckerPanel() {
    if (checkerPanel.classList.contains('hidden')) {
        renderCheckerList();
        checkerPanel.classList.remove('hidden');
    } else {
        checkerPanel.classList.add('hidden');
    }
}

function renderCheckerList() {
    checkerList.innerHTML = "";
    const keys = Object.keys(topicsData);

    if (keys.length === 0) {
        checkerList.innerHTML = "<div style='padding: 10px; color: var(--text-secondary); text-align: center;'>Danh sách trống</div>";
        return;
    }

    keys.forEach(topic => {
        // Không hiện "Ôn tập tổng hợp" vào danh sách xóa quản lý
        if (topic === "🔄 Ôn tập tổng hợp") return;

        const item = document.createElement('div');
        item.className = "checker-item";

        const checkbox = document.createElement('input');
        checkbox.type = "checkbox";
        checkbox.value = topic;
        checkbox.id = `check-${topic}`;

        const label = document.createElement('label');
        label.htmlFor = `check-${topic}`;
        const countText = (topicsData[topic] && topicsData[topic].length > 0) ? ` (${topicsData[topic].length} từ)` : " (Chưa nạp)";
        label.textContent = topic + countText;

        item.appendChild(checkbox);
        item.appendChild(label);
        checkerList.appendChild(item);
    });
}

function toggleSelectAllCheckboxes() {
    allCheckedState = !allCheckedState;
    const checkboxes = checkerList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = allCheckedState);
}

function deleteSelectedTopics() {
    const checkboxes = checkerList.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert("Vui lòng tích chọn ít nhất một chủ đề để thực hiện thao tác xóa.");
        return;
    }

    if (confirm(`Bạn có chắc chắn muốn gỡ bỏ hoàn toàn ${checkboxes.length} chủ đề đã chọn khỏi bộ nhớ?`)) {
        checkboxes.forEach(cb => {
            const topicToDelete = cb.value;
            delete topicsData[topicToDelete];
            delete topicProgress[topicToDelete];
            if (topicUrls[topicToDelete]) delete topicUrls[topicToDelete];
        });

        allCheckedState = false;
        
        // Xác định chủ đề thay thế để kích hoạt sau khi chủ đề hiện tại bị xóa
        const remainingKeys = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp");
        let nextActiveTopic = "";
        if (remainingKeys.length > 0) {
            nextActiveTopic = remainingKeys.includes(currentTopicName) ? currentTopicName : remainingKeys[0];
        }

        updateSelectDropdown(nextActiveTopic);
        saveProgressToStorage();
        alert("Đã gỡ bỏ thành công dữ liệu các chủ đề được lựa chọn.");
    }
}

// === 8. Tính năng: Ôn tập tổng hợp kết hợp nhiều chủ đề ===
function checkGlobalReviewButtonState() {
    if (!startReviewBtn) return;
    // Chỉ kích hoạt nút nếu có ít nhất 1 chủ đề đã thực sự tải xong từ vựng về bộ nhớ
    const loadedTopics = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp" && topicsData[k] && topicsData[k].length > 0);
    startReviewBtn.disabled = (loadedTopics.length === 0);
}

function startGlobalReview() {
    // Thu thập toàn bộ các từ thuộc những chủ đề ĐÃ ĐƯỢC TẢI dữ liệu về hệ thống
    const loadedTopics = Object.keys(topicsData).filter(k => k !== "🔄 Ôn tập tổng hợp" && topicsData[k] && topicsData[k].length > 0);
    
    if (loadedTopics.length === 0) {
        alert("Không tìm thấy dữ liệu từ vựng khả dụng để tạo danh sách ôn tập.");
        return;
    }

    let globalPool = [];
    loadedTopics.forEach(topic => {
        globalPool = globalPool.concat(topicsData[topic]);
    });

    // Trộn ngẫu nhiên toàn bộ kho từ vựng tổng hợp
    for (let i = globalPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [globalPool[i], globalPool[j]] = [globalPool[j], globalPool[i]];
    }

    // Cắt bớt danh sách từ dựa trên số lượng người dùng cấu hình giới hạn học
    const limitCount = parseInt(reviewCountSelect.value, 10);
    if (limitCount > 0 && globalPool.length > limitCount) {
        globalPool = globalPool.slice(0, limitCount);
    }

    // Đăng ký tạo một "Chủ đề giả lập" phục vụ riêng tiến trình ôn tập
    const reviewSessionName = "🔄 Ôn tập tổng hợp";
    topicsData[reviewSessionName] = globalPool;
    topicProgress[reviewSessionName] = 0;

    // Đưa tùy chọn này vào trực tiếp phần select và kích hoạt chạy
    let reviewOption = listSelect.querySelector(`option[value="${reviewSessionName}"]`);
    if (!reviewOption) {
        reviewOption = document.createElement('option');
        reviewOption.value = reviewSessionName;
        listSelect.appendChild(reviewOption);
    }
    reviewOption.textContent = `${reviewSessionName} (${globalPool.length} từ)`;
    
    listSelect.value = reviewSessionName;
    switchTopic();

    // Thu gọn bảng điều khiển checklist nếu đang mở để tránh vướng màn hình học
    if (checkerPanel) checkerPanel.classList.add('hidden');
}

// === 9. Đồng bộ lưu và tải dữ liệu qua LocalStorage trình duyệt ===
function saveProgressToStorage() {
    // Tránh lưu dữ liệu tạm thời của phiên Ôn tập tổng hợp vào bộ nhớ vĩnh viễn
    const cleanTopicsData = { ...topicsData };
    const cleanTopicProgress = { ...topicProgress };
    delete cleanTopicsData["🔄 Ôn tập tổng hợp"];
    delete cleanTopicProgress["🔄 Ôn tập tổng hợp"];

    localStorage.setItem('flashcard_topics_data', JSON.stringify(cleanTopicsData));
    localStorage.setItem('flashcard_topic_progress', JSON.stringify(cleanTopicProgress));
    localStorage.setItem('flashcard_topic_urls', JSON.stringify(topicUrls));
    if (currentTopicName && currentTopicName !== "🔄 Ôn tập tổng hợp") {
        localStorage.setItem('flashcard_current_topic', currentTopicName);
    }
}

function loadProgressFromStorage() {
    try {
        const storedData = localStorage.getItem('flashcard_topics_data');
        const storedProgress = localStorage.getItem('flashcard_topic_progress');
        const storedUrls = localStorage.getItem('flashcard_topic_urls');
        const storedCurrent = localStorage.getItem('flashcard_current_topic');

        if (storedData && storedProgress) {
            topicsData = JSON.parse(storedData);
            topicProgress = JSON.parse(storedProgress);
            if (storedUrls) topicUrls = JSON.parse(storedUrls);

            const keys = Object.keys(topicsData);
            if (keys.length > 0) {
                fileLabel.textContent = `💾 Đã khôi phục tiến trình học từ bộ nhớ máy`;
                const activeTopic = (storedCurrent && keys.includes(storedCurrent)) ? storedCurrent : keys[0];
                updateSelectDropdown(activeTopic);
                return true;
            }
        }
    } catch (e) {
        console.error("Lỗi đọc dữ liệu từ LocalStorage máy cục bộ:", e);
    }
    return false;
}

// Xóa toàn bộ lịch sử học tập để reset lại ứng dụng từ đầu
function clearSavedData() {
    if (confirm("Hành động này sẽ xóa toàn bộ từ vựng đã nạp cùng tiến trình học hiện tại của tất cả chủ đề. Bạn có chắc chắn muốn làm mới?")) {
        localStorage.clear();
        topicsData = {};
        topicProgress = {};
        topicUrls = {};
        resetToEmptyState();
        alert("Đã xóa sạch bộ nhớ. Trình duyệt sẽ tự động tải lại.");
        window.location.reload();
    }
}

// === 10. Quản lý Sự kiện phím tắt Bàn phím máy tính ===
document.addEventListener('keydown', (e) => {
    if (flashcards.length === 0) return;
    
    // Bỏ qua phím tắt nếu người dùng đang thao tác nhập liệu bên trong các thẻ cấu hình hoặc nút bấm
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
        e.preventDefault(); // Chặn hành vi cuộn trang mặc định của phím cách
        flipCard();
    } else if (e.code === 'ArrowRight') {
        nextCard();
    } else if (e.code === 'ArrowLeft') {
        prevCard();
    } else if (e.code === 'KeyV' || e.code === 'KeyV') {
        speakWord(); // Phím tắt nhanh "V" lệnh phát âm tiếng Anh
    }
});

// === 11. KHỞI CHẠY ỨNG DỤNG KHI TẢI TRANG XONG ===
window.addEventListener('DOMContentLoaded', () => {
    const hasSavedData = loadProgressFromStorage();

    // Nếu bộ nhớ trống (Lần đầu chạy trang), kết nối API Index để lấy danh mục chủ đề tối ưu theo cấu trúc gọn
    if (!hasSavedData) {
        fileLabel.textContent = `⏳ Đang tải danh mục chủ đề từ máy chủ...`;
        
        // Trỏ thẳng tới liên kết tệp mục lục chính trên GitHub của bạn
        const indexApiUrl = 'https://raw.githubusercontent.com/nghia46/English_Flashcard/refs/heads/master/English-words.json'; 

        fetch(indexApiUrl)
            .then(response => {
                if (!response.ok) throw new Error("Không thể tải cấu hình danh mục chủ đề.");
                return response.json();
            })
            .then(indexData => {
                // Giải mã phân tách cấu trúc: baseUrl và danh sách tệp tin ngắn gọn
                const baseUrl = indexData.baseUrl || "";
                const topics = indexData.topics || {};

                topicUrls = {};
                topicsData = {};

                // Tự động ghép nối chuỗi đường dẫn tạo ra link Raw GitHub chính xác cho từng tệp
                Object.keys(topics).forEach(topic => {
                    topicUrls[topic] = baseUrl + topics[topic];
                    topicsData[topic] = []; // Khởi tạo mảng rỗng chờ người dùng kích hoạt tải (Lazy Loading)
                    if (topicProgress[topic] === undefined) {
                        topicProgress[topic] = 0;
                    }
                });

                const keys = Object.keys(topicsData);
                if (keys.length > 0) {
                    fileLabel.textContent = `📁 Đã đồng bộ danh mục hệ thống thành công`;
                    updateSelectDropdown(keys[0]); // Nạp giao diện và bắt đầu chạy chủ đề mặc định đầu tiên
                } else {
                    resetToEmptyState();
                }
            })
            .catch(error => {
                console.error("Lỗi đồng bộ API danh mục hệ thống:", error);
                fileLabel.textContent = `❌ Không tìm thấy danh sách mặc định hệ thống`;
                resetToEmptyState();
            });
    }
});