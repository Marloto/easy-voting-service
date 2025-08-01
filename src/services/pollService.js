const StorageManager = require('../utils/storage');

class PollService {
  constructor() {
    this.storage = new StorageManager();
  }

  async updateConfig(storageHash, masterHash, encryptedConfig, voterHashes) {
    return await this.storage.updateConfig(storageHash, masterHash, encryptedConfig, voterHashes);
  }

  async getConfig(storageHash, masterHash = null) {
    const config = await this.storage.getConfig(storageHash, masterHash);
    return config;
  }

  async getVotes(storageHash, masterHash) {
    const isValid = await this.storage.validateMasterHash(storageHash, masterHash);
    if (!isValid) {
      throw new Error('Invalid master hash');
    }

    return await this.storage.getVotes(storageHash);
  }

  async authenticateVoter(storageHash, voterHash) {
    return await this.storage.authenticateVoter(storageHash, voterHash);
  }

  async clearAllSessionData(storageHash, masterHash) {
    const isValid = await this.storage.validateMasterHash(storageHash, masterHash);
    if (!isValid) {
      throw new Error('Invalid master hash');
    }

    return await this.storage.clearAllSessionData(storageHash);
  }

  async uploadBulkVotes(storageHash, masterHash, votes) {
    const isValid = await this.storage.validateMasterHash(storageHash, masterHash);
    if (!isValid) {
      throw new Error('Invalid master hash');
    }

    return await this.storage.uploadBulkVotes(storageHash, votes);
  }
}

module.exports = PollService;