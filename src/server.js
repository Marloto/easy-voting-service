const express = require('express');
const cors = require('cors');
const path = require('path');
const pollRoutes = require('./routes/polls');
const voteRoutes = require('./routes/votes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Key', 'X-Master-Key', 'X-Master-Hash']
}));

app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve Bootstrap CSS and JS from node_modules
app.use('/css', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, '../node_modules/bootstrap/dist/js')));

// Serve Bootstrap Icons CSS and fonts from node_modules
app.use('/css', express.static(path.join(__dirname, '../node_modules/bootstrap-icons/font')));

// Serve SortableJS from node_modules
app.use('/js', express.static(path.join(__dirname, '../node_modules/sortablejs')));

app.use('/api/data', pollRoutes);
app.use('/api/vote', voteRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Voting backend server running on port ${PORT}`);
});

module.exports = app;