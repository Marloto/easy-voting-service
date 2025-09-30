// Configuration State Management with Auto-Save and Auto-Sync
class ConfigStateManager {
    constructor() {
        this.config = {
            title: '',
            description: '',
            items: [], // Flat list of groups and questions
            subjects: [],
            voters: []
        };
        this.session = null;
        this.listeners = new Set();
        this.syncTimeout = null;
        this.lastSyncTime = 0;
        
        // Auto-sync settings
        this.AUTO_SYNC_DELAY = 2000; // 2 seconds debounce
        this.SYNC_INTERVAL = 30000;  // Force sync every 30 seconds
        
        this.init();
    }
    
    init() {
        this.loadFromLocalStorage();
        this.startPeriodicSync();
    }
    
    // Load state from localStorage on initialization
    loadFromLocalStorage() {
        try {
            // Load session
            const savedSession = CryptoUtils.loadFromLocalStorage('current_session');
            if (savedSession) {
                this.session = savedSession;
                console.log('Loaded session from localStorage:', savedSession.sessionId);
            }
            
            // Load config
            const savedConfig = CryptoUtils.loadFromLocalStorage('current_config');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
                console.log('Loaded config from localStorage:', this.config);
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }
    
    // Auto-save to localStorage whenever config changes
    saveToLocalStorage() {
        try {
            CryptoUtils.saveToLocalStorage('current_config', this.config);
            console.log('Config auto-saved to localStorage');
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }
    
    // Set session and trigger save
    setSession(sessionData) {
        this.session = sessionData;
        CryptoUtils.saveToLocalStorage('current_session', sessionData);
        this.notifyListeners('session-changed', sessionData);
    }
    
    // Update config and trigger auto-save + auto-sync
    updateConfig(updates) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...updates };
        
        // Auto-save to localStorage immediately
        this.saveToLocalStorage();
        
        // Schedule server sync (debounced)
        this.scheduleServerSync();
        
        // Notify listeners
        this.notifyListeners('config-changed', { old: oldConfig, new: this.config });
    }
    
    // Add item (group or question) and auto-save
    addItem(item) {
        this.config.items.push(item);
        this.saveToLocalStorage();
        this.scheduleServerSync();
        this.notifyListeners('item-added', item);
    }
    
    // Update specific item
    updateItem(itemId, field, value) {
        const item = this.config.items.find(i => i.id === itemId);
        if (item) {
            if (field === 'scale') {
                item.scale = parseInt(value);
            } else if (field === 'questionType') {
                item.questionType = value;
                if (value !== 'rating') {
                    delete item.scale;
                } else {
                    item.scale = 5;
                }
            } else {
                item[field] = value;
            }
            
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('item-updated', { itemId, field, value, item });
        }
    }
    
    // Delete item
    deleteItem(itemId) {
        const index = this.config.items.findIndex(i => i.id === itemId);
        if (index !== -1) {
            const deletedItem = this.config.items.splice(index, 1)[0];
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('item-deleted', deletedItem);
        }
    }
    
    // Reorder items (for drag & drop)
    reorderItems(newOrder) {
        this.config.items = newOrder;
        this.saveToLocalStorage();
        this.scheduleServerSync();
        this.notifyListeners('items-reordered', newOrder);
    }
    
    // Voter management
    addVoter(voter) {
        this.config.voters.push(voter);
        this.saveToLocalStorage();
        this.scheduleServerSync();
        this.notifyListeners('voter-added', voter);
    }
    
    updateVoter(voterId, field, value) {
        const voter = this.config.voters.find(v => v.id === voterId);
        if (voter) {
            voter[field] = value;
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('voter-updated', { voterId, field, value });
        }
    }
    
    deleteVoter(voterId) {
        const index = this.config.voters.findIndex(v => v.id === voterId);
        if (index !== -1) {
            const deletedVoter = this.config.voters.splice(index, 1)[0];
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('voter-deleted', deletedVoter);
        }
    }
    
    // Subject management
    addSubject(subject) {
        this.config.subjects.push(subject);
        this.saveToLocalStorage();
        this.scheduleServerSync();
        this.notifyListeners('subject-added', subject);
    }
    
    updateSubject(subjectId, field, value) {
        const subject = this.config.subjects.find(s => s.id === subjectId);
        if (subject) {
            subject[field] = value;
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('subject-updated', { subjectId, field, value });
        }
    }
    
    deleteSubject(subjectId) {
        const index = this.config.subjects.findIndex(s => s.id === subjectId);
        if (index !== -1) {
            const deletedSubject = this.config.subjects.splice(index, 1)[0];
            this.saveToLocalStorage();
            this.scheduleServerSync();
            this.notifyListeners('subject-deleted', deletedSubject);
        }
    }
    
    // Debounced server sync
    scheduleServerSync() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        
        this.syncTimeout = setTimeout(() => {
            this.syncToServer();
        }, this.AUTO_SYNC_DELAY);
    }
    
    // Force immediate server sync
    async syncToServer() {
        if (!this.session) {
            console.warn('No session available for server sync');
            return false;
        }
        
        try {
            console.log('Syncing config to server...');
            
            // Separate voter hashes from main config for security
            const voterHashes = await this.getVoterHashesWithTypes();
            console.log('Generated voter hashes for sync:', voterHashes.length, voterHashes);
            
            const configWithoutVoterHashes = {
                title: this.config.title,
                description: this.config.description,
                subjects: this.config.subjects,
                groups: this.buildGroupsFromItems()
                // NOTE: voterHashes intentionally excluded from encrypted config
            };
            
            // Encrypt main configuration (without voter hashes)
            const sessionKey = await CryptoUtils.getSessionKey(this.session.sessionId);
            const encryptedConfig = await CryptoUtils.encrypt(configWithoutVoterHashes, sessionKey);
            
            // Prepare payload with voter hashes
            const payload = { 
                encryptedConfig,
                voterHashes: voterHashes // Stored separately, only accessible with master key
            };
            console.log('Sending payload to server:', {
                encryptedConfigLength: encryptedConfig.length,
                voterHashesCount: voterHashes.length,
                voterHashes: voterHashes
            });
            
            // Send to server with voter hashes stored separately
            const response = await fetch(`api/data/${this.session.storageHash}/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Hash': this.session.masterHash
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                this.lastSyncTime = Date.now();
                this.notifyListeners('sync-success', { timestamp: this.lastSyncTime });
                console.log('Config synced to server successfully');
                return true;
            } else {
                const error = await response.json();
                this.notifyListeners('sync-error', error);
                console.error('Server sync failed:', error);
                return false;
            }
        } catch (error) {
            console.error('Server sync error:', error);
            this.notifyListeners('sync-error', error);
            return false;
        }
    }
    
    // Periodic background sync
    startPeriodicSync() {
        setInterval(() => {
            const timeSinceLastSync = Date.now() - this.lastSyncTime;
            if (timeSinceLastSync > this.SYNC_INTERVAL && this.session) {
                this.syncToServer();
            }
        }, this.SYNC_INTERVAL);
    }
    
    // Load config from server (for existing sessions)
    async loadFromServer() {
        if (!this.session) {
            throw new Error('No session available');
        }
        
        try {
            const response = await fetch(`api/data/${this.session.storageHash}/config`);
            
            if (response.ok) {
                const configData = await response.json();
                
                if (configData.encryptedConfig) {
                    const sessionKey = await CryptoUtils.getSessionKey(this.session.sessionId);
                    const decryptedConfig = await CryptoUtils.decrypt(configData.encryptedConfig, sessionKey);
                    
                    // Convert old format to new if needed
                    if (decryptedConfig.groups && decryptedConfig.groups.length > 0) {
                        this.convertFromGroupedFormat(decryptedConfig);
                    } else {
                        this.config = { ...this.config, ...decryptedConfig };
                    }
                    
                    this.saveToLocalStorage();
                    this.notifyListeners('config-loaded', this.config);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Failed to load config from server:', error);
            throw error;
        }
    }
    
    // Convert flat format to grouped format for server compatibility
    async convertToGroupedFormat() {
        const groups = [];
        let currentGroup = null;
        let unnamedQuestions = [];
        
        this.config.items.forEach(item => {
            if (item.type === 'group') {
                // Save previous unnamed questions
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
        
        // Generate voter hashes with types
        const voterHashes = await this.getVoterHashesWithTypes();
        
        return {
            title: this.config.title,
            description: this.config.description,
            subjects: this.config.subjects,
            groups: groups,
            voterHashes: voterHashes
            // NOTE: actual voter keys are intentionally excluded for zero-knowledge backend
        };
    }
    
    // Generate voter hashes with types for server storage
    async getVoterHashesWithTypes() {
        if (!this.session || !this.config.voters) {
            return [];
        }
        
        const voterHashes = [];
        
        for (const voter of this.config.voters) {
            try {
                const voterHash = await CryptoUtils.createVoterHash(voter.id, this.session.sessionId);
                voterHashes.push({
                    hash: voterHash,
                    type: voter.type || 'single'
                });
            } catch (error) {
                console.error('Failed to create voter hash for:', voter.id, error);
            }
        }
        
        console.log(`Generated ${voterHashes.length} voter hashes with types for server storage`);
        return voterHashes;
    }
    
    // Helper method to build groups from items (without voter hashes)
    buildGroupsFromItems() {
        const groups = [];
        let currentGroup = null;
        let unnamedQuestions = [];
        
        this.config.items.forEach(item => {
            if (item.type === 'group') {
                // Save previous unnamed questions
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
        
        return groups;
    }
    
    // Convert grouped format to flat format
    convertFromGroupedFormat(groupedConfig) {
        const items = [];
        
        groupedConfig.groups.forEach(group => {
            items.push({
                id: group.id,
                type: 'group',
                name: group.name
            });
            
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
        
        // Preserve local-only data (voters) when loading from server
        const currentVoters = this.config.voters;
        
        this.config = {
            title: groupedConfig.title || '',
            description: groupedConfig.description || '',
            subjects: groupedConfig.subjects || [],
            items: items,
            voters: currentVoters // Keep existing voters - they're not stored on server
        };
    }
    
    // Event listener system
    addEventListener(event, callback) {
        this.listeners.add({ event, callback });
    }
    
    removeEventListener(event, callback) {
        for (let listener of this.listeners) {
            if (listener.event === event && listener.callback === callback) {
                this.listeners.delete(listener);
                break;
            }
        }
    }
    
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`Error in listener for ${event}:`, error);
                }
            }
        });
    }
    
    // Clear all data (for new session)
    clear() {
        this.config = {
            title: '',
            description: '',
            items: [],
            subjects: [],
            voters: []
        };
        this.session = null;
        this.lastSyncTime = 0;
        
        // Clear localStorage
        localStorage.removeItem('voting_current_session');
        localStorage.removeItem('voting_current_config');
        
        this.notifyListeners('state-cleared');
    }
    
    // Getters
    getConfig() {
        return { ...this.config };
    }
    
    getSession() {
        return this.session;
    }
    
    hasUnsyncedChanges() {
        return this.lastSyncTime === 0 || (this.syncTimeout !== null);
    }
}