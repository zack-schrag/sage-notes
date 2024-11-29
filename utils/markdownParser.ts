interface Frontmatter {
  tags?: string[];
  [key: string]: any;
}

interface ParsedMarkdown {
  frontmatter: Frontmatter;
  content: string;
}

export function parseMarkdown(markdown: string): ParsedMarkdown {
  const defaultResult = {
    frontmatter: {},
    content: markdown
  };

  // Check if the file starts with frontmatter delimiter
  if (!markdown.startsWith('---\n')) {
    return defaultResult;
  }

  // Find the closing frontmatter delimiter
  const endIndex = markdown.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return defaultResult;
  }

  try {
    const frontmatterStr = markdown.slice(4, endIndex);
    const content = markdown.slice(endIndex + 5);
    const frontmatter: Frontmatter = {};

    // Parse frontmatter lines
    frontmatterStr.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        
        // Handle tags specifically
        if (key.trim() === 'tags') {
          // Tags can be in various formats:
          // tags: tag1, tag2, tag3
          // tags: [tag1, tag2, tag3]
          // tags:
          //   - tag1
          //   - tag2
          let tags: string[] = [];
          
          if (value.startsWith('[') && value.endsWith(']')) {
            // Handle array format: [tag1, tag2]
            tags = value.slice(1, -1).split(',').map(t => t.trim());
          } else if (value.includes(',')) {
            // Handle comma-separated format: tag1, tag2
            tags = value.split(',').map(t => t.trim());
          } else {
            // Handle single tag
            tags = [value];
          }
          
          frontmatter.tags = tags.filter(t => t.length > 0);
        } else {
          frontmatter[key.trim()] = value;
        }
      }
    });

    return { frontmatter, content };
  } catch (error) {
    console.error('Error parsing frontmatter:', error);
    return defaultResult;
  }
}

export function addTagToMarkdown(markdown: string, newTag: string): string {
  const { frontmatter, content } = parseMarkdown(markdown);
  
  // Initialize or update tags array
  const tags = new Set(frontmatter.tags || []);
  tags.add(newTag);
  
  // Create new frontmatter
  const newFrontmatter = {
    ...frontmatter,
    tags: Array.from(tags)
  };
  
  // Convert frontmatter to YAML format
  const frontmatterLines = ['---'];
  Object.entries(newFrontmatter).forEach(([key, value]) => {
    if (key === 'tags') {
      frontmatterLines.push(`tags: [${value.join(', ')}]`);
    } else {
      frontmatterLines.push(`${key}: ${value}`);
    }
  });
  frontmatterLines.push('---\n');
  
  return frontmatterLines.join('\n') + content;
}

export function removeTagFromMarkdown(markdown: string, tagToRemove: string): string {
  const { frontmatter, content } = parseMarkdown(markdown);
  
  if (!frontmatter.tags) {
    return markdown;
  }
  
  // Remove the tag
  const tags = frontmatter.tags.filter(tag => tag !== tagToRemove);
  
  // Create new frontmatter
  const newFrontmatter = {
    ...frontmatter,
    tags
  };
  
  // Convert frontmatter to YAML format
  const frontmatterLines = ['---'];
  Object.entries(newFrontmatter).forEach(([key, value]) => {
    if (key === 'tags') {
      frontmatterLines.push(`tags: [${value.join(', ')}]`);
    } else {
      frontmatterLines.push(`${key}: ${value}`);
    }
  });
  frontmatterLines.push('---\n');
  
  return frontmatterLines.join('\n') + content;
}
