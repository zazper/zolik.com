// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const app = express();

// Load environment variables from .env file (for local development)
// Hostinger should provide env vars directly, but this won't hurt
try {
  require('dotenv').config();
} catch (err) {
  console.log('dotenv not available or .env file not found (this is normal for production)');
}

// Alternative: Try to read from a config file if env vars not available
// This is a fallback for hosting providers with non-standard env var handling
if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  try {
    // Check multiple locations for server-config.json
    // Priority: 1) Parent directory, 2) Current directory
    const configLocations = [
      path.join(__dirname, '..', 'server-config.json'),  // Parent directory (priority)
      path.join(__dirname, 'server-config.json')          // Current directory (fallback)
    ];
    
    let configLoaded = false;
    
    for (const configPath of configLocations) {
      if (fsSync.existsSync(configPath)) {
        console.log(`Found server-config.json at: ${configPath}`);
        const serverConfig = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
        
        if (serverConfig.GEMINI_API_KEY) {
          process.env.GEMINI_API_KEY = serverConfig.GEMINI_API_KEY;
          console.log(`Loaded GEMINI_API_KEY from ${configPath}`);
        }
        if (serverConfig.ANTHROPIC_API_KEY) {
          process.env.ANTHROPIC_API_KEY = serverConfig.ANTHROPIC_API_KEY;
          console.log(`Loaded ANTHROPIC_API_KEY from ${configPath}`);
        }
        
        configLoaded = true;
        break; // Stop after loading from first found location
      }
    }
    
    if (!configLoaded) {
      console.log('No server-config.json found in parent or current directory (this is normal if using env vars)');
    }
  } catch (err) {
    console.log(`Could not load server-config.json: ${err.message}`);
  }
}

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
log(`Node version: ${process.version}`);
log(`Platform: ${process.platform}`);
log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
log(`GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
log(`GEMINI_API_KEY length: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0}`);
log(`ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      geminiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
      hasClaudeKey: !!process.env.ANTHROPIC_API_KEY,
      nodeVersion: process.version,
      platform: process.platform
    }
  });
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

// Debug endpoint to check environment variables
app.get('/api/env-debug', async (req, res) => {
  try {
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'not set',
      port: PORT,
      host: HOST,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      geminiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
      hasClaudeKey: !!process.env.ANTHROPIC_API_KEY,
      // Show first/last 4 chars of key for verification (safe)
      geminiKeyPreview: process.env.GEMINI_API_KEY ? 
        `${process.env.GEMINI_API_KEY.substring(0, 4)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}` : 
        'not set',
      allEnvKeys: Object.keys(process.env).filter(key => 
        !key.includes('PASSWORD') && 
        !key.includes('SECRET') && 
        !key.includes('KEY') &&
        !key.includes('TOKEN')
      )
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
    // Verify the file has valid JSON
    const content = await fs.readFile(QUERIES_FILE, 'utf8');
    if (!content || content.trim() === '') {
      log('Queries file is empty, initializing with empty array');
      await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
    } else {
      try {
        JSON.parse(content);
        log('Queries file exists and is valid');
      } catch (parseError) {
        log('Queries file exists but is corrupted, resetting');
        await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
      }
    }
  } catch {
    log('Creating queries file');
    await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
  }
}

// Helper function to safely read queries file
async function readQueriesFile() {
  try {
    const content = await fs.readFile(QUERIES_FILE, 'utf8');
    if (!content || content.trim() === '') {
      return [];
    }
    return JSON.parse(content);
  } catch (error) {
    log(`Error reading queries file: ${error.message}, returning empty array`);
    // Reset the file if it's corrupted
    await fs.writeFile(QUERIES_FILE, JSON.stringify([]));
    return [];
  }
}

// Helper function to safely write queries file
async function writeQueriesFile(queries) {
  try {
    await fs.writeFile(QUERIES_FILE, JSON.stringify(queries, null, 2));
  } catch (error) {
    log(`Error writing queries file: ${error.message}`);
    throw error;
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
    
    const queries = await readQueriesFile();
    
    queries.push({
      query,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    
    await writeQueriesFile(queries);
    
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
    
    // Read config to determine AI provider
    const config = JSON.parse(await fs.readFile('./config.json', 'utf8'));
    const aiProvider = config.aiProvider || 'gemini'; // Default to Gemini
    
    log(`AI Provider from config: ${aiProvider}`);
    
    // Check which API key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    
    log(`Gemini key available: ${!!geminiKey}`);
    log(`Claude key available: ${!!claudeKey}`);
    
    // Prepare query log entry
    const queryLogEntry = {
      query,
      timestamp: new Date().toISOString(),
      id: Date.now(),
      aiProvider: null,
      modelUsed: null,
      response: null,
      status: 'pending',
      error: null
    };
    
    if (!geminiKey && !claudeKey) {
      log('No API keys available');
      queryLogEntry.status = 'no_api_key';
      queryLogEntry.response = "Thanks for your message! I've logged it and will review it soon.";
      
      // Log the query
      const queries = await readQueriesFile();
      queries.push(queryLogEntry);
      await writeQueriesFile(queries);
      
      return res.json({
        response: queryLogEntry.response,
        isComplex: false
      });
    }
    
    // Simple complexity check
    const wordCount = query.trim().split(/\s+/).length;
    const isComplex = wordCount > 20 || query.includes('?') && query.split('?').length > 2;
    
    log(`Query word count: ${wordCount}, isComplex: ${isComplex}`);
    
    if (isComplex) {
      queryLogEntry.status = 'complex_query';
      queryLogEntry.response = "This looks like a complex query! For detailed assistance, please visit my contact page or connect with me on LinkedIn.";
      
      // Log the query
      const queries = await readQueriesFile();
      queries.push(queryLogEntry);
      await writeQueriesFile(queries);
      
      return res.json({
        response: queryLogEntry.response,
        isComplex: true,
        redirect: "/contact"
      });
    }
    
    let aiResponse;
    let modelUsed = null;
    
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
              const queries = await readQueriesFile();
              queries.push(queryLogEntry);
              await writeQueriesFile(queries);
              
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
      modelUsed = 'claude-sonnet-4';
    } else {
      log('No suitable AI provider available');
      queryLogEntry.status = 'no_provider';
      queryLogEntry.response = "Thanks for your message! I'll review it soon.";
      
      // Log the query
      const queries = await readQueriesFile();
      queries.push(queryLogEntry);
      await writeQueriesFile(queries);
      
      return res.json({
        response: queryLogEntry.response,
        isComplex: false
      });
    }
    
    // Log successful query with response
    queryLogEntry.status = 'success';
    queryLogEntry.aiProvider = aiProvider;
    queryLogEntry.modelUsed = modelUsed;
    queryLogEntry.response = aiResponse;
    
    const queries = await readQueriesFile();
    queries.push(queryLogEntry);
    await writeQueriesFile(queries);
    
    log(`✓ Query logged successfully with response from ${modelUsed}`);
    
    res.json({
      response: aiResponse,
      isComplex: false
    });
    
  } catch (error) {
    log(`Error processing query: ${error.message}`);
    console.error('Error processing query:', error);
    
    // Log failed query
    try {
      const queries = await readQueriesFile();
      queries.push({
        query: req.body.query,
        timestamp: new Date().toISOString(),
        id: Date.now(),
        status: 'error',
        error: error.message,
        aiProvider: null,
        modelUsed: null,
        response: "Thanks for your message! I'll review it soon."
      });
      await writeQueriesFile(queries);
    } catch (logError) {
      log(`Failed to log error: ${logError.message}`);
    }
    
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
    const queries = await readQueriesFile();
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