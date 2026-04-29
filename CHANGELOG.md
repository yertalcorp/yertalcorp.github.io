Changelog
All notable changes to the Yertal Arcade platform are documented below, indexed by release date to ensure chronological transparency.

[2026-04-29]
Added
Feedback Moderation Suite: Users can now add, edit, and delete their own feedback transmissions.

Superuser Authority: The yertal-arcade superuser now has global override permissions to delete any feedback entry.

Live Stat Sync: Integrated logic to decrement the Spark card "FEEDBACK" count instantly upon deletion without page refresh.

Changed
HUD Density Optimization: Redesigned the Feedback HUD with a metallic-text title and reduced vertical padding to maximize visible content.

UI Position Locking: Implemented coordinate-capture logic to prevent the HUD from "jumping" or shifting during edit/refresh cycles.

Fixed
Overlay Stacking: Resolved "Ghost HUD" issue where multiple panels rendered on top of each other.

TypeError Guard: Added null-checks to openFeedback to handle cases where the event object is not present during UI refreshes.

[2026-04-28]
Added
Transaction Engine: Implemented support for "Tips" (Free/Personal tiers) and "Sales" (Business/Retail tiers).

View Tracking: Integrated real-time view counters for Spark cards to monitor engagement.

Tier-Based Logic: Established distinct transaction paths for hobbyists vs. commercial storefronts.

[2026-03-15]
Added
Firebase Infrastructure: Connected the 3D Arcade to the Realtime Database for persistent "Sparks."

Authentication Flow: Established user login flows and Superuser session management.

[2026-02-06]
Added
Project Genesis: Initial concept and 3D world construction using Three.js, sparked by a Gemini Pro interaction.

World Physics: Implemented basic 3D navigation and collision boundaries.
