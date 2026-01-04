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