// Client-side cryptographic utilities for zero-knowledge voting

class CryptoUtils {
    
    // Generate UUID v4
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    // Generate short voter key (4-6 characters, alphanumeric)
    static generateVoterKey(length = 5) {
        const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Exclude confusing chars like O, 0, I, l
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Generate unique voter key with collision checking
    static generateUniqueVoterKey(existingKeys, length = 5) {
        let attempts = 0;
        let key;
        
        do {
            key = this.generateVoterKey(length);
            attempts++;
            
            // If too many attempts, increase length to reduce collision probability
            if (attempts > 100) {
                length++;
                attempts = 0;
                if (length > 8) {
                    throw new Error('Unable to generate unique voter key');
                }
            }
        } while (existingKeys.includes(key));
        
        return key;
    }
    
    // Generate SHA-256 hash
    static async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Generate symmetric key from password/seed
    static async deriveKey(password, salt = 'voting-salt') {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    // Encrypt data with AES-GCM
    static async encrypt(data, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedData
        );
        
        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    }
    
    // Decrypt data with AES-GCM
    static async decrypt(encryptedData, key) {
        const combined = new Uint8Array(
            atob(encryptedData).split('').map(char => char.charCodeAt(0))
        );
        
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );
        
        const decodedData = new TextDecoder().decode(decrypted);
        return JSON.parse(decodedData);
    }
    
    // Create session keys for voting system
    static async createSessionKeys() {
        const sessionId = this.generateUUID();
        const masterKey = this.generateUUID();
        
        const storageHash = await this.sha256(sessionId);
        const masterHash = await this.sha256(masterKey);
        
        return {
            sessionId,
            masterKey,
            storageHash,
            masterHash
        };
    }
    
    // Create voter hash from voter ID and session
    static async createVoterHash(voterId, sessionId) {
        return await this.sha256(voterId + sessionId);
    }
    
    // Derive encryption key for session config
    static async getSessionKey(sessionId) {
        return await this.deriveKey(sessionId + 'config', 'session-salt');
    }
    
    // Derive encryption key for voter data
    static async getVoterKey(voterId, sessionId) {
        return await this.deriveKey(voterId + sessionId + 'vote', 'voter-salt');
    }
    
    // Save keys to localStorage
    static saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(`voting_${key}`, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }
    
    // Load keys from localStorage
    static loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(`voting_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }
    
    // Create downloadable backup file
    static createBackupFile(sessionData, filename = 'voting-session-backup.json') {
        const backup = {
            timestamp: new Date().toISOString(),
            sessionId: sessionData.sessionId,
            masterKey: sessionData.masterKey,
            storageHash: sessionData.storageHash,
            masterHash: sessionData.masterHash,
            warning: 'Keep this file secure! It contains your master key.'
        };
        
        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    // Parse session ID from URL fragment
    static getSessionFromURL() {
        const fragment = window.location.hash.substring(1);
        return fragment || null;
    }
    
    // Set session ID in URL fragment
    static setSessionInURL(sessionId) {
        window.location.hash = sessionId;
    }
}

// Make CryptoUtils available globally
window.CryptoUtils = CryptoUtils;