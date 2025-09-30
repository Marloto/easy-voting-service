// Main application logic for config.html

class ConfigApp {
    constructor() {
        this.stateManager = new ConfigStateManager();
        this.sortable = null;
        this.init();
    }

    init() {
        this.setupStateListeners();
        this.setupEventListeners();
        this.loadInitialState();
    }

    setupStateListeners() {
        // Listen to state changes and update UI accordingly
        this.stateManager.addEventListener('config-changed', (data) => {
            console.log('Config changed, updating UI');
            this.updateUI();
            this.updatePollInfoInputs();
        });

        this.stateManager.addEventListener('session-changed', (sessionData) => {
            console.log('Session changed:', sessionData);
            this.switchToPhase2();
            this.updateUI();
        });

        this.stateManager.addEventListener('item-added', () => {
            this.renderSortableList();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('item-updated', () => {
            this.renderSortableList();
        });

        this.stateManager.addEventListener('item-deleted', () => {
            this.renderSortableList();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('items-reordered', () => {
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('voter-added', () => {
            this.renderVoters();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('voter-updated', () => {
            this.renderVoters();
        });

        this.stateManager.addEventListener('voter-deleted', () => {
            this.renderVoters();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('subject-added', () => {
            this.renderSubjects();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('subject-updated', () => {
            this.renderSubjects();
        });

        this.stateManager.addEventListener('subject-deleted', () => {
            this.renderSubjects();
            this.toggleEmptyMessages();
        });

        this.stateManager.addEventListener('sync-success', (data) => {
            // Remove auto-save success messages - they're too frequent and not needed
            console.log(`Auto-saved to server at ${new Date(data.timestamp).toLocaleTimeString()}`);
        });

        this.stateManager.addEventListener('sync-error', (error) => {
            this.showError('Failed to sync to server: ' + (error.message || 'Unknown error'));
        });

        this.stateManager.addEventListener('state-cleared', () => {
            this.returnToPhase1();
        });
    }

    loadInitialState() {
        // Check if we have a session from localStorage
        const session = this.stateManager.getSession();
        if (session) {
            console.log('Found existing session in localStorage, switching to Phase 2');
            this.switchToPhase2();
            this.updateUI();
        }
    }

    updateUI() {
        this.renderSortableList();
        this.renderVoters();
        this.renderSubjects();
        this.toggleEmptyMessages();
    }

    setupEventListeners() {
        // Phase 1 buttons
        document.getElementById('createNewBtn').addEventListener('click', () => {
            this.createNewSession();
        });

        document.getElementById('uploadConfigBtn').addEventListener('click', () => {
            this.triggerConfigUpload();
        });

        document.getElementById('configFileInput').addEventListener('change', (e) => {
            this.handleConfigUpload(e);
        });

        // Drag & drop functionality
        this.setupDragAndDrop();

        document.getElementById('exportConfigBtn').addEventListener('click', () => {
            this.showExportModal();
        });

        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.showClearDataModal();
        });

        document.getElementById('addGroupBtn').addEventListener('click', () => {
            this.addGroup();
        });

        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            this.addQuestion();
        });

        document.getElementById('addVoterBtn').addEventListener('click', () => {
            this.addVoter();
        });

        document.getElementById('showQRCodeBtn').addEventListener('click', () => {
            this.showQRCode();
        });
        
        document.getElementById('printVotersBtn').addEventListener('click', () => {
            this.printVoters();
        });
        
        document.getElementById('showResultsBtn').addEventListener('click', () => {
            this.showResults();
        });

        // Poll info modal
        document.getElementById('editPollInfoBtn').addEventListener('click', () => {
            this.showPollInfoModal();
        });
        
        document.getElementById('savePollInfoBtn').addEventListener('click', () => {
            this.savePollInfoFromModal();
        });

        document.getElementById('addSubjectBtnSidebar').addEventListener('click', () => {
            this.addSubjectInline();
        });



        document.getElementById('addSubjectBtn').addEventListener('click', () => {
            this.addSubject();
        });

        // Handle Enter key in subject input
        document.getElementById('newSubjectInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSubject();
            }
        });
        
        // Clear data modal event handlers
        document.getElementById('clearLocalBtn').addEventListener('click', () => {
            this.clearLocalData();
        });
        
        document.getElementById('exportAndClearBtn').addEventListener('click', () => {
            this.exportAndClearAll();
        });
        
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllData();
        });
    }

    async createNewSession() {
        this.showLoading(true);

        try {
            // Generate new session keys
            const sessionData = await CryptoUtils.createSessionKeys();

            // Update URL fragment
            CryptoUtils.setSessionInURL(sessionData.sessionId);

            // Set session in state manager (this will trigger session-changed event)
            this.stateManager.setSession(sessionData);

            // No success message needed - switching to phase 2 is self-evident
        } catch (error) {
            console.error('Error creating session:', error);
            this.showError('Failed to create new session');
        } finally {
            this.showLoading(false);
        }
    }

    switchToPhase2() {
        document.getElementById('phase1').classList.add('d-none');
        document.getElementById('phase2').classList.remove('d-none');

        // Update session info display
        const session = this.stateManager.getSession();
        if (session) {
            document.getElementById('displaySessionId').textContent = session.sessionId;
            document.getElementById('displayMasterKey').textContent = session.masterKey;
        }

        // Update poll info inputs
        this.updatePollInfoInputs();

        // Initialize sortable list
        this.initializeSortable();
        
        // Initialize Bootstrap tooltips
        this.initializeTooltips();
    }
    
    updatePollInfoInputs() {
        // Update header display
        this.updatePollInfoDisplay();
    }
    
    showPollInfoModal() {
        const config = this.stateManager.getConfig();
        
        // Populate modal with current values
        document.getElementById('pollTitleInputModal').value = config.title || '';
        document.getElementById('pollDescriptionInputModal').value = config.description || '';
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('pollInfoModal'));
        modal.show();
    }
    
    savePollInfoFromModal() {
        const title = document.getElementById('pollTitleInputModal').value.trim();
        const description = document.getElementById('pollDescriptionInputModal').value.trim();
        
        // Update config
        this.stateManager.updateConfig({ title, description });
        
        // Update display in header
        this.updatePollInfoDisplay();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('pollInfoModal'));
        modal.hide();
        
        this.showSuccess('Poll information updated!');
    }
    
    updatePollInfoDisplay() {
        const config = this.stateManager.getConfig();
        
        // Update title display
        const titleDisplay = document.getElementById('pollTitleDisplay');
        const titleText = config.title || 'Untitled Poll';
        titleDisplay.innerHTML = `
            ${titleText}
            <button class="btn btn-link p-0 ms-2" id="editPollInfoBtn" style="color: rgba(255,255,255,0.7);">
                <i class="bi bi-pencil-square"></i>
            </button>
        `;
        
        // Re-attach event listener to the new button
        document.getElementById('editPollInfoBtn').addEventListener('click', () => {
            this.showPollInfoModal();
        });
        
        // Update description display
        const descriptionDisplay = document.getElementById('pollDescriptionDisplay');
        descriptionDisplay.textContent = config.description || 'Click pencil to edit poll information';
    }

    async startNewSession() {
        const confirmed = await this.showConfirm(
            'Are you sure? This will discard current session data.',
            'Discard',
            'Cancel'
        );
        
        if (confirmed) {
            // Clear URL fragment
            window.location.hash = '';

            // Clear state via state manager
            this.stateManager.clear();
        }
    }

    returnToPhase1() {
        document.getElementById('phase2').classList.add('d-none');
        document.getElementById('phase1').classList.remove('d-none');
    }

    initializeSortable() {
        const listElement = document.getElementById('sortableList');
        if (this.sortable) {
            this.sortable.destroy();
        }

        this.sortable = Sortable.create(listElement, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            handle: '.drag-handle',
            onEnd: () => {
                this.updateItemOrder();
            }
        });
    }
    
    initializeTooltips() {
        // Initialize Bootstrap tooltips for info icons
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    addGroup() {
        const group = {
            id: 'group_' + Date.now(),
            type: 'group',
            name: 'New Group'
        };

        this.stateManager.addItem(group);
    }

    addQuestion() {
        const question = {
            id: 'question_' + Date.now(),
            type: 'question',
            text: 'New Question',
            questionType: 'rating',
            scale: 5
        };

        this.stateManager.addItem(question);
    }

    addVoter() {
        const config = this.stateManager.getConfig();
        const existingKeys = config.voters.map(v => v.id);

        try {
            const voterKey = CryptoUtils.generateUniqueVoterKey(existingKeys);
            const voter = {
                id: voterKey,
                name: 'Voter ' + (config.voters.length + 1),
                type: 'single' // 'single' or 'group'
            };

            this.stateManager.addVoter(voter);
        } catch (error) {
            console.error('Failed to generate unique voter key:', error);
            this.showError('Failed to generate unique voter key. Please try again.');
        }
    }

    renderSortableList() {
        const listElement = document.getElementById('sortableList');
        listElement.innerHTML = '';

        const config = this.stateManager.getConfig();
        config.items.forEach(item => {
            const itemElement = this.createSortableItem(item);
            listElement.appendChild(itemElement);
        });

        // Re-initialize sortable after rendering
        if (this.sortable) {
            this.initializeSortable();
        }
    }

    createSortableItem(item) {
        const div = document.createElement('div');
        div.className = `sortable-item ${item.type}-item`;
        div.setAttribute('data-id', item.id);
        div.setAttribute('data-type', item.type);

        if (item.type === 'group') {
            div.innerHTML = this.createGroupItemHTML(item);
        } else {
            div.innerHTML = this.createQuestionItemHTML(item);
        }

        return div;
    }

    createGroupItemHTML(group) {
        return `
            <div class="p-3">
                <div class="d-flex align-items-center">
                    <i class="bi bi-grip-vertical drag-handle me-2"></i>
                    <div class="flex-grow-1">
                        <div class="row align-items-center">
                            <div class="col-10 col-xl-11">
                                <div class="form-floating mb-1">
                                    <input type="text" class="form-control form-control-sm" 
                                        id="groupText_${group.id}"
                                        value="${group.name}" placeholder="Group name"
                                        onchange="app.updateItem('${group.id}', 'name', this.value)"
                                        style="font-weight: bold;">
                                    <label for="groupText_${group.id}" class="form-label form-label-sm">Group</label>
                                </div>
                            </div>
                            <div class="col-2 col-xl-1 d-flex align-items-stretch">
                                <div class="w-100 d-flex align-items-center">
                                    <button class="btn btn-outline-danger btn-sm w-100 h-100" style="min-height: 58px;" onclick="app.deleteItem('${group.id}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createQuestionItemHTML(question) {
        return `
            <div class="p-3">
                <div class="d-flex align-items-center">
                    <i class="bi bi-grip-vertical drag-handle me-2"></i>
                    <div class="flex-grow-1">
                        <div class="row align-items-center">
                            <div class="col-5 col-xl-6">
                                <div class="form-floating mb-1">
                                    <input type="text" class="form-control form-control-sm" 
                                    id="questionText_${question.id}"
                                    value="${question.text}" placeholder="Question text"
                                    onchange="app.updateItem('${question.id}', 'text', this.value)">
                                    <label for="questionText_${question.id}" class="form-label form-label-sm">Question</label>
                                </div>
                            </div>
                            <div class="col-3 col-xl-3">
                                <div class="form-floating">
                                    <select class="form-select form-select-sm" 
                                        id="questionType_${question.id}"
                                        onchange="app.updateItem('${question.id}', 'questionType', this.value)">
                                        <option value="rating" ${question.questionType === 'rating' ? 'selected' : ''}>Rating Scale</option>
                                        <option value="yes_no" ${question.questionType === 'yes_no' ? 'selected' : ''}>Yes/No</option>
                                        <option value="text" ${question.questionType === 'text' ? 'selected' : ''}>Text</option>
                                    </select>
                                    <label for="questionType_${question.id}" class="form-label form-label-sm">Type</label>
                                </div>
                            </div>
                            <div class="col-2 col-xl-2">
                                <div class="form-floating">
                                    <input type="number" class="form-control form-control-sm" 
                                        id="questionScale_${question.id}"
                                        value="${question.scale || 5}" min="1" max="10"
                                        ${question.questionType !== 'rating' ? 'disabled' : ''}
                                        onchange="app.updateItem('${question.id}', 'scale', this.value)">
                                    <label for="questionScale_${question.id}" class="form-label form-label-sm">Scale</label>
                                </div>
                            </div>
                            <div class="col-2 col-xl-1 d-flex align-items-stretch">
                                <div class="w-100 d-flex align-items-center">
                                    <button class="btn btn-outline-danger btn-sm w-100 h-100" style="min-height: 58px;" onclick="app.deleteItem('${question.id}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    renderVoters() {
        const votersList = document.getElementById('votersList');
        votersList.innerHTML = '';

        const config = this.stateManager.getConfig();
        config.voters.forEach(voter => {
            const voterItem = this.createVoterItem(voter);
            votersList.appendChild(voterItem);
        });
    }

    createVoterItem(voter) {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="row align-items-center">
                    <div class="col-5 col-xl-5 col-lg-5">
                        <strong class="voter-key-protected" 
                                title="Hover to show full key"
                                data-full-key="${voter.id}">
                            ${voter.id.substring(0, 2)}...
                        </strong>
                    </div>
                    <div class="col-5 col-xl-5 col-lg-4">
                        <select class="form-select form-select-sm w-100"
                        onchange="app.updateVoterType('${voter.id}', this.value)">
                            <option value="single" ${voter.type === 'single' ? 'selected' : ''}>Single Vote</option>
                            <option value="group" ${voter.type === 'group' ? 'selected' : ''}>Group Vote</option>
                        </select>
                    </div>
                    <div class="col-2 col-xl-2 col-lg-3">
                        <button class="btn btn-outline-danger btn-sm w-100"
                        onclick="app.deleteVoter('${voter.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add hover behavior for voter key privacy
        const voterKeyElement = div.querySelector('.voter-key-protected');
        if (voterKeyElement) {
            voterKeyElement.addEventListener('mouseenter', () => {
                voterKeyElement.textContent = voterKeyElement.dataset.fullKey;
            });
            
            voterKeyElement.addEventListener('mouseleave', () => {
                const fullKey = voterKeyElement.dataset.fullKey;
                voterKeyElement.textContent = fullKey.substring(0, 2) + '...';
            });
        }
        
        return div;
    }

    updateItemOrder() {
        const listElement = document.getElementById('sortableList');
        const items = Array.from(listElement.children);

        // Reorder items array based on DOM order
        const config = this.stateManager.getConfig();
        const newOrder = items.map(element => {
            const id = element.getAttribute('data-id');
            return config.items.find(item => item.id === id);
        }).filter(item => item); // Filter out any undefined items

        this.stateManager.reorderItems(newOrder);
    }

    updateItem(itemId, field, value) {
        this.stateManager.updateItem(itemId, field, value);
    }

    async deleteItem(itemId) {
        const config = this.stateManager.getConfig();
        const item = config.items.find(i => i.id === itemId);
        const itemType = item ? item.type : 'item';

        const confirmed = await this.showConfirm(
            `Delete this ${itemType}?`,
            'Delete',
            'Cancel'
        );
        
        if (confirmed) {
            this.stateManager.deleteItem(itemId);
        }
    }

    toggleEmptyMessages() {
        const config = this.stateManager.getConfig();
        document.getElementById('emptyListMessage').classList.toggle('d-none', config.items.length > 0);
        document.getElementById('emptyVotersMessage').classList.toggle('d-none', config.voters.length > 0);
        document.getElementById('emptySubjectsMessage').classList.toggle('d-none', config.subjects.length > 0);
    }

    renderSubjects() {
        const subjectsList = document.getElementById('subjectsList');
        subjectsList.innerHTML = '';

        const config = this.stateManager.getConfig();
        config.subjects.forEach(subject => {
            const subjectItem = this.createSubjectItem(subject);
            subjectsList.appendChild(subjectItem);
        });
    }

    createSubjectItem(subject) {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        div.innerHTML = `
            <div class="card-body p-2">
            <div class="row align-items-center">
                <div class="col-10 col-lg-9 col-xl-10">
                <input type="text" class="form-control form-control-sm border-0 bg-transparent shadow-none" 
                    value="${subject.name}" placeholder="Subject name"
                    onchange="app.updateSubjectName('${subject.id}', this.value)"
                    style="font-size: 1em;">
                </div>
                <div class="col-2 col-lg-3 col-xl-2">
                <button class="btn btn-outline-danger btn-sm w-100" 
                    onclick="app.deleteSubject('${subject.id}')">
                    <i class="bi bi-trash"></i>
                </button>
                </div>
            </div>
            </div>
        `;
        return div;
    }

    addSubjectInline() {
        const subject = {
            id: 'subject_' + Date.now(),
            name: 'New Subject'
        };

        this.stateManager.addSubject(subject);
    }

    updateSubjectName(subjectId, newName) {
        this.stateManager.updateSubject(subjectId, 'name', newName);
    }

    async deleteSubject(subjectId) {
        const confirmed = await this.showConfirm(
            'Delete this subject?',
            'Delete',
            'Cancel'
        );
        
        if (confirmed) {
            this.stateManager.deleteSubject(subjectId);
        }
    }



    loadConfigurationUI() {
        // Convert old format to new flat format if needed
        if (this.pollConfig.groups && this.pollConfig.groups.length > 0) {
            this.convertOldFormatToNew();
        }

        this.renderSortableList();
        this.renderVoters();
        this.renderSubjects();
        this.toggleEmptyMessages();
    }

    convertOldFormatToNew() {
        const items = [];

        this.pollConfig.groups.forEach(group => {
            // Add group item
            items.push({
                id: group.id,
                type: 'group',
                name: group.name
            });

            // Add questions for this group
            group.questions.forEach(question => {
                items.push({
                    id: question.id,
                    type: 'question',
                    text: question.text,
                    questionType: question.type,
                    scale: question.scale
                });
            });
        });

        this.pollConfig.items = items;
        delete this.pollConfig.groups; // Remove old format
    }

    convertNewFormatForSaving() {
        // Convert flat list back to grouped format for backend compatibility
        const groups = [];
        let currentGroup = null;
        let unnamedQuestions = [];

        this.pollConfig.items.forEach(item => {
            if (item.type === 'group') {
                // Save previous unnamed questions if any
                if (unnamedQuestions.length > 0) {
                    groups.push({
                        id: 'unnamed_' + Date.now(),
                        name: 'Unnamed Questions',
                        questions: unnamedQuestions
                    });
                    unnamedQuestions = [];
                }

                // Start new group
                currentGroup = {
                    id: item.id,
                    name: item.name,
                    questions: []
                };
                groups.push(currentGroup);
            } else if (item.type === 'question') {
                const question = {
                    id: item.id,
                    text: item.text,
                    type: item.questionType,
                    scale: item.scale
                };

                if (currentGroup) {
                    currentGroup.questions.push(question);
                } else {
                    unnamedQuestions.push(question);
                }
            }
        });

        // Handle remaining unnamed questions
        if (unnamedQuestions.length > 0) {
            groups.push({
                id: 'unnamed_' + Date.now(),
                name: 'Unnamed Questions',
                questions: unnamedQuestions
            });
        }

        return {
            ...this.pollConfig,
            groups: groups,
            items: undefined // Remove items from saved format
        };
    }

    // Legacy methods - kept for compatibility but no longer used

    updateVoterType(voterId, newType) {
        this.stateManager.updateVoter(voterId, 'type', newType);
    }

    async deleteVoter(voterId) {
        const confirmed = await this.showConfirm(
            'Delete this voter?',
            'Delete',
            'Cancel'
        );
        
        if (confirmed) {
            this.stateManager.deleteVoter(voterId);
        }
    }


    showResults() {
        const session = this.stateManager.getSession();
        if (!session) {
            this.showError('No active session. Please save your configuration first.');
            return;
        }

        const config = this.stateManager.getConfig();
        
        // Check if there are any voters
        if (!config.voters || config.voters.length === 0) {
            this.showError('No voters configured. Please add some voters before viewing results.');
            return;
        }

        // Create secure results URL with base64 encoded data
        const resultsData = {
            sessionId: session.sessionId,
            masterKey: session.masterKey,
            voterKeys: config.voters.map(v => v.id)
        };
        
        // Base64 encode the data for URL obfuscation
        const encodedData = btoa(JSON.stringify(resultsData));
        const resultsUrl = `results.html#${encodedData}`;
        
        console.log('Opening results with encoded data (length:', encodedData.length, 'chars)');
        
        // Open results page in new tab
        window.open(resultsUrl, '_blank');
        
        this.showInfo('Results page opened in new tab');
    }
    
    printVoters() {
        const session = this.stateManager.getSession();
        if (!session) {
            this.showError('No active session. Please save your configuration first.');
            return;
        }

        const config = this.stateManager.getConfig();
        
        // Check if there are any voters
        if (!config.voters || config.voters.length === 0) {
            this.showError('No voters configured. Please add some voters before printing.');
            return;
        }

        // Create voter data for print view
        const voterData = {
            sessionId: session.sessionId,
            pollTitle: config.title || 'Untitled Poll',
            voters: config.voters.map(v => ({
                id: v.id,
                type: v.type || 'single'
            }))
        };
        
        // Base64 encode the data for URL
        const encodedData = btoa(JSON.stringify(voterData));
        const printUrl = `print-voters.html#${encodedData}`;
        
        console.log('Opening print view with voter data:', {
            votersCount: config.voters.length,
            singleVoters: config.voters.filter(v => v.type === 'single' || !v.type).length,
            groupVoters: config.voters.filter(v => v.type === 'group').length
        });
        
        // Open print page in new tab
        window.open(printUrl, '_blank');
        
        this.showInfo('Print view opened in new tab');
    }
    
    showQRCode() {
        const session = this.stateManager.getSession();
        if (!session) {
            this.showError('No active session. Please save your configuration first.');
            return;
        }
        
        // Generate voting URL
        const votingUrl = `${window.location.origin}${window.location.pathname.replace('config.html', 'voting.html')}#${session.sessionId}`;
        
        // Show backdrop and modal
        document.getElementById('qrBackdrop').classList.remove('d-none');
        document.getElementById('qrModal').classList.remove('d-none');
        
        // Set up event listeners for QR modal (do this each time to ensure they work)
        this.setupQRModalEventListeners();
        
        // Set the voting link input
        document.getElementById('votingLinkInput').value = votingUrl;
        
        // Generate QR code
        const qrContainer = document.getElementById('qrCodeDisplay');
        qrContainer.innerHTML = ''; // Clear previous QR code
        
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrContainer, {
                    text: votingUrl,
                    width: 256,
                    height: 256,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (error) {
                console.error('QR Code generation failed:', error);
                qrContainer.innerHTML = '<p class="text-danger">Failed to generate QR code</p>';
            }
        } else {
            qrContainer.innerHTML = '<p class="text-warning">QR Code library not loaded</p>';
        }
        
    }
    
    setupQRModalEventListeners() {
        // Close button
        const closeQRButton = document.getElementById('closeQRModal');
        if (closeQRButton) {
            // Remove any existing listeners first
            closeQRButton.replaceWith(closeQRButton.cloneNode(true));
            const newCloseButton = document.getElementById('closeQRModal');
            newCloseButton.addEventListener('click', () => {
                this.hideQRCode();
            });
        }
        
        // Backdrop click
        const qrBackdrop = document.getElementById('qrBackdrop');
        if (qrBackdrop) {
            // Remove any existing listeners first
            qrBackdrop.replaceWith(qrBackdrop.cloneNode(true));
            const newBackdrop = document.getElementById('qrBackdrop');
            newBackdrop.addEventListener('click', () => {
                this.hideQRCode();
            });
        }
        
        // Copy button
        const copyLinkButton = document.getElementById('copyLinkBtn');
        if (copyLinkButton) {
            // Remove any existing listeners first
            copyLinkButton.replaceWith(copyLinkButton.cloneNode(true));
            const newCopyButton = document.getElementById('copyLinkBtn');
            newCopyButton.addEventListener('click', () => {
                this.copyVotingLink();
            });
        }
    }
    
    hideQRCode() {
        document.getElementById('qrBackdrop').classList.add('d-none');
        document.getElementById('qrModal').classList.add('d-none');
    }
    
    async copyVotingLink() {
        const input = document.getElementById('votingLinkInput');
        
        try {
            await navigator.clipboard.writeText(input.value);
            
            // Update button temporarily to show success
            const button = document.getElementById('copyLinkBtn');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check"></i> Copied!';
            button.classList.remove('btn-outline-secondary');
            button.classList.add('btn-success');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('btn-success');
                button.classList.add('btn-outline-secondary');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            // Fallback: select the text
            input.select();
            input.setSelectionRange(0, 99999); // For mobile devices
            this.showInfo('Link selected - please copy manually (Ctrl+C)');
        }
    }

    // UI helper methods
    showLoading(show) {
        document.getElementById('loadingSpinner').classList.toggle('d-none', !show);
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showInfo(message) {
        this.showAlert(message, 'info');
    }

    showWarning(message) {
        this.showAlert(message, 'warning');
    }

    showAlert(message, type) {
        // Create unique toast ID
        const toastId = 'toast_' + Date.now();
        
        // Create toast element
        const toastDiv = document.createElement('div');
        toastDiv.id = toastId;
        toastDiv.className = 'toast align-items-center border-0 mb-3';
        toastDiv.setAttribute('role', 'alert');
        toastDiv.setAttribute('aria-live', 'assertive');
        toastDiv.setAttribute('aria-atomic', 'true');
        
        // Set toast color based on type
        let bgClass = 'bg-primary';
        let iconClass = 'bi-info-circle';
        
        if (type === 'danger') {
            bgClass = 'bg-danger';
            iconClass = 'bi-exclamation-triangle';
        } else if (type === 'success') {
            bgClass = 'bg-success';
            iconClass = 'bi-check-circle';
        } else if (type === 'warning') {
            bgClass = 'bg-warning';
            iconClass = 'bi-exclamation-triangle';
        }
        
        toastDiv.classList.add(bgClass, 'text-white');
        
        toastDiv.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${iconClass} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add to container
        document.getElementById('toastContainer').appendChild(toastDiv);
        
        // Initialize and show Bootstrap toast
        const toast = new bootstrap.Toast(toastDiv, {
            autohide: true,
            delay: type === 'danger' ? 8000 : 4000 // Errors stay longer
        });
        
        toast.show();
        
        // Clean up after toast is hidden
        toastDiv.addEventListener('hidden.bs.toast', () => {
            toastDiv.remove();
        });
    }
    
    // Modern confirmation dialog replacement
    showConfirm(message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Update modal content
            document.getElementById('confirmationMessage').textContent = message;
            document.getElementById('confirmActionBtn').textContent = confirmText;
            
            // Set up event handlers
            const confirmBtn = document.getElementById('confirmActionBtn');
            const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
            
            const handleConfirm = () => {
                modal.hide();
                confirmBtn.removeEventListener('click', handleConfirm);
                resolve(true);
            };
            
            const handleCancel = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                resolve(false);
            };
            
            // Add event listeners
            confirmBtn.addEventListener('click', handleConfirm);
            document.getElementById('confirmationModal').addEventListener('hidden.bs.modal', handleCancel, { once: true });
            
            // Show modal
            modal.show();
        });
    }

    
    triggerConfigUpload() {
        document.getElementById('configFileInput').click();
    }
    
    setupDragAndDrop() {
        const dropZone = document.getElementById('uploadDropZone');
        if (!dropZone) return;
        
        // Prevent default drag behaviors on the entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleDroppedFile(files[0]);
            }
        });
        
        // Also make the entire card clickable
        dropZone.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // Don't trigger if clicking the button
            this.triggerConfigUpload();
        });
    }
    
    async handleDroppedFile(file) {
        // Check if it's a JSON file
        if (!file.name.toLowerCase().endsWith('.json')) {
            this.showError('Please drop a JSON file');
            return;
        }
        
        try {
            const text = await file.text();
            const configData = JSON.parse(text);
            
            // Validate config structure
            if (!this.validateConfigStructure(configData)) {
                this.showError('Invalid configuration file format');
                return;
            }
            
            // Load the config
            await this.loadConfigFromData(configData);
            
            this.showSuccess(`Configuration "${file.name}" uploaded successfully!`);
            
        } catch (error) {
            console.error('Error processing dropped file:', error);
            this.showError('Failed to load configuration file. Please check the file format.');
        }
    }
    
    async handleConfigUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const configData = JSON.parse(text);
            
            // Validate config structure
            if (!this.validateConfigStructure(configData)) {
                this.showError('Invalid configuration file format');
                return;
            }
            
            // Load the config
            await this.loadConfigFromData(configData);
            
            this.showSuccess('Configuration uploaded successfully!');
            
            // Clear the file input
            event.target.value = '';
            
        } catch (error) {
            console.error('Error uploading config:', error);
            this.showError('Failed to load configuration file. Please check the file format.');
        }
    }
    
    validateConfigStructure(configData) {
        // Must be an object with version
        if (!configData || typeof configData !== 'object' || !configData.version) {
            return false;
        }
        
        // Must have either session data or config data (or both)
        const hasSession = configData.session && typeof configData.session === 'object';
        const hasConfig = configData.config && typeof configData.config === 'object';
        
        if (!hasSession && !hasConfig) {
            return false;
        }
        
        // If config exists, validate it has at least some data
        if (hasConfig) {
            const config = configData.config;
            const hasData = config.groups || config.items || config.subjects || 
                           config.voters || config.title !== undefined || config.description !== undefined;
            return hasData;
        }
        
        return true;
    }
    
    async loadConfigFromData(configData) {
        try {
            // Handle session data
            if (configData.session) {
                // Use provided session data
                this.stateManager.setSession(configData.session);
            } else {
                // No session data - create new session (template import)
                await this.createNewSession();
            }
            
            // Handle config data if present
            if (configData.config) {
                if (configData.config.groups && Array.isArray(configData.config.groups)) {
                    // Convert grouped format to flat format
                    this.convertFromGroupedFormat(configData.config);
                } else {
                    // Use config as-is (already in flat format or partial)
                    const currentConfig = this.stateManager.getConfig();
                    const mergedConfig = { ...currentConfig, ...configData.config };
                    this.stateManager.updateConfig(mergedConfig);
                }
            }
            
            // Handle voting data recreation if present
            let votingRecreationResults = null;
            if (configData.votes && configData.session) {
                const onSuccess = async () => {
                    try {
                        votingRecreationResults = await this.recreateVotingData(configData.votes, configData.session);
                    } catch (error) {
                        console.warn('Failed to recreate voting data:', error);
                        this.showWarning('Configuration imported but voting data recreation failed: ' + error.message);
                    }
                    this.stateManager.removeEventListener('sync-success', onSuccess);
                };
                this.stateManager.addEventListener('sync-success', onSuccess);
            }
            
            // Switch to phase 2
            this.switchToPhase2();
            
            // Show appropriate success message
            if (!configData.session) {
                this.showInfo('Configuration imported into new session. Session ID and master key have been generated.');
            } else if (votingRecreationResults) {
                this.showSuccess(`Configuration imported successfully! Voting data recreated: ${votingRecreationResults.uploadedCount} votes uploaded, ${votingRecreationResults.skippedCount} skipped.`);
            } else {
                this.showSuccess('Configuration imported successfully!');
            }
            
        } catch (error) {
            console.error('Error loading config data:', error);
            throw error;
        }
    }
    
    async recreateVotingData(votes, session) {
        if (!votes || !session) {
            throw new Error('Missing votes or session data');
        }
        
        this.showLoading(true);
        
        try {
            const storageHash = await CryptoUtils.sha256(session.sessionId);
            const masterHash = await CryptoUtils.sha256(session.masterKey);
            
            const response = await fetch(`api/data/${storageHash}/votes/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Hash': masterHash
                },
                body: JSON.stringify({ votes })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload voting data');
            }
            
            const result = await response.json();
            console.log('Voting data recreation result:', result);
            return result;
        } finally {
            this.showLoading(false);
        }
    }
    
    convertFromGroupedFormat(groupedConfig) {
        const items = [];
        
        if (groupedConfig.groups) {
            groupedConfig.groups.forEach(group => {
                items.push({
                    id: group.id,
                    type: 'group',
                    name: group.name
                });
                
                if (group.questions) {
                    group.questions.forEach(question => {
                        items.push({
                            id: question.id,
                            type: 'question',
                            text: question.text,
                            questionType: question.type,
                            scale: question.scale
                        });
                    });
                }
            });
        }
        
        const config = {
            title: groupedConfig.title || '',
            description: groupedConfig.description || '',
            subjects: groupedConfig.subjects || [],
            items: items,
            voters: groupedConfig.voters || []
        };
        
        this.stateManager.updateConfig(config);
    }
    
    exportConfig() {
        const session = this.stateManager.getSession();
        const config = this.stateManager.getConfig();
        
        if (!session) {
            this.showError('No active session to export');
            return;
        }
        
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            session: session,
            config: config
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
        const filename = `voting-config-${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showSuccess('Configuration exported successfully!');
    }
    
    showExportModal() {
        const modal = new bootstrap.Modal(document.getElementById('exportModal'));
        
        // Reset form to defaults
        document.getElementById('exportQuestions').checked = true;
        document.getElementById('exportSubjects').checked = false;
        document.getElementById('exportVoters').checked = false;
        document.getElementById('exportSession').checked = false;
        document.getElementById('exportSettings').checked = false;
        document.getElementById('exportVotes').checked = false;
        document.getElementById('exportAll').checked = false;
        
        // Set default filename
        const timestamp = new Date().toISOString().slice(0, 10);
        document.getElementById('exportFilename').value = `voting-config-${timestamp}`;
        
        // Setup event listeners for the modal
        this.setupExportModalListeners();
        
        modal.show();
    }
    
    setupExportModalListeners() {
        // "Select All" checkbox handler
        const exportAllCheckbox = document.getElementById('exportAll');
        const individualCheckboxes = [
            'exportQuestions', 'exportSubjects', 'exportVoters', 
            'exportSession', 'exportSettings', 'exportVotes'
        ];
        
        exportAllCheckbox.addEventListener('change', () => {
            const isChecked = exportAllCheckbox.checked;
            individualCheckboxes.forEach(id => {
                document.getElementById(id).checked = isChecked;
            });
            this.updateExportFilename();
        });
        
        // Individual checkbox handlers
        individualCheckboxes.forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                // Update "Select All" checkbox state
                const allChecked = individualCheckboxes.every(checkboxId => 
                    document.getElementById(checkboxId).checked
                );
                exportAllCheckbox.checked = allChecked;
                this.updateExportFilename();
            });
        });
        
        // Export button handler
        document.getElementById('performExportBtn').addEventListener('click', () => {
            this.performSelectedExport();
        });
        
        // QR Code modal handlers will be set up when modal is first shown
    }
    
    updateExportFilename() {
        const filename = document.getElementById('exportFilename');
        const timestamp = new Date().toISOString().slice(0, 10);
        
        const selections = {
            questions: document.getElementById('exportQuestions').checked,
            subjects: document.getElementById('exportSubjects').checked,
            voters: document.getElementById('exportVoters').checked,
            session: document.getElementById('exportSession').checked,
            settings: document.getElementById('exportSettings').checked,
            votes: document.getElementById('exportVotes').checked,
            all: document.getElementById('exportAll').checked
        };
        
        if (selections.all) {
            filename.value = `voting-session-complete-${timestamp}`;
        } else if (selections.questions && !selections.subjects && !selections.voters && !selections.session && !selections.settings && !selections.votes) {
            filename.value = `voting-questions-template-${timestamp}`;
        } else if (selections.session || selections.votes) {
            filename.value = `voting-session-backup-${timestamp}`;
        } else {
            filename.value = `voting-config-${timestamp}`;
        }
    }
    
    async performSelectedExport() {
        const session = this.stateManager.getSession();
        const config = this.stateManager.getConfig();
        
        if (!session) {
            this.showError('No active session to export');
            return;
        }
        
        const selections = {
            questions: document.getElementById('exportQuestions').checked,
            subjects: document.getElementById('exportSubjects').checked,
            voters: document.getElementById('exportVoters').checked,
            session: document.getElementById('exportSession').checked,
            settings: document.getElementById('exportSettings').checked,
            votes: document.getElementById('exportVotes').checked,
            all: document.getElementById('exportAll').checked
        };
        
        this.showLoading(true);
        
        try {
            // Build export data using original format, excluding unselected sections
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            
            // Add session data if selected
            if (selections.session || selections.all) {
                exportData.session = session;
            }
            
            // Build config object with selected sections
            const configData = {};
            
            if (selections.settings || selections.all) {
                configData.title = config.title || '';
                configData.description = config.description || '';
            }
            
            if (selections.questions || selections.all) {
                configData.groups = this.stateManager.buildGroupsFromItems();
                // Also include items for backward compatibility
                configData.items = config.items || [];
            }
            
            if (selections.subjects || selections.all) {
                configData.subjects = config.subjects || [];
            }
            
            if (selections.voters || selections.all) {
                configData.voters = config.voters || [];
            }
            
            // Only add config if at least one section is selected
            if (Object.keys(configData).length > 0) {
                exportData.config = configData;
            }
            
            // Add voting data if selected
            if (selections.votes || selections.all) {
                const storageHash = await CryptoUtils.sha256(session.sessionId);
                const masterHash = await CryptoUtils.sha256(session.masterKey);
                
                try {
                    const response = await fetch(`api/data/${storageHash}/votes`, {
                        headers: {
                            'X-Master-Hash': masterHash
                        }
                    });
                    
                    if (response.ok) {
                        const votesData = await response.json();
                        exportData.votes = votesData.votes || [];
                        console.log(`Exported ${exportData.votes.length} vote records`);
                    } else {
                        console.warn('Could not fetch votes for export:', response.status);
                        exportData.votes = [];
                    }
                } catch (error) {
                    console.warn('Error fetching votes for export:', error);
                    exportData.votes = [];
                }
            }
            
            // Create and download file
            const filename = document.getElementById('exportFilename').value + '.json';
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            
            // Close modal and show success
            const modal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
            modal.hide();
            
            this.showSuccess(`Configuration exported as ${filename}!`);
        } finally {
            this.showLoading(false);
        }
    }
    
    async performCompleteExport() {
        const session = this.stateManager.getSession();
        const config = this.stateManager.getConfig();
        
        if (!session) {
            throw new Error('No active session to export');
        }
        
        this.showLoading(true);
        
        try {
            // Build complete export data including votes
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                type: 'complete_session',
                session: session,
                config: {
                    title: config.title,
                    description: config.description,
                    items: config.items,
                    subjects: config.subjects,
                    voters: config.voters
                }
            };
            
            // Fetch voting data from server
            const storageHash = await CryptoUtils.sha256(session.sessionId);
            const masterHash = await CryptoUtils.sha256(session.masterKey);
            
            try {
                const response = await fetch(`api/data/${storageHash}/votes`, {
                    headers: {
                        'X-Master-Hash': masterHash
                    }
                });
                
                if (response.ok) {
                    const votesData = await response.json();
                    exportData.votes = votesData.votes || [];
                    console.log(`Exported ${exportData.votes.length} vote records`);
                } else {
                    console.warn('Could not fetch votes for export:', response.status);
                    exportData.votes = [];
                }
            } catch (error) {
                console.warn('Error fetching votes for export:', error);
                exportData.votes = [];
            }
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
            const filename = `voting-complete-session-${timestamp}.json`;
            
            // Download the file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            
            console.log('Complete session exported:', filename);
        } finally {
            this.showLoading(false);
        }
    }
    
    showClearDataModal() {
        const modal = new bootstrap.Modal(document.getElementById('clearDataModal'));
        modal.show();
    }
    
    async clearLocalData() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('clearDataModal'));
        modal.hide();
        
        const confirmed = await this.showConfirm(
            'Clear local browser data only? Server data will remain intact.',
            'Clear Local',
            'Cancel'
        );
        
        if (confirmed) {
            // Clear URL fragment
            window.location.hash = '';
            
            // Clear state via state manager (local only)
            this.stateManager.clear();
            
            // Return to phase 1
            this.returnToPhase1();
            
            this.showInfo('Local data cleared successfully');
        }
    }
    
    async exportAndClearAll() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('clearDataModal'));
        modal.hide();
        
        const confirmed = await this.showConfirm(
            'Export complete session data to file, then clear all data locally and on server?',
            'Export & Clear',
            'Cancel'
        );
        
        if (confirmed) {
            try {
                // Export complete session data first
                await this.performCompleteExport();
                
                // Then clear all data
                await this.clearAllDataIncServer();
                
                this.showSuccess('Session exported and all data cleared successfully');
            } catch (error) {
                console.error('Export and clear failed:', error);
                this.showError('Failed to export and clear: ' + (error.message || 'Unknown error'));
            }
        }
    }
    
    async clearAllData() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('clearDataModal'));
        modal.hide();
        
        const confirmed = await this.showConfirm(
            'Permanently delete ALL data locally and on server? This cannot be undone!',
            'Clear All Data',
            'Cancel'
        );
        
        if (confirmed) {
            await this.clearAllDataIncServer();
            this.showInfo('All data cleared successfully');
        }
    }
    
    async clearAllDataIncServer() {
        try {
            const session = this.stateManager.getSession();
            
            if (session) {
                // Clear server data first
                const storageHash = await CryptoUtils.sha256(session.sessionId);
                const masterHash = await CryptoUtils.sha256(session.masterKey);
                
                const response = await fetch(`api/data/${storageHash}/clear`, {
                    method: 'DELETE',
                    headers: {
                        'X-Master-Hash': masterHash
                    }
                });
                
                if (!response.ok) {
                    console.warn('Server clear failed:', response.status, response.statusText);
                }
            }
            
            // Clear URL fragment
            window.location.hash = '';
            
            // Clear state via state manager
            this.stateManager.clear();
            
            // Return to phase 1
            this.returnToPhase1();
        } catch (error) {
            console.error('Error clearing server data:', error);
            // Continue with local clear even if server clear fails
            
            // Clear URL fragment
            window.location.hash = '';
            
            // Clear state via state manager
            this.stateManager.clear();
            
            // Return to phase 1
            this.returnToPhase1();
        }
    }

    openSubjectModal() {
        this.renderCurrentSubjects();

        const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
        modal.show();
    }

    addSubject() {
        const input = document.getElementById('newSubjectInput');
        const name = input.value.trim();

        if (name) {
            const subject = {
                id: 'subject_' + Date.now(),
                name: name
            };

            this.pollConfig.subjects.push(subject);
            this.renderCurrentSubjects();
            this.renderSubjectsInModal();

            input.value = '';
            input.focus();
        }
    }

    renderCurrentSubjects() {
        const container = document.getElementById('currentSubjectsList');
        container.innerHTML = '';

        if (this.pollConfig.subjects.length === 0) {
            container.innerHTML = '<small class="text-muted">No subjects added yet</small>';
            return;
        }

        this.pollConfig.subjects.forEach(subject => {
            const div = document.createElement('div');
            div.className = 'badge bg-primary me-2 mb-2 d-inline-flex align-items-center';
            div.innerHTML = `
                ${subject.name}
                <button type="button" class="btn btn-sm btn-outline-light ms-2" 
                        onclick="app.deleteSubject('${subject.id}')" style="font-size: 0.7em;">
                    <i class="bi bi-x"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    deleteSubject(subjectId) {
        this.pollConfig.subjects = this.pollConfig.subjects.filter(s => s.id !== subjectId);
        this.renderCurrentSubjects();
        this.renderSubjectsInModal();
    }

    renderSubjectsInModal() {
        const textarea = document.getElementById('subjectsInput');
        const subjects = this.pollConfig.subjects.map(s => s.name).join('\n');
        textarea.value = subjects;
    }



}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConfigApp();
});