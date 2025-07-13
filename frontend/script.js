document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const projectListContainer = document.getElementById("project-list");
    const logContainer = document.getElementById("log-container");
    const connectBtn = document.querySelector(".connection-status"); // Updated selector
    const statusText = connectBtn.querySelector("span:last-child");
    const statusIndicator = connectBtn.querySelector(".status-indicator");
    const totalLogsEl = document.getElementById("total-logs");
    const errorLogsEl = document.getElementById("error-logs");
    const warningLogsEl = document.getElementById("warning-logs");
    const levelFilterEl = document.getElementById("level-filter");
    const operationFilterEl = document.getElementById("operation-filter");
    const searchFilterEl = document.getElementById("search-filter");
    const autoScrollBtn = document.getElementById("auto-scroll-btn");
    const clearBtn = document.getElementById("clear-btn");
    const exportBtn = document.getElementById("export-btn");
    const logCountDisplayEl = document.getElementById("log-count-display");
    const connectionTypeSelect = document.getElementById("connection-type");
    const bufferIndicator = document.getElementById("buffer-indicator");
    const bufferCountEl = document.getElementById("buffer-count");
    const scrollToTopBtn = document.getElementById("scroll-to-top-btn");

    // --- State ---
    let connection = null;
    let projects = {}; // To store logs grouped by project, populated from API
    let allLogs = []; // Store all received logs
    let totalLogs = 0;
    let errorLogs = 0;
    let warningLogs = 0;
    let isAutoScrollActive = true;
    let openContexts = new Set(); // Track which log contexts are open
    let bufferedLogs = []; // Buffer for new logs when user is scrolled down
    let isUserScrolledDown = false; // Track if user has scrolled away from top

    // --- Icons ---
    const ICONS = {
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="${getComputedStyle(document.documentElement).getPropertyValue('--color-blue').trim()}"/></svg>`,
        debug: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 8.5L15.5 12L19 15.5M12 20H5C4.46957 20 3.96086 19.7893 3.58579 19.4142C3.21071 19.0391 3 18.5304 3 18V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H19C19.5304 4 20.0391 4.21071 20.4142 4.58579C20.7893 4.96086 21 5.46957 21 6V11" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-purple').trim()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 21H22L12 2Z" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-yellow').trim()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9V13" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-yellow').trim()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17H12.01" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-yellow').trim()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 16C11.45 16 11 15.55 11 15V12C11 11.45 11.45 11 12 11C12.55 11 13 11.45 13 12V15C13 15.55 12.55 16 12 16ZM12 9.5C11.17 9.5 10.5 8.83 10.5 8C10.5 7.17 11.17 6.5 12 6.5C12.83 6.5 13.5 7.17 13.5 8C13.5 8.83 12.83 9.5 12 9.5Z" fill="${getComputedStyle(document.documentElement).getPropertyValue('--color-red').trim()}"/></svg>`,
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12L11 14L15 10M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-green').trim()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    };

    // --- Initialization ---
    async function initialize() {
        await fetchAndRenderProjects();
        setupEventListeners();
        connect(); // Auto-connect on load
    }

    // --- Project List Rendering ---
    async function fetchAndRenderProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const projectsData = await response.json();
            projects = projectsData.reduce((acc, proj) => {
                acc[proj.name] = proj;
                return acc;
            }, {});
            renderProjectList();
        } catch (error) {
            console.error("Failed to fetch projects:", error);
            projectListContainer.innerHTML = `<div class="error-message">Failed to load projects.</div>`;
        }
    }

    function renderProjectList() {
        projectListContainer.innerHTML = ""; // Clear existing list
        Object.values(projects).forEach(proj => {
            const projectItem = document.createElement("div");
            projectItem.className = "project-item";
            projectItem.dataset.projectName = proj.name;
            projectItem.innerHTML = `
                <div class="project-header">
                    <span class="project-name">
                        <svg class="project-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7Z" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span>${proj.name}</span>
                    </span>
                    <span class="project-info">
                        <span class="project-log-count">${proj.files.length}</span>
                        <span class="project-status"></span>
                    </span>
                </div>
                <div class="log-file-list">
                    <!-- Log files will be populated here on expand -->
                </div>
            `;
            projectListContainer.appendChild(projectItem);
        });
    }
    
    // --- Event Listeners ---
    function setupEventListeners() {
        // Project accordion and log file click handler
        projectListContainer.addEventListener("click", (e) => {
            const fileItem = e.target.closest(".log-file-item");
            
            // Handle log file click
            if (fileItem) {
                // Prevent the accordion from toggling when clicking a file
                e.stopPropagation(); 
                
                const filePath = fileItem.dataset.filePath;
                if (filePath) {
                    // Open the log file in a new tab
                    window.open(filePath, '_blank');
                }
                return; // Stop further processing for this click
            }
            
            // Handle project header click (accordion)
            const header = e.target.closest(".project-header");
            if (header) {
                const projectItem = header.parentElement;
                const fileList = projectItem.querySelector(".log-file-list");
                
                // Toggle active state
                header.classList.toggle("active");
                
                if (header.classList.contains("active")) {
                    // Lazy load/show log files
                    if (fileList.children.length === 0) {
                       const projectName = projectItem.dataset.projectName;
                       const projectData = projects[projectName];
                       if (projectData && projectData.files) {
                           fileList.innerHTML = projectData.files.map(file => {
                               const filePath = `logs/${projectName}/${file}`;
                               return `
                                <div class="log-file-item" data-file-path="${filePath}" title="${filePath}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 18.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    <span>${file}</span>
                                </div>`;
                               }
                           ).join('');
                       } else {
                           fileList.innerHTML = `<div class="log-file-item">No log files found.</div>`;
                       }
                    }
                    
                    // アニメーション用の初期状態を設定
                    const fileItems = fileList.querySelectorAll('.log-file-item');
                    fileItems.forEach((item, index) => {
                        item.style.opacity = '0';
                        item.style.transform = 'translateX(-10px)';
                        item.style.transitionDelay = `${(index + 1) * 0.05}s`;
                    });
                    
                    // CSSの制約を一時的にリセットして正しい高さを測定
                    fileList.style.maxHeight = 'none';
                    fileList.style.overflow = 'visible';
                    const actualHeight = fileList.scrollHeight;
                    
                    // 正しい高さを設定
                    fileList.style.overflow = 'hidden';
                    fileList.style.maxHeight = actualHeight + "px";
                    
                    // アニメーションを実行（少し遅延させて確実に実行）
                    setTimeout(() => {
                        fileItems.forEach((item) => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateX(0)';
                        });
                    }, 50);
                } else {
                    // 閉じる際のアニメーション
                    const fileItems = fileList.querySelectorAll('.log-file-item');
                    fileItems.forEach((item, index) => {
                        item.style.transitionDelay = `${index * 0.03}s`;
                        item.style.opacity = '0';
                        item.style.transform = 'translateX(-10px)';
                    });
                    
                    // アニメーション完了後に高さを0に設定
                    setTimeout(() => {
                        fileList.style.maxHeight = "0px";
                    }, 150);
                }
            }
        });

        // Log context toggle
        logContainer.addEventListener('click', (e) => {
            const toggle = e.target.closest('.log-context-toggle');
            if (toggle) {
                const logId = toggle.dataset.logId;
                toggle.classList.toggle('open');
                const context = toggle.nextElementSibling;
                
                if (toggle.classList.contains('open')) {
                    // Track this context as open
                    openContexts.add(logId);
                    // Add open class for CSS styling
                    context.classList.add('open');
                    // Set max-height for animation
                    context.style.maxHeight = context.scrollHeight + 'px';
                } else {
                    // Remove from tracking
                    openContexts.delete(logId);
                    // Remove open class
                    context.classList.remove('open');
                    // Reset max-height
                    context.style.maxHeight = '0px';
                }
            }
        });

        // Toolbar controls
        levelFilterEl.addEventListener('change', applyFilters);
        operationFilterEl.addEventListener('input', debounce(applyFilters, 300));
        searchFilterEl.addEventListener('input', debounce(applyFilters, 300));
        connectionTypeSelect.addEventListener('change', connect);

        autoScrollBtn.addEventListener('click', () => {
            isAutoScrollActive = !isAutoScrollActive;
            autoScrollBtn.classList.toggle('active', isAutoScrollActive);
        });

        clearBtn.addEventListener('click', clearLogs);
        
        exportBtn.addEventListener('click', () => alert('Export functionality not implemented yet.'));

        // Scroll to top button
        scrollToTopBtn.addEventListener('click', scrollToTopAndReleaseBuffer);

        // Monitor scroll position
        logContainer.addEventListener('scroll', handleScroll);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchFilterEl.focus();
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                clearLogs();
            }
        });
    }

    // --- WebSocket/SSE Connection ---
    function connect() {
        disconnect(); // Ensure any existing connection is closed
        const type = connectionTypeSelect.value;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;

        if (type === "ws") {
            connection = new WebSocket(`${protocol}//${host}/ws`);
            connection.onopen = handleOpen;
            connection.onmessage = handleMessage;
            connection.onclose = handleClose;
            connection.onerror = handleError;
        } else if (type === "sse") {
            connection = new EventSource("/sse");
            // Use the standard 'open' event instead of an optimistic call for reliability.
            connection.onopen = handleOpen;
            connection.onmessage = handleMessage;
            connection.onerror = (err) => {
                console.error("SSE Error:", err);
                handleError();
            };
        }
    }

    function disconnect() {
        if (connection) {
            // Prevent handlers from firing on an intentional disconnect.
            if (connection instanceof WebSocket) {
                connection.onopen = null;
                connection.onmessage = null;
                connection.onclose = null;
                connection.onerror = null;
            } else if (connection instanceof EventSource) {
                connection.onopen = null;
                connection.onmessage = null;
                connection.onerror = null;
            }
            connection.close();
            connection = null;
        }
    }

    // --- Connection Handlers ---
    function handleOpen() {
        console.log("Connection established");
        updateButton(true, "Connected");
    }

    function handleClose() {
        console.log("Connection closed");
        updateButton(false, "Disconnected");
    }

    function handleError() {
        console.error("Connection error");
        updateButton(false, "Error", true);
    }

    function handleMessage(event) {
        try {
            const logData = JSON.parse(event.data);
            allLogs.push(logData);
            updateStats(logData);
            
            // Check if user is scrolled down and auto-scroll is disabled
            if (isUserScrolledDown && !isAutoScrollActive) {
                // Add to buffer instead of immediately displaying
                bufferedLogs.push(logData);
                updateBufferIndicator();
            } else {
                // Normal rendering
                renderFilteredLogs();
            }
        } catch (e) {
            console.error("Failed to parse log data:", e);
        }
    }

    // --- UI Update Functions ---
    function updateButton(isConnected, text, isError = false) {
        statusText.textContent = text;
        statusIndicator.className = 'status-indicator';
        if(isError) {
            statusIndicator.classList.add('disconnected');
        } else {
            statusIndicator.classList.add(isConnected ? 'connected' : 'disconnected');
        }
    }

    function formatJsonContext(context) {
        if (typeof context === 'undefined' || context === null) return '';
        try {
            // Simply stringify with an indent of 2 spaces.
            // The <pre> tag will handle the formatting.
            return JSON.stringify(context, null, 2);
        } catch (e) {
            console.warn('JSON formatting failed, falling back to string conversion:', e);
            // Fallback for safety, e.g., if context is not valid JSON.
            return String(context);
        }
    }

    function createLogCard(log) {
        const card = document.createElement("div");
        const level = log.level ? log.level.toLowerCase() : 'info';
        // Create unique ID for this log card using timestamp and correlation_id
        const logId = `log-${log.timestamp}-${log.correlation_id || Math.random().toString(36).substr(2, 9)}`;
        card.className = `log-card ${level}`;
        card.dataset.logId = logId;

        const timestamp = new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = new Date(log.timestamp).toLocaleDateString('en-CA');

        const contextHtml = log.context ? `
            <div class="log-context-toggle" data-log-id="${logId}">
                <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Context</span>
            </div>
            <div class="log-context" data-log-id="${logId}">
                <pre><code>${formatJsonContext(log.context)}</code></pre>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="log-card-header">
                <span class="log-icon">${ICONS[level] || ICONS.info}</span>
                <span class="log-timestamp">${date} ${timestamp}</span>
                <span class="log-level">${log.level || 'INFO'}</span>
                <span class="log-operation">${log.operation || ''}</span>
                <span class="log-id">${log.correlation_id ? log.correlation_id.split('-')[0] : ''}</span>
            </div>
            <div class="log-card-body">
                <p class="log-message">${log.message || ''}</p>
                <p class="log-source">${log.source || ''}</p>
                ${contextHtml}
            </div>
        `;
        return card;
    }
    
    // --- Feature Implementations ---
    function updateStats(log) {
        totalLogs++;
        if (log.level === 'ERROR') errorLogs++;
        if (log.level === 'WARNING') warningLogs++;

        totalLogsEl.textContent = totalLogs;
        errorLogsEl.textContent = errorLogs;
        warningLogsEl.textContent = warningLogs;
    }

    function applyFilters() {
        renderFilteredLogs();
    }

    function renderFilteredLogs() {
        const levelFilter = levelFilterEl.value;
        const opFilter = operationFilterEl.value.toLowerCase();
        const searchFilter = searchFilterEl.value.toLowerCase();

        const filteredLogs = allLogs.filter(log => {
            const levelMatch = levelFilter === 'all' || (log.level && log.level.toLowerCase() === levelFilter);
            const opMatch = !opFilter || (log.operation && log.operation.toLowerCase().includes(opFilter));
            const searchMatch = !searchFilter || 
                (log.message && log.message.toLowerCase().includes(searchFilter)) ||
                (log.operation && log.operation.toLowerCase().includes(searchFilter)) ||
                (log.source && log.source.toLowerCase().includes(searchFilter)) ||
                (log.context && JSON.stringify(log.context).toLowerCase().includes(searchFilter));
            
            return levelMatch && opMatch && searchMatch;
        });

        logContainer.innerHTML = '';
        filteredLogs.forEach(log => {
            logContainer.prepend(createLogCard(log));
        });

        // Restore context states after rendering
        restoreContextStates();

        logCountDisplayEl.textContent = `Showing ${filteredLogs.length} of ${allLogs.length} logs`;
        
        if (isAutoScrollActive) {
            logContainer.scrollTop = 0; // Scroll to top because we prepend
        }
    }

    function restoreContextStates() {
        // Restore the open state for contexts that were previously open
        openContexts.forEach(logId => {
            const toggle = logContainer.querySelector(`.log-context-toggle[data-log-id="${logId}"]`);
            const context = logContainer.querySelector(`.log-context[data-log-id="${logId}"]`);
            
            if (toggle && context) {
                // Restore the open state
                toggle.classList.add('open');
                context.classList.add('open');
                // Use setTimeout to ensure the element is rendered before calculating height
                setTimeout(() => {
                    context.style.maxHeight = context.scrollHeight + 'px';
                }, 10);
            }
        });
    }

    function clearLogs() {
        allLogs = [];
        totalLogs = 0;
        errorLogs = 0;
        warningLogs = 0;
        openContexts.clear(); // Clear context states
        bufferedLogs = []; // Clear buffer
        isUserScrolledDown = false; // Reset scroll state
        updateBufferIndicator(); // Hide buffer indicator
        
        totalLogsEl.textContent = '0';
        errorLogsEl.textContent = '0';
        warningLogsEl.textContent = '0';
        
        renderFilteredLogs();
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    function handleScroll() {
        const scrollTop = logContainer.scrollTop;
        const threshold = 50; // 50px from top
        
        // Update scroll state
        isUserScrolledDown = scrollTop > threshold;
        
        // If user scrolled to top and there are buffered logs, release them
        if (!isUserScrolledDown && bufferedLogs.length > 0) {
            releaseBufferedLogs();
        }
    }

    function updateBufferIndicator() {
        if (bufferedLogs.length > 0) {
            bufferCountEl.textContent = bufferedLogs.length;
            bufferIndicator.style.display = 'flex';
        } else {
            bufferIndicator.style.display = 'none';
        }
    }

    function releaseBufferedLogs() {
        if (bufferedLogs.length === 0) return;
        
        // Clear buffer
        bufferedLogs = [];
        
        // Hide indicator
        updateBufferIndicator();
        
        // Re-render all logs
        renderFilteredLogs();
    }

    function scrollToTopAndReleaseBuffer() {
        // Scroll to top
        logContainer.scrollTop = 0;
        
        // Release buffered logs
        releaseBufferedLogs();
        
        // Update scroll state
        isUserScrolledDown = false;
    }

    // --- Start ---
    initialize();
});
