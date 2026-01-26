/**
 * Frontend problem type definitions (JSDoc)
 * Used for editor/type-hinting consistency in this JS codebase.
 */

/**
 * @typedef {(
 *  "Math"|
 *  "Array"|
 *  "Divide and Conquer"|
 *  "Searching"|
 *  "Linked List"|
 *  "Greedy"|
 *  "Hashing"|
 *  "Sorting"|
 *  "Unknown"
 * )} ProblemCategoryType
 */

/**
 * @typedef {Object} PublicQuestionListItem
 * @property {string} _id
 * @property {string} title
 * @property {"Easy"|"Medium"|"Hard"} difficulty
 * @property {string[]=} tags
 * @property {ProblemCategoryType=} categoryType
 */

export default {};
