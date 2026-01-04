// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const app = express();

// Load environment variables from .env file (for local development)
require('dotenv').config();

// Hostinger provides PORT via environment variable
// Default to 3000 for local development
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create a log file for debugging
const LOG_FILE = './app.log';
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  try {
    fsSync.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    // If we can't write to file, at least console.log works
    console.error('Failed to write to log file:', err.message);
  }
}

// Log uncaught errors
process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.message}`);
  log(`Stack: ${err.stack}`);
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`UNHANDLED REJECTION: ${reason}`);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

log('Application starting...');
log(`PORT: ${PORT}`);
log(`HOST: ${HOST}`);
log(`Directory: ${__dirname}`);
log(`GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
log(`ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check file system
app.get('/debug', async (req, res) => {
  try {
    const files = await fs.readdir(__dirname);
    const publicFiles = await fs.readdir(path.join(__dirname, 'public')).catch(() => ['public folder not found']);
    const configExists = await fs.access('./config.json').then(() => true).catch(() => false);
    
    res.json({
      status: 'running',
      directory: __dirname,
      port: PORT,
      host: HOST,
      files: files,
      publicFiles: publicFiles,
      configExists: configExists,
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'not set'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available Gemini models (for debugging)
app.get('/api/gemini-models', async (req, res) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.json({ error: 'GEMINI_API_KEY not set' });
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const data = await response.json();
    
    // Filter to only show models that support generateContent
    const generateModels = data.models?.filter(m => 
      m.supportedGenerationMethods?.includes('generateContent')
    ).map(m => ({
      name: m.name,
      displayName: m.displayName,
      description: m.description
    }));
    
    res.json({
      availableModels: generateModels,
      fullResponse: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ensure data directory exists
const DATA_DIR = './data';
const QUERIES_FILE = path.join(DATA_DIR, 'queries.json');

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
    log('Data directory exists');
  } catch {
    log('Creating data directory');
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  try {
    await fs.access(QUERIES_FILE);
    log('Queries file exists');
  } catch {
    log('Creating queries file');
    await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
  }
}

// Check available Gemini models on startup
async function checkGeminiModels() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    log('No Gemini API key - skipping model check');
    return;
  }
  
  try {
    log('Checking available Gemini models...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const data = await response.json();
    
    if (data.models) {
      const generateModels = data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      
      log(`Available Gemini models: ${generateModels.join(', ')}`);
    } else {
      log('Could not fetch Gemini models');
    }
  } catch (error) {
    log(`Error checking Gemini models: ${error.message}`);
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
    
    log(`Received query: ${query}`);
    
    // Log the query first
    const queries = JSON.parse(await fs.readFile(QUERIES_FILE, 'utf8'));
    queries.push({
      query,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    await fs.writeFile(QUERIES_FILE, JSON.stringify(queries, null, 2));
    
    // Read config to determine AI provider
    const config = JSON.parse(await fs.readFile('./config.json', 'utf8'));
    const aiProvider = config.aiProvider || 'gemini'; // Default to Gemini
    
    log(`AI Provider from config: ${aiProvider}`);
    
    // Check which API key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    
    log(`Gemini key available: ${!!geminiKey}`);
    log(`Claude key available: ${!!claudeKey}`);
    
    if (!geminiKey && !claudeKey) {
      log('No API keys available');
      return res.json({
        response: "Thanks for your message! I've logged it and will review it soon.",
        isComplex: false
      });
    }
    
    // Simple complexity check
    const wordCount = query.trim().split(/\s+/).length;
    const isComplex = wordCount > 20 || query.includes('?') && query.split('?').length > 2;
    
    log(`Query word count: ${wordCount}, isComplex: ${isComplex}`);
    
    if (isComplex) {
      return res.json({
        response: "This looks like a complex query! For detailed assistance, please visit my contact page or connect with me on LinkedIn.",
        isComplex: true,
        redirect: "/contact"
      });
    }
    
    let aiResponse;
    
    // Use Gemini if selected and key is available
    if (aiProvider === 'gemini' && geminiKey) {
      log('Attempting to call Gemini API...');
      try {
        // Try multiple model variations in order of preference
        // Based on actual available models from /api/gemini-models
        const modelsToTry = [
          'gemini-2.5-flash',           // Best: Latest stable, 1M context
          'gemini-flash-latest',        // Backup: Always latest
          'gemini-2.0-flash-001',       // Fallback: Older stable
          'gemini-2.0-flash'            // Last resort
        ];
        
        let lastError = null;
        
        for (const modelName of modelsToTry) {
          try {
            log(`Trying model: ${modelName}`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are a helpful assistant on a personal homepage. Give a brief, friendly response (2-3 sentences max) to: ${query}`
                  }]
                }]
              })
            });
            
            log(`Model ${modelName} response status: ${response.status}`);
            
            const data = await response.json();
            
            // Handle rate limit errors
            if (response.status === 429 || data.error?.code === 429) {
              log('Rate limit exceeded for Gemini API');
              
              queryLogEntry.status = 'rate_limited';
              queryLogEntry.aiProvider = 'gemini';
              queryLogEntry.modelUsed = modelName;
              queryLogEntry.response = "Thanks for your question! I've logged it for review. We've hit our AI rate limit for now - please try again in a minute or contact me directly!";
              queryLogEntry.error = 'Rate limit exceeded';
              
              // Log the query
              const queries = JSON.parse(await fs.readFile(QUERIES_FILE, 'utf8'));
              queries.push(queryLogEntry);
              await fs.writeFile(QUERIES_FILE, JSON.stringify(queries, null, 2));
              
              return res.json({
                response: queryLogEntry.response,
                isComplex: false,
                rateLimited: true
              });
            }
            
            // If 404, try next model
            if (response.status === 404) {
              log(`Model ${modelName} not found, trying next...`);
              lastError = data.error;
              continue;
            }
            
            // Handle other API errors
            if (data.error) {
              log(`Gemini API error with ${modelName}: ${data.error.message}`);
              lastError = data.error;
              continue;
            }
            
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
              aiResponse = data.candidates[0].content.parts[0].text;
              modelUsed = modelName;
              log(`✓ Success with model ${modelName}: ${aiResponse}`);
              break; // Success! Exit loop
            }
          } catch (err) {
            log(`Error with model ${modelName}: ${err.message}`);
            lastError = err;
            continue; // Try next model
          }
        }
        
        // If we got here without a response, all models failed
        if (!aiResponse) {
          log('All Gemini models failed');
          throw new Error(lastError?.message || 'All Gemini models unavailable');
        }
      } catch (error) {
        log(`Gemini API error: ${error.message}`);
        console.error('Gemini API error:', error);
        // Fallback to Claude if available
        if (claudeKey) {
          log('Falling back to Claude...');
          aiResponse = await callClaudeAPI(query, claudeKey);
        } else {
          throw error;
        }
      }
    } 
    // Use Claude if selected or as fallback
    else if (claudeKey) {
      log('Attempting to call Claude API...');
      aiResponse = await callClaudeAPI(query, claudeKey);
    } else {
      log('No suitable AI provider available');
      return res.json({
        response: "Thanks for your message! I'll review it soon.",
        isComplex: false
      });
    }
    
    res.json({
      response: aiResponse,
      isComplex: false
    });
    
  } catch (error) {
    log(`Error processing query: ${error.message}`);
    console.error('Error processing query:', error);
    res.json({
      response: "Thanks for your message! I'll review it soon.",
      isComplex: false
    });
  }
});

// Helper function for Claude API
async function callClaudeAPI(query, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
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
  return data.content[0].text;
}

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
ensureDataDir().then(async () => {
  log('Data directory initialized');
  
  // Check available models
  await checkGeminiModels();
  
  const server = app.listen(PORT, HOST, () => {
    log(`✓ Server successfully started on ${HOST}:${PORT}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  
  server.on('error', (err) => {
    log(`✗ Server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      log(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });
  
}).catch(err => {
  log(`✗ FATAL ERROR during initialization: ${err.message}`);
  log(`Stack: ${err.stack}`);
  console.error('Failed to start server:', err);
  process.exit(1);
});