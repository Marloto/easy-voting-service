const StorageManager = require('../utils/storage');

class VoteService {
  constructor() {
    this.storage = new StorageManager();
  }

  async updateVote(storageHash, voterHash, encryptedVote) {
    const storageExists = await this.storage.storageExists(storageHash);
    if (!storageExists) {
      throw new Error('Storage not found');
    }

    return await this.storage.updateVote(storageHash, voterHash, encryptedVote);
  }
}

module.exports = VoteService;