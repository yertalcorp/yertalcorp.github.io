All notable changes to the Yertal Arcade platform are documented below. This project follows a date-based release schedule.
[2026-05-03] - API Routing & Failover Overhaul
Objective: Transition to a manifest-driven, multi-provider failover system with live health tracking.

Added:

modelStats global state object for tracking failure counts per provider and model.

getBestModels function to dynamically select the healthiest available LLM.

handleModelError to increment failure counts and trigger failover routing.

Visual status bar logic within callProviderAPI (Progress %, 2s error display).

Updated:

callProviderAPI: Integrated multi-model retry logic (top 3 candidates).

initiateSystemCooldown: Updated to 60s and modified to reset the new nested modelStats object structure.

retrieveProvider: Now acts as a combined hydration engine for credentials and model stats.

Fixed:

Redundant database calls: The system now checks databaseCache.app_manifest before hitting Firebase.

Silent Failures: Implemented console logging ([FORGE], [FORGE SUCCESS], [FORGE FAIL]) for real-time debugging.
[2026-04-29] - Engagement & Moderation
Added
Feedback HUD: Launched a real-time communication layer allowing users to add, edit, and delete feedback on Spark cards.

Superuser Authority: Implemented global moderation rights for yertal-arcade to manage community transmissions.

Live Stat Sync: Real-time increments/decrements for Likes, Views, and Feedback counts without page refreshes.

Persistence Logic: Redesigned the HUD to capture and lock exact screen coordinates (left/top) during edit/delete cycles to prevent UI "jumping."

Fixed
Overlay Stacking: Resolved "Ghosting" issues where multiple overlays would stack in the DOM; implemented a pre-render cleanup phase.

UI Density: Compacted the HUD layout with metallic-text styling and reduced row gaps to maximize visible text.

TypeError Guard: Fixed a crash in openFeedback by adding null-checks for the event object during UI refreshes.

[2026-04-22] - Commerce, Discovery & Mass Retrieval
Added
Transaction Engine: Implemented tier-based commerce logic. Support for "Tips" (Free/Personal tiers) and "Sales/Pay" (Business/Retail tiers).

Arcade Search: Added global search functionality using "Arcade Slugs" to visit specific user showrooms.

Mass Spark Retrieval: Logic to fetch multiple Spark cards simultaneously (e.g., "Top 10 Movies") based on Plan Tier limits.

Spark Icon Actions: Integrated a row of functional icons for Like, Save (with a prompt for new users to create their own arcade), Share, and Delete.

[2026-04-15] - Navigation & Support Systems
Added
Navigation Drawer: Implemented the "Three-Dot" menu featuring Arcade Settings and a Help Center.

Help & Tutorials: Launched a 6-step Interactive Tutorial and a "Chat Bot" navigator helping users with Yertal platform topics.

Quick-Access HUDs: Top-bar shortcuts for Adding Currents (+) and accessing Help (?).

Search Integration: Added a search bar for finding specific creator identities (Slugs).

[2026-04-08] - The "Laboratory" Spark Experience
Added
Laboratory View (TV Mode): A dedicated interface for Spark content with Zen Mode (Maximized), Navigation arrows, and a Reload function.

Spark Customization: Added "Edit Spark" mode to change Spark names and select custom cover images from a grid.

Smart Content Injection: Logic handler to ensure LLM-returned code/content fits perfectly in both TV and Zen modes by checking for appropriate tags.

[2026-04-01] - Intelligence & Rules Engine
Added
30 Predefined Capabilities: Expanded the Arcade with specialized nodes like Optics, Physics, and Cellular Biomes.

Regex Classifier: Implemented a pattern-matching layer to automatically classify prompts and apply capability-specific rules.

LLM Model Pool: Added an app_manifest to the DB to manage Gemini API models and automatic fallback routines.

Prompt Architect: Added functionality to view and structure prompts before sending to the LLM to ensure intent accuracy.

[2026-03-25] - Capacity, Tiers & Initialization
Added
Visual Capacity Meter: A dashboard showing Spark/Current limits. Input boxes automatically disappear when plan capacity is reached.

Onboarding Flow: Created the "Welcome to the Arcade" HUD with "Create Your Arcade" and "View Tutorial" entry points.

Privacy Cascade: Implemented cascading privacy where a private "Current" forces all child "Sparks" to be private.

[2026-03-11] - The "Currents" Framework
Added
Infrastructure Node: Divided the user DB into profile (metadata) and infrastructure (operational data) for scaling.

Spark Generation Engine: Integrated the Gemini API to generate live 3D code/content from prompts via an "Exec" button.

Interactive Card UI: Developed .spark-card and .action-card classes with integrated statistics (Likes, Saves, Shares, Tips).

[2026-02-25] - Arcade Infrastructure & Auth
Added
Tri-Provider Auth: Integrated API keys for Google, Yahoo, and GitHub via Firebase for seamless user authentication.

Database Cache: Implemented databaseCache in arcade.js to handle real-time data flow without lag.

Theme Engine: Created the neon-dark "Laboratory" theme with infrastructure to switch themes instantly.

System Status Bar: Added a status zone to track model connections and request progress.

[2026-02-11] - Showroom & Brand Identity
Added
Showroom HUD: Top navigation bar with branding, menu zone, and Auth Status (Sign Into Arcade).

Ethereal UI Components: Developed the "Enter Yertal Arcade" hover buttons and the Showroom Hero section.

Dynamic Styling: Connected the UI to a JSON configuration (ui-settings) for remote control of colors, fonts, and sizes.

Showroom Displays: Built initial displays for Space Dodger 3D, a Health App, and Prompt Engineering tutorials.

Action Cards: Created cards linking directly to WordPress educational nodes (C, Python, AI Tools).

[2026-01-28] - The First "Spark"
Added
Space Dodger 3D: Developed the first browser-based 3D game using Gemini Pro; features high scores, audio, and physics.

Repository Architecture: Established the core directory structure (/arcade, /js, /css, /config).

[2026-01-25] - Genesis
Added
Project Kickoff: Created GitHub Repository and Firebase Project yertal-arcade.

Database Schema: Initialized JSON DB structure with nodes for auth_ui, settings, and users.

Initial Landing: Deployment of the first index.html showroom shell.
