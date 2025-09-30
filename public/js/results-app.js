// Results interface application
class ResultsApp {
    constructor() {
        this.sessionId = null;
        this.masterKey = null;
        this.storageHash = null;
        this.masterHash = null;
        this.config = null;
        this.rawVotes = null;
        this.processedResults = null;
        this.excludedVoters = new Set(); // Voter keys to exclude from results
        this.currentSubjectId = null;
        this.voterKeys = []; // All voter keys for decryption
        this.decryptedVotes = {}; // Cached decrypted votes
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkURLFragment();
    }
    
    setupEventListeners() {
        // Authentication
        document.getElementById('authenticateBtn').addEventListener('click', () => {
            this.authenticateMaster();
        });
        
        // Enter key in master key input
        document.getElementById('masterKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.authenticateMaster();
            }
        });
        
        // Voter management
        document.getElementById('manageVotersBtn').addEventListener('click', () => {
            this.openVoterManagement();
        });
        
        document.getElementById('saveVoterSettingsBtn').addEventListener('click', () => {
            this.saveVoterSettings();
        });
    }
    
    checkURLFragment() {
        const fragment = window.location.hash.substring(1);
        
        if (!fragment) {
            this.showError('No session data found in URL. Please use a valid results link from the config page.');
            return;
        }
        
        try {
            // Try to decode base64 data (new format)
            const decodedData = JSON.parse(atob(fragment));
            
            if (decodedData.sessionId && decodedData.masterKey && decodedData.voterKeys) {
                this.sessionId = decodedData.sessionId;
                this.masterKey = decodedData.masterKey;
                this.voterKeys = decodedData.voterKeys;
                
                console.log('Parsed encoded results data:', {
                    sessionId: this.sessionId,
                    masterKey: '***hidden***',
                    voterKeysCount: this.voterKeys.length
                });
            } else {
                throw new Error('Invalid data structure');
            }
        } catch (error) {
            // Fallback to legacy format: sessionId,masterKey,voter1,voter2,...
            console.log('Trying legacy format:', error.message);
            const parts = fragment.split(',');
            
            if (parts.length < 2) {
                this.showError('Invalid results link format. Please use the link generated from the config page.');
                return;
            }
            
            this.sessionId = parts[0];
            this.masterKey = parts[1];
            this.voterKeys = parts.slice(2);
            
            console.log('Parsed legacy results data:', {
                sessionId: this.sessionId,
                masterKey: '***hidden***',
                voterKeysCount: this.voterKeys.length
            });
        }
        
        // Auto-fill form
        document.getElementById('sessionIdDisplay').value = this.sessionId;
        document.getElementById('masterKeyInput').value = this.masterKey;
        
        // Auto-authenticate if we have all data
        if (this.sessionId && this.masterKey && this.voterKeys.length > 0) {
            this.showInfo('Session data loaded from URL. Authenticating...');
            // Small delay to let the user see the message
            setTimeout(() => {
                this.authenticateMaster();
            }, 500);
        }
    }
    
    async authenticateMaster() {
        const masterKey = document.getElementById('masterKeyInput').value.trim();
        
        if (!masterKey) {
            this.showError('Please enter the master key');
            return;
        }
        
        if (!this.sessionId) {
            this.showError('No session ID available');
            return;
        }
        
        this.showLoading(true);
        
        try {
            // Generate hashes
            this.masterKey = masterKey;
            this.storageHash = await CryptoUtils.sha256(this.sessionId);
            this.masterHash = await CryptoUtils.sha256(masterKey);
            
            // Load poll configuration and votes
            const [configLoaded, votesLoaded] = await Promise.all([
                this.loadPollConfig(),
                this.loadVotes()
            ]);
            
            if (configLoaded && votesLoaded) {
                this.switchToResultsPhase();
                this.showSuccess('Results loaded successfully!');
            } else {
                this.showError('Failed to load poll data. Please check your master key.');
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
            // Load full config with voter hashes (requires master key)
            const response = await fetch(`api/data/${this.storageHash}/config`, {
                headers: {
                    'X-Master-Hash': this.masterHash
                }
            });
            
            if (response.ok) {
                const configData = await response.json();
                
                if (configData.encryptedConfig) {
                    const sessionKey = await CryptoUtils.getSessionKey(this.sessionId);
                    this.config = await CryptoUtils.decrypt(configData.encryptedConfig, sessionKey);
                    
                    console.log('Loaded poll config:', this.config);
                    
                    // Create voter hash to type lookup from server-side data
                    this.voterHashTypes = {};
                    if (configData.voterHashes) {
                        configData.voterHashes.forEach(voterHash => {
                            this.voterHashTypes[voterHash.hash] = voterHash.type || 'single';
                        });
                    }
                    console.log('Voter hash types loaded from server:', Object.keys(this.voterHashTypes).length, 'hashes');
                    
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Failed to load poll config:', error);
            return false;
        }
    }
    
    async loadVotes() {
        try {
            const response = await fetch(`api/data/${this.storageHash}/votes`, {
                headers: {
                    'X-Master-Hash': this.masterHash
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.rawVotes = data.votes || {};
                console.log('Loaded raw votes:', this.rawVotes);
                
                // Process and decrypt votes
                await this.processVotes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to load votes:', error);
            return false;
        }
    }
    
    async processVotes() {
        const processedVotes = {};
        
        // Load excluded voters from localStorage
        this.loadExcludedVoters();
        
        console.log('Processing votes with voter keys:', this.voterKeys.length);
        
        for (const [voterHash, voteHistory] of Object.entries(this.rawVotes)) {
            if (voteHistory.length === 0) continue;
            
            try {
                // Try to decrypt using each voter key until we find the right one
                let matchingVoterKey = null;
                let voterType = 'single'; // default
                
                for (const voterKey of this.voterKeys) {
                    try {
                        // Check if this voter key corresponds to this voter hash
                        const expectedHash = await CryptoUtils.createVoterHash(voterKey, this.sessionId);
                        
                        if (expectedHash === voterHash) {
                            matchingVoterKey = voterKey;
                            voterType = this.voterTypes[voterKey] || 'single';
                            break;
                        }
                    } catch (decryptError) {
                        // This voter key doesn't match, try the next one
                        continue;
                    }
                }
                
                if (!matchingVoterKey) {
                    console.warn(`Could not find matching voter key for hash ${voterHash}`);
                    continue;
                }
                
                // Get voter type from hash lookup (more reliable than key lookup)
                voterType = this.voterHashTypes[voterHash] || 'single';
                
                // Process votes based on voter type
                const cryptoVoterKey = await CryptoUtils.getVoterKey(matchingVoterKey, this.sessionId);
                const decryptedVotes = [];
                
                if (voterType === 'group') {
                    // For group voters, process all votes (not just latest)
                    for (const vote of voteHistory) {
                        try {
                            const decryptedVote = await CryptoUtils.decrypt(vote.encryptedVote, cryptoVoterKey);
                            decryptedVotes.push({
                                data: decryptedVote,
                                timestamp: vote.timestamp,
                                encryptedVote: vote.encryptedVote
                            });
                        } catch (error) {
                            console.error('Failed to decrypt group vote:', error);
                        }
                    }
                } else {
                    // For single voters, use only the latest vote per subject
                    const subjectVotes = {};
                    
                    for (const vote of voteHistory) {
                        try {
                            const decryptedVote = await CryptoUtils.decrypt(vote.encryptedVote, cryptoVoterKey);
                            const subjectId = decryptedVote.subjectId;
                            
                            // Keep only the latest vote per subject
                            if (!subjectVotes[subjectId] || new Date(vote.timestamp) > new Date(subjectVotes[subjectId].timestamp)) {
                                subjectVotes[subjectId] = {
                                    data: decryptedVote,
                                    timestamp: vote.timestamp,
                                    encryptedVote: vote.encryptedVote
                                };
                            }
                        } catch (error) {
                            console.error('Failed to decrypt single vote:', error);
                        }
                    }
                    
                    // Convert to array
                    decryptedVotes.push(...Object.values(subjectVotes));
                }
                
                processedVotes[voterHash] = {
                    voterKey: matchingVoterKey,
                    voterType: voterType,
                    votes: decryptedVotes
                };
                
                console.log(`Successfully processed ${decryptedVotes.length} vote(s) for ${voterType} voter ${matchingVoterKey}`);
                
            } catch (error) {
                console.error('Failed to process votes for voter:', voterHash, error);
                processedVotes[voterHash] = {
                    voterKey: null,
                    voterType: 'unknown',
                    votes: []
                };
            }
        }
        
        this.processedResults = processedVotes;
        
        const totalVotes = Object.values(processedVotes).reduce((sum, voter) => sum + voter.votes.length, 0);
        console.log(`Processed ${Object.keys(processedVotes).length} voters with ${totalVotes} total votes`);
    }
    
    switchToResultsPhase() {
        document.getElementById('authPhase').classList.add('d-none');
        document.getElementById('resultsPhase').classList.remove('d-none');
        
        // Update UI with poll info
        document.getElementById('pollTitle').textContent = this.config.title || 'Untitled Poll';
        document.getElementById('pollDescription').textContent = this.config.description || 'No description provided';
        document.getElementById('displaySessionId').textContent = this.sessionId;
        document.getElementById('totalResponses').textContent = Object.keys(this.processedResults).length;
        
        // Render subjects
        this.renderSubjects();
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
    }
    
    createSubjectCard(subject) {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4 mb-3';
        
        // Calculate participation for this subject
        const participationCount = this.getSubjectParticipation(subject.id);
        const totalVoters = Object.values(this.processedResults).filter(v => v.voterKey && !this.excludedVoters.has(v.voterKey)).length;
        
        div.innerHTML = `
            <div class="subject-card card h-100" onclick="app.openResultsModal('${subject.id}')">
                <div class="card-body text-center">
                    <div class="mb-2">
                        <i class="bi bi-bar-chart-fill text-primary" style="font-size: 2rem;"></i>
                    </div>
                    <h5 class="card-title">${subject.name}</h5>
                    <p class="card-text text-muted">
                        ${participationCount} of ${totalVoters} responses
                    </p>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${totalVoters > 0 ? (participationCount / totalVoters * 100) : 0}%">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return div;
    }
    
    getSubjectParticipation(subjectId) {
        if (!this.processedResults) return 0;
        
        let count = 0;
        for (const voterData of Object.values(this.processedResults)) {
            // Skip excluded voters
            if (this.excludedVoters.has(voterData.voterKey)) continue;
            
            // Check if this voter has any votes for this subject
            const hasVotedForSubject = voterData.votes.some(vote => 
                vote.data && vote.data.subjectId === subjectId
            );
            
            if (hasVotedForSubject) {
                count++;
            }
        }
        return count;
    }
    
    openResultsModal(subjectId) {
        this.currentSubjectId = subjectId;
        const subject = this.config.subjects.find(s => s.id === subjectId);
        
        if (!subject) {
            this.showError('Subject not found');
            return;
        }
        
        // Update modal title
        document.getElementById('modalSubjectName').textContent = subject.name;
        
        // Generate results
        this.generateResults(subject);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('resultsModal'));
        modal.show();
    }
    
    generateResults(subject) {
        const participationInfo = document.getElementById('participationInfo');
        const resultsContent = document.getElementById('resultsContent');
        
        // Show participation info
        const totalVoters = Object.values(this.processedResults).filter(v => v.voterKey && !this.excludedVoters.has(v.voterKey)).length;
        const participationCount = this.getSubjectParticipation(subject.id);
        
        participationInfo.innerHTML = `
            <strong>Participation:</strong> ${participationCount} out of ${totalVoters} voters participated in this subject
            ${this.excludedVoters.size > 0 ? `<br><small class="text-muted">${this.excludedVoters.size} voter(s) excluded from results</small>` : ''}
        `;
        
        // Generate results content
        resultsContent.innerHTML = '';
        
        if (!this.config.groups || this.config.groups.length === 0) {
            resultsContent.innerHTML = '<p class="text-muted">No questions available for this subject.</p>';
            return;
        }
        
        // Generate actual results using decrypted vote data
        this.config.groups.forEach(group => {
            const groupDiv = this.createResultsGroup(group, subject);
            resultsContent.appendChild(groupDiv);
        });
    }
    
    createResultsGroup(group, subject) {
        const div = document.createElement('div');
        div.className = 'question-result';
        
        let groupHTML = `<div class="group-title">${group.name}</div>`;
        
        group.questions.forEach(question => {
            groupHTML += this.createQuestionResult(question, subject);
        });
        
        div.innerHTML = groupHTML;
        return div;
    }
    
    createQuestionResult(question, subject) {
        // Get actual vote data for this question and subject
        const questionData = this.getQuestionData(question, subject);
        
        switch (question.type) {
            case 'rating':
                return this.createRatingResult(question, questionData);
            case 'yes_no':
                return this.createYesNoResult(question, questionData);
            case 'text':
                return this.createTextResult(question, questionData);
            default:
                return `<div class="mb-3"><strong>${question.text}</strong><br><em>Unknown question type</em></div>`;
        }
    }
    
    getQuestionData(question, subject) {
        const questionId = `q_${question.id}`;
        const responses = [];
        
        if (!this.processedResults) return responses;
        
        for (const voterData of Object.values(this.processedResults)) {
            // Skip excluded voters
            if (this.excludedVoters.has(voterData.voterKey)) continue;
            
            // Check all votes from this voter for the specific subject
            for (const vote of voterData.votes) {
                if (vote.data && 
                    vote.data.subjectId === subject.id &&
                    vote.data.answers &&
                    vote.data.answers[questionId] !== undefined) {
                    
                    const answer = vote.data.answers[questionId];
                    if (answer !== null && answer !== '') {
                        responses.push(answer);
                    }
                }
            }
        }
        
        return responses;
    }
    
    createRatingResult(question, responses) {
        if (responses.length === 0) {
            return `
                <div class="mb-3">
                    <strong>${question.text}</strong>
                    <div class="result-bar mt-2">
                        <div class="result-bar-fill rating" style="width: 0%">
                            No responses
                        </div>
                    </div>
                    <small class="text-muted">No ratings submitted</small>
                </div>
            `;
        }
        
        // Calculate average from numeric responses
        const numericResponses = responses.map(r => parseFloat(r)).filter(r => !isNaN(r));
        const average = numericResponses.reduce((sum, val) => sum + val, 0) / numericResponses.length;
        const scale = question.scale || 5;
        const percentage = (average / scale) * 100;
        
        return `
            <div class="mb-3">
                <strong>${question.text}</strong>
                <div class="result-bar mt-2">
                    <div class="result-bar-fill rating" style="width: ${percentage}%">
                        ${average.toFixed(1)} von ${scale}
                    </div>
                </div>
                <small class="text-muted">Average rating from ${numericResponses.length} response(s)</small>
            </div>
        `;
    }
    
    createYesNoResult(question, responses) {
        if (responses.length === 0) {
            return `
                <div class="mb-3">
                    <strong>${question.text}</strong>
                    <div class="result-bar mt-2">
                        <div class="result-bar-fill yesno" style="width: 0%">
                            No responses
                        </div>
                    </div>
                    <small class="text-muted">No responses submitted</small>
                </div>
            `;
        }
        
        // Count yes and no responses
        const yesCount = responses.filter(r => r.toLowerCase() === 'yes').length;
        const noCount = responses.filter(r => r.toLowerCase() === 'no').length;
        const totalValid = yesCount + noCount;
        
        if (totalValid === 0) {
            return `
                <div class="mb-3">
                    <strong>${question.text}</strong>
                    <div class="result-bar mt-2">
                        <div class="result-bar-fill yesno" style="width: 0%">
                            No valid responses
                        </div>
                    </div>
                    <small class="text-muted">No valid Yes/No responses</small>
                </div>
            `;
        }
        
        const yesPercentage = (yesCount / totalValid) * 100;
        
        return `
            <div class="mb-3">
                <strong>${question.text}</strong>
                <div class="result-bar mt-2">
                    <div class="result-bar-fill yesno" style="width: ${yesPercentage}%">
                        ${yesPercentage.toFixed(0)}% Yes
                    </div>
                </div>
                <small class="text-muted">${noCount} No, ${yesCount} Yes (${totalValid} total responses)</small>
            </div>
        `;
    }
    
    createTextResult(question, responses) {
        if (responses.length === 0) {
            return `
                <div class="mb-3">
                    <strong>${question.text}</strong>
                    <div class="text-responses mt-2">
                        <div class="response-item text-muted">No text responses submitted</div>
                    </div>
                    <small class="text-muted">0 text responses</small>
                </div>
            `;
        }
        
        // Preserve line breaks by replacing \n with <br>
        let responsesHTML = responses.map(response => 
            `<div class="response-item">${String(response).replace(/\n/g, '<br>')}</div>`
        ).join('');
        
        return `
            <div class="mb-3">
                <strong>${question.text}</strong>
                <div class="text-responses mt-2">
                    ${responsesHTML}
                </div>
                <small class="text-muted">${responses.length} text response(s)</small>
            </div>
        `;
    }
    
    openVoterManagement() {
        this.renderVoterKeys();
        const modal = new bootstrap.Modal(document.getElementById('voterManagementModal'));
        modal.show();
    }
    
    renderVoterKeys() {
        const voterKeysList = document.getElementById('voterKeysList');
        voterKeysList.innerHTML = '';
        
        if (Object.keys(this.processedResults).length === 0) {
            voterKeysList.innerHTML = '<p class="text-muted">No voter data available</p>';
            return;
        }
        
        // Show actual voter keys from decrypted votes
        const voterKeysWithData = [];
        Object.values(this.processedResults).forEach(voterData => {
            if (voterData.voterKey) {
                voterKeysWithData.push(voterData.voterKey);
            }
        });
        
        // Also include voter keys that might not have votes yet
        this.voterKeys.forEach(key => {
            if (!voterKeysWithData.includes(key)) {
                voterKeysWithData.push(key);
            }
        });
        
        voterKeysWithData.forEach((voterKey, index) => {
            const isExcluded = this.excludedVoters.has(voterKey);
            const voterData = Object.values(this.processedResults).find(v => v.voterKey === voterKey);
            const hasVoted = voterData && voterData.votes.length > 0;
            const voterType = voterData ? voterData.voterType : 'single';
            const voteCount = voterData ? voterData.votes.length : 0;
            
            const voterDiv = document.createElement('div');
            voterDiv.className = `voter-key-item ${isExcluded ? 'excluded' : ''}`;
            voterDiv.innerHTML = `
                <div>
                    <strong>${voterKey}</strong> <span class="badge bg-secondary">${voterType}</span>
                    <small class="text-muted d-block">${hasVoted ? `${voteCount} vote(s) submitted` : 'No votes yet'}</small>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" 
                           id="exclude_${voterKey}" ${isExcluded ? 'checked' : ''}
                           onchange="app.toggleVoterExclusion('${voterKey}', this.checked)">
                    <label class="form-check-label" for="exclude_${voterKey}">
                        Exclude
                    </label>
                </div>
            `;
            
            voterKeysList.appendChild(voterDiv);
        });
    }
    
    toggleVoterExclusion(voterKey, exclude) {
        if (exclude) {
            this.excludedVoters.add(voterKey);
        } else {
            this.excludedVoters.delete(voterKey);
        }
    }
    
    saveVoterSettings() {
        // Save excluded voters to localStorage
        this.saveExcludedVoters();
        
        // Refresh results
        this.renderSubjects();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('voterManagementModal'));
        modal.hide();
        
        this.showSuccess('Voter settings saved');
    }
    
    loadExcludedVoters() {
        try {
            const key = `excluded_voters_${this.sessionId}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                this.excludedVoters = new Set(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load excluded voters:', error);
        }
    }
    
    saveExcludedVoters() {
        try {
            const key = `excluded_voters_${this.sessionId}`;
            localStorage.setItem(key, JSON.stringify(Array.from(this.excludedVoters)));
        } catch (error) {
            console.error('Failed to save excluded voters:', error);
        }
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ResultsApp();
});