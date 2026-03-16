export const parseMarkdownToGraph = (text) => {
    const lines = text.split('\n');
    const nodes = [];
    const edges = [];
    // Stack to keep track of the current parent at each level
    // index 0 = H1 parent, index 1 = H2 parent, etc.
    const parentStack = new Array(7).fill(null);
    // Store potential links to resolve after all nodes are created
    const potentialLinks = [];
    let currentNode = null;
    let graphTitle = 'Untitled Graph';
    let firstHeaderFound = false;
    const getLevelInfo = (depth) => {
        switch (depth) {
            case 1: return 'root';
            case 2: return 'core';
            case 3: return 'sub';
            case 4: return 'normal';
            default: return 'leaf';
        }
    };
    lines.forEach((line, _index) => {
        const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
            const depth = headerMatch[1].length;
            const title = headerMatch[2].trim();
            const nodeId = `md-node-${nodes.length + 1}`;
            if (depth === 1 && !firstHeaderFound) {
                graphTitle = title;
                firstHeaderFound = true;
            }
            const level = getLevelInfo(depth);
            currentNode = {
                id: nodeId,
                title,
                content: '',
                level,
                x_position: Math.round((Math.random() - 0.5) * 100),
                y_position: Math.round((Math.random() - 0.5) * 100),
            };
            nodes.push(currentNode);
            // Create edge from parent (if exists)
            // Parent is the last node seen at depth - 1
            const parentId = parentStack[depth - 1];
            if (parentId) {
                edges.push({
                    source: parentId,
                    target: nodeId,
                    relationship: 'contains'
                });
            }
            // Update stack: this node becomes the parent for the next level (depth + 1)
            // Also clear any deeper levels in the stack because we've started a new branch
            parentStack[depth] = nodeId;
            for (let i = depth + 1; i < parentStack.length; i++) {
                parentStack[i] = null;
            }
        }
        else if (currentNode) {
            // Append non-header lines to current node's content
            const trimmedLine = line.trim();
            if (trimmedLine) {
                currentNode.content = currentNode.content
                    ? `${currentNode.content}\n${trimmedLine}`
                    : trimmedLine;
            }
        }
        // Extract Obsidian-style links: [[Target Node Title]]
        if (currentNode) {
            const linkRegex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = linkRegex.exec(line)) !== null) {
                potentialLinks.push({
                    sourceId: currentNode.id,
                    targetTitle: match[1].trim()
                });
            }
        }
    });
    // If no headers found, treat entire text as one root node
    if (nodes.length === 0 && text.trim()) {
        const title = text.split('\n')[0].substring(0, 20) || 'Untitled';
        const nodeId = 'md-node-1';
        nodes.push({
            id: nodeId,
            title,
            content: text,
            level: 'root'
        });
        graphTitle = title;
    }
    // Resolve collected links
    potentialLinks.forEach(link => {
        const targetNode = nodes.find(n => n.title.toLowerCase() === link.targetTitle.toLowerCase());
        if (targetNode && targetNode.id !== link.sourceId) {
            const exists = edges.some(e => (e.source === link.sourceId && e.target === targetNode.id) ||
                (e.source === targetNode.id && e.target === link.sourceId));
            if (!exists) {
                edges.push({
                    source: link.sourceId,
                    target: targetNode.id,
                    relationship: 'relates_to'
                });
            }
        }
    });
    return {
        graph_title: graphTitle,
        nodes,
        edges
    };
};
//# sourceMappingURL=markdownParser.js.map