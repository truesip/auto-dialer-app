Full-Stack Auto-Dialer Web Application

This repository contains the complete source code for a web-based auto-dialer application. It features separate interfaces for users and administrators, a Node.js backend, and a MongoDB database. The system is designed for easy deployment to cloud platforms like the DigitalOcean App Platform.
Features
User Features

    User Authentication: Secure user registration and login.

    Campaign Management: Create, start, and pause personal dialing campaigns.

    Balance System: Campaigns deduct a small, predefined cost per call from the user's balance.

    Bulk Upload: Upload contact lists from .csv or .txt files.

    Personalized TTS: Use {name} shortcode in messages for personalized Text-to-Speech calls.

    Auto-Pause on Low Balance: Campaigns are automatically paused if the user's balance is too low to continue.

Admin Features

    Secure Login: Separate, secure login for administrators.

    System Overview: A dashboard with statistics on total users, campaigns, and calls made.

    User Management: View all registered users with pagination.

    Balance Control: Add funds directly to any user's account.

    Security & Spam Protection:

        From Number Blocklist: Globally block specific phone numbers from being used as a "From Number".

        Google Perspective API: Automatically checks campaign messages for spam, toxicity, and threats.

        Custom Word Blocklist: Admins can define custom lists of forbidden words for campaigns.

Repository Structure

The project is organized into two main parts for clear separation of concerns and easy deployment:

    /backend/: Contains the Node.js, Express, and Mongoose server code. This is the core application logic.

    /frontend/: Contains the client-side HTML files for both the Admin and User interfaces.

Deployment to DigitalOcean App Platform

This guide will walk you through deploying the application from GitHub to the DigitalOcean App Platform.
Prerequisites

    A GitHub account with this repository created.

    A DigitalOcean account.

    A Google Perspective API Key for spam protection. You can get one from the Google Cloud Console.

Step 1: Prepare Your Code on GitHub

Before deploying, ensure your code is correctly structured and configured in your GitHub repository.

    Verify Folder Structure: Your repository should have the /backend and /frontend directories at the root.

    Verify package.json: Ensure the backend/package.json file has a start script:

    "scripts": {
      "start": "node server.js"
    }

    Update API_BASE_URL: In both frontend/admin.html and frontend/user.html, make sure the API base URL is set to a relative path. This allows it to work seamlessly with the App Platform's routing.

    const API_BASE_URL = '/api';

Step 2: Create and Configure the App

    In your DigitalOcean dashboard, go to Create > Apps.

    Select GitHub and choose your auto-dialer-app repository.

    The App Platform will inspect your code. Click Next.

    You will now configure the components: a backend service, a frontend site, and a database.

    A. Configure the Backend (Web Service)

        DigitalOcean should auto-detect the backend as a Node.js service. Click the Edit link next to it.

        HTTP Routes: Change the route from / to /api. This is critical for routing API requests correctly.

        Run Command: Ensure it's set to npm start.

        Click Back.

    B. Add the Frontend (Static Site)

        Click Add Component > Static Site.

        Source Directory: Set this to /frontend.

        HTTP Routes: Set the route to /. This makes the frontend the default for your app's main URL.

        Click Add.

    C. Add the Database (MongoDB)

        Click Add Component > Database.

        Choose Add a new Dev Database and select MongoDB.

        The platform will automatically link this to your backend service.

Step 3: Set Environment Variables

This is where you'll add your secret keys.

    Click Edit next to your backend component.

    Scroll down to Environment Variables and click Edit.

    Add the following variables. Click "Encrypt" for each one to keep it secure.

        JWT_SECRET: Enter a long, random, and secret string for signing tokens.

        PERSPECTIVE_API_KEY: Paste your Google Perspective API key here.

        MONGO_URI: This should already be configured and pointing to your new dev database.

    Click Save.

Step 4: Launch the App

    Review your final configuration. It should show:

        A Web Service (backend) with the route /api.

        A Static Site (frontend) with the route /.

        A Database (mongodb).

    Choose a plan for your components (the basic plans are sufficient to start).

    Click Next, then Launch App.

DigitalOcean will now build and deploy your application. Once complete, 
you will be provided with a public URL where you can access your live auto-dialer app. 
The App Platform will automatically redeploy whenever you push changes to your connected GitHub branch.
