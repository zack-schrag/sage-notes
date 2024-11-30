export function parseRepoUrl(url: string): { owner: string; name: string } | null {
  try {
    // Handle SSH URLs
    if (url.startsWith('git@')) {
      const match = url.match(/git@github\.com:(.+?)\/(.+?)\.git/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    // Handle HTTPS URLs
    const urlObj = new URL(url);
    if (urlObj.hostname === 'github.com') {
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          name: parts[1].replace('.git', '')
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
