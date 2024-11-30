import { getToken, getRepoUrl } from './tokenStorage';
import { parseRepoUrl } from './githubUtils';

interface GitHubFileInfo {
  name: string;
  path: string;
  sha: string;
  size: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function getFileMetadata(filePath: string): Promise<GitHubFileInfo | null> {
  try {
    const token = await getToken();
    const repoUrl = await getRepoUrl();
    
    if (!token || !repoUrl) {
      console.error('Missing token or repo URL');
      return null;
    }

    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) {
      console.error('Invalid repo URL');
      return null;
    }

    // Get commits for the file to find creation date
    const commitsUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/commits?path=${filePath}&page=1&per_page=1`;
    const commitsResponse = await fetch(commitsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!commitsResponse.ok) {
      throw new Error(`GitHub API error: ${commitsResponse.status}`);
    }

    const commits = await commitsResponse.json();
    const firstCommit = commits[0];

    // Get current file info
    const fileUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/contents/${filePath}`;
    const fileResponse = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!fileResponse.ok) {
      throw new Error(`GitHub API error: ${fileResponse.status}`);
    }

    const fileData = await fileResponse.json();

    return {
      name: fileData.name,
      path: fileData.path,
      sha: fileData.sha,
      size: fileData.size,
      created_at: firstCommit.commit.author.date,
      updated_at: firstCommit.commit.committer.date,
      html_url: fileData.html_url
    };
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    return null;
  }
}

export function formatDate(dateString: string): string {
  console.log(dateString);
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export { getToken };
