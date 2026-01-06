# Deployment Guide

This guide explains how to deploy the work-check-in application to Firebase Hosting.

## Prerequisites

1. **Firebase Account**: Ensure you have a Firebase account and access to the project `chamcong-90388`
2. **Node.js**: Make sure Node.js and npm are installed
3. **Firebase CLI**: The Firebase CLI is included as a dev dependency, but you can also install it globally:
   ```bash
   npm install -g firebase-tools
   ```

## Initial Setup (First Time Only)

### 1. Login to Firebase

If you haven't logged in to Firebase CLI yet:

```bash
npx firebase login
```

This will open a browser window for you to authenticate with your Google account.

### 2. Verify Project Configuration

The project is already configured to use `chamcong-90388`. You can verify this in `.firebaserc`:

```json
{
  "projects": {
    "default": "chamcong-90388"
  }
}
```

If you need to switch projects:

```bash
npx firebase use chamcong-90388
```

## Deployment Steps

### Quick Deploy

The easiest way to deploy is using the npm script:

```bash
npm run deploy
```

This command will:
1. Build the production bundle (`npm run build`)
2. Deploy to Firebase Hosting

### Deploy Only Hosting

If you only want to deploy hosting (useful if you have other Firebase services):

```bash
npm run deploy:hosting
```

### Manual Deployment

If you prefer to run the steps manually:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Firebase**:
   ```bash
   npx firebase deploy --only hosting
   ```

## Build Configuration

- **Build Output**: The built files are in the `dist/` directory
- **Build Command**: `vite build`
- **Public Directory**: Configured in `firebase.json` to serve from `dist/`

## Firebase Hosting Configuration

The hosting configuration is in `firebase.json`:

- **Public Directory**: `dist`
- **SPA Routing**: All routes are rewritten to `/index.html` for client-side routing
- **Caching**: Static assets (JS, CSS, images) are cached for 1 year

## Environment Variables

If your application uses environment variables:

1. Create a `.env.production` file for production environment variables
2. Ensure sensitive variables are not committed to git (they're in `.gitignore`)
3. For Firebase Hosting, you may need to use Firebase Functions or configure environment variables in the Firebase Console

## Troubleshooting

### Build Fails

- Check that all dependencies are installed: `npm install`
- Verify there are no TypeScript or linting errors: `npm run lint`
- Check the build output for specific error messages

### Deployment Fails

- Verify you're logged in: `npx firebase login`
- Check your project ID is correct: `npx firebase projects:list`
- Ensure you have the correct permissions for the Firebase project
- Check Firebase Console for any quota or billing issues

### Routes Not Working

- Ensure the rewrite rule in `firebase.json` is correct (all routes → `/index.html`)
- Verify your React Router configuration is set up correctly
- Check browser console for any routing errors

## CI/CD Integration

### GitHub Actions Example

You can automate deployments using GitHub Actions. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: chamcong-90388
```

**Note**: You'll need to set up a Firebase service account and add it as a GitHub secret.

## Post-Deployment

After deployment, your app will be available at:
- **Production URL**: `https://chamcong-90388.web.app` or `https://chamcong-90388.firebaseapp.com`
- **Custom Domain**: If configured, your custom domain URL

You can view deployment history and manage your site in the [Firebase Console](https://console.firebase.google.com/project/chamcong-90388/hosting).

## Rollback

If you need to rollback to a previous deployment:

1. Go to Firebase Console → Hosting
2. Find the previous deployment in the history
3. Click "Rollback" to restore that version

## Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

