// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();

/*
===========================================
FILE: package.json
===========================================
{
  "name": "personal-homepage",
  "version": "1.0.0",
  "description": "Personal homepage with AI-powered query system",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "keywords": ["homepage", "portfolio", "nodejs"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}

===========================================
FILE: .env.example
===========================================
PORT=3000
ANTHROPIC_API_KEY=your_api_key_here

===========================================
FILE: .gitignore
===========================================
node_modules/
.env
data/
*.log

===========================================
FILE: README.md
===========================================
# Personal Homepage

A simple Node.js web application for your personal homepage.

## Features

- Landing page with profile links (LinkedIn, Resume, GitHub)
- AI-powered query system that logs and responds to visitor questions
- Interactive particle playground game
- Simple and clean design

## Setup Instructions

### 1. Local Development

```bash
# Install dependencies
npm install

# Create .env file (optional - for AI features)
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY if you want AI responses

# Start the server
npm start
```

Visit http://localhost:3000

### 2. Deploy to Hostinger via GitHub

#### Step 1: Push to GitHub

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/your-repo-name.git
git branch -M main
git push -u origin main
```

#### Step 2: Connect to Hostinger

1. Log in to your Hostinger control panel
2. Go to "Git" or "GitHub" deployment section
3. Connect your GitHub account
4. Select your repository
5. Set branch to `main`
6. Set build command to: `npm install`
7. Set start command to: `npm start`
8. Add environment variables:
   - `PORT` (Hostinger will usually set this automatically)
   - `ANTHROPIC_API_KEY` (optional - only if you want AI responses)

#### Step 3: Deploy

Click "Deploy" and Hostinger will automatically deploy your application!

## Customization

Edit `public/index.html` to update:
- Your name in the header
- Your profile links (LinkedIn, GitHub, Resume)
- Any text or styling

## Environment Variables

- `PORT`: Server port (default: 3000)
- `ANTHROPIC_API_KEY`: Optional - enables AI responses to queries

Without the API key, queries will still be logged but won't receive AI responses.

## File Structure

```
├── server.js           # Main server file
├── package.json        # Dependencies
├── public/
│   └── index.html     # Frontend HTML/CSS/JS
├── data/
│   └── queries.json   # Logged queries (auto-created)
└── README.md
```

## Future Enhancements

- Connect to n8n workflow for advanced query processing
- Add database integration (MongoDB, PostgreSQL)
- Add admin dashboard to review queries
- Enhance AI logic with more sophisticated routing

## License

MIT
*/

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
        response: "AI backend not configured. Please set ANTHROPIC_API_KEY environment variable.",
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

/* 
===========================================
FILE: public/index.html
===========================================
*/
`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Name - Personal Homepage</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 30px;
            flex-wrap: wrap;
        }

        .links a {
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 25px;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
        }

        .links a:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }

        .content {
            padding: 40px;
        }

        .query-section {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 40px;
        }

        .query-section h2 {
            margin-bottom: 20px;
            color: #667eea;
        }

        .input-group {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        #queryInput {
            flex: 1;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        #queryInput:focus {
            outline: none;
            border-color: #667eea;
        }

        #submitBtn {
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: transform 0.3s;
        }

        #submitBtn:hover {
            transform: scale(1.05);
        }

        #submitBtn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .response {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 10px;
            border-left: 4px solid #667eea;
            display: none;
        }

        .response.show {
            display: block;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .game-section {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
        }

        .game-section h2 {
            margin-bottom: 15px;
            color: #667eea;
        }

        #gameCanvas {
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            cursor: crosshair;
            background: white;
            display: block;
            margin: 20px auto;
        }

        .game-controls {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .game-controls button {
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s;
        }

        .game-controls button:hover {
            background: #764ba2;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2em;
            }
            
            .content {
                padding: 20px;
            }
            
            .input-group {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Name</h1>
            <p>Developer | Creator | Thinker</p>
            <div class="links">
                <a href="https://linkedin.com/in/yourprofile" target="_blank">LinkedIn</a>
                <a href="/resume.pdf" target="_blank">Resume</a>
                <a href="https://github.com/yourusername" target="_blank">GitHub</a>
            </div>
        </div>

        <div class="content">
            <div class="query-section">
                <h2>What is on your mind today?</h2>
                <p>Ask me anything or share your thoughts. I'll do my best to help!</p>
                <div class="input-group">
                    <input type="text" id="queryInput" placeholder="Type your question or thought here...">
                    <button id="submitBtn">Send</button>
                </div>
                <div id="response" class="response"></div>
            </div>

            <div class="game-section">
                <h2>Particle Playground</h2>
                <p>Click and drag to create colorful particles!</p>
                <canvas id="gameCanvas" width="800" height="400"></canvas>
                <div class="game-controls">
                    <button id="clearBtn">Clear</button>
                    <button id="gravityBtn">Toggle Gravity</button>
                    <button id="colorBtn">Random Colors</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Query handling
        const queryInput = document.getElementById('queryInput');
        const submitBtn = document.getElementById('submitBtn');
        const responseDiv = document.getElementById('response');

        async function handleQuery() {
            const query = queryInput.value.trim();
            if (!query) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            responseDiv.classList.remove('show');

            try {
                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();
                responseDiv.textContent = data.response;
                responseDiv.classList.add('show');

                if (data.isComplex && data.redirect) {
                    setTimeout(() => {
                        responseDiv.textContent += ' Redirecting...';
                    }, 2000);
                }

                queryInput.value = '';
            } catch (error) {
                responseDiv.textContent = 'Thanks for your message! It has been logged for review.';
                responseDiv.classList.add('show');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send';
            }
        }

        submitBtn.addEventListener('click', handleQuery);
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleQuery();
        });

        // Particle game
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const particles = [];
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        let gravity = true;
        let colorMode = 'rainbow';

        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.vx = (Math.random() - 0.5) * 4;
                this.vy = (Math.random() - 0.5) * 4;
                this.radius = Math.random() * 3 + 2;
                this.color = this.getColor();
                this.life = 1;
            }

            getColor() {
                if (colorMode === 'rainbow') {
                    const hue = Math.random() * 360;
                    return `hsl(${hue}, 70%, 60%)`;
                } else {
                    return `hsl(${colorMode}, 70%, 60%)`;
                }
            }

            update() {
                if (gravity) {
                    this.vy += 0.2;
                }
                
                this.x += this.vx;
                this.y += this.vy;
                this.life -= 0.005;

                if (this.y + this.radius > canvas.height) {
                    this.y = canvas.height - this.radius;
                    this.vy *= -0.7;
                }

                if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
                    this.vx *= -1;
                }
            }

            draw() {
                ctx.globalAlpha = this.life;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (isMouseDown) {
                for (let i = 0; i < 3; i++) {
                    particles.push(new Particle(mouseX, mouseY));
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                particles[i].draw();

                if (particles[i].life <= 0) {
                    particles.splice(i, 1);
                }
            }

            requestAnimationFrame(animate);
        }

        canvas.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });

        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isMouseDown = false;
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            particles.length = 0;
        });

        document.getElementById('gravityBtn').addEventListener('click', () => {
            gravity = !gravity;
        });

        document.getElementById('colorBtn').addEventListener('click', () => {
            if (colorMode === 'rainbow') {
                colorMode = Math.random() * 360;
            } else {
                colorMode = 'rainbow';
            }
        });

        animate();
    </script>
</body>
</html>
`;