// アプリケーション状態管理
let state = {
    user: { id: null, mainType: null, subType: null },
    tasks: [],
    running: { taskId: null, startedAt: null, paused: false },
    csrfToken: csrfToken,
};

// API通信ラッパー
async function api(url, method = 'GET', body = null) {
    const opt = { method, headers: { 'X-CSRFToken': csrfToken } };
    if (body) {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(body);
    }
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}

// ユーティリティ関数
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

function getImportanceColor(importance) {
    const colors = ['text-muted', 'text-info', 'text-warning', 'text-danger'];
    return colors[importance] || 'text-muted';
}

function getStatusIcon(status) {
    const icons = {
        'todo': 'bi-circle',
        'doing': 'bi-play-circle-fill text-success',
        'done': 'bi-check-circle-fill text-success'
    };
    return icons[status] || 'bi-circle';
}

// プログレスリング更新
function updateProgressRing(actual, target) {
    const percent = Math.min((actual / target) * 100, 100);
    const circle = document.getElementById('progressCircle');
    const text = document.getElementById('progressPercent');
    
    if (circle) {
        const circumference = 2 * Math.PI * 50;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }
    
    if (text) {
        text.textContent = `${Math.round(percent)}%`;
    }
}

// タスクリスト描画
function renderTaskList() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    
    if (state.tasks.length === 0) {
        taskList.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-list-task" style="font-size: 2rem;"></i>
                <p class="mt-2">タスクがありません</p>
            </div>
        `;
        return;
    }
    
    const tasksHtml = state.tasks.map(task => {
        const isRunning = state.running.taskId === task.id;
        const statusClass = task.status === 'doing' ? 'doing' : task.status === 'done' ? 'done' : '';
        
        return `
            <div class="task-item p-3 ${statusClass}" data-task-id="${task.id}">
                <div class="row align-items-center">
                    <div class="col">
                        <div class="d-flex align-items-center">
                            <i class="bi ${getStatusIcon(task.status)} me-2"></i>
                            <div>
                                <h6 class="mb-1">${task.title}</h6>
                                <div class="small text-muted">
                                    ${task.deadline ? `期限: ${formatDate(task.deadline)}` : ''}
                                    ${task.estimate_min > 0 ? `・予想: ${task.estimate_min}分` : ''}
                                    ${task.tags ? `・${task.tags}` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-auto task-actions">
                        ${task.status === 'todo' ? `
                            <button class="btn btn-success btn-sm me-1" onclick="startTask(${task.id})">
                                <i class="bi bi-play-fill"></i> 開始
                            </button>
                        ` : ''}
                        ${task.status === 'doing' ? `
                            <button class="btn btn-warning btn-sm me-1" onclick="stopTask(${task.id})">
                                <i class="bi bi-pause-fill"></i> 停止
                            </button>
                        ` : ''}
                        ${task.status !== 'done' ? `
                            <button class="btn btn-primary btn-sm me-1" onclick="completeTask(${task.id})">
                                <i class="bi bi-check-lg"></i> 完了
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-secondary btn-sm me-1" onclick="toggleTaskDetails(${task.id})">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteTask(${task.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="collapse mt-3" id="taskDetails${task.id}">
                    <div class="collapse-content p-3">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>サブタスク</h6>
                                <div id="subtasks${task.id}">
                                    ${task.subtasks.map(subtask => `
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" 
                                                   id="subtask${subtask.id}" ${subtask.done ? 'checked' : ''}
                                                   onchange="updateSubtask(${task.id}, ${subtask.id}, this.checked)">
                                            <label class="form-check-label" for="subtask${subtask.id}">
                                                ${subtask.title}
                                            </label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6>メモ</h6>
                                <textarea class="form-control" rows="3" placeholder="メモを入力..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    taskList.innerHTML = tasksHtml;
}

// 今の一手カード更新
function updateNowCard() {
    const nowCard = document.getElementById('nowCard');
    if (!nowCard) return;
    
    if (!state.user.mainType) {
        nowCard.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-question-circle" style="font-size: 2rem;"></i>
                <p class="mt-2">診断を受けてあなたのタイプを確認しましょう</p>
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#diagModal">
                    <i class="bi bi-clipboard-check"></i> 診断を開始
                </button>
            </div>
        `;
        return;
    }
    
    const typeMessages = {
        'planner': {
            title: 'プランナータイプ',
            message: '計画的にタスクを進めましょう。今日の優先順位を確認してください。',
            icon: 'bi-calendar-check',
            color: 'primary'
        },
        'sprinter': {
            title: 'スプリンタータイプ',
            message: '短時間集中で効率的にタスクをこなしましょう。25分集中セッションを試してみてください。',
            icon: 'bi-lightning-charge',
            color: 'warning'
        },
        'flow': {
            title: 'フロータイプ',
            message: 'リラックスして自然な流れで作業しましょう。無理のないペースを保ってください。',
            icon: 'bi-water',
            color: 'info'
        }
    };
    
    const type = typeMessages[state.user.mainType];
    
    nowCard.innerHTML = `
        <div class="text-center">
            <i class="bi ${type.icon} text-${type.color}" style="font-size: 2rem;"></i>
            <h5 class="mt-2">${type.title}</h5>
            <p class="text-muted">${type.message}</p>
            <div class="mt-3">
                <button class="btn btn-outline-${type.color} btn-sm me-2" onclick="showSettings()">
                    <i class="bi bi-gear"></i> 設定
                </button>
                <button class="btn btn-outline-secondary btn-sm" onclick="retakeDiagnosis()">
                    <i class="bi bi-arrow-clockwise"></i> 再診断
                </button>
            </div>
        </div>
    `;
}

// 固定バー更新
function updateFocusBar() {
    const focusBar = document.getElementById('focusBar');
    const focusTaskName = document.getElementById('focusTaskName');
    const focusTimer = document.getElementById('focusTimer');
    
    if (!state.running.taskId) {
        focusBar.style.display = 'none';
        return;
    }
    
    const task = state.tasks.find(t => t.id === state.running.taskId);
    if (!task) return;
    
    focusBar.style.display = 'block';
    focusTaskName.textContent = task.title;
    
    // タイマー更新
    if (state.running.startedAt && !state.running.paused) {
        const elapsed = Math.floor((Date.now() - new Date(state.running.startedAt).getTime()) / 1000);
        focusTimer.textContent = formatTime(elapsed);
    }
}

// タイマー更新（requestAnimationFrame）
function updateTimer() {
    if (state.running.taskId && state.running.startedAt && !state.running.paused) {
        updateFocusBar();
    }
    requestAnimationFrame(updateTimer);
}

// タスク操作
async function startTask(taskId) {
    try {
        const response = await api(`/api/tasks/${taskId}/start/`, 'POST');
        state.running.taskId = taskId;
        state.running.startedAt = response.started_at;
        state.running.paused = false;
        
        // タスク状態更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'doing';
            task.started_at = response.started_at;
        }
        
        renderTaskList();
        updateFocusBar();
    } catch (error) {
        console.error('タスク開始エラー:', error);
        alert('タスクの開始に失敗しました');
    }
}

async function stopTask(taskId) {
    try {
        const response = await api(`/api/tasks/${taskId}/stop/`, 'POST');
        state.running.paused = true;
        
        // タスク状態更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'todo';
            task.started_at = null;
        }
        
        renderTaskList();
        updateFocusBar();
    } catch (error) {
        console.error('タスク停止エラー:', error);
        alert('タスクの停止に失敗しました');
    }
}

async function completeTask(taskId) {
    try {
        const response = await api(`/api/tasks/${taskId}/complete/`, 'POST');
        
        // 実行中なら停止
        if (state.running.taskId === taskId) {
            state.running.taskId = null;
            state.running.startedAt = null;
            state.running.paused = false;
        }
        
        // タスク状態更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'done';
            task.completed_at = response.completed_at;
        }
        
        renderTaskList();
        updateFocusBar();
        loadMetrics();
    } catch (error) {
        console.error('タスク完了エラー:', error);
        alert('タスクの完了に失敗しました');
    }
}

async function deleteTask(taskId) {
    if (!confirm('このタスクを削除しますか？')) return;
    
    try {
        await api(`/api/tasks/${taskId}/delete/`, 'POST');
        
        // 実行中なら停止
        if (state.running.taskId === taskId) {
            state.running.taskId = null;
            state.running.startedAt = null;
            state.running.paused = false;
        }
        
        // タスクリストから削除
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        
        renderTaskList();
        updateFocusBar();
    } catch (error) {
        console.error('タスク削除エラー:', error);
        alert('タスクの削除に失敗しました');
    }
}

// タスク詳細の開閉
function toggleTaskDetails(taskId) {
    const details = document.getElementById(`taskDetails${taskId}`);
    if (details) {
        const bsCollapse = new bootstrap.Collapse(details, { toggle: true });
    }
}

// サブタスク更新
async function updateSubtask(taskId, subtaskId, done) {
    try {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
            subtask.done = done;
        }
        
        await api(`/api/subtasks/${taskId}/bulk_upsert/`, 'POST', {
            subtasks: task.subtasks.map(s => ({ id: s.id, done: s.done }))
        });
    } catch (error) {
        console.error('サブタスク更新エラー:', error);
    }
}

// 新規タスク作成
async function createTask() {
    const title = document.getElementById('taskTitle').value;
    const deadline = document.getElementById('taskDeadline').value;
    const estimate = parseInt(document.getElementById('taskEstimate').value) || 0;
    const tags = document.getElementById('taskTags').value;
    const importance = parseInt(document.getElementById('taskImportance').value) || 0;
    
    if (!title.trim()) {
        alert('タイトルを入力してください');
        return;
    }
    
    try {
        const response = await api('/api/tasks/create/', 'POST', {
            title: title.trim(),
            deadline: deadline || null,
            estimate_min: estimate,
            tags: tags.trim(),
            importance: importance
        });
        
        // フォームリセット
        document.getElementById('taskForm').reset();
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
        modal.hide();
        
        // タスクリストを再読み込み
        loadTasks();
    } catch (error) {
        console.error('タスク作成エラー:', error);
        alert('タスクの作成に失敗しました');
    }
}

// メトリクス読み込み
async function loadMetrics() {
    try {
        const response = await api('/api/metrics/summary/?range=day');
        updateProgressRing(response.ring.actual, response.ring.target);
        document.getElementById('streakCount').textContent = response.streak.days;
    } catch (error) {
        console.error('メトリクス読み込みエラー:', error);
    }
}

// タスクリスト読み込み
async function loadTasks() {
    try {
        const response = await api('/api/tasks/');
        state.tasks = response.tasks;
        renderTaskList();
    } catch (error) {
        console.error('タスク読み込みエラー:', error);
    }
}

// プロフィール読み込み
async function loadProfile() {
    try {
        const response = await api('/api/profile/');
        state.user = {
            id: null, // ユーザーIDは必要に応じて設定
            mainType: response.main_type,
            subType: response.sub_type
        };
        updateNowCard();
    } catch (error) {
        console.error('プロフィール読み込みエラー:', error);
    }
}

// 診断関連
function startDiagnosis() {
    const diagContent = document.getElementById('diagContent');
    diagContent.innerHTML = `
        <div class="progress-indicator">
            <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div id="diagnosisQuestions">
            ${getDiagnosisQuestions()}
        </div>
    `;
    
    showDiagnosisQuestion(1);
}

function getDiagnosisQuestions() {
    const questions = [
        {
            q: 1,
            text: "新しいプロジェクトを始める時、あなたはどうしますか？",
            options: [
                { key: "A", text: "詳細な計画を立ててから始める" },
                { key: "B", text: "とりあえず始めてみて調整する" },
                { key: "C", text: "気分が乗った時に自然に始める" }
            ]
        },
        {
            q: 2,
            text: "締切が迫っている時、あなたは？",
            options: [
                { key: "A", text: "スケジュールを確認して計画的に進める" },
                { key: "B", text: "集中して一気に仕上げる" },
                { key: "C", text: "焦らずに自分のペースで進める" }
            ]
        },
        {
            q: 3,
            text: "作業中に中断された時、あなたは？",
            options: [
                { key: "A", text: "中断前の状況を記録して後で再開する" },
                { key: "B", text: "中断を無視して作業を続ける" },
                { key: "C", text: "中断を受け入れて別の作業に移る" }
            ]
        },
        {
            q: 4,
            text: "複数のタスクがある時、あなたは？",
            options: [
                { key: "A", text: "優先順位を決めて順番に処理する" },
                { key: "B", text: "最も興味のあるものから始める" },
                { key: "C", text: "気分に応じて選んで取り組む" }
            ]
        },
        {
            q: 5,
            text: "作業環境について、あなたは？",
            options: [
                { key: "A", text: "整理整頓された環境を好む" },
                { key: "B", text: "集中できる環境なら多少散らかっていてもOK" },
                { key: "C", text: "自然な環境でリラックスして作業したい" }
            ]
        },
        {
            q: 6,
            text: "新しいスキルを学ぶ時、あなたは？",
            options: [
                { key: "A", text: "体系的に基礎から学ぶ" },
                { key: "B", text: "実践しながら覚える" },
                { key: "C", text: "興味のある部分から学ぶ" }
            ]
        },
        {
            q: 7,
            text: "目標達成について、あなたは？",
            options: [
                { key: "A", text: "具体的な数値目標を設定する" },
                { key: "B", text: "短期間で集中して達成する" },
                { key: "C", text: "無理のない範囲で継続する" }
            ]
        }
    ];
    
    return questions.map(q => `
        <div class="diagnosis-question" id="question${q.q}">
            <h5>質問 ${q.q}/7</h5>
            <p class="mb-4">${q.text}</p>
            <div class="d-grid gap-2">
                ${q.options.map(opt => `
                    <button class="btn btn-outline-primary text-start" onclick="selectAnswer(${q.q}, '${opt.key}')">
                        ${opt.key}. ${opt.text}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

let diagnosisAnswers = [];

function showDiagnosisQuestion(qNum) {
    // 全ての質問を非表示
    document.querySelectorAll('.diagnosis-question').forEach(q => q.classList.remove('active'));
    
    // 指定の質問を表示
    const question = document.getElementById(`question${qNum}`);
    if (question) {
        question.classList.add('active');
    }
    
    // プログレスバー更新
    const progress = ((qNum - 1) / 7) * 100;
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

function selectAnswer(qNum, choice) {
    diagnosisAnswers[qNum - 1] = { q_index: qNum, choice: choice };
    
    if (qNum < 7) {
        showDiagnosisQuestion(qNum + 1);
    } else {
        submitDiagnosis();
    }
}

async function submitDiagnosis() {
    try {
        const response = await api('/api/diagnosis/submit/', 'POST', {
            answers: diagnosisAnswers
        });
        
        // プロフィール更新
        state.user.mainType = response.main_type;
        state.user.subType = response.sub_type;
        
        // 今の一手カード更新
        updateNowCard();
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('diagModal'));
        modal.hide();
        
        // 診断結果を表示
        showDiagnosisResult(response.main_type, response.sub_type);
        
    } catch (error) {
        console.error('診断送信エラー:', error);
        alert('診断の送信に失敗しました');
    }
}

function showDiagnosisResult(mainType, subType) {
    const typeNames = {
        'planner': 'プランナー',
        'sprinter': 'スプリンター',
        'flow': 'フロー'
    };
    
    const result = `
        <div class="alert alert-success">
            <h5>診断結果</h5>
            <p>あなたのタイプ: <strong>${typeNames[mainType]}</strong></p>
            ${subType ? `<p>サブタイプ: <strong>${subType}</strong></p>` : ''}
        </div>
    `;
    
    // 結果を表示（例：ページ上部に一時的に表示）
    const container = document.querySelector('.container');
    if (container) {
        const resultDiv = document.createElement('div');
        resultDiv.innerHTML = result;
        container.insertBefore(resultDiv, container.firstChild);
        
        // 3秒後に削除
        setTimeout(() => resultDiv.remove(), 3000);
    }
}

// 設定関連
function showSettings() {
    const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
    modal.show();
}

function retakeDiagnosis() {
    diagnosisAnswers = [];
    const modal = new bootstrap.Modal(document.getElementById('diagModal'));
    modal.show();
    startDiagnosis();
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', function() {
    // 初期データ読み込み
    loadProfile();
    loadTasks();
    loadMetrics();
    
    // タイマー開始
    requestAnimationFrame(updateTimer);
    
    // イベントリスナー
    document.getElementById('saveTaskBtn')?.addEventListener('click', createTask);
    document.getElementById('startDiagnosisBtn')?.addEventListener('click', startDiagnosis);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        // 設定保存処理
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        modal.hide();
    });
    
    // 固定バーのボタン
    document.getElementById('focusStopBtn')?.addEventListener('click', () => {
        if (state.running.taskId) {
            if (state.running.paused) {
                // 再開
                state.running.paused = false;
                state.running.startedAt = new Date().toISOString();
            } else {
                // 停止
                stopTask(state.running.taskId);
            }
        }
    });
    
    document.getElementById('focusCompleteBtn')?.addEventListener('click', () => {
        if (state.running.taskId) {
            completeTask(state.running.taskId);
        }
    });
});
