# TimeLog ⏳

**TimeLog** is a lightweight, fully customizable task and time-tracking application built to adapt entirely to how *you* want to track your day. Instead of forcing you into rigid activity schemas like "Sleep" or "Exercise," TimeLog relies on dynamic custom tasks with highly personalized emojis and colors.

## Features ✨

* **Dynamically Created Tasks**: Personalize your lifestyle tracker. Map specific emojis and custom colors to unique tasks in your life instantly with native emoji palettes and native color pickers.
* **Smart Concurrency Lock**: Tracks your active state down to the millisecond. If you're running a task, the platform locks you out of initiating a new workflow elsewhere until you stop or complete the active cycle.
* **Inline Clock Displays**: The responsive user interface tracks the runtime of your task efficiently inline, so your tracking card breathes and scales seamlessly into any mobile device footprint.
* **Comprehensive Dashboards**: Check 7-day and 30-day activity trends broken down natively through detailed data graphs.
* **Google Authentication**: Frictionless onboarding leveraging Google Identity provider sign-ins.
* **Dark Mode Native**: Features a gorgeous standard dark-mode system and an automated light-mode equivalent mapping safely around browser top-panels via calculated `safe-area-inset` styling.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+)
- A [Google Cloud Console project](https://console.cloud.google.com/) equipped with an OAuth 2.0 Client ID (To enable Google sign-in)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vineetjangiriitb/timelog.git
   cd timelog
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add the following keys:
   ```env
   # Your Google OAuth 2.0 Web Application Client ID
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

   # An arbitrary long string for backend JWT encryption
   JWT_SECRET=your_super_secret_jwt_string_here

   PORT=3000
   ```

4. **Initialize application**
   ```bash
   npm start
   ```
   *The application will automatically deploy the `data/` directory and configure the underlying SQLite database schema upon the first connection.*

5. **Open locally**
   Head to `http://localhost:3000` to start tracking your time.

## 🔐 Security & Privacy Notice (For Open Source)

This project has been safely structured to separate sensitive configurations from the public repository layout:
* `data/sleeplogs.db` - The underlying SQLite engine containing personal data is completely ignored from Source Control via `.gitignore`.
* `.env` - Authentication keys including `GOOGLE_CLIENT_ID` and `JWT_SECRET` are blocked from Source Control via `.gitignore`.

If you are forking or downloading this repository, you **must** supply your own `.env` configuration file to instantiate the authentication layer!

## Deployment

TimeLog is deployment-ready for standard virtualized Linux hosts (e.g., Render, Railway). Just configure the `data` volume context onto a persistent directory within your host to ensure the SQLite schema bypasses ephemeral host reboots!

## License
MIT License. Free to use, fork, and hack into.
