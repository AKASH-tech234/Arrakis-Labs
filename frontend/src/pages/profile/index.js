/**
 * Profile Page Exports
 *
 * This module exports the Profile page components and related utilities.
 */

// Main Profile page (refactored version)
export { default as Profile } from "./profile";
export { default } from "./profile";

// Legacy version (for reference/rollback)
export { default as ProfileLegacy } from "./profile.legacy";

// Coding Profile modal
export { default as CodingProfile } from "./codingProfile";

// Section components (for direct import if needed)
export * from "./sections";
