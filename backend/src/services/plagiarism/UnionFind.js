/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * UNION-FIND (DISJOINT SET) SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Implements Union-Find data structure for clustering cheating groups.
 * When users A and B are found to have plagiarized, and B and C are found
 * to have plagiarized, all three form a cheating group.
 * 
 * Uses path compression and union by rank for optimal performance.
 */

class UnionFind {
  constructor() {
    // Parent pointers: maps element to its parent
    this.parent = new Map();
    // Rank (approximate height) for union by rank
    this.rank = new Map();
    // Size of each set
    this.size = new Map();
    // Store edges (connections) between elements
    this.edges = new Map();
  }

  /**
   * Initialize or ensure an element exists in the structure
   */
  makeSet(element) {
    const key = element.toString();
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
      this.rank.set(key, 0);
      this.size.set(key, 1);
      this.edges.set(key, []);
    }
  }

  /**
   * Find the root/representative of the set containing element
   * Uses path compression for efficiency
   */
  find(element) {
    const key = element.toString();
    this.makeSet(key);

    // Path compression: make every node point directly to root
    if (this.parent.get(key) !== key) {
      this.parent.set(key, this.find(this.parent.get(key)));
    }
    return this.parent.get(key);
  }

  /**
   * Union two sets containing elements x and y
   * Uses union by rank for balanced trees
   * @param {*} x - First element
   * @param {*} y - Second element
   * @param {Object} edgeData - Additional data about the connection (similarity, etc.)
   */
  union(x, y, edgeData = {}) {
    const rootX = this.find(x);
    const rootY = this.find(y);

    // Already in same set
    if (rootX === rootY) {
      // Still record the edge for connection tracking
      this.addEdge(x, y, edgeData);
      return false;
    }

    // Union by rank
    const rankX = this.rank.get(rootX);
    const rankY = this.rank.get(rootY);

    let newRoot;
    let otherRoot;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      newRoot = rootY;
      otherRoot = rootX;
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      newRoot = rootX;
      otherRoot = rootY;
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
      newRoot = rootX;
      otherRoot = rootY;
    }

    // Update size
    const newSize = this.size.get(rootX) + this.size.get(rootY);
    this.size.set(newRoot, newSize);

    // Record the edge
    this.addEdge(x, y, edgeData);

    return true;
  }

  /**
   * Add an edge between two elements
   */
  addEdge(x, y, edgeData) {
    const keyX = x.toString();
    const keyY = y.toString();

    this.makeSet(keyX);
    this.makeSet(keyY);

    const edge = { from: keyX, to: keyY, ...edgeData };
    this.edges.get(keyX).push(edge);
    this.edges.get(keyY).push({ from: keyY, to: keyX, ...edgeData });
  }

  /**
   * Check if two elements are in the same set
   */
  connected(x, y) {
    return this.find(x) === this.find(y);
  }

  /**
   * Get the size of the set containing element
   */
  getSetSize(element) {
    const root = this.find(element);
    return this.size.get(root);
  }

  /**
   * Get all elements in the same set as the given element
   */
  getSet(element) {
    const root = this.find(element);
    const members = [];

    for (const [key] of this.parent) {
      if (this.find(key) === root) {
        members.push(key);
      }
    }

    return members;
  }

  /**
   * Get all distinct sets (groups)
   */
  getAllSets() {
    const sets = new Map();

    for (const [key] of this.parent) {
      const root = this.find(key);
      if (!sets.has(root)) {
        sets.set(root, []);
      }
      sets.get(root).push(key);
    }

    return Array.from(sets.values());
  }

  /**
   * Get all sets with more than one member (actual groups)
   */
  getGroups(minSize = 2) {
    return this.getAllSets().filter((set) => set.length >= minSize);
  }

  /**
   * Get edges (connections) for elements in a set
   */
  getEdgesInSet(element) {
    const members = new Set(this.getSet(element));
    const edges = [];
    const seen = new Set();

    for (const member of members) {
      for (const edge of this.edges.get(member) || []) {
        if (members.has(edge.to)) {
          const edgeKey = [edge.from, edge.to].sort().join("-");
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            edges.push(edge);
          }
        }
      }
    }

    return edges;
  }

  /**
   * Get connection count for an element
   */
  getConnectionCount(element) {
    const key = element.toString();
    return (this.edges.get(key) || []).length;
  }

  /**
   * Calculate average similarity for an element
   */
  getAverageSimilarity(element) {
    const key = element.toString();
    const elementEdges = this.edges.get(key) || [];
    
    if (elementEdges.length === 0) return 0;

    const totalSim = elementEdges.reduce((sum, edge) => {
      return sum + (edge.similarity || 0);
    }, 0);

    return totalSim / elementEdges.length;
  }

  /**
   * Get detailed group info with connection data
   */
  getGroupDetails() {
    const groups = this.getGroups();
    
    return groups.map((members) => {
      const edges = this.getEdgesInSet(members[0]);
      
      // Calculate group stats
      const avgSimilarity = edges.length > 0
        ? edges.reduce((sum, e) => sum + (e.similarity || 0), 0) / edges.length
        : 0;

      const memberDetails = members.map((member) => ({
        id: member,
        connectionCount: this.getConnectionCount(member),
        avgSimilarity: this.getAverageSimilarity(member),
      }));

      return {
        members: memberDetails,
        edges,
        size: members.length,
        totalConnections: edges.length,
        avgSimilarity,
      };
    });
  }

  /**
   * Clear all data
   */
  clear() {
    this.parent.clear();
    this.rank.clear();
    this.size.clear();
    this.edges.clear();
  }

  /**
   * Export state for persistence
   */
  exportState() {
    return {
      parent: Object.fromEntries(this.parent),
      rank: Object.fromEntries(this.rank),
      size: Object.fromEntries(this.size),
      edges: Object.fromEntries(
        Array.from(this.edges).map(([k, v]) => [k, v])
      ),
    };
  }

  /**
   * Import state
   */
  importState(state) {
    this.parent = new Map(Object.entries(state.parent));
    this.rank = new Map(Object.entries(state.rank));
    this.size = new Map(Object.entries(state.size));
    this.edges = new Map(Object.entries(state.edges));
    return this;
  }
}

export default UnionFind;
