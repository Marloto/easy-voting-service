// Voting interface application
class VotingApp {
    constructor() {
        this.sessionId = null;
        this.voterKey = null;
        this.voterHash = null;
        this.config = null;
        this.votedSubjects = new Set(); // Track completed votes
        this.currentSubjectId = null;
        this.savedFormData = {}; // Store partially filled form data
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkURLFragment();
    }
    
    // LocalStorage methods for vote persistence
    async getVotingStorageKey() {
        const keyHash = await CryptoUtils.sha256(`${this.sessionId}_${this.voterKey}`);
        return `voting_progress_${keyHash}`;
    }
    
    async getFormDataStorageKey() {
        const keyHash = await CryptoUtils.sha256(`${this.sessionId}_${this.voterKey}`);
        return `voting_forms_${keyHash}`;
    }
    
    async getSubmittedVotesStorageKey() {
        const keyHash = await CryptoUtils.sha256(`${this.sessionId}_${this.voterKey}`);
        return `voting_submitted_${keyHash}`;
    }
    
    async saveVotingProgress() {
        if (!this.sessionId || !this.voterKey) return;
        
        const progress = {
            votedSubjects: Array.from(this.votedSubjects),
            timestamp: new Date().toISOString()
        };
        
        try {
            const storageKey = await this.getVotingStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(progress));
            console.log('Voting progress saved to localStorage');
        } catch (error) {
            console.error('Failed to save voting progress:', error);
        }
    }
    
    async loadVotingProgress() {
        if (!this.sessionId || !this.voterKey) return null;
        
        try {
            const storageKey = await this.getVotingStorageKey();
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const progress = JSON.parse(saved);
                console.log('Loaded voting progress from localStorage:', progress);
                return progress;
            }
        } catch (error) {
            console.error('Failed to load voting progress:', error);
        }
        return null;
    }
    
    async saveSubmittedVote(subjectId, voteData, encryptedVote) {
        if (!this.sessionId || !this.voterKey) return;
        
        try {
            const allSubmittedVotes = await this.loadAllSubmittedVotes() || {};
            const subject = this.config.subjects.find(s => s.id === subjectId);
            
            allSubmittedVotes[subjectId] = {
                subjectName: subject ? subject.name : 'Unknown Subject',
                voteData: voteData,
                encryptedVote: encryptedVote,
                timestamp: new Date().toISOString()
            };
            
            const storageKey = await this.getSubmittedVotesStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(allSubmittedVotes));
            console.log(`Submitted vote saved for subject ${subjectId}`);
        } catch (error) {
            console.error('Failed to save submitted vote:', error);
        }
    }
    
    async loadAllSubmittedVotes() {
        if (!this.sessionId || !this.voterKey) return null;
        
        try {
            const storageKey = await this.getSubmittedVotesStorageKey();
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load submitted votes:', error);
        }
        return null;
    }
    
    async loadSubmittedVote(subjectId) {
        const allSubmittedVotes = await this.loadAllSubmittedVotes();
        return allSubmittedVotes && allSubmittedVotes[subjectId] ? allSubmittedVotes[subjectId] : null;
    }
    
    async saveFormData(subjectId, formData) {
        if (!this.sessionId || !this.voterKey) return;
        
        try {
            const allFormData = await this.loadAllFormData() || {};
            allFormData[subjectId] = {
                data: formData,
                timestamp: new Date().toISOString()
            };
            
            const storageKey = await this.getFormDataStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(allFormData));
            console.log(`Form data saved for subject ${subjectId}`);
        } catch (error) {
            console.error('Failed to save form data:', error);
        }
    }
    
    async loadAllFormData() {
        if (!this.sessionId || !this.voterKey) return null;
        
        try {
            const storageKey = await this.getFormDataStorageKey();
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load form data:', error);
        }
        return null;
    }
    
    async loadFormData(subjectId) {
        const allFormData = await this.loadAllFormData();
        return allFormData && allFormData[subjectId] ? allFormData[subjectId].data : null;
    }
    
    async clearFormData(subjectId) {
        if (!this.sessionId || !this.voterKey) return;
        
        try {
            const allFormData = await this.loadAllFormData() || {};
            delete allFormData[subjectId];
            const storageKey = await this.getFormDataStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(allFormData));
            console.log(`Form data cleared for subject ${subjectId}`);
        } catch (error) {
            console.error('Failed to clear form data:', error);
        }
    }
    
    setupEventListeners() {
        // Authentication
        document.getElementById('authenticateBtn').addEventListener('click', () => {
            this.authenticateVoter();
        });
        
        // Enter key in voter key input
        document.getElementById('voterKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.authenticateVoter();
            }
        });
        
        // Vote submission
        document.getElementById('submitVoteBtn').addEventListener('click', () => {
            this.submitVote();
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
    }
    
    checkURLFragment() {
        const sessionId = CryptoUtils.getSessionFromURL();
        if (sessionId) {
            this.sessionId = sessionId;
            console.log('Session ID loaded from URL:', sessionId);
            
            // Try to find existing voter keys for this session
            this.tryRestoreVoterKey();
        } else {
            this.showError('No session ID found in URL. Please use a valid voting link.');
        }
    }
    
    tryRestoreVoterKey() {
        if (!this.sessionId) return;
        
        // Look for session-specific voter key storage
        const sessionStorageKey = `session_voters_${this.sessionId}`;
        
        try {
            const saved = localStorage.getItem(sessionStorageKey);
            if (saved) {
                const sessionData = JSON.parse(saved);
                if (sessionData.lastVoterKey && sessionData.timestamp) {
                    // Auto-fill the most recent voter key found
                    document.getElementById('voterKeyInput').value = sessionData.lastVoterKey;
                    this.showInfo('Previous voting session found. Your voter key has been restored.');
                }
            }
        } catch (error) {
            console.error('Error parsing saved session data:', error);
        }
    }
    
    saveSessionVoterKey() {
        if (!this.sessionId || !this.voterKey) return;
        
        const sessionStorageKey = `session_voters_${this.sessionId}`;
        const sessionData = {
            lastVoterKey: this.voterKey,
            timestamp: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(sessionStorageKey, JSON.stringify(sessionData));
            console.log('Session voter key saved for restoration');
        } catch (error) {
            console.error('Failed to save session voter key:', error);
        }
    }
    
    async authenticateVoter() {
        const voterKey = document.getElementById('voterKeyInput').value.trim().toUpperCase();
        
        if (!voterKey) {
            this.showError('Please enter your voter key');
            return;
        }
        
        if (!this.sessionId) {
            this.showError('No session ID available');
            return;
        }
        
        this.showLoading(true);
        
        try {
            // Generate voter hash
            this.voterKey = voterKey;
            this.voterHash = await CryptoUtils.createVoterHash(voterKey, this.sessionId);
            
            // Load poll configuration
            const success = await this.loadPollConfig();
            
            if (success) {
                // Check if voter is authorized (now async)
                const isAuthorized = await this.isVoterAuthorized();
                
                if (isAuthorized) {
                    await this.switchToVotingPhase();
                    this.showSuccess('Authentication successful!');
                } else {
                    this.showError('Invalid voter key. You are not authorized to vote in this poll.');
                }
            } else {
                this.showError('Could not load poll configuration. Please check your session ID.');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.showError('Authentication failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadPollConfig() {
        try {
            const storageHash = await CryptoUtils.sha256(this.sessionId);
            // Load public config (without voter hashes for security)
            const response = await fetch(`api/data/${storageHash}/config`);
            
            if (response.ok) {
                const configData = await response.json();
                
                if (configData.encryptedConfig) {
                    const sessionKey = await CryptoUtils.getSessionKey(this.sessionId);
                    this.config = await CryptoUtils.decrypt(configData.encryptedConfig, sessionKey);
                    
                    console.log('Loaded public poll config:', this.config);
                    
                    // Note: Voter hashes are no longer in config for security
                    // Authorization will be done server-side
                    
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Failed to load poll config:', error);
            return false;
        }
    }
    
    async isVoterAuthorized() {
        if (!this.voterKey || !this.sessionId) {
            console.log('Authorization failed: Missing voter key or session ID');
            return false;
        }
        
        try {
            // Generate hash for the provided voter key
            const voterHash = await CryptoUtils.createVoterHash(this.voterKey, this.sessionId);
            const storageHash = await CryptoUtils.sha256(this.sessionId);
            
            console.log('Checking voter authorization server-side...');
            
            // Server-side authorization check
            const response = await fetch(`api/data/${storageHash}/voter/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ voterHash })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Server authorization result:', {
                    voterKey: this.voterKey,
                    voterHash: voterHash.substring(0, 8) + '...',
                    isAuthorized: result.authorized,
                    voterType: result.voterType
                });
                
                // Store voter type for later use
                if (result.authorized && result.voterType) {
                    this.voterType = result.voterType;
                }
                
                return result.authorized;
            } else {
                console.log('Authorization request failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error during server-side voter authorization:', error);
            return false;
        }
    }
    
    async switchToVotingPhase() {
        document.getElementById('authPhase').classList.add('d-none');
        document.getElementById('votingPhase').classList.remove('d-none');
        
        // Update UI with poll info
        document.getElementById('pollTitle').textContent = this.config.title || 'Untitled Poll';
        document.getElementById('pollDescription').textContent = this.config.description || 'No description provided';
        document.getElementById('displayVoterKey').textContent = this.voterKey;
        
        // Save session voter key for restoration
        this.saveSessionVoterKey();
        
        // Load saved voting progress
        const savedProgress = await this.loadVotingProgress();
        if (savedProgress && savedProgress.votedSubjects) {
            this.votedSubjects = new Set(savedProgress.votedSubjects);
            console.log('Restored voting progress:', savedProgress.votedSubjects.length, 'subjects completed');
        }
        
        // Render subjects
        this.renderSubjects();
        this.updateVoteCount();
        
        // Save initial progress
        await this.saveVotingProgress();
    }
    
    renderSubjects() {
        const subjectsList = document.getElementById('subjectsList');
        subjectsList.innerHTML = '';
        
        if (!this.config.subjects || this.config.subjects.length === 0) {
            document.getElementById('emptySubjectsMessage').classList.remove('d-none');
            return;
        }
        
        document.getElementById('emptySubjectsMessage').classList.add('d-none');
        
        this.config.subjects.forEach(subject => {
            const subjectCard = this.createSubjectCard(subject);
            subjectsList.appendChild(subjectCard);
        });
        
        document.getElementById('totalCount').textContent = this.config.subjects.length;
    }
    
    createSubjectCard(subject) {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4 mb-3';
        
        const isVoted = this.votedSubjects.has(subject.id);
        const cardClass = isVoted ? 'subject-card voted' : 'subject-card';
        
        div.innerHTML = `
            <div class="${cardClass} card h-100" onclick="app.handleSubjectCardClick('${subject.id}')">
                <div class="card-body text-center">
                    <div class="mb-2">
                        ${isVoted ? 
                            '<i class="bi bi-check-circle-fill text-success" style="font-size: 2rem;"></i>' : 
                            '<i class="bi bi-circle text-muted" style="font-size: 2rem;"></i>'
                        }
                    </div>
                    <h5 class="card-title">${subject.name}</h5>
                    <p class="card-text text-muted">
                        ${isVoted ? 'Vote submitted' : 'Click to vote'}
                    </p>
                </div>
            </div>
        `;
        
        return div;
    }
    
    handleSubjectCardClick(subjectId) {
        // Handle async opening of voting modal
        this.openVotingModal(subjectId).catch(error => {
            console.error('Error opening voting modal:', error);
            this.showError('Failed to open voting form');
        });
    }
    
    async openVotingModal(subjectId) {
        this.currentSubjectId = subjectId;
        const subject = this.config.subjects.find(s => s.id === subjectId);
        
        if (!subject) {
            this.showError('Subject not found');
            return;
        }
        
        // Update modal title
        document.getElementById('modalSubjectName').textContent = subject.name;
        
        // Generate form
        await this.generateVotingForm();
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('votingModal'));
        modal.show();
    }
    
    async generateVotingForm() {
        const formContainer = document.getElementById('votingForm');
        formContainer.innerHTML = '';
        
        if (!this.config.groups || this.config.groups.length === 0) {
            formContainer.innerHTML = '<p class="text-muted">No questions available for this subject.</p>';
            return;
        }
        
        this.config.groups.forEach(group => {
            const groupDiv = this.createQuestionGroup(group);
            formContainer.appendChild(groupDiv);
        });
        
        // Load and restore saved form data
        await this.restoreFormData();
        
        // Set up auto-save for form inputs
        this.setupFormAutoSave();
    }
    
    async restoreFormData() {
        if (!this.currentSubjectId) return;
        
        // First try to load submitted vote data if subject was already voted on
        const submittedVote = await this.loadSubmittedVote(this.currentSubjectId);
        let dataToRestore = null;
        
        if (submittedVote && submittedVote.voteData && submittedVote.voteData.answers) {
            // Use submitted vote data
            dataToRestore = submittedVote.voteData.answers;
            console.log('Restoring submitted vote data for subject:', this.currentSubjectId, dataToRestore);
            
            // Update submit button to indicate this is a review/resubmit
            const submitBtn = document.getElementById('submitVoteBtn');
            submitBtn.innerHTML = 'Resubmit Vote';
            submitBtn.disabled = false;
        } else {
            // Use draft form data
            dataToRestore = await this.loadFormData(this.currentSubjectId);
            if (dataToRestore) {
                console.log('Restoring draft form data for subject:', this.currentSubjectId, dataToRestore);
            }
            
            // Reset submit button
            const submitBtn = document.getElementById('submitVoteBtn');
            submitBtn.innerHTML = 'Submit Vote';
            submitBtn.disabled = false;
        }
        
        if (!dataToRestore) return;
        
        // Restore form values
        Object.keys(dataToRestore).forEach(fieldName => {
            const value = dataToRestore[fieldName];
            
            // Handle radio buttons
            const radioButton = document.querySelector(`input[name="${fieldName}"][value="${value}"]`);
            if (radioButton) {
                radioButton.checked = true;
                return;
            }
            
            // Handle text areas and text inputs
            const textField = document.querySelector(`[name="${fieldName}"]`);
            if (textField && (textField.tagName === 'TEXTAREA' || textField.type === 'text')) {
                textField.value = value;
            }
        });
    }
    
    setupFormAutoSave() {
        if (!this.currentSubjectId) return;
        
        const form = document.getElementById('votingForm');
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            // Auto-save on change
            input.addEventListener('change', () => {
                this.autoSaveFormData();
            });
            
            // Auto-save on input for text fields (with debounce)
            if (input.type === 'text' || input.tagName === 'TEXTAREA') {
                let saveTimeout;
                input.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        this.autoSaveFormData();
                    }, 1000); // 1 second debounce
                });
            }
        });
    }
    
    async autoSaveFormData() {
        if (!this.currentSubjectId) return;
        
        const formData = this.collectVoteData();
        if (Object.keys(formData).length > 0) {
            await this.saveFormData(this.currentSubjectId, formData);
        }
    }
    
    createQuestionGroup(group) {
        const div = document.createElement('div');
        div.className = 'question-group';
        
        let groupHTML = `<div class="group-title">${group.name}</div>`;
        
        group.questions.forEach(question => {
            groupHTML += this.createQuestionHTML(question);
        });
        
        div.innerHTML = groupHTML;
        return div;
    }
    
    createQuestionHTML(question) {
        const questionId = `q_${question.id}`;
        
        switch (question.type) {
            case 'rating':
                return this.createRatingQuestion(question, questionId);
            case 'yes_no':
                return this.createYesNoQuestion(question, questionId);
            case 'text':
                return this.createTextQuestion(question, questionId);
            default:
                return `<div class="alert alert-warning">Unknown question type: ${question.type}</div>`;
        }
    }
    
    createRatingQuestion(question, questionId) {
        const scale = question.scale || 5;
        let optionsHTML = '';
        
        for (let i = 1; i <= scale; i++) {
            optionsHTML += `
                <div class="rating-option">
                    <input type="radio" class="form-check-input" name="${questionId}" value="${i}" id="${questionId}_${i}">
                    <div>${i}</div>
                </div>
            `;
        }
        
        return `
            <div class="mb-3">
                <label class="form-label fw-bold">${question.text}</label>
                <div class="rating-scale">
                    ${optionsHTML}
                </div>
                <div class="rating-labels">
                    <small>Poor</small>
                    <small>Excellent</small>
                </div>
            </div>
        `;
    }
    
    createYesNoQuestion(question, questionId) {
        return `
            <div class="mb-3">
                <label class="form-label fw-bold">${question.text}</label>
                <div class="d-flex gap-3">
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${questionId}" value="yes" id="${questionId}_yes">
                        <label class="form-check-label" for="${questionId}_yes">Yes</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${questionId}" value="no" id="${questionId}_no">
                        <label class="form-check-label" for="${questionId}_no">No</label>
                    </div>
                </div>
            </div>
        `;
    }
    
    createTextQuestion(question, questionId) {
        return `
            <div class="mb-3">
                <label class="form-label fw-bold" for="${questionId}">${question.text}</label>
                <textarea class="form-control" name="${questionId}" id="${questionId}" rows="3" 
                          placeholder="Enter your response..."></textarea>
            </div>
        `;
    }
    
    async submitVote() {
        if (!this.currentSubjectId) {
            this.showError('No subject selected');
            return;
        }
        
        // Collect form data
        const voteData = this.collectVoteData();
        
        if (Object.keys(voteData).length === 0) {
            this.showError('Please answer at least one question');
            return;
        }
        
        this.showLoading(true);
        
        try {
            // Prepare vote data with metadata
            const fullVoteData = {
                subjectId: this.currentSubjectId,
                timestamp: new Date().toISOString(),
                answers: voteData
            };
            
            // Encrypt vote data
            const voterKey = await CryptoUtils.getVoterKey(this.voterKey, this.sessionId);
            const encryptedVote = await CryptoUtils.encrypt(fullVoteData, voterKey);
            
            // Submit to backend
            const storageHash = await CryptoUtils.sha256(this.sessionId);
            const response = await fetch(`api/vote/${storageHash}/${this.voterHash}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ encryptedVote })
            });
            
            if (response.ok) {
                // Mark subject as voted
                this.votedSubjects.add(this.currentSubjectId);
                
                // Save the actual submitted vote data for review
                await this.saveSubmittedVote(this.currentSubjectId, fullVoteData, encryptedVote);
                
                // Save voting progress to localStorage
                await this.saveVotingProgress();
                
                // Clear saved form data for this subject (no longer needed)
                await this.clearFormData(this.currentSubjectId);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('votingModal'));
                modal.hide();
                
                // Update UI
                this.renderSubjects();
                this.updateVoteCount();
                
                this.showSuccess('Vote submitted successfully!');
            } else {
                const error = await response.json();
                this.showError('Failed to submit vote: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Vote submission error:', error);
            this.showError('Failed to submit vote. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    collectVoteData() {
        const formData = {};
        const form = document.getElementById('votingForm');
        
        // Collect all form inputs
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            if (input.type === 'radio' && input.checked) {
                formData[input.name] = input.value;
            } else if (input.type === 'text' || input.tagName === 'TEXTAREA') {
                if (input.value.trim()) {
                    formData[input.name] = input.value.trim();
                }
            }
        });
        
        return formData;
    }
    
    updateVoteCount() {
        document.getElementById('votedCount').textContent = this.votedSubjects.size;
    }
    
    async logout() {
        const confirmed = await this.showConfirm(
            'Are you sure you want to logout? This will clear your voting progress and return to the login screen.',
            'Logout',
            'Cancel'
        );
        
        if (confirmed) {
            // Clear all localStorage data for this session/voter
            await this.clearAllVotingData();
            
            // Reset app state
            this.voterKey = null;
            this.voterHash = null;
            this.config = null;
            this.votedSubjects = new Set();
            this.currentSubjectId = null;
            this.savedFormData = {};
            
            // Return to authentication phase
            this.returnToAuthPhase();
            
            this.showInfo('Logged out successfully');
        }
    }
    
    async clearAllVotingData() {
        if (!this.sessionId || !this.voterKey) return;
        
        try {
            // Clear voting progress
            const votingStorageKey = await this.getVotingStorageKey();
            localStorage.removeItem(votingStorageKey);
            
            // Clear form data
            const formDataStorageKey = await this.getFormDataStorageKey();
            localStorage.removeItem(formDataStorageKey);
            
            // Clear submitted votes
            const submittedVotesStorageKey = await this.getSubmittedVotesStorageKey();
            localStorage.removeItem(submittedVotesStorageKey);
            
            // Clear session voter key storage
            const sessionStorageKey = `session_voters_${this.sessionId}`;
            localStorage.removeItem(sessionStorageKey);
            
            console.log('All voting data cleared for session:', this.sessionId, 'voter:', this.voterKey);
        } catch (error) {
            console.error('Failed to clear voting data:', error);
        }
    }
    
    returnToAuthPhase() {
        document.getElementById('votingPhase').classList.add('d-none');
        document.getElementById('authPhase').classList.remove('d-none');
        
        // Clear the voter key input
        document.getElementById('voterKeyInput').value = '';
    }
    
    // UI helper methods
    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('d-none', !show);
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VotingApp();
});