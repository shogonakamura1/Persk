// アプリケーション状態管理
let state = {
    user: { id: null, mainType: null, subType: null },
    tasks: [],
    running: { taskId: null, startedAt: null, paused: false, totalSeconds: 0, pausedSeconds: 0 },
    runningSubtask: { subtaskId: null, startedAt: null, paused: false, totalSeconds: 0, pausedSeconds: 0 },
    csrfToken: typeof csrfToken !== 'undefined' ? csrfToken : '',
    sort: {
        autoSort: false,
        currentType: 'planner',
        lastSortedAt: null,
        isSorted: false  // ソート済みかどうかのフラグ
    }
};

// API通信ラッパー
async function api(url, method = 'GET', body = null) {
    const opt = { method, headers: { 'X-CSRFToken': csrfToken } };
    if (body) {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(body);
    }
    
    console.log(`API Call: ${method} ${url}`, body);
    
    const r = await fetch(url, opt);
    if (!r.ok) {
        const errorText = await r.text();
        console.error(`API Error: ${r.status} ${r.statusText}`, errorText);
        
        // 401エラー（認証エラー）の場合はログアウト状態とみなす
        if (r.status === 401) {
            console.log('User is not authenticated, redirecting to login');
            window.location.href = '/login/';
            return;
        }
        
        throw new Error(errorText);
    }
    const response = await r.json();
    console.log(`API Response:`, response);
    return response;
}

// タスクタイマー更新
function updateTaskTimers() {
    state.tasks.forEach(task => {
        if (task.status === 'doing' || task.status === 'paused') {
            const timerElement = document.getElementById(`taskTimer${task.id}`);
            if (timerElement) {
                let totalSeconds = 0;
                let shouldUpdate = true;
                
                if (state.running.taskId === task.id) {
                    // 現在実行中のタスク
                    if (state.running.startedAt) {
                        if (state.running.paused) {
                            // 一時停止状態の場合は記録された経過時間を使用
                            totalSeconds = state.running.pausedSeconds || 0;
                        } else {
                            // 実行中の場合は現在時刻から計算
                            const now = new Date();
                            const startedAt = new Date(state.running.startedAt);
                            totalSeconds = Math.floor((now - startedAt) / 1000);
                        }
                    }
                } else if (task.status === 'paused') {
                    // 一時停止状態のタスク（現在実行中ではない）は表示を更新しない
                    shouldUpdate = false;
                } else if (task.started_at && task.status === 'doing') {
                    // 実行中のタスク（現在実行中ではない）の場合のみ時間計算
                    const startedAt = new Date(task.started_at);
                    const now = new Date();
                    totalSeconds = Math.floor((now - startedAt) / 1000);
                }
                
                if (shouldUpdate) {
                    timerElement.textContent = formatTime(totalSeconds);
                }
            }
        }
    });
}

// 完了済みタスクの実際の時間を更新
async function updateCompletedTaskTimes() {
    const completedTasks = state.tasks.filter(task => task.status === 'done');
    
    for (const task of completedTasks) {
        try {
            const response = await api(`/api/tasks/${task.id}/focus-time/`);
            if (response.ok) {
                const actualMinutes = Math.ceil(response.total_seconds / 60);
                const timeElement = document.getElementById(`actualTime${task.id}`);
                if (timeElement) {
                    timeElement.textContent = `${actualMinutes}分`;
                }
            }
        } catch (error) {
            console.error(`タスク ${task.id} の実際の時間取得エラー:`, error);
        }
    }
}

// 進捗表示更新
function updateProgress() {
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(task => task.status === 'done').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // 進捗パーセンテージ更新
    const progressPercentElement = document.getElementById('progressPercent');
    if (progressPercentElement) {
        progressPercentElement.textContent = `${progressPercent}%`;
    }
    
    // 進捗説明更新
    const progressDescriptionElement = document.getElementById('progressDescription');
    if (progressDescriptionElement) {
        progressDescriptionElement.textContent = `${completedTasks}個のタスクを完了`;
    }
    
    // 進捗リングのアニメーション更新
    const progressCircle = document.querySelector('.progress-ring .progress');
    if (progressCircle) {
        const circumference = 2 * Math.PI * 50; // r=50
        const offset = circumference - (progressPercent / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
    }
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
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRemainingTime(dateString) {
    if (!dateString) return '';
    const deadline = new Date(dateString);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff < 0) {
        // 期限超過
        const overdueDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
        const overdueHours = Math.floor((Math.abs(diff) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `<span class="text-danger">超過 ${overdueDays}日${overdueHours}時間</span>`;
    } else {
        // 残り時間
        const remainingDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (remainingDays > 0) {
            return `<span class="text-info">残り ${remainingDays}日${remainingHours}時間</span>`;
        } else if (remainingHours > 0) {
            return `<span class="text-warning">残り ${remainingHours}時間${remainingMinutes}分</span>`;
        } else {
            return `<span class="text-danger">残り ${remainingMinutes}分</span>`;
        }
    }
}

function getImportanceColor(importance) {
    const colors = ['text-muted', 'text-info', 'text-warning', 'text-danger'];
    return colors[importance] || 'text-muted';
}

function getImportanceBadge(importance) {
    const colors = ['secondary', 'info', 'warning', 'danger'];
    const labels = ['低', '中', '高', '最高'];
    const color = colors[importance] || 'secondary';
    const label = labels[importance] || '?';
    
    return `<span class="badge bg-${color} importance-badge">${label}</span>`;
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
    
    // デバッグ: レンダリング時のタスク情報
    console.log('renderTaskList - state.tasks:', state.tasks);
    const doneTasks = state.tasks.filter(task => task.status === 'done');
    console.log('renderTaskList - 完了したタスク:', doneTasks);
    
    // 現在開いている詳細画面を記憶
    const openDetails = [];
    state.tasks.forEach(task => {
        const details = document.getElementById(`taskDetails${task.id}`);
        if (details) {
            const bsCollapseInstance = bootstrap.Collapse.getInstance(details);
            if (bsCollapseInstance && bsCollapseInstance._isShown()) {
                openDetails.push(task.id);
            }
        }
    });
    
    if (state.tasks.length === 0) {
        taskList.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-list-task" style="font-size: 3rem; opacity: 0.3;"></i>
                <p class="mt-3">タスクがありません</p>
                <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#taskModal">
                    最初のタスクを作成
                </button>
            </div>
        `;
        return;
    }
    
    const tasksHtml = state.tasks.map(task => {
        const isRunning = state.running.taskId === task.id;
        const statusClass = task.status === 'doing' ? 'doing' : task.status === 'done' ? 'done' : '';
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        
        // デバッグ: 各タスクの情報
        console.log(`タスク ${task.id} (${task.title}) - status: ${task.status}, hasSubtasks: ${hasSubtasks}`);
        
        // 重要度に基づくクラス名を決定
        const priorityClass = task.importance >= 2 ? 'priority-high' : task.importance >= 1 ? 'priority-medium' : 'priority-low';
        
        // タグを配列に分割
        const tags = task.tags ? task.tags.split(',').map(tag => tag.trim()) : [];
        
        // タグのデバッグ
        console.log(`タスク ${task.id} のタグ処理:`, {
            originalTags: task.tags,
            parsedTags: tags
        });
        
        // タグのHTML生成
        const tagsHtml = tags.map(tag => {
            const tagClass = tag.toLowerCase().includes('デザイン') || tag.toLowerCase().includes('重要') ? 'tag-design' :
                           tag.toLowerCase().includes('会議') ? 'tag-meeting' :
                           tag.toLowerCase().includes('開発') || tag.toLowerCase().includes('技術') ? 'tag-development' : 'tag-design';
            return `<span class="task-tag ${tagClass}">${tag}</span>`;
        }).join('');
        
        console.log(`タスク ${task.id} のタグHTML:`, tagsHtml);
        
        return `
            <div class="task-card ${priorityClass} task-item" data-task-id="${task.id}">
                <div class="task-content" onclick="toggleTaskDetails(${task.id})" style="cursor: pointer;">
                    <div class="d-flex align-items-center flex-grow-1">
                        <div class="task-drag-handle me-2" style="cursor: grab; color: #ccc;" onclick="event.stopPropagation();">
                            <i class="bi bi-grip-vertical"></i>
                        </div>
                        <div class="task-checkbox" onclick="event.stopPropagation();">
                            <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} 
                                   onchange="toggleTaskStatus(${task.id}, this.checked)">
                        </div>
                        <div class="task-info flex-grow-1 ms-3">
                            <div class="task-title">${task.title}</div>
                            <div class="task-meta-info d-flex align-items-center gap-2">
                                ${getImportanceBadge(task.importance)}
                                ${tags.length > 0 ? `<div class="task-tags">${tagsHtml}</div>` : ''}
                            </div>
                            <div class="task-meta">
                                ${task.deadline ? `
                                    <div class="task-date">
                                        <i class="bi bi-calendar"></i>
                                        ${new Date(task.deadline).toLocaleDateString('ja-JP')}
                                        ${formatDeadlineDisplay(task.deadline)}
                                    </div>
                                ` : ''}
                                ${task.estimate_min > 0 ? `
                                    <div class="task-time">
                                        <i class="bi bi-clock"></i>
                                        ${task.status === 'done' ? `<span id="actualTime${task.id}">${task.estimate_min}分</span>` : `${task.estimate_min}分`}
                                    </div>
                                ` : ''}
                                ${(task.status === 'doing' || task.status === 'paused') ? `
                                    <div class="task-timer">
                                        <i class="bi bi-stopwatch"></i>
                                        <span id="taskTimer${task.id}">00:00:00</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="task-actions" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important; flex-shrink: 0;">
                        ${task.status === 'todo' ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); startTask(${task.id})" title="開始" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-play-fill"></i>
                            </button>
                        ` : ''}
                        ${task.status === 'doing' ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); pauseTask(${task.id})" title="一時停止" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-pause-fill"></i>
                            </button>
                        ` : ''}
                        ${task.status === 'paused' ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); resumeTask(${task.id})" title="再開" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-play-fill"></i>
                            </button>
                        ` : ''}
                        ${(task.status === 'doing' || task.status === 'paused') ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); resetTaskTimer(${task.id})" title="リセット" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        ` : ''}
                        ${task.status !== 'done' ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); completeTask(${task.id})" title="完了" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-check-lg"></i>
                            </button>
                        ` : ''}
                        ${task.status === 'done' ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); shareTask(${task.id})" title="${task.shared ? '共有中' : '共有'}" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-share${task.shared ? '-fill' : ''}"></i>
                            </button>
                        ` : ''}
                        <button class="task-action-btn" onclick="event.stopPropagation(); deleteTask(${task.id})" title="削除" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                            <i class="bi bi-trash"></i>
                        </button>
                        ${hasSubtasks ? `
                            <button class="task-action-btn" onclick="event.stopPropagation(); toggleTaskDetails(${task.id})" title="詳細" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                                <i class="bi bi-chevron-down"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="collapse mt-3" id="taskDetails${task.id}">
                    <div class="collapse-content p-3" onclick="event.stopPropagation();">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>サブタスク</h6>
                                </div>
                                <div id="subtasks${task.id}">
                                    ${task.subtasks.map(subtask => `
                                        <div class="subtask-item">
                                            <div class="d-flex align-items-center">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" 
                                                           id="subtask${subtask.id}" ${subtask.done ? 'checked' : ''}
                                                           onchange="event.stopPropagation(); updateSubtask(${task.id}, ${subtask.id}, this.checked)"
                                                           onclick="event.stopPropagation();">
                                                    <label class="form-check-label" for="subtask${subtask.id}" onclick="event.stopPropagation();" style="cursor: pointer;">
                                                        ${subtask.title}
                                                    </label>
                                                </div>
                                            </div>
                                                <!-- サブタスクタイマー機能を一時無効化
                                                <div class="subtask-actions">
                                                    ${subtask.status === 'todo' ? `
                                                        <button class="btn btn-success btn-sm me-1" onclick="event.stopPropagation(); startSubtask(${subtask.id})">
                                                            <i class="bi bi-play-fill"></i> 開始
                                                        </button>
                                                    ` : ''}
                                                    ${subtask.status === 'doing' ? `
                                                        <button class="btn btn-warning btn-sm me-1" onclick="event.stopPropagation(); pauseSubtask(${subtask.id})">
                                                            <i class="bi bi-pause-fill"></i> 一時停止
                                                        </button>
                                                    ` : ''}
                                                    ${subtask.status === 'paused' ? `
                                                        <button class="btn btn-success btn-sm me-1" onclick="event.stopPropagation(); resumeSubtask(${subtask.id})">
                                                            <i class="bi bi-play-fill"></i> 再開
                                                        </button>
                                                    ` : ''}
                                                    ${(subtask.status === 'doing' || subtask.status === 'paused') ? `
                                                        <button class="btn btn-warning btn-sm me-1" onclick="event.stopPropagation(); resetSubtaskTimer(${subtask.id})">
                                                            <i class="bi bi-arrow-clockwise"></i> リセット
                                                        </button>
                                                    ` : ''}
                                                    ${subtask.status !== 'done' ? `
                                                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); completeSubtask(${subtask.id})">
                                                            <i class="bi bi-check-lg"></i> 完了
                                                        </button>
                                                    ` : ''}
                                                </div>
                                                -->
                                            </div>
                                            <!-- サブタスクタイマー表示を一時無効化
                                            ${subtask.status === 'doing' || subtask.status === 'paused' ? `
                                                <div class="subtask-timer mt-2" onclick="event.stopPropagation();">
                                                    <small class="text-muted">
                                                        タイマー: <span id="subtaskTimer${subtask.id}">00:00:00</span>
                                                        ${subtask.status === 'paused' ? ' <i class="bi bi-pause-fill"></i>' : ''}
                                                    </small>
                                                </div>
                                            ` : ''}
                                            -->
                                        </div>
                                    `).join('')}
                                </div>
                                <!-- サブタスク追加フォーム -->
                                <div class="input-group mt-3">
                                    <input type="text" class="form-control" id="newSubtask${task.id}" 
                                           placeholder="新しいサブタスクを入力"
                                           onclick="event.stopPropagation();">
                                    <button class="btn subtask-add-btn" onclick="event.stopPropagation(); addSubtask(${task.id})">
                                        <i class="bi bi-plus-lg"></i> 追加
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    taskList.innerHTML = tasksHtml;
    
    // 進捗表示を更新
    updateProgress();
    
    // タスクタイマーを更新
    updateTaskTimers();
    
    // デバッグ: 生成されたHTMLを確認
    console.log('生成されたHTML:', tasksHtml);
    
    // 記憶した詳細画面を再度開く
    openDetails.forEach(taskId => {
        setTimeout(() => {
            const details = document.getElementById(`taskDetails${taskId}`);
            if (details) {
                const bsCollapse = new bootstrap.Collapse(details, { show: true });
            }
        }, 50);
    });
    
    // Sortableを再初期化
    initializeSortable();
    
    // 完了済みタスクの実際の時間を更新
    updateCompletedTaskTimes();
    
    // ソート設定を更新
    updateSortUI();
    
    // ドラッグ&ドロップ機能を再初期化
    setTimeout(() => {
        initializeSortable();
    }, 100);
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



// タイマー更新（requestAnimationFrame）
function updateTimer() {
    requestAnimationFrame(updateTimer);
}

// 既存の実行中のタスク/サブタスクを停止
async function stopCurrentRunning(targetTaskId = null, targetSubtaskId = null) {
    // 実行中のサブタスクがある場合は停止（対象と異なる場合のみ）
    if (state.runningSubtask.subtaskId && state.runningSubtask.subtaskId !== targetSubtaskId) {
        console.log('Stopping current subtask:', state.runningSubtask.subtaskId);
        await pauseSubtask(state.runningSubtask.subtaskId);
    }
    
    // 実行中のタスクがある場合は停止（対象と異なる場合のみ）
    if (state.running.taskId && state.running.taskId !== targetTaskId) {
        console.log('Stopping current task:', state.running.taskId);
        await pauseTask(state.running.taskId);
    }
}

// タスク操作
async function startTask(taskId) {
    console.log('startTask called with taskId:', taskId);
    console.log('Current state:', state);
    
    try {
        // 既存の実行中のタスク/サブタスクを停止
        console.log('Stopping current running tasks...');
        await stopCurrentRunning(taskId);
        
        console.log('Making API call to start task...');
        const response = await api(`/api/tasks/${taskId}/start/`, 'POST');
        console.log('API response:', response);
        
        // バックエンドからの応答を正しく処理
        if (response.ok) {
            state.running.taskId = taskId;
            state.running.startedAt = response.started_at;
            state.running.paused = false;
            
            console.log('Task started with start time:', state.running.startedAt);
            console.log('Updated state:', state);
            
            // タスク状態更新
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'doing';
                task.started_at = response.started_at;
                console.log('Updated task:', task);
            } else {
                console.error('Task not found in state:', taskId);
            }
            
            console.log('Updating task buttons...');
            updateTaskButtons(taskId);
            console.log('Task buttons updated');
        } else {
            throw new Error(response.error || 'タスクの開始に失敗しました');
        }
    } catch (error) {
        console.error('タスク開始エラー:', error);
        console.error('Error stack:', error.stack);
        alert('タスクの開始に失敗しました: ' + error.message);
    }
}

async function pauseTask(taskId) {
    try {
        console.log('pauseTask called with taskId:', taskId);
        
        // 現在の経過時間を計算して記録
        let currentElapsedSeconds = 0;
        if (state.running.startedAt) {
            const startTime = new Date(state.running.startedAt);
            const now = new Date();
            currentElapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        
        console.log('Current elapsed time before pause:', currentElapsedSeconds, 'seconds');
        
        const response = await api(`/api/tasks/${taskId}/pause/`, 'POST');
        
        // バックエンドからの応答を正しく処理
        if (response.ok) {
            state.running.paused = true;
            
            // 一時停止時の経過時間を記録
            state.running.pausedSeconds = currentElapsedSeconds;
            
            console.log('Paused at elapsed time:', currentElapsedSeconds, 'seconds');
            
            // タスク状態更新
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'paused';
            }
            
            // タイマー表示を即座に更新（0を表示しないように）
            const timerElement = document.getElementById(`taskTimer${taskId}`);
            if (timerElement) {
                timerElement.textContent = formatTime(currentElapsedSeconds);
            }
            
            // ボタンの表示を更新
            updateTaskButtons(taskId);
        } else {
            throw new Error(response.error || 'タスクの一時停止に失敗しました');
        }
    } catch (error) {
        console.error('タスク一時停止エラー:', error);
        alert('タスクの一時停止に失敗しました: ' + error.message);
    }
}

async function resumeTask(taskId) {
    try {
        console.log('resumeTask called with taskId:', taskId);
        
        const response = await api(`/api/tasks/${taskId}/resume/`, 'POST');
        
        // バックエンドからの応答を正しく処理
        if (response.ok) {
            state.running.paused = false;
            
            // 記録された経過時間を使用して開始時間を調整
            const now = new Date();
            const adjustedStartTime = new Date(now.getTime() - (state.running.pausedSeconds * 1000));
            state.running.startedAt = adjustedStartTime.toISOString();
            
            console.log('Resumed with elapsed time:', state.running.pausedSeconds, 'seconds');
            console.log('Adjusted start time:', state.running.startedAt);
            
            // タスク状態更新
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'doing';
                task.started_at = state.running.startedAt;
            }
            
            // タイマー表示を即座に更新（0を表示しないように）
            const timerElement = document.getElementById(`taskTimer${taskId}`);
            if (timerElement) {
                timerElement.textContent = formatTime(state.running.pausedSeconds || 0);
            }
            
            // ボタンの表示を更新
            updateTaskButtons(taskId);
        } else {
            throw new Error(response.error || 'タスクの再開に失敗しました');
        }
    } catch (error) {
        console.error('タスク再開エラー:', error);
        alert('タスクの再開に失敗しました: ' + error.message);
    }
}

// タスクステータス切り替え
async function toggleTaskStatus(taskId, isCompleted) {
    try {
        const newStatus = isCompleted ? 'done' : 'todo';
        await api(`/api/tasks/${taskId}/update/`, 'POST', { status: newStatus });
        
        // ローカル状態を更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            if (newStatus === 'done') {
                task.completed_at = new Date().toISOString();
            } else {
                task.completed_at = null;
            }
        }
        
        renderTaskList();
    } catch (error) {
        console.error('タスクステータス更新エラー:', error);
        alert('タスクステータスの更新に失敗しました');
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
            state.running.totalSeconds = 0;
        }
        
        // タスク状態更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'done';
            task.completed_at = response.completed_at;
        }
        
        renderTaskList();
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
            state.running.totalSeconds = 0;
        }
        
        // タスクリストから削除
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        
        renderTaskList();
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

// タスクボタンの表示を更新
function updateTaskButtons(taskId) {
    console.log('updateTaskButtons called with taskId:', taskId);
    
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('Task not found in state:', taskId);
        return;
    }
    
    // タスクカード内のアクションボタンを更新
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskCard) {
        console.error('Task card not found in DOM:', taskId);
        return;
    }
    
    // タスクのメタ情報を更新
    updateTaskMeta(taskCard, task);
    
    const actionsContainer = taskCard.querySelector('.task-actions');
    if (!actionsContainer) {
        console.error('Task actions container not found:', taskId);
        return;
    }
    
    console.log('Found actions container, updating buttons...');
    
    // サブタスクの有無を確認
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // 既存のボタンを全て削除
    actionsContainer.innerHTML = '';
    
    // 開始/一時停止/再開ボタン
    if (task.status === 'todo') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); startTask(${taskId})" title="開始" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-play-fill"></i>
            </button>
        `;
    } else if (task.status === 'doing') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); pauseTask(${taskId})" title="一時停止" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-pause-fill"></i>
            </button>
        `;
    } else if (task.status === 'paused') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); resumeTask(${taskId})" title="再開" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-play-fill"></i>
            </button>
        `;
    }
    
    // リセットボタン（実行中または一時停止中の場合）
    if (task.status === 'doing' || task.status === 'paused') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); resetTaskTimer(${taskId})" title="リセット" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
        `;
    }
    
    // 完了ボタン（完了していない場合）
    if (task.status !== 'done') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); completeTask(${taskId})" title="完了" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-check-lg"></i>
            </button>
        `;
    }
    
    // 共有ボタン（完了している場合）
    if (task.status === 'done') {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); shareTask(${taskId})" title="${task.shared ? '共有中' : '共有'}" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-share${task.shared ? '-fill' : ''}"></i>
            </button>
        `;
    }
    
    // 削除ボタン
    actionsContainer.innerHTML += `
        <button class="task-action-btn" onclick="event.stopPropagation(); deleteTask(${taskId})" title="削除" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
            <i class="bi bi-trash"></i>
        </button>
    `;
    
    // 詳細ボタン（サブタスクがある場合）
    if (hasSubtasks) {
        actionsContainer.innerHTML += `
            <button class="task-action-btn" onclick="event.stopPropagation(); toggleTaskDetails(${taskId})" title="詳細" style="display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 10 !important;">
                <i class="bi bi-chevron-down"></i>
            </button>
        `;
    }
    
    console.log('Task buttons updated successfully');
}

// タスクのメタ情報を更新
function updateTaskMeta(taskCard, task) {
    const metaContainer = taskCard.querySelector('.task-meta');
    if (!metaContainer) {
        console.error('Task meta container not found');
        return;
    }
    
    // タグ情報を取得
    const tags = task.tags ? task.tags.split(',').map(tag => tag.trim()) : [];
    const tagsHtml = tags.map(tag => {
        const tagClass = tag.toLowerCase().includes('デザイン') || tag.toLowerCase().includes('重要') ? 'tag-design' :
                       tag.toLowerCase().includes('会議') ? 'tag-meeting' :
                       tag.toLowerCase().includes('開発') || tag.toLowerCase().includes('技術') ? 'tag-development' : 'tag-design';
        return `<span class="task-tag ${tagClass}">${tag}</span>`;
    }).join('');
    
    // 既存のタイマー要素を保存
    const existingTimer = metaContainer.querySelector('.task-timer');
    const existingTimerText = existingTimer ? existingTimer.textContent : null;
    
    // メタ情報のHTMLを生成
    let metaHtml = '';
    
    if (task.deadline) {
        metaHtml += `
            <div class="task-date">
                <i class="bi bi-calendar"></i>
                ${new Date(task.deadline).toLocaleDateString('ja-JP')}
                ${formatDeadlineDisplay(task.deadline)}
            </div>
        `;
    }
    
    if (task.estimate_min > 0) {
        metaHtml += `
            <div class="task-time">
                <i class="bi bi-clock"></i>
                ${task.status === 'done' ? `<span id="actualTime${task.id}">${task.estimate_min}分</span>` : `${task.estimate_min}分`}
            </div>
        `;
    }
    
    if (task.status === 'doing' || task.status === 'paused') {
        // 既存のタイマーがある場合は、その値を保持
        if (existingTimer && existingTimerText) {
            metaHtml += `
                <div class="task-timer">
                    <i class="bi bi-stopwatch"></i>
                    <span id="taskTimer${task.id}">${existingTimerText}</span>
                </div>
            `;
        } else {
            // 新しいタイマーの場合は、現在の経過時間を計算
            let initialTime = '00:00:00';
            if (state.running.taskId === task.id) {
                if (state.running.paused && state.running.pausedSeconds) {
                    initialTime = formatTime(state.running.pausedSeconds);
                } else if (state.running.startedAt) {
                    const now = new Date();
                    const startedAt = new Date(state.running.startedAt);
                    const elapsedSeconds = Math.floor((now - startedAt) / 1000);
                    initialTime = formatTime(elapsedSeconds);
                }
            }
            
            metaHtml += `
                <div class="task-timer">
                    <i class="bi bi-stopwatch"></i>
                    <span id="taskTimer${task.id}">${initialTime}</span>
                </div>
            `;
        }
    }
    
    // メタ情報を更新
    metaContainer.innerHTML = metaHtml;
    
    // タグ情報も更新
    const tagsContainer = taskCard.querySelector('.task-tags');
    if (tagsContainer) {
        if (tags.length > 0) {
            tagsContainer.innerHTML = tagsHtml;
        } else {
            tagsContainer.remove();
        }
    } else if (tags.length > 0) {
        // タグコンテナが存在しない場合は作成
        const taskInfo = taskCard.querySelector('.task-info');
        if (taskInfo) {
            const titleElement = taskInfo.querySelector('.task-title');
            if (titleElement) {
                const newTagsContainer = document.createElement('div');
                newTagsContainer.className = 'task-tags';
                newTagsContainer.innerHTML = tagsHtml;
                titleElement.insertAdjacentElement('afterend', newTagsContainer);
            }
        }
    }
    
    console.log('Task meta updated successfully');
}

// タスクタイマーリセット
function resetTaskTimer(taskId) {
    console.log('resetTaskTimer called with taskId:', taskId);
    
    if (!confirm('タイマーをリセットしますか？経過時間が0に戻ります。')) {
        return;
    }
    
    // 現在実行中のタスクの場合
    if (state.running.taskId === taskId) {
        state.running.startedAt = new Date().toISOString();
        state.running.paused = true;
        state.running.pausedSeconds = 0;
        
        // タスク状態更新
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.started_at = state.running.startedAt;
        }
        
        renderTaskList();
    }
}

// タスクタイマー表示
async function showTaskTimer(taskId) {
    console.log('showTaskTimer called with taskId:', taskId);
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
        console.log('Task not found:', taskId);
        return;
    }
    
    console.log('Task status:', task.status);
    console.log('Current running task:', state.running.taskId);
    
    // タスクが実行中でない場合は、タイマー表示のみ（開始しない）
    if (task.status !== 'doing') {
        console.log('Task not running, showing timer display only');
        
        // 既存の実行中のタスク/サブタスクを停止
        await stopCurrentRunning(taskId);
        
        // 詳細画面の状態を確認
        const details = document.getElementById(`taskDetails${taskId}`);
        let isDetailsOpen = false;
        
        if (details) {
            // Bootstrapのcollapseインスタンスを取得
            const bsCollapseInstance = bootstrap.Collapse.getInstance(details);
            if (bsCollapseInstance) {
                isDetailsOpen = bsCollapseInstance._isShown();
            } else {
                // インスタンスがない場合は、クラスとスタイルで判定
                isDetailsOpen = details.classList.contains('show') || details.style.display !== 'none';
            }
        }
        
        console.log('Details element:', details);
        console.log('Is details open:', isDetailsOpen);
        
        // 詳細画面が開いている場合は閉じる
        if (isDetailsOpen) {
            console.log('Details are open, closing them');
            const bsCollapse = new bootstrap.Collapse(details, { hide: true });
            return; // 詳細画面を閉じた後は何もしない
        }
        
        // 前回の経過時間を計算
        let totalElapsedSeconds = 0;
        
        // タスクの開始時間と完了時間から経過時間を計算
        if (task.started_at) {
            const startTime = new Date(task.started_at);
            const endTime = task.completed_at ? new Date(task.completed_at) : new Date();
            totalElapsedSeconds = Math.floor((endTime - startTime) / 1000);
        }
        
        // FocusLogから実際の記録時間を取得
        try {
            const focusTimeResponse = await api(`/api/tasks/${taskId}/focus-time/`);
            if (focusTimeResponse.ok) {
                totalElapsedSeconds = focusTimeResponse.total_seconds;
                console.log('Using actual focus time:', totalElapsedSeconds, 'seconds');
            }
        } catch (error) {
            console.log('Could not fetch focus time, using calculated time:', totalElapsedSeconds, 'seconds');
        }
        
        // タイマー表示用の状態を設定（実際には開始しない）
        state.running.taskId = taskId;
        // 現在時刻から経過時間を逆算して開始時間を設定
        const now = new Date();
        const adjustedStartTime = new Date(now.getTime() - (totalElapsedSeconds * 1000));
        state.running.startedAt = adjustedStartTime.toISOString();
        state.running.paused = true; // 一時停止状態で表示
        
        renderTaskList();
        
        // 詳細画面を開く
        if (details) {
            const bsCollapse = new bootstrap.Collapse(details, { show: true });
        }
        
        // ボタンの文字を状況に応じて更新
        setTimeout(() => {
            const startBtn = document.getElementById('focusStartBtn');
            if (startBtn && totalElapsedSeconds > 0) {
                startBtn.innerHTML = '<i class="bi bi-play-fill"></i> 再開';
            } else if (startBtn) {
                startBtn.innerHTML = '<i class="bi bi-play-fill"></i> 開始';
            }
        }, 100);
    } else {
        console.log('Task is running, toggling pause state');
        // 既に実行中の場合は一時停止/再開を切り替え
        if (state.running.paused) {
            resumeTask(taskId);
        } else {
            pauseTask(taskId);
        }
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

// サブタスク開始
async function startSubtask(subtaskId) {
    try {
        console.log('startSubtask called with subtaskId:', subtaskId);
        
        // 既存の実行中のタスク/サブタスクを停止
        await stopCurrentRunning(null, subtaskId);
        
        const response = await api(`/api/subtasks/${subtaskId}/start/`, 'POST');
        
        if (response.ok) {
            state.runningSubtask.subtaskId = subtaskId;
            state.runningSubtask.startedAt = response.started_at;
            state.runningSubtask.paused = false;
            
            console.log('Subtask started with start time:', state.runningSubtask.startedAt);
            
            // サブタスク状態更新
            updateSubtaskInState(subtaskId, 'doing', response.started_at);
            
            renderTaskList();
        } else {
            throw new Error(response.error || 'サブタスクの開始に失敗しました');
        }
    } catch (error) {
        console.error('サブタスク開始エラー:', error);
        alert('サブタスクの開始に失敗しました: ' + error.message);
    }
}

// サブタスク一時停止
async function pauseSubtask(subtaskId) {
    try {
        console.log('pauseSubtask called with subtaskId:', subtaskId);
        
        // 現在の経過時間を計算して記録
        let currentElapsedSeconds = 0;
        if (state.runningSubtask.startedAt) {
            const startTime = new Date(state.runningSubtask.startedAt);
            const now = new Date();
            currentElapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        
        console.log('Current elapsed time before pause:', currentElapsedSeconds, 'seconds');
        
        const response = await api(`/api/subtasks/${subtaskId}/pause/`, 'POST');
        
        if (response.ok) {
            state.runningSubtask.paused = true;
            
            // 一時停止時の経過時間を記録
            state.runningSubtask.pausedSeconds = currentElapsedSeconds;
            
            console.log('Paused at elapsed time:', currentElapsedSeconds, 'seconds');
            
            // サブタスク状態更新
            updateSubtaskInState(subtaskId, 'paused', null);
            
            renderTaskList();
        } else {
            throw new Error(response.error || 'サブタスクの一時停止に失敗しました');
        }
    } catch (error) {
        console.error('サブタスク一時停止エラー:', error);
        alert('サブタスクの一時停止に失敗しました: ' + error.message);
    }
}

// サブタスク再開
async function resumeSubtask(subtaskId) {
    try {
        console.log('resumeSubtask called with subtaskId:', subtaskId);
        
        // 現在の経過時間を計算
        let currentElapsedSeconds = 0;
        if (state.runningSubtask.startedAt) {
            const startTime = new Date(state.runningSubtask.startedAt);
            const now = new Date();
            currentElapsedSeconds = Math.floor((now - startTime) / 1000);
        }
        
        console.log('Current elapsed time before resume:', currentElapsedSeconds, 'seconds');
        
        const response = await api(`/api/subtasks/${subtaskId}/resume/`, 'POST');
        
        if (response.ok) {
            state.runningSubtask.paused = false;
            
            // 記録された経過時間を使用して開始時間を調整
            const now = new Date();
            const adjustedStartTime = new Date(now.getTime() - (state.runningSubtask.pausedSeconds * 1000));
            state.runningSubtask.startedAt = adjustedStartTime.toISOString();
            
            console.log('Resumed with elapsed time:', state.runningSubtask.pausedSeconds, 'seconds');
            console.log('Adjusted start time:', state.runningSubtask.startedAt);
            
            // サブタスク状態更新
            updateSubtaskInState(subtaskId, 'doing', state.runningSubtask.startedAt);
            
            renderTaskList();
        } else {
            throw new Error(response.error || 'サブタスクの再開に失敗しました');
        }
    } catch (error) {
        console.error('サブタスク再開エラー:', error);
        alert('サブタスクの再開に失敗しました: ' + error.message);
    }
}

// サブタスク完了
async function completeSubtask(subtaskId) {
    try {
        const response = await api(`/api/subtasks/${subtaskId}/complete/`, 'POST');
        
        // 実行中なら停止
        if (state.runningSubtask.subtaskId === subtaskId) {
            state.runningSubtask.subtaskId = null;
            state.runningSubtask.startedAt = null;
            state.runningSubtask.paused = false;
            state.runningSubtask.totalSeconds = 0;
        }
        
        // サブタスク状態更新
        updateSubtaskInState(subtaskId, 'done', null, response.completed_at);
        
        renderTaskList();
    } catch (error) {
        console.error('サブタスク完了エラー:', error);
        alert('サブタスクの完了に失敗しました');
    }
}

// サブタスク状態更新ヘルパー
function updateSubtaskInState(subtaskId, status, startedAt, completedAt = null) {
    for (const task of state.tasks) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
            subtask.status = status;
            subtask.started_at = startedAt;
            if (completedAt) {
                subtask.completed_at = completedAt;
            }
            break;
        }
    }
}

// サブタスクタイマーリセット
function resetSubtaskTimer(subtaskId) {
    console.log('resetSubtaskTimer called with subtaskId:', subtaskId);
    
    if (!confirm('サブタスクのタイマーをリセットしますか？経過時間が0に戻ります。')) {
        return;
    }
    
    // 現在実行中のサブタスクの場合
    if (state.runningSubtask.subtaskId === subtaskId) {
        state.runningSubtask.startedAt = new Date().toISOString();
        state.runningSubtask.paused = true;
        
        // サブタスク状態更新
        updateSubtaskInState(subtaskId, 'paused', state.runningSubtask.startedAt);
        
        renderTaskList();
    }
}

// サブタスクタイマー表示
async function showSubtaskTimer(subtaskId) {
    console.log('showSubtaskTimer called with subtaskId:', subtaskId);
    
    // サブタスクを検索
    let subtask = null;
    for (const task of state.tasks) {
        subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) break;
    }
    
    if (!subtask) {
        console.log('Subtask not found:', subtaskId);
        return;
    }
    
    console.log('Subtask status:', subtask.status);
    console.log('Current running subtask:', state.runningSubtask.subtaskId);
    
    // 既存の実行中のタスク/サブタスクを停止
    await stopCurrentRunning(null, subtaskId);
    
    // サブタスクが実行中でない場合は開始
    if (subtask.status !== 'doing') {
        console.log('Starting subtask:', subtaskId);
        startSubtask(subtaskId);
    } else {
        console.log('Pausing subtask:', subtaskId);
        pauseSubtask(subtaskId);
    }
}

// サブタスク追加
async function addSubtask(taskId) {
    const input = document.getElementById(`newSubtask${taskId}`);
    const title = input.value.trim();
    
    if (!title) {
        alert('サブタスクのタイトルを入力してください');
        return;
    }
    
    try {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // 既存のサブタスクと新しいサブタスクを分けて送信
        const existingSubtasks = task.subtasks.map(s => ({ 
            id: s.id, 
            title: s.title,
            done: s.done 
        }));
        
        // 新しいサブタスク（idなし）
        const newSubtaskData = {
            title: title,
            done: false
        };
        
        // APIで保存
        const response = await api(`/api/subtasks/${taskId}/bulk_upsert/`, 'POST', {
            subtasks: [...existingSubtasks, newSubtaskData]
        });
        
        if (response.ok) {
            // バックエンドから返された新しいIDでサブタスクを更新
            const newSubtask = {
                id: response.items[response.items.length - 1].id, // 最後に追加されたサブタスクのID
                title: title,
                done: false,
                status: 'todo',
                started_at: null,
                completed_at: null
            };
            
            task.subtasks.push(newSubtask);
            
            // 入力フィールドをクリア
            input.value = '';
            
            // タスクリストを再描画
            renderTaskList();
            
            // 詳細画面を再度開く
            setTimeout(() => {
                const details = document.getElementById(`taskDetails${taskId}`);
                if (details) {
                    const bsCollapse = new bootstrap.Collapse(details, { show: true });
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('サブタスク追加エラー:', error);
        alert('サブタスクの追加に失敗しました');
    }
}

// 新規タスク作成
async function createTask() {
    const title = document.getElementById('taskTitle').value;
    const deadline = document.getElementById('taskDeadline').value;
    const estimate = parseInt(document.getElementById('taskEstimate').value) || 0;
    const tags = document.getElementById('taskTags').value;
    const importance = parseInt(document.getElementById('taskImportance').value) || 0;
    
    // バリデーション
    if (!title.trim()) {
        alert('タイトルを入力してください');
        return;
    }
    
    if (!deadline) {
        alert('期限を入力してください');
        return;
    }
    
    if (estimate < 5) {
        alert('見積時間は5分以上を入力してください');
        return;
    }
    
    if (importance < 0 || importance > 3) {
        alert('重要度は0-3の範囲で入力してください');
        return;
    }
    
    try {
        const response = await api('/api/tasks/create/', 'POST', {
            title: title.trim(),
            deadline: deadline,
            estimate_min: estimate,
            tags: tags.trim(),
            importance: importance
        });
        
        // フォームリセット
        document.getElementById('taskForm').reset();
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
        modal.hide();
        
        // ソート済みタスクリストを再読み込み
        await loadSortedTasks();
        
        // タスク作成後はソート済みフラグをリセット
        state.sort.isSorted = false;
        updateSortUI();
        
        showSuccess('タスクを作成しました');
    } catch (error) {
        console.error('タスク作成エラー:', error);
        showError('タスクの作成に失敗しました: ' + error.message);
    }
}

// サブタスク作成
async function createSubtask(taskId) {
    const title = document.getElementById('subtaskTitle').value;
    const estimate = parseInt(document.getElementById('subtaskEstimate').value) || 15;
    const orderIndex = parseInt(document.getElementById('subtaskOrderIndex').value) || 0;
    
    // バリデーション
    if (!title.trim()) {
        alert('サブタスクのタイトルを入力してください');
        return;
    }
    
    if (estimate < 5) {
        alert('見積時間は5分以上を入力してください');
        return;
    }
    
    try {
        const response = await api('/api/subtasks/create/', 'POST', {
            task_id: taskId,
            title: title.trim(),
            estimate_min: estimate,
            order_index: orderIndex
        });
        
        // フォームリセット
        document.getElementById('subtaskForm').reset();
        
        // モーダルを閉じる
        const modal = bootstrap.Modal.getInstance(document.getElementById('subtaskModal'));
        modal.hide();
        
        // ソート済みタスクリストを再読み込み
        await loadSortedTasks();
        
        // サブタスク作成後はソート済みフラグをリセット
        state.sort.isSorted = false;
        updateSortUI();
        
        showSuccess('サブタスクを作成しました');
    } catch (error) {
        console.error('サブタスク作成エラー:', error);
        showError('サブタスクの作成に失敗しました: ' + error.message);
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
        // エラーメッセージは表示しない
    }
}

// タスクリスト読み込み
async function loadTasks() {
    try {
        console.log('Loading tasks...');
        const response = await api('/api/tasks/');
        
        // sharedフィールドを確実に含める
        state.tasks = response.tasks.map(task => ({
            ...task,
            shared: task.shared || false
        }));
        
        console.log('Loaded tasks:', state.tasks);
        
        // 実行中のタスクがあれば、タイマー状態を復元
        const runningTask = state.tasks.find(task => task.status === 'doing' && task.started_at);
        if (runningTask) {
            console.log('Found running task:', runningTask);
            state.running.taskId = runningTask.id;
            state.running.startedAt = runningTask.started_at;
            state.running.paused = false;
        }
        
        // 実行中のサブタスクがあれば、タイマー状態を復元
        for (const task of state.tasks) {
            const runningSubtask = task.subtasks.find(subtask => subtask.status === 'doing' && subtask.started_at);
            if (runningSubtask) {
                console.log('Found running subtask:', runningSubtask);
                state.runningSubtask.subtaskId = runningSubtask.id;
                state.runningSubtask.startedAt = runningSubtask.started_at;
                state.runningSubtask.paused = false;
                break;
            }
        }
        
        console.log('Final state:', state);
        renderTaskList();
    } catch (error) {
        console.error('タスク読み込みエラー:', error);
        // エラーメッセージは表示しない
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
        
        // ナビゲーションバーのタイプ表示を更新
        updateUserTypeDisplay();
    } catch (error) {
        console.error('プロフィール読み込みエラー:', error);
        // エラーメッセージは表示しない
    }
}

// ユーザータイプ表示を更新
function updateUserTypeDisplay() {
    const typeDisplay = document.getElementById('userTypeDisplay');
    if (!typeDisplay) return;
    
    const typeNames = {
        'planner': 'プランナー',
        'sprinter': 'スプリンター',
        'flow': 'フロー'
    };
    
    const typeIcons = {
        'planner': 'bi-calendar-check',
        'sprinter': 'bi-lightning-charge',
        'flow': 'bi-water'
    };
    
    if (state.user.mainType && typeNames[state.user.mainType]) {
        const typeName = typeNames[state.user.mainType];
        const icon = typeIcons[state.user.mainType] || 'bi-person';
        typeDisplay.innerHTML = `<i class="bi ${icon} me-1"></i>${typeName}`;
    } else {
        typeDisplay.innerHTML = '<i class="bi bi-person me-1"></i>未診断';
    }
}

// 診断関連
function startDiagnosis() {
    // 診断開始画面を表示
    showDiagnosisStartScreen();
}

function showDiagnosisStartScreen() {
    const diagContent = document.getElementById('diagContent');
    diagContent.innerHTML = `
        <div class="diagnosis-start">
            <h4>あなたの作業スタイルを診断します</h4>
            <p>7つの質問に答えて、最適なタスク管理方法を見つけましょう</p>
            <button class="diagnosis-start-btn" onclick="beginDiagnosis()">
                <i class="bi bi-play-fill me-2"></i> 診断開始
            </button>
        </div>
    `;
}

function beginDiagnosis() {
    const diagContent = document.getElementById('diagContent');
    diagContent.innerHTML = `
        <div class="diagnosis-progress">
            <div class="diagnosis-progress-bar" style="width: 0%"></div>
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
            <p>${q.text}</p>
            <div class="d-grid gap-3">
                ${q.options.map(opt => `
                    <button class="diagnosis-option" onclick="selectAnswer(${q.q}, '${opt.key}')">
                        <strong>${opt.key}.</strong> ${opt.text}
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
    const progressBar = document.querySelector('.diagnosis-progress-bar');
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
        
        // ナビゲーションバーのタイプ表示を更新
        updateUserTypeDisplay();
        
        // 診断結果をモーダル内に表示
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
    
    const typeDescriptions = {
        'planner': '計画的にタスクを進めるタイプです。詳細な計画を立てて、順序立てて作業を進めることが得意です。',
        'sprinter': '短時間集中で効率的にタスクをこなすタイプです。時間制限を設けて、集中して作業を進めることが得意です。',
        'flow': 'リラックスして自然な流れで作業するタイプです。無理のないペースで、継続的に作業を進めることが得意です。'
    };
    
    const typeIcons = {
        'planner': 'bi-calendar-check',
        'sprinter': 'bi-lightning-charge',
        'flow': 'bi-water'
    };
    
    const mainTypeName = typeNames[mainType] || mainType;
    const description = typeDescriptions[mainType] || '';
    const icon = typeIcons[mainType] || 'bi-person';
    
    const resultHtml = `
        <div class="diagnosis-result">
            <div class="diagnosis-result-icon">
                <i class="bi ${icon}"></i>
            </div>
            <h4>あなたのタイプ: ${mainTypeName}</h4>
            <p>${description}</p>
            <div class="d-flex gap-3 justify-content-center">
                <button class="diagnosis-result-btn" onclick="closeDiagnosisModal()">
                    <i class="bi bi-check-lg me-2"></i> 完了
                </button>
                <button class="diagnosis-result-btn" onclick="retakeDiagnosis()">
                    <i class="bi bi-arrow-clockwise me-2"></i> 再診断
                </button>
            </div>
        </div>
    `;
    
    const diagContent = document.getElementById('diagContent');
    diagContent.innerHTML = resultHtml;
}

// 設定関連
function showSettings() {
    const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
    modal.show();
}

function closeDiagnosisModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('diagModal'));
    modal.hide();
}

function retakeDiagnosis() {
    diagnosisAnswers = [];
    const modal = new bootstrap.Modal(document.getElementById('diagModal'));
    modal.show();
    // 診断モーダルを初期状態に戻す
    const diagContent = document.getElementById('diagContent');
    diagContent.innerHTML = `
        <div class="diagnosis-start">
            <h4>あなたの作業スタイルを診断します</h4>
            <p>7つの質問に答えて、最適なタスク管理方法を見つけましょう</p>
            <button class="diagnosis-start-btn" onclick="beginDiagnosis()">
                <i class="bi bi-play-fill me-2"></i> 診断開始
            </button>
        </div>
    `;
}

// サブタスクモーダルを開く
function openSubtaskModal(taskId) {
    const subtaskModal = new bootstrap.Modal(document.getElementById('subtaskModal'));
    document.getElementById('subtaskForm').reset();
    document.getElementById('subtaskModal').dataset.taskId = taskId;
    subtaskModal.show();
}

// ソート関連の関数
async function loadSortedTasks(type = null) {
    try {
        const sortType = type || state.sort.currentType;
        const response = await api(`/api/tasks/sorted/?type=${sortType}`);
        
        // レスポンスデータをstate.tasks形式に変換
        const tasksMap = new Map();
        const parentTasks = [];
        
        response.tasks.forEach(item => {
            if (item.parent_id === null) {
                // 親タスク
                const task = {
                    id: item.id,
                    title: item.title,
                    deadline: item.deadline,
                    estimate_min: item.estimate_min,
                    importance: item.importance,
                    status: item.status,
                    tags: item.tags,
                    shared: item.shared || false,
                    score: item.score,
                    subtasks: []
                };
                tasksMap.set(item.id, task);
                parentTasks.push(task);
            } else {
                // サブタスク
                const parentTask = tasksMap.get(item.parent_id);
                if (parentTask) {
                    parentTask.subtasks.push({
                        id: item.id,
                        title: item.title,
                        estimate_min: item.estimate_min,
                        status: item.status,
                        order_index: item.order_index
                    });
                }
            }
        });
        
        state.tasks = parentTasks;
        state.sort.lastSortedAt = response.sorted_at;
        state.sort.isSorted = true;  // ソート済みフラグを設定
        
        // デバッグ: 完了したタスクの情報をログ出力
        const doneTasks = parentTasks.filter(task => task.status === 'done');
        console.log('完了したタスク:', doneTasks);
        console.log('全タスク:', parentTasks);
        console.log('APIレスポンス:', response);
        
        // タグ情報のデバッグ
        parentTasks.forEach(task => {
            console.log(`タスク ${task.id} (${task.title}) のタグ:`, task.tags);
        });
        
        renderTaskList();
        
        // ソート設定を更新
        updateSortUI();
        
        // ドラッグ&ドロップ機能を再初期化
        setTimeout(() => {
            initializeSortable();
        }, 100);
    } catch (error) {
        console.error('Failed to load sorted tasks:', error);
        // エラーメッセージは表示しない
    }
}

async function recomputeOrder() {
    try {
        console.log('recomputeOrder開始 - タイプ:', state.sort.currentType);
        
        const response = await api(`/api/tasks/recompute-order/?type=${state.sort.currentType}`, 'POST');
        console.log('recomputeOrder APIレスポンス:', response);
        
        state.sort.lastSortedAt = response.sorted_at;
        state.sort.isSorted = true;  // ソート済みフラグを設定
        
        console.log('ソート済みフラグを設定:', state.sort.isSorted);
        
        // タスクリストを再読み込み
        await loadSortedTasks();
        
        showSuccess('ソートを更新しました');
        console.log('recomputeOrder完了');
    } catch (error) {
        console.error('Failed to recompute order:', error);
        showError('ソートの更新に失敗しました');
    }
}

async function updateSortSettings(autoSort, archiveDays = 30) {
    try {
        await api('/api/user/sort-settings/', 'POST', {
            auto_sort: autoSort,
            archive_after_days: archiveDays
        });
        
        state.sort.autoSort = autoSort;
        updateSortUI();
        
        showSuccess('ソート設定を更新しました');
    } catch (error) {
        console.error('Failed to update sort settings:', error);
        showError('ソート設定の更新に失敗しました');
    }
}

function updateSortUI() {
    const autoSortToggle = document.getElementById('autoSortToggle');
    const sortNowBtn = document.getElementById('sortNowBtn');
    const sortTypeSelect = document.getElementById('sortTypeSelect');
    
    if (autoSortToggle) {
        autoSortToggle.checked = state.sort.autoSort;
    }
    
    if (sortNowBtn) {
        // ソート済みの場合はボタンを無効化
        if (state.sort.isSorted) {
            sortNowBtn.disabled = true;
            sortNowBtn.classList.add('btn-outline-secondary');
            sortNowBtn.classList.remove('btn-outline-primary');
            sortNowBtn.innerHTML = '<i class="bi bi-check-circle"></i> ソート済み';
        } else {
            sortNowBtn.disabled = false;
            sortNowBtn.classList.remove('btn-outline-secondary');
            sortNowBtn.classList.add('btn-outline-primary');
            sortNowBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> ソート更新';
        }
    }
    
    if (sortTypeSelect) {
        sortTypeSelect.value = state.sort.currentType;
    }
}

// 自動ソートの定期実行
function startAutoSort() {
    if (state.sort.autoSort) {
        // 12時間ごとに自動ソート
        setInterval(async () => {
            if (state.sort.autoSort) {
                await recomputeOrder();
            }
        }, 12 * 60 * 60 * 1000); // 12時間
    }
}

// ドラッグアンドドロップ機能
let sortableInstance = null;

function initializeSortable() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    
    // 既存のSortableインスタンスを破棄
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    
    // 新しいSortableインスタンスを作成
    sortableInstance = new Sortable(taskList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.task-drag-handle',
        filter: '.task-actions, .task-actions *',
        onEnd: function(evt) {
            // ドラッグ終了時の処理
            const movedTaskId = evt.item.dataset.taskId;
            const newIndex = evt.newIndex;
            const oldIndex = evt.oldIndex;
            
            console.log(`Task ${movedTaskId} moved from ${oldIndex} to ${newIndex}`);
            
            // 手動で並び替えた場合はソート済みフラグをリセット
            if (newIndex !== oldIndex) {
                state.sort.isSorted = false;
                updateSortUI();
                
                // 手動ソートが有効な場合は、次の自動ソートで元に戻ることを通知
                if (!state.sort.autoSort) {
                    showInfo('手動で並び替えました。自動ソートが有効になると元の順序に戻ります。');
                }
            }
        }
    });
}



// 締め切り時間の表示を計算
function formatDeadlineDisplay(deadline) {
    if (!deadline) return '';
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs < 0) {
        // 締め切りを過ぎている場合（赤文字）
        const overdueDays = Math.abs(diffDays);
        const overdueHours = Math.abs(diffHours);
        const overdueMinutes = Math.abs(diffMinutes);
        
        if (overdueDays > 0) {
            return `<span class="text-danger fw-bold">${overdueDays}日超過</span>`;
        } else if (overdueHours > 0) {
            return `<span class="text-danger fw-bold">${overdueHours}時間${overdueMinutes}分超過</span>`;
        } else {
            return `<span class="text-danger fw-bold">${overdueMinutes}分超過</span>`;
        }
    } else {
        // 締め切り前の場合
        if (diffDays > 0) {
            return `<span class="text-info">残り${diffDays}日${diffHours}時間</span>`;
        } else if (diffHours >= 3) {
            return `<span class="text-info">残り${diffHours}時間${diffMinutes}分</span>`;
        } else if (diffHours > 0 || diffMinutes > 0) {
            return `<span class="text-warning fw-bold">残り${diffHours}時間${diffMinutes}分</span>`;
        } else {
            return `<span class="text-danger fw-bold">期限切れ</span>`;
        }
    }
}

// 締め切り時間の表示を定期的に更新
function updateDeadlineDisplays() {
    state.tasks.forEach(task => {
        if (task.deadline) {
            const taskCard = document.querySelector(`[data-task-id="${task.id}"]`);
            if (taskCard) {
                const dateElement = taskCard.querySelector('.task-date');
                if (dateElement) {
                    const icon = dateElement.querySelector('i');
                    const dateText = new Date(task.deadline).toLocaleDateString('ja-JP');
                    const deadlineDisplay = formatDeadlineDisplay(task.deadline);
                    
                    dateElement.innerHTML = `
                        ${icon.outerHTML}
                        ${dateText}
                        ${deadlineDisplay}
                    `;
                }
            }
        }
    });
}

// 残り時間を定期的に更新
function updateRemainingTimes() {
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(taskItem => {
        const deadlineElement = taskItem.querySelector('.small.text-muted');
        if (deadlineElement) {
            const deadlineText = deadlineElement.textContent;
            if (deadlineText.includes('期限:')) {
                // 期限の日時を抽出
                const deadlineMatch = deadlineText.match(/期限: ([\d\/\s:]+)/);
                if (deadlineMatch) {
                    const deadlineStr = deadlineMatch[1];
                    const deadline = new Date(deadlineStr);
                    
                    // 新しい残り時間を計算
                    const remainingTimeHtml = formatRemainingTime(deadline.toISOString());
                    
                    // 既存の残り時間を更新
                    const existingRemaining = deadlineElement.querySelector('.text-danger, .text-info, .text-warning');
                    if (existingRemaining) {
                        existingRemaining.outerHTML = remainingTimeHtml;
                    }
                }
            }
        }
    });
}

// 残り時間の定期更新を開始
function startRemainingTimeUpdates() {
    // 1分ごとに更新
    setInterval(updateRemainingTimes, 60000);
    // 締め切り時間の表示も1分ごとに更新
    setInterval(updateDeadlineDisplays, 60000);
}

// ユーティリティ関数
function showSuccess(message) {
    // Bootstrap のトーストまたはアラートを使用
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

function showError(message) {
    // Bootstrap のトーストまたはアラートを使用
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function showInfo(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-info alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

// タスク共有機能
async function shareTask(taskId) {
    try {
        const response = await api(`/api/tasks/${taskId}/share/`, 'POST');
        
        if (response.ok) {
            if (response.shared) {
                showSuccess('🎉 タスクを共有しました！みんなで頑張りましょう！ 💪');
            } else {
                showInfo('🔒 タスクの共有を解除しました');
            }
            // タスクリストを更新
            loadSortedTasks();
            
            // Timelineページにいる場合はTimelineも更新
            if (window.location.pathname.includes('/timeline/')) {
                // Timelineを再読み込み
                timelineCursor = null; // カーソルをリセット
                const timelineList = document.getElementById('timelineList');
                if (timelineList) {
                    timelineList.innerHTML = `
                        <div class="text-center text-muted">
                            <i class="bi bi-clock-history" style="font-size: 2rem;"></i>
                            <p class="mt-2">イベントがありません</p>
                        </div>
                    `;
                }
                loadTimeline();
            }
        }
    } catch (error) {
        console.error('タスク共有エラー:', error);
        showError('😅 タスクの共有に失敗しました。もう一度お試しください！');
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded開始');
    
    // 初期データ読み込み
    loadProfile();
    loadSortedTasks(); // 通常のloadTasks()の代わりにソート済みタスクを読み込み
    loadMetrics();
    
    // タイマー開始
    requestAnimationFrame(updateTimer);
    
    // タスクタイマー更新の定期実行
    setInterval(updateTaskTimers, 1000);
    
    // 自動ソート開始
    startAutoSort();

    // 残り時間の定期更新を開始
    startRemainingTimeUpdates();

    // ドラッグアンドドロップ初期化
    initializeSortable();
    
    console.log('DOMContentLoaded完了');
    
    // イベントリスナー
    document.getElementById('saveTaskBtn')?.addEventListener('click', createTask);
    document.getElementById('saveSubtaskBtn')?.addEventListener('click', () => {
        // 現在のタスクIDを取得（モーダルから）
        const taskId = document.getElementById('subtaskModal').dataset.taskId;
        if (taskId) {
            createSubtask(parseInt(taskId));
        }
    });
    // startDiagnosisBtnのイベントリスナーは削除（onclick属性で直接呼び出し）
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        // 設定保存処理
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        modal.hide();
    });
    
    // ソート関連のイベントリスナー
    document.getElementById('sortTypeSelect')?.addEventListener('change', (e) => {
        console.log('ソートタイプ変更:', e.target.value);
        state.sort.currentType = e.target.value;
        state.sort.isSorted = false;  // ソートタイプ変更時はソート済みフラグをリセット
        loadSortedTasks();
    });
    
    document.getElementById('autoSortToggle')?.addEventListener('change', (e) => {
        console.log('自動ソート切り替え:', e.target.checked);
        updateSortSettings(e.target.checked);
    });
    
    const sortNowBtn = document.getElementById('sortNowBtn');
    console.log('sortNowBtn要素:', sortNowBtn);
    if (sortNowBtn) {
        sortNowBtn.addEventListener('click', () => {
            console.log('ソート更新ボタンがクリックされました');
            recomputeOrder();
        });
    } else {
        console.error('sortNowBtn要素が見つかりません');
    }
});
