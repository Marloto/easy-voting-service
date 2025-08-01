const express = require('express');
const PollService = require('../services/pollService');

const router = express.Router();
const pollService = new PollService();

router.put('/:storageHash/config', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const masterHash = req.headers['x-master-hash'];
    const { encryptedConfig, voterHashes } = req.body;

    if (!masterHash) {
      return res.status(401).json({ error: 'Master hash required' });
    }

    if (!encryptedConfig) {
      return res.status(400).json({ error: 'Encrypted config required' });
    }

    const result = await pollService.updateConfig(storageHash, masterHash, encryptedConfig, voterHashes);
    res.json(result);
  } catch (error) {
    console.error('Error updating config:', error);
    if (error.message === 'Invalid master hash') {
      res.status(403).json({ error: 'Invalid master hash' });
    } else {
      res.status(500).json({ error: 'Failed to update config' });
    }
  }
});

router.get('/:storageHash/config', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const masterHash = req.headers['x-master-hash'];
    
    const config = await pollService.getConfig(storageHash, masterHash);
    
    if (!config) {
      return res.status(404).json({ error: 'Storage not found' });
    }

    res.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

router.get('/:storageHash/votes', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const masterHash = req.headers['x-master-hash'];

    if (!masterHash) {
      return res.status(401).json({ error: 'Master hash required' });
    }

    const votes = await pollService.getVotes(storageHash, masterHash);
    res.json({ votes });
  } catch (error) {
    console.error('Error getting votes:', error);
    if (error.message === 'Invalid master hash') {
      res.status(403).json({ error: 'Invalid master hash' });
    } else {
      res.status(500).json({ error: 'Failed to get votes' });
    }
  }
});

// New voter authentication endpoint
router.post('/:storageHash/voter/auth', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const { voterHash } = req.body;

    if (!voterHash) {
      return res.status(400).json({ error: 'Voter hash required' });
    }

    const authResult = await pollService.authenticateVoter(storageHash, voterHash);
    res.json(authResult);
  } catch (error) {
    console.error('Error authenticating voter:', error);
    res.status(500).json({ error: 'Failed to authenticate voter' });
  }
});

// Clear all session data endpoint
router.delete('/:storageHash/clear', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const masterHash = req.headers['x-master-hash'];

    if (!masterHash) {
      return res.status(401).json({ error: 'Master hash required' });
    }

    const result = await pollService.clearAllSessionData(storageHash, masterHash);
    res.json(result);
  } catch (error) {
    console.error('Error clearing session data:', error);
    if (error.message === 'Invalid master hash') {
      res.status(403).json({ error: 'Invalid master hash' });
    } else {
      res.status(500).json({ error: 'Failed to clear session data' });
    }
  }
});

// Bulk voting data upload/recreation endpoint
router.post('/:storageHash/votes/bulk', async (req, res) => {
  try {
    const { storageHash } = req.params;
    const masterHash = req.headers['x-master-hash'];
    const { votes } = req.body;

    if (!masterHash) {
      return res.status(401).json({ error: 'Master hash required' });
    }

    if (!votes || typeof votes !== 'object' || Array.isArray(votes)) {
      return res.status(400).json({ error: 'Votes object required' });
    }

    const result = await pollService.uploadBulkVotes(storageHash, masterHash, votes);
    res.json(result);
  } catch (error) {
    console.error('Error uploading bulk votes:', error);
    if (error.message === 'Invalid master hash') {
      res.status(403).json({ error: 'Invalid master hash' });
    } else {
      res.status(500).json({ error: 'Failed to upload bulk votes' });
    }
  }
});

module.exports = router;