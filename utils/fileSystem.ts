import * as FileSystem from 'expo-file-system';

// Base directory for all our git repositories
export const REPOS_DIR = `${FileSystem.documentDirectory}repos/`;

// Repository details
const REPO_OWNER = 'zack-schrag';
const REPO_NAME = 'notes';

interface GitHubContent {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeItem[];
}

export async function ensureReposDirExists() {
    const dirInfo = await FileSystem.getInfoAsync(REPOS_DIR);
    if (!dirInfo.exists) {
        console.log('Creating repos directory...');
        await FileSystem.makeDirectoryAsync(REPOS_DIR, { intermediates: true });
    }
}

async function fetchDirectoryContents(path: string = '', token: string): Promise<GitHubContent[]> {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
    console.log('Fetching contents from:', url);
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function downloadFile(downloadUrl: string, localPath: string, token: string) {
    console.log('Downloading file to:', localPath);
    const response = await FileSystem.downloadAsync(
        downloadUrl,
        localPath,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );
    console.log('Download complete:', response);
}

export async function cloneRepository(token: string) {
    try {
        await ensureReposDirExists();
        const localRepoDir = `${REPOS_DIR}${REPO_NAME}`;
        console.log('Cloning to directory:', localRepoDir);

        // Check if repository already exists
        const dirInfo = await FileSystem.getInfoAsync(localRepoDir);
        if (dirInfo.exists) {
            console.log('Repository already exists');
            return true;
        }

        // Create the target directory
        await FileSystem.makeDirectoryAsync(localRepoDir, { intermediates: true });

        // Recursively fetch and download all files
        async function processDirectory(path: string = '', currentDir: string = localRepoDir) {
            const contents = await fetchDirectoryContents(path, token);
            
            for (const item of contents) {
                const localItemPath = `${currentDir}/${item.name}`;
                
                if (item.type === 'dir') {
                    await FileSystem.makeDirectoryAsync(localItemPath, { intermediates: true });
                    await processDirectory(item.path, localItemPath);
                } else if (item.type === 'file' && item.download_url) {
                    await downloadFile(item.download_url, localItemPath, token);
                }
            }
        }

        await processDirectory();
        console.log('Repository contents downloaded successfully');
        return true;
    } catch (error) {
        console.error('Error in cloneRepository:', error);
        return false;
    }
}

export async function listMarkdownFiles() {
    try {
        const repoDir = `${REPOS_DIR}${REPO_NAME}`;
        console.log('Checking repository directory:', repoDir);
        const dirInfo = await FileSystem.getInfoAsync(repoDir);
        console.log('Directory info:', dirInfo);
        
        if (!dirInfo.exists) {
            console.log('Repository directory does not exist');
            return [];
        }

        // List all files recursively
        const getFilesInDir = async (dir: string): Promise<string[]> => {
            console.log('Scanning directory:', dir);
            const files = await FileSystem.readDirectoryAsync(dir);
            console.log('Files in directory:', files);
            let results: string[] = [];
            
            for (const file of files) {
                const fullPath = `${dir}/${file}`;
                const info = await FileSystem.getInfoAsync(fullPath);
                console.log('File info for', file, ':', info);
                
                if (info.isDirectory) {
                    results = results.concat(await getFilesInDir(fullPath));
                } else if (file.endsWith('.md')) {
                    // Return path relative to repo directory
                    results.push(fullPath.replace(repoDir + '/', ''));
                }
            }
            
            return results;
        };

        const files = await getFilesInDir(repoDir);
        console.log('Found markdown files:', files);
        return files;
    } catch (error) {
        console.error('Error listing markdown files:', error);
        return [];
    }
}

export async function readMarkdownFile(filename: string) {
    try {
        const fullPath = `${REPOS_DIR}${REPO_NAME}/${filename}`;
        const content = await FileSystem.readAsStringAsync(fullPath);
        return content;
    } catch (error) {
        console.error('Error reading markdown file:', error);
        return null;
    }
}

export async function removeRepository() {
    try {
        const repoDir = `${REPOS_DIR}${REPO_NAME}`;
        console.log('Attempting to remove repository at:', repoDir);
        const dirInfo = await FileSystem.getInfoAsync(repoDir);
        
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(repoDir, { idempotent: true });
            console.log('Repository removed successfully');
            return true;
        } else {
            console.log('Repository directory does not exist, nothing to remove');
            return true;
        }
    } catch (error) {
        console.error('Error removing repository:', error);
        return false;
    }
}

export async function getDirectoryStructure(dir: string = `${REPOS_DIR}${REPO_NAME}`): Promise<FileTreeItem[]> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      return [];
    }

    const contents = await FileSystem.readDirectoryAsync(dir);
    const items: FileTreeItem[] = [];

    for (const name of contents) {
      const path = `${dir}/${name}`;
      const info = await FileSystem.getInfoAsync(path);
      
      if (info.exists) {
        // Only process if it's a directory or a markdown file
        if (info.isDirectory || name.toLowerCase().endsWith('.md')) {
          const item: FileTreeItem = {
            name,
            path,
            type: info.isDirectory ? 'dir' : 'file',
          };

          if (info.isDirectory) {
            // Recursively get children
            const children = await getDirectoryStructure(path);
            // Only include directory if it has markdown files in its tree
            if (children.length > 0) {
              item.children = children;
              items.push(item);
            }
          } else {
            // It's a markdown file, include it
            items.push(item);
          }
        }
      }
    }

    // Sort directories first, then files, both alphabetically
    return items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'dir' ? -1 : 1;
    });
  } catch (error) {
    console.error('Error getting directory structure:', error);
    return [];
  }
}

export async function saveFile(path: string, content: string): Promise<boolean> {
  try {
    await FileSystem.writeAsStringAsync(path, content);
    console.log('File saved successfully:', path);
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
}
