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

# Create .env file for local development
cp .env.example .env

# Edit .env and add your API keys
# Example:
# PORT=3000
# GEMINI_API_KEY=AIzaSyD1234567890abcdefghijklmnop
# ANTHROPIC_API_KEY=sk-ant-1234567890 (optional)

# Start the server
npm start
```

Visit http://localhost:3000

**Important for local testing:**
- The `.env` file is ignored by Git (it's in `.gitignore`)
- Never commit your `.env` file with real API keys
- Use `.env.example` as a template

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
   - Click "Add Environment Variable" or similar
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your actual Gemini API key (starts with `AIza...`)
   - Click Save/Add
9. **Important:** Make sure you're adding to "Environment Variables" section, NOT uploading a `.env` file

**Troubleshooting Hostinger Environment Variables:**
- Some Hostinger plans may require you to set variables in a different location
- Check: Application Settings → Environment Variables
- Check: Node.js Application → Environment section
- Verify the variable is saved (refresh the page to confirm)
- After adding variables, **restart/redeploy** the application

**To verify variables are working:**
- Visit: `https://yourdomain.com/api/env-debug`
- Should show: `hasGeminiKey: true` and `geminiKeyLength: 39` (or similar)
- If it shows `false`, the environment variable isn't being loaded

#### Step 3: Deploy

Click "Deploy" and Hostinger will automatically deploy your application!

## Customization

Edit `config.json` to update your personal information:
```json
{
  "name": "Your Name",
  "tagline": "Developer | Creator | Thinker",
  "links": {
    "linkedin": "https://linkedin.com/in/yourprofile",
    "resume": "/resume.pdf",
    "github": "https://github.com/yourusername"
  }
}
```

You can also edit `public/index.html` for styling and layout changes.

## Environment Variables

- `PORT`: Server port (default: 3000)
- `GEMINI_API_KEY`: Optional - enables Google Gemini AI responses
- `ANTHROPIC_API_KEY`: Optional - enables Claude AI responses

**AI Provider Configuration:**
Set `aiProvider` in `config.json` to either `"gemini"` (default) or `"claude"`.
The app will use the specified provider if the API key is available, otherwise it falls back to the other provider or just logs queries.

**Getting API Keys:**

### Google Gemini API Key (Recommended - Free & Easy):
1. Visit https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. The system may prompt you to create/select a Google Cloud project (this happens automatically in the background)
5. Copy your API key
6. **Important**: The API key is all you need - no project name or project number required in your code
7. **Free tier**: 60 requests per minute, no credit card required

**Note about Google Cloud Projects:**
- When you create a Gemini API key, it's automatically associated with a Google Cloud project behind the scenes
- You don't need to reference the project ID, project name, or project number anywhere in your code
- The API key contains all the necessary authentication information
- We use Google AI Studio API (not Vertex AI), which only requires the API key

### Claude API Key (Optional - Premium):
1. Visit https://console.anthropic.com
2. Sign up or log in
3. Go to "API Keys" section in the dashboard
4. Click "Create Key"
5. Copy your API key
6. **Note**: Claude requires payment setup after free trial credits are used
7. More powerful for complex queries, but costs money after free tier

**Recommendation:** Start with Gemini (free, generous limits) and add Claude later if needed.

Without any API key, queries will still be logged but won't receive AI responses.

## Security Considerations

```
├── server.js           # Main server file
├── package.json        # Dependencies
├── config.json         # Your personal info (EDIT THIS!)
├── public/
│   └── index.html     # Frontend HTML/CSS/JS
├── data/
│   └── queries.json   # Logged queries (auto-created)
└── README.md
```

## Viewing Logged Queries

You can view all logged queries by visiting: `http://localhost:3000/api/queries`

This endpoint returns a JSON array of all queries with timestamps.

## Future Enhancements

- Connect to n8n workflow for advanced query processing
- Add database integration (MongoDB, PostgreSQL)
- Add admin dashboard to review queries
- Enhance AI logic with more sophisticated routing

## License

MIT