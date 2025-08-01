const fs = require('fs').promises;
const path = require('path');

class StorageManager {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
  }

  async ensureDataDir() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async ensureStorageDir(storageHash) {
    const storageDir = path.join(this.dataDir, storageHash);
    try {
      await fs.access(storageDir);
    } catch {
      await fs.mkdir(storageDir, { recursive: true });
    }
    return storageDir;
  }

  async ensureVoterDir(storageHash, voterHash) {
    const storageDir = await this.ensureStorageDir(storageHash);
    const votersDir = path.join(storageDir, 'voters');
    const voterDir = path.join(votersDir, voterHash);
    
    try {
      await fs.mkdir(votersDir, { recursive: true });
      await fs.mkdir(voterDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
    
    return voterDir;
  }

  async updateConfig(storageHash, masterHash, encryptedConfig, voterHashes = []) {
    await this.ensureDataDir();
    const storageDir = await this.ensureStorageDir(storageHash);
    const masterPath = path.join(storageDir, 'master.json');
    
    // Check if master hash already exists and validate
    try {
      const existingData = await fs.readFile(masterPath, 'utf8');
      const existing = JSON.parse(existingData);
      if (existing.masterHash !== masterHash) {
        throw new Error('Invalid master hash');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // First time - create master hash
        const masterData = {
          masterHash,
          createdAt: new Date().toISOString()
        };
        await fs.writeFile(masterPath, JSON.stringify(masterData, null, 2));
      } else {
        throw error; // Re-throw validation error
      }
    }
    
    // Store/update encrypted config
    const configPath = path.join(storageDir, 'config.json');
    const configData = {
      encryptedConfig,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    
    // Store/update voter hashes separately (secure)
    if (voterHashes && voterHashes.length > 0) {
      const voterHashesPath = path.join(storageDir, 'voter-hashes.json');
      const voterHashesData = {
        voterHashes,
        updatedAt: new Date().toISOString()
      };
      await fs.writeFile(voterHashesPath, JSON.stringify(voterHashesData, null, 2));
      console.log(`Stored ${voterHashes.length} voter hashes for ${storageHash}`);
    }
    
    return configData;
  }

  async getConfig(storageHash, masterHash = null) {
    const configPath = path.join(this.dataDir, storageHash, 'config.json');
    
    try {
      const data = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(data);
      
      // If master hash is provided, include voter hashes
      if (masterHash) {
        const isValid = await this.validateMasterHash(storageHash, masterHash);
        if (isValid) {
          const voterHashes = await this.getVoterHashes(storageHash);
          if (voterHashes) {
            config.voterHashes = voterHashes;
          }
        }
      }
      
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateVote(storageHash, voterHash, encryptedVote) {
    await this.ensureDataDir();
    const voterDir = await this.ensureVoterDir(storageHash, voterHash);
    
    const timestamp = new Date().toISOString();
    const filename = `vote_${timestamp.replace(/[:.]/g, '-')}.json`;
    const votePath = path.join(voterDir, filename);
    
    const voteData = {
      voterHash,
      encryptedVote,
      timestamp
    };

    await fs.writeFile(votePath, JSON.stringify(voteData, null, 2));
    return voteData;
  }

  async getVotes(storageHash) {
    const votersDir = path.join(this.dataDir, storageHash, 'voters');
    try {
      const voterDirs = await fs.readdir(votersDir);
      const allVotes = {};
      
      for (const voterHash of voterDirs) {
        const voterDir = path.join(votersDir, voterHash);
        const stat = await fs.stat(voterDir);
        
        if (stat.isDirectory()) {
          const voteFiles = await fs.readdir(voterDir);
          const votes = [];
          
          for (const file of voteFiles) {
            if (file.startsWith('vote_') && file.endsWith('.json')) {
              const filePath = path.join(voterDir, file);
              const data = await fs.readFile(filePath, 'utf8');
              votes.push(JSON.parse(data));
            }
          }
          
          votes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          allVotes[voterHash] = votes;
        }
      }
      
      return allVotes;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async storageExists(storageHash) {
    try {
      const storageDir = path.join(this.dataDir, storageHash);
      await fs.access(storageDir);
      return true;
    } catch {
      return false;
    }
  }

  async validateMasterHash(storageHash, masterHash) {
    try {
      const masterPath = path.join(this.dataDir, storageHash, 'master.json');
      const data = await fs.readFile(masterPath, 'utf8');
      const master = JSON.parse(data);
      return master.masterHash === masterHash;
    } catch(e) {
      console.error('Error validating master hash:', e);
      return false;
    }
  }

  async getVoterHashes(storageHash) {
    const voterHashesPath = path.join(this.dataDir, storageHash, 'voter-hashes.json');
    try {
      const data = await fs.readFile(voterHashesPath, 'utf8');
      const voterHashesData = JSON.parse(data);
      return voterHashesData.voterHashes;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async authenticateVoter(storageHash, voterHash) {
    try {
      const voterHashes = await this.getVoterHashes(storageHash);
      const voterData = voterHashes.find(vh => vh.hash === voterHash);
      
      if (voterData) {
        return {
          authorized: true,
          voterType: voterData.type || 'single'
        };
      } else {
        return {
          authorized: false
        };
      }
    } catch (error) {
      console.error('Error authenticating voter:', error);
      return {
        authorized: false
      };
    }
  }

  async clearAllSessionData(storageHash) {
    const storageDir = path.join(this.dataDir, storageHash);
    
    try {
      // Check if storage directory exists
      await fs.access(storageDir);
      
      // Remove entire storage directory and all its contents
      await fs.rm(storageDir, { recursive: true, force: true });
      
      console.log(`Cleared all session data for ${storageHash}`);
      
      return {
        success: true,
        message: 'All session data cleared successfully',
        clearedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, consider it cleared
        return {
          success: true,
          message: 'No session data found to clear',
          clearedAt: new Date().toISOString()
        };
      }
      
      console.error('Error clearing session data:', error);
      throw new Error('Failed to clear session data');
    }
  }

  async uploadBulkVotes(storageHash, votes) {
    await this.ensureDataDir();
    const storageDir = await this.ensureStorageDir(storageHash);
    
    let uploadedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    try {
      // Process each vote in the votes object
      for (const [voterHash, voterVotes] of Object.entries(votes)) {
        if (!Array.isArray(voterVotes)) {
          errors.push(`Invalid vote data for voter ${voterHash}: not an array`);
          continue;
        }
        
        // Ensure voter directory exists
        const voterDir = await this.ensureVoterDir(storageHash, voterHash);
        
        // Process each vote for this voter
        for (const vote of voterVotes) {
          try {
            if (!vote.timestamp || !vote.encryptedVote) {
              errors.push(`Invalid vote structure for voter ${voterHash}: missing timestamp or encryptedVote`);
              skippedCount++;
              continue;
            }
            
            // Create filename based on timestamp
            const timestamp = vote.timestamp;
            const filename = `vote_${timestamp.replace(/[:.]/g, '-')}.json`;
            const votePath = path.join(voterDir, filename);
            
            // Check if vote already exists
            try {
              await fs.access(votePath);
              skippedCount++; // Skip if file already exists
              continue;
            } catch (error) {
              // File doesn't exist, we can create it
            }
            
            // Write the vote data
            const voteData = {
              voterHash: vote.voterHash || voterHash,
              encryptedVote: vote.encryptedVote,
              timestamp: vote.timestamp
            };
            
            await fs.writeFile(votePath, JSON.stringify(voteData, null, 2));
            uploadedCount++;
          } catch (error) {
            errors.push(`Error processing vote for voter ${voterHash}: ${error.message}`);
            skippedCount++;
          }
        }
      }
      
      const result = {
        success: true,
        uploadedCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Bulk vote upload completed: ${uploadedCount} uploaded, ${skippedCount} skipped`,
        uploadedAt: new Date().toISOString()
      };
      
      console.log(`Bulk vote upload for ${storageHash}:`, result);
      return result;
    } catch (error) {
      console.error('Error in bulk vote upload:', error);
      throw new Error('Failed to upload bulk votes');
    }
  }
}

module.exports = StorageManager;