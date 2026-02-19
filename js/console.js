window.resetTestData = async (targetUid) => {
    const uid = targetUid || user.uid; // Use provided UID or current logged-in user
    if (!uid) return console.error("No UID detected.");

    console.log(`[SYSTEM]: INITIATING RESET FOR UID: ${uid}...`);

    const updates = {};
    
    // 1. Remove Infrastructure (Currents & Sparks)
    updates[`users/${uid}/infrastructure`] = null;

    // 2. Clear Profile Signifiers (Keeping the Slug & Plan)
    updates[`users/${uid}/profile/arcade_title`] = null;
    updates[`users/${uid}/profile/arcade_subtitle`] = null;
    updates[`users/${uid}/profile/arcade_logo`] = null;

    try {
        // Assuming saveToRealtimeDB is your global helper function
        // If you use 'update', it only touches these specific keys
        await firebase.database().ref().update(updates);
        
        console.log("[SYSTEM]: RESET COMPLETE. REFRESHING UI...");
        
        // 3. Trigger Refresh to show the Welcome HUD logic
        if (window.refreshUI) await window.refreshUI();
        
    } catch (error) {
        console.error("[SYSTEM]: RESET FAILED:", error);
    }
};
