/**
 * TodoCategory - Abstraction layer for category/subcategory handling
 *
 * This class provides a future-proof way to handle categories of arbitrary depth
 * while currently using the {category, subcategory} storage format.
 *
 * When ready to support deeper nesting (2-level local / 3-level global),
 * simply update CATEGORY_DEPTH constants and switch to toStorageV2().
 */

export class TodoCategory {
  /**
   * @param {string[]} parts - Array of category parts, e.g., ["backend", "api"]
   * @param {string} task - The task description
   */
  constructor(parts, task) {
    this.parts = parts.filter(p => p && p.trim().length > 0);
    this.task = task;
  }

  /**
   * Get the depth (number of category levels)
   */
  get depth() {
    return this.parts.length;
  }

  /**
   * Parse a task string with category prefix
   * Format: "cat/subcat::task" or "cat::task" or "task"
   *
   * @param {string} taskString - Full task string with optional category prefix
   * @param {number} maxDepth - Maximum allowed depth (default: 3)
   * @returns {TodoCategory}
   * @throws {Error} If category depth exceeds maxDepth
   */
  static fromString(taskString, maxDepth = 3) {
    // Split on :: to separate category from task
    const categoryMatch = taskString.match(/^([^:]+)::(.+)$/);

    if (!categoryMatch) {
      // No category prefix, just a task
      return new TodoCategory([], taskString.trim());
    }

    const categoryPart = categoryMatch[1].trim();
    const task = categoryMatch[2].trim();

    // Split category on / to get individual parts
    const parts = categoryPart.split('/').map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length > maxDepth) {
      const formatExample = maxDepth === 1 ? 'category::task'
        : maxDepth === 2 ? 'category/subcategory::task'
        : 'category/subcategory/subarea::task';
      throw new Error(
        `Category depth ${parts.length} exceeds maximum ${maxDepth}. ` +
        `Format: ${formatExample}`
      );
    }

    return new TodoCategory(parts, task);
  }

  /**
   * Create TodoCategory from storage format (v1)
   *
   * @param {Object} stored - Storage object with category, subcategory, task fields
   * @returns {TodoCategory}
   */
  static fromStorage(stored) {
    // Future: Check for v2 format first (categories array)
    // if (stored.categories && Array.isArray(stored.categories)) {
    //   return new TodoCategory(stored.categories, stored.task);
    // }

    // Use v1 format (category, subcategory)
    const parts = [];
    if (stored.category) parts.push(stored.category);
    if (stored.subcategory) parts.push(stored.subcategory);

    return new TodoCategory(parts, stored.task);
  }

  /**
   * Convert to storage format v1 (current)
   * Uses category + subcategory fields
   *
   * @param {number} maxDepth - Maximum depth to store (unused but kept for future)
   * @returns {Object} Storage object with category, subcategory
   */
  toStorageV1(maxDepth) {
    return {
      category: this.parts[0] || null,
      subcategory: this.parts[1] || null,
      task: this.task
    };
  }

  /**
   * Convert to storage format v2 (future)
   * Uses categories array alongside v1 fields for backward compatibility
   *
   * @returns {Object} Storage object with categories array and v1 fields
   */
  toStorageV2() {
    return {
      categories: this.parts.length > 0 ? this.parts : null,
      // Include v1 fields for backward compatibility
      category: this.parts[0] || null,
      subcategory: this.parts[1] || null,
      task: this.task
    };
  }

  /**
   * Convert to display string format
   * Examples: "backend", "backend/api", "computer_use/backend/api"
   *
   * @returns {string}
   */
  toString() {
    return this.parts.length > 0 ? this.parts.join('/') : null;
  }

  /**
   * Get the grouping key for display grouping
   * Uses :: as separator to distinguish from display format
   * Examples: "backend", "backend::api", "computer_use::backend::api"
   *
   * @returns {string}
   */
  toGroupKey() {
    return this.parts.length > 0 ? this.parts.join('::') : '__untagged__';
  }

  /**
   * Get the display label (same as toString but returns null for empty)
   *
   * @returns {string|null}
   */
  toDisplayLabel() {
    return this.toString();
  }

  /**
   * Check if this category is untagged (no categories)
   *
   * @returns {boolean}
   */
  isUntagged() {
    return this.parts.length === 0;
  }

  /**
   * Transform this category for syncing to global scope
   * Prepends the project name as the first category level
   *
   * Example: TodoCategory(["backend"]) + "computer_use"
   *          -> TodoCategory(["computer_use", "backend"])
   *
   * @param {string} projectName - Project name to prepend
   * @returns {TodoCategory} New TodoCategory with project prefix
   */
  toGlobalCategory(projectName) {
    return new TodoCategory([projectName, ...this.parts], this.task);
  }

  /**
   * Get the category at a specific depth (0-indexed)
   *
   * @param {number} index - Index of category level
   * @returns {string|null}
   */
  getCategoryAt(index) {
    return this.parts[index] || null;
  }

  /**
   * Check if this category matches a given category string
   *
   * @param {string} categoryString - Category to match (e.g., "backend")
   * @returns {boolean}
   */
  matches(categoryString) {
    if (!categoryString) return this.isUntagged();
    return this.parts[0] === categoryString;
  }

  /**
   * Check if this category matches a category and subcategory
   *
   * @param {string} category - First level category
   * @param {string|null} subcategory - Second level category
   * @returns {boolean}
   */
  matchesFull(category, subcategory) {
    if (!category) return this.isUntagged();

    const categoryMatches = this.parts[0] === category;
    if (!subcategory) return categoryMatches;

    return categoryMatches && this.parts[1] === subcategory;
  }
}
