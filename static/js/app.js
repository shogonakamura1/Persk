// アプリケーション状態管理
let state = {
    user: { id: null, mainType: null, subType: null },
    tasks: [],
    running: { taskId: null, startedAt: null, paused: false, totalSeconds: 0, pausedSeconds: 0 },
    runningSubtask: { subtaskId: null, startedAt: null, paused: false, totalSeconds: 0, pausedSeconds: 0 },
    csrfToken: typeof csrfToken !== 'undefined' ? csrfToken : '',
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
        throw new Error(errorText);
    }
    const response = await r.json();
    console.log(`API Response:`, response);
    return response;
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
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        
        return `
            <div class="task-item p-3 ${statusClass}" data-task-id="${task.id}">
                <div class="row align-items-center">
                    <div class="col">
                        <div class="d-flex align-items-center" onclick="showTaskTimer(${task.id})" style="cursor: pointer;">
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
                        ${!hasSubtasks ? `
                            ${task.status === 'todo' ? `
                                <button class="btn btn-success btn-sm me-1" onclick="event.stopPropagation(); startTask(${task.id})">
                                    <i class="bi bi-play-fill"></i> 開始
                                </button>
                            ` : ''}
                            ${task.status === 'doing' ? `
                                <button class="btn btn-warning btn-sm me-1" onclick="event.stopPropagation(); pauseTask(${task.id})">
                                    <i class="bi bi-pause-fill"></i> 一時停止
                                </button>
                            ` : ''}
                            ${task.status === 'paused' ? `
                                <button class="btn btn-success btn-sm me-1" onclick="event.stopPropagation(); resumeTask(${task.id})">
                                    <i class="bi bi-play-fill"></i> 再開
                                </button>
                            ` : ''}
                            ${(task.status === 'doing' || task.status === 'paused') ? `
                                <button class="btn btn-warning btn-sm me-1" onclick="event.stopPropagation(); resetTaskTimer(${task.id})">
                                    <i class="bi bi-arrow-clockwise"></i> リセット
                                </button>
                            ` : ''}
                        ` : ''}
                        ${task.status !== 'done' ? `
                            <button class="btn btn-primary btn-sm me-1" onclick="event.stopPropagation(); completeTask(${task.id})">
                                <i class="bi bi-check-lg"></i> 完了
                            </button>
                        ` : ''}

                        <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation(); deleteTask(${task.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="collapse mt-3" id="taskDetails${task.id}">
                    <div class="collapse-content p-3" onclick="event.stopPropagation();">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>サブタスク</h6>
                                <div id="subtasks${task.id}">
                                    ${task.subtasks.map(subtask => `
                                        <div class="subtask-item p-2 mb-2 border rounded">
                                            <div class="d-flex align-items-center justify-content-between">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" 
                                                           id="subtask${subtask.id}" ${subtask.done ? 'checked' : ''}
                                                           onchange="event.stopPropagation(); updateSubtask(${task.id}, ${subtask.id}, this.checked)"
                                                           onclick="event.stopPropagation();">
                                                    <label class="form-check-label" for="subtask${subtask.id}" onclick="event.stopPropagation(); showSubtaskTimer(${subtask.id})" style="cursor: pointer;">
                                                        ${subtask.title}
                                                    </label>
                                                </div>
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
                                            </div>
                                            ${subtask.status === 'doing' || subtask.status === 'paused' ? `
                                                <div class="subtask-timer mt-2" onclick="event.stopPropagation();">
                                                    <small class="text-muted">
                                                        タイマー: <span id="subtaskTimer${subtask.id}">00:00:00</span>
                                                        ${subtask.status === 'paused' ? ' <i class="bi bi-pause-fill"></i>' : ''}
                                                    </small>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                                <!-- サブタスク追加フォーム -->
                                <div class="mt-3">
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="newSubtask${task.id}" 
                                               placeholder="新しいサブタスクを入力"
                                               onclick="event.stopPropagation();">
                                        <button class="btn btn-outline-primary" onclick="event.stopPropagation(); addSubtask(${task.id})">
                                            <i class="bi bi-plus-lg"></i> 追加
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    taskList.innerHTML = tasksHtml;
    
    // 記憶した詳細画面を再度開く
    openDetails.forEach(taskId => {
        setTimeout(() => {
            const details = document.getElementById(`taskDetails${taskId}`);
            if (details) {
                const bsCollapse = new bootstrap.Collapse(details, { show: true });
            }
        }, 50);
    });
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
    const focusSubtaskBar = document.getElementById('focusSubtaskBar');
    const focusSubtaskName = document.getElementById('focusSubtaskName');
    const focusSubtaskTimer = document.getElementById('focusSubtaskTimer');
    
    // 何も実行中でない場合は非表示
    if (!state.running.taskId && !state.runningSubtask.subtaskId) {
        focusBar.style.display = 'none';
        return;
    }
    
    focusBar.style.display = 'block';
    
    // サブタスクが実行中または一時停止中の場合はサブタスクを優先表示
    if (state.runningSubtask.subtaskId) {
        // サブタスク表示
        focusSubtaskBar.style.display = 'block';
        
        let subtask = null;
        for (const task of state.tasks) {
            subtask = task.subtasks.find(s => s.id === state.runningSubtask.subtaskId);
            if (subtask) break;
        }
        
        if (subtask) {
            focusSubtaskName.textContent = subtask.title;
            
            // タイマー更新
            if (state.runningSubtask.startedAt) {
                if (state.runningSubtask.paused) {
                    // 一時停止状態では記録された経過時間を表示
                    focusSubtaskTimer.classList.add('text-muted');
                    focusSubtaskTimer.innerHTML = formatTime(state.runningSubtask.pausedSeconds) + ' <i class="bi bi-pause-fill"></i>';
                } else {
                    // 実行中はリアルタイムで更新
                    const elapsed = Math.floor((Date.now() - new Date(state.runningSubtask.startedAt).getTime()) / 1000);
                    focusSubtaskTimer.classList.remove('text-muted');
                    focusSubtaskTimer.innerHTML = formatTime(elapsed);
                }
            }
        }
        
        // タスク表示は非表示
        focusTaskName.textContent = '';
        focusTimer.innerHTML = '';
        document.getElementById('focusStopBtn').style.display = 'none';
        document.getElementById('focusStartBtn').style.display = 'none';
        
    } else if (state.running.taskId) {
        // タスク表示
        focusSubtaskBar.style.display = 'none';
        
        const task = state.tasks.find(t => t.id === state.running.taskId);
        if (task) {
            focusTaskName.textContent = task.title;
            
            // タイマー更新
            if (state.running.startedAt) {
                if (state.running.paused) {
                    // 一時停止状態では記録された経過時間を表示
                    focusTimer.classList.add('text-muted');
                    focusTimer.innerHTML = formatTime(state.running.pausedSeconds) + ' <i class="bi bi-pause-fill"></i>';
                    // ボタン表示を切り替え
                    document.getElementById('focusStopBtn').style.display = 'none';
                    document.getElementById('focusStartBtn').style.display = 'inline-block';
                    
                    // ボタンの文字を状況に応じて変更
                    const startBtn = document.getElementById('focusStartBtn');
                    if (state.running.pausedSeconds > 0) {
                        startBtn.innerHTML = '<i class="bi bi-play-fill"></i> 再開';
                    } else {
                        startBtn.innerHTML = '<i class="bi bi-play-fill"></i> 開始';
                    }
                } else {
                    // 実行中はリアルタイムで更新
                    const elapsed = Math.floor((Date.now() - new Date(state.running.startedAt).getTime()) / 1000);
                    focusTimer.classList.remove('text-muted');
                    focusTimer.innerHTML = formatTime(elapsed);
                    // ボタン表示を切り替え
                    document.getElementById('focusStopBtn').style.display = 'inline-block';
                    document.getElementById('focusStartBtn').style.display = 'none';
                }
            }
        }
    }
}

// タイマー更新（requestAnimationFrame）
function updateTimer() {
    if ((state.running.taskId && state.running.startedAt && !state.running.paused) ||
        (state.runningSubtask.subtaskId && state.runningSubtask.startedAt && !state.runningSubtask.paused)) {
        updateFocusBar();
    }
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
    try {
        // 既存の実行中のタスク/サブタスクを停止
        await stopCurrentRunning(taskId);
        
        const response = await api(`/api/tasks/${taskId}/start/`, 'POST');
        
        // バックエンドからの応答を正しく処理
        if (response.ok) {
            state.running.taskId = taskId;
            state.running.startedAt = response.started_at;
            state.running.paused = false;
            
            console.log('Task started with start time:', state.running.startedAt);
            
            // タスク状態更新
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'doing';
                task.started_at = response.started_at;
            }
            
            renderTaskList();
            updateFocusBar();
        } else {
            throw new Error(response.error || 'タスクの開始に失敗しました');
        }
    } catch (error) {
        console.error('タスク開始エラー:', error);
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
            
            renderTaskList();
            updateFocusBar();
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
            
            renderTaskList();
            updateFocusBar();
        } else {
            throw new Error(response.error || 'タスクの再開に失敗しました');
        }
    } catch (error) {
        console.error('タスク再開エラー:', error);
        alert('タスクの再開に失敗しました: ' + error.message);
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
            state.running.totalSeconds = 0;
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
        updateFocusBar();
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
        updateFocusBar();
        
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
            updateFocusBar();
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
            updateFocusBar();
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
            updateFocusBar();
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
        updateFocusBar();
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
        updateFocusBar();
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
        console.log('Loading tasks...');
        const response = await api('/api/tasks/');
        state.tasks = response.tasks;
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
        updateFocusBar();
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
            pauseTask(state.running.taskId);
        }
    });
    
    document.getElementById('focusStartBtn')?.addEventListener('click', () => {
        if (state.running.taskId) {
            resumeTask(state.running.taskId);
        }
    });
    
    document.getElementById('focusResetBtn')?.addEventListener('click', () => {
        if (state.running.taskId) {
            resetTaskTimer(state.running.taskId);
        }
    });
    
    document.getElementById('focusCompleteBtn')?.addEventListener('click', () => {
        if (state.running.taskId) {
            completeTask(state.running.taskId);
        }
    });
    
    // サブタスク固定バーのボタン
    document.getElementById('focusSubtaskStopBtn')?.addEventListener('click', () => {
        if (state.runningSubtask.subtaskId) {
            if (state.runningSubtask.paused) {
                // 再開
                resumeSubtask(state.runningSubtask.subtaskId);
            } else {
                // 一時停止
                pauseSubtask(state.runningSubtask.subtaskId);
            }
        }
    });
    
    document.getElementById('focusSubtaskCompleteBtn')?.addEventListener('click', () => {
        if (state.runningSubtask.subtaskId) {
            completeSubtask(state.runningSubtask.subtaskId);
        }
    });
});
