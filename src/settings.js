// 引入浏览器兼容层
const browser = browserCompat;

document.addEventListener('DOMContentLoaded', () => {
    // --- Section Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const sectionId = item.dataset.section;

            if (sectionId === 'performance') {
                loadPerformanceData();
            }

            // Update nav item active class
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show the corresponding section
            contentSections.forEach(section => {
                if (section.id === sectionId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    // --- Settings Logic ---
    const subfolderInput = document.getElementById('subfolder');
    const statusDiv = document.getElementById('status');
    const timeSourceRadios = document.querySelectorAll('input[name="timestampSource"]');
    const timestampFormatSelect = document.getElementById('timestampFormat');
    const timestampStatus = document.getElementById('timestampStatus');
    const timestampHint = document.getElementById('timestampFormatHint');
    const TIMESTAMP_DEFAULT_FORMAT = 'YYYY-MM-DD_HH-mm';
    const TIMESTAMP_PREVIEW = {
        'YYYYMMDD-HHmm': '20231231-2359',
        'YYYY-MM-DD_HH-mm': '2023-12-31_23-59',
        'YYYY.MM.DD-HH.mm': '2023.12.31-23.59'
    };
    const STATE_CAPTIONS = {
        'off': '关闭（文件名保持原样）',
        'createdAt': '创建时间（将追加创建时间到文件名）',
        'updatedAt': '修改时间（将追加修改时间到文件名）'
    };
    let saveTimeout;
    let timestampTimeout;

    function updateTimestampHint(format) {
        if (!timestampHint) return;
        const preview = TIMESTAMP_PREVIEW[format] || TIMESTAMP_PREVIEW[TIMESTAMP_DEFAULT_FORMAT];
        timestampHint.textContent = `示例：示例文档__${preview}`;
    }


    function showTimestampStatus(message) {
        if (!timestampStatus) return;
        timestampStatus.textContent = `✅ ${message}`;
        timestampStatus.style.opacity = '1';
        clearTimeout(timestampTimeout);
        timestampTimeout = setTimeout(() => {
            timestampStatus.style.opacity = '0';
        }, 2000);
    }

    function saveTimeSourceState(state) {
        const isEnabled = state !== 'off';
        const updates = {
            preserveFileTimes: isEnabled,
            fileTimeSource: state
        };
        if (isEnabled) {
            updates.fileTimeFormat = timestampFormatSelect.value || TIMESTAMP_DEFAULT_FORMAT;
        }
        browser.storage.local.set(updates).then(() => {
            const messages = {
                'off': '时间信息已关闭',
                'createdAt': '将使用创建时间',
                'updatedAt': '将使用修改时间'
            };
            showTimestampStatus(messages[state] || messages['off']);
        });
    }

    // Load the saved settings
    browser.storage.local.get(['subfolder', 'preserveFileTimes', 'fileTimeFormat', 'fileTimeSource']).then((result) => {
        if (result.subfolder) {
            subfolderInput.value = result.subfolder;
        }

        if (timeSourceRadios.length > 0 && timestampFormatSelect) {
            // Determine current state
            let currentState = 'off';
            if (result.preserveFileTimes) {
                currentState = result.fileTimeSource || 'createdAt';
            }

            // Update radio buttons
            timeSourceRadios.forEach(radio => {
                radio.checked = radio.value === currentState;
            });
            // Update format select
            const savedFormat = result.fileTimeFormat || TIMESTAMP_DEFAULT_FORMAT;
            const availableFormats = Array.from(timestampFormatSelect.options).map(option => option.value);
            const formatToUse = availableFormats.includes(savedFormat) ? savedFormat : TIMESTAMP_DEFAULT_FORMAT;
            timestampFormatSelect.value = formatToUse;
            timestampFormatSelect.disabled = currentState === 'off';
            updateTimestampHint(formatToUse);
        }
    });

    // Save the setting on input
    subfolderInput.addEventListener('input', () => {
        const subfolder = subfolderInput.value.trim();
        browser.storage.local.set({ subfolder }).then(() => {
            // Show saved status message
            statusDiv.style.opacity = '1';

            // Clear previous timeout if it exists
            clearTimeout(saveTimeout);

            // Hide the message after 2 seconds
            saveTimeout = setTimeout(() => {
                statusDiv.style.opacity = '0';
            }, 2000);
        });
    });

    // Handle radio button changes
    timeSourceRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const selectedState = radio.value;
            
            timestampFormatSelect.disabled = selectedState === 'off';
            updateTimestampHint(timestampFormatSelect.value || TIMESTAMP_DEFAULT_FORMAT);
            
            saveTimeSourceState(selectedState);
        });
    });

    // Handle format select change
    if (timestampFormatSelect) {
        timestampFormatSelect.addEventListener('change', () => {
            if (timestampFormatSelect.disabled) return;
            const format = timestampFormatSelect.value || TIMESTAMP_DEFAULT_FORMAT;
            browser.storage.local.set({ fileTimeFormat: format }).then(() => {
                updateTimestampHint(format);
                showTimestampStatus('时间格式已更新');
            });
        });
    }

    // --- File Tree Controls ---
    setupFileTreeControls();

    // --- Feedback Button ---
    setupFeedbackButton();
});

// 设置反馈按钮
function setupFeedbackButton() {
    const feedbackBtn = document.getElementById('feedbackBtn');
    const feedbackStatus = document.getElementById('feedbackStatus');
    
    if (!feedbackBtn) return;

    feedbackBtn.addEventListener('click', async () => {
        try {
            feedbackBtn.disabled = true;
            feedbackBtn.classList.add('loading');
            
            // 获取 shimo_sid
            let shimoSid = '';
            try {
                const sidCookie = await browser.cookies.get({ url: 'https://shimo.im', name: 'shimo_sid' });
                if (sidCookie && sidCookie.value) {
                    shimoSid = sidCookie.value;
                } else {
                    shimoSid = '未找到 shimo_sid（可能未登录）';
                }
            } catch (error) {
                shimoSid = `获取 shimo_sid 失败: ${error.message}`;
            }

            // 获取日志信息
            let logs = [];
            try {
                const response = await browser.runtime.sendMessage({ action: 'getUiState' });
                if (response && response.success && response.data && response.data.logs) {
                    logs = response.data.logs;
                } else {
                    logs = ['暂无日志信息'];
                }
            } catch (error) {
                logs = [`获取日志失败: ${error.message}`];
            }

            // 组装反馈信息
            const feedbackText = [
                '=== 石墨文档导出工具反馈信息 ===',
                '',
                '--- shimo_sid ---',
                shimoSid,
                '',
                '--- 日志信息 ---',
                ...logs,
                '',
                '=== 反馈信息结束 ==='
            ].join('\n');

            // 复制到剪切板
            await navigator.clipboard.writeText(feedbackText);
            
            // 显示成功提示
            if (feedbackStatus) {
                feedbackStatus.textContent = '✅ 反馈信息已复制到剪切板！';
                feedbackStatus.style.display = 'block';
                feedbackStatus.style.opacity = '1';
                setTimeout(() => {
                    feedbackStatus.style.opacity = '0';
                    setTimeout(() => {
                        feedbackStatus.style.display = 'none';
                    }, 300);
                }, 3000);
            }
        } catch (error) {
            console.error('复制反馈信息失败:', error);
            if (feedbackStatus) {
                feedbackStatus.textContent = `❌ 复制失败: ${error.message}`;
                feedbackStatus.style.display = 'block';
                feedbackStatus.style.opacity = '1';
                setTimeout(() => {
                    feedbackStatus.style.opacity = '0';
                    setTimeout(() => {
                        feedbackStatus.style.display = 'none';
                    }, 300);
                }, 3000);
            }
        } finally {
            feedbackBtn.disabled = false;
            feedbackBtn.classList.remove('loading');
        }
    });
}

// 全局变量存储当前文件数据
let currentFileList = [];
let currentExportType = '';
let currentFilterStatus = 'all';

function setupFileTreeControls() {
    // 状态筛选按钮
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新按钮状态
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 应用筛选
            currentFilterStatus = btn.dataset.status;
            applyFileTreeFilter();
        });
    });

    // 刷新按钮
    const refreshBtn = document.getElementById('refreshTreeBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshFileTree();
        });
    }
}

function refreshFileTree() {
    const refreshBtn = document.getElementById('refreshTreeBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }

    // 重新加载数据
    loadPerformanceData().finally(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    });
}

function loadPerformanceData() {
    return new Promise((resolve) => {
        browser.runtime.sendMessage({ action: 'getUiState' }).then(response => {
            if (response && response.success && response.data && response.data.fileList.length > 0) {
                currentFileList = response.data.fileList;
                currentExportType = response.data.exportType || 'md';
                renderFileTree(currentFileList, currentExportType);
                renderSlowestFiles(currentFileList);
            } else {
                currentFileList = [];
                currentExportType = '';
                document.getElementById('file-tree-container').innerHTML = '<p>没有可用的性能数据。</p>';
                document.getElementById('slowest-files-container').innerHTML = '<p>没有可用的性能数据。</p>';
            }
            resolve();
        }).catch(() => {
            resolve();
        });
    });
}

function applyFileTreeFilter() {
    if (currentFileList.length === 0) return;

    let filteredFiles = currentFileList;
    
    // 根据状态筛选文件
    if (currentFilterStatus !== 'all') {
        filteredFiles = currentFileList.filter(file => file.status === currentFilterStatus);
    }

    // 重新渲染文件树
    renderFileTree(filteredFiles, currentExportType);
    
    // 更新文件计数
    updateFileCount(filteredFiles.length, currentFileList.length);
}

function updateFileCount(filteredCount, totalCount) {
    const container = document.getElementById('file-tree-container');
    const existingCount = container.querySelector('.file-count');
    
    if (existingCount) {
        existingCount.remove();
    }
    
    if (currentFilterStatus !== 'all') {
        const countDiv = document.createElement('div');
        countDiv.className = 'file-count';
        countDiv.style.cssText = 'margin-bottom: 12px; font-size: 0.9rem; color: var(--text-secondary);';
        countDiv.textContent = `显示 ${filteredCount} 个文件 (共 ${totalCount} 个)`;
        container.insertBefore(countDiv, container.firstChild);
    }
}

function renderFileTree(fileList, exportType) {
    const container = document.getElementById('file-tree-container');
    container.innerHTML = ''; // Clear previous content

    if (fileList.length === 0) {
        container.innerHTML = '<p>没有符合条件的文件。</p>';
        return;
    }

    const tree = {};
    fileList.forEach(file => {
        const pathParts = file.folderPath ? file.folderPath.split('/') : [];
        let currentLevel = tree;
        pathParts.forEach(part => {
            currentLevel[part] = currentLevel[part] || {};
            currentLevel = currentLevel[part];
        });
        currentLevel._files = currentLevel._files || [];
        currentLevel._files.push(file);
    });
    
    container.appendChild(createTreeHtml(tree, exportType));
    
    // Add event listeners
    container.querySelectorAll('.file-name').forEach(el => {
        el.addEventListener('click', () => {
            const linkEl = el.parentElement.nextElementSibling;
            if(linkEl && linkEl.classList.contains('file-link')) {
                linkEl.style.display = linkEl.style.display === 'block' ? 'none' : 'block';
            }
        });
    });

    container.querySelectorAll('.file-tree-folder > span').forEach(el => {
        el.addEventListener('click', () => {
            el.parentElement.classList.toggle('collapsed');
        });
    });

    // 更新文件计数
    updateFileCount(fileList.length, currentFileList.length);
}

function createTreeHtml(node, exportType) {
    const ul = document.createElement('ul');
    Object.keys(node).sort().forEach(key => {
        if (key === '_files') {
            node._files.forEach(file => {
                const li = document.createElement('li');
                
                const statusIcon = file.status === 'success' ? '✅' : (file.status === 'failed' ? '❌' : '⏳');
                const duration = file.duration ? `${(file.duration / 1000).toFixed(2)}s` : '-';

                const suggestedFilename = `${file.title}.${exportType}`;
                const downloadLink = file.downloadUrl 
                    ? `<a href="${file.downloadUrl}" download="${suggestedFilename}" target="_blank" rel="noopener noreferrer">点击直接下载</a>` 
                    : 'N/A';
                
                li.innerHTML = `
                    <div class="file-tree-file">
                        <span class="file-name">${statusIcon} ${file.title}</span>
                        <span class="file-metrics">
                           <span>${duration}</span>
                           <span>${file.retryCount || 0}次重试</span>
                        </span>
                    </div>
                    <div class="file-link">
                        <div><strong>Export URL:</strong> <span class="url-text">${file.exportUrl || 'N/A'}</span></div>
                        <div><strong>Download URL:</strong> ${downloadLink}</div>
                    </div>
                `;
                ul.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'file-tree-folder collapsed'; // Start collapsed by default
            li.innerHTML = `<span>${key}</span>`;
            li.appendChild(createTreeHtml(node[key], exportType));
            ul.appendChild(li);
        }
    });
    return ul;
}

function renderSlowestFiles(fileList) {
    const container = document.getElementById('slowest-files-container');
    const slowest = fileList
        .filter(f => f.status === 'success' && f.duration > 0)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

    if (slowest.length === 0) {
        container.innerHTML = '<p>没有成功的下载记录可供排名。</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'perf-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>文件名</th>
                <th>路径</th>
                <th>耗时 (秒)</th>
            </tr>
        </thead>
        <tbody>
            ${slowest.map(file => `
                <tr>
                    <td>${file.title}</td>
                    <td>${file.folderPath || '/'}</td>
                    <td>${(file.duration / 1000).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.innerHTML = '';
    container.appendChild(table);
} 