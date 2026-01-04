// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
const DATA_DIR = './data';
const QUERIES_FILE = path.join(DATA_DIR, 'queries.json');

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  try {
    await fs.access(QUERIES_FILE);
  } catch {
    await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
  }
}

// Log query endpoint
app.post('/api/log-query', async (req, res) => {
  try {
    const { query } = req.body;
    
    const queries = JSON.parse(await fs.readFile(QUERIES_FILE, 'utf8'));
    
    queries.push({
      query,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    
    await fs.writeFile(QUERIES_FILE, JSON.stringify(queries, null, 2));
    
    res.json({ success: true, message: 'Query logged successfully' });
  } catch (error) {
    console.error('Error logging query:', error);
    res.status(500).json({ error: 'Failed to log query' });
  }
});

// AI query endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Log the query first
    const queries = JSON.parse(await fs.readFile(QUERIES_FILE, 'utf8'));
    queries.push({
      query,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    await fs.writeFile(QUERIES_FILE, JSON.stringify(queries, null, 2));
    
    // Check if ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        response: "Thanks for your message! I've logged it and will review it soon.",
        isComplex: false
      });
    }
    
    // Simple complexity check
    const wordCount = query.trim().split(/\s+/).length;
    const isComplex = wordCount > 20 || query.includes('?') && query.split('?').length > 2;
    
    if (isComplex) {
      return res.json({
        response: "This looks like a complex query! For detailed assistance, please visit my contact page or connect with me on LinkedIn.",
        isComplex: true,
        redirect: "/contact"
      });
    }
    
    // Call Claude API for simple queries
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are a helpful assistant on a personal homepage. Give a brief, friendly response (2-3 sentences max) to: ${query}`
        }]
      })
    });
    
    const data = await response.json();
    const aiResponse = data.content[0].text;
    
    res.json({
      response: aiResponse,
      isComplex: false
    });
    
  } catch (error) {
    console.error('Error processing query:', error);
    res.json({
      response: "Thanks for your message! I'll review it soon.",
      isComplex: false
    });
  }
});

// Get all queries (for review)
app.get('/api/queries', async (req, res) => {
  try {
    const queries = JSON.parse(await fs.readFile(QUERIES_FILE, 'utf8'));
    res.json(queries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve queries' });
  }
});

// Get config
app.get('/api/config', async (req, res) => {
  try {
    const config = JSON.parse(await fs.readFile('./config.json', 'utf8'));
    res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});