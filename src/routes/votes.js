const express = require('express');
const VoteService = require('../services/voteService');

const router = express.Router();
const voteService = new VoteService();

router.put('/:storageHash/:voterHash', async (req, res) => {
  try {
    const { storageHash, voterHash } = req.params;
    const { encryptedVote } = req.body;

    if (!encryptedVote) {
      return res.status(400).json({ error: 'Encrypted vote required' });
    }

    const result = await voteService.updateVote(storageHash, voterHash, encryptedVote);
    res.json(result);
  } catch (error) {
    console.error('Error updating vote:', error);
    if (error.message === 'Storage not found') {
      res.status(404).json({ error: 'Storage not found' });
    } else {
      res.status(500).json({ error: 'Failed to update vote' });
    }
  }
});

module.exports = router;