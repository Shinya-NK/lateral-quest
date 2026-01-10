# Lateral Quest

A browser-based game built with React and Vite.

## Setup

Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Deployment to GitHub Pages

This project is configured to automatically deploy to GitHub Pages when you push to the `main` branch.

### Initial Setup

1. Go to your repository settings on GitHub
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions**
4. Push to the `main` branch to trigger the deployment

### Manual Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
- Build the project with Vite
- Deploy to GitHub Pages
- Make the game available at: `https://<username>.github.io/lateral-quest/`

## Tech Stack

- React 18
- Vite 6
- Web Audio API for sound effects