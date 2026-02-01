/**
 * Profile Page
 *
 * This file now exports the refactored Profile component with:
 * - Section-based architecture
 * - Lazy loading for performance
 * - Error boundaries for stability
 * - URL-based navigation state
 *
 * The original monolithic implementation is preserved in profile.legacy.jsx
 *
 * To switch back to the legacy version, uncomment the legacy export below:
 * export { default } from './profile.legacy';
 */

// Export the refactored Profile component
export { default } from "./ProfileRefactored";

// Uncomment to use the legacy monolithic version:
// export { default } from './profile.legacy';
