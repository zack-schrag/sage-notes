import * as FileSystem from 'expo-file-system';
import { setRepoInfo, getFileMetadata, deleteFile, deleteFileMetadata, commitFile } from './githubSync';
import { parseRepoUrl } from './githubUtils';
import { getRepoUrl } from './tokenStorage';
import { initializeTracking } from './fileTracker';

// Base directory for all our git repositories
export const REPOS_DIR = `${FileSystem.documentDirectory}repos/`;

interface GitHubContent {
    name: string;
    path: string;
    type: 'dir' | 'file';
    download_url: string | null;
    sha: string;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: string;
  download_url: string | null;
}

export async function getRepoInfo(): Promise<{ owner: string; name: string; repoDir: string }> {
  const repoUrl = await getRepoUrl();
  if (!repoUrl) {
    throw new Error('No repository URL found');
  }
  const repoInfo = parseRepoUrl(repoUrl);
  if (!repoInfo) {
    throw new Error('Invalid repository URL');
  }
  return {
    ...repoInfo,
    repoDir: `${REPOS_DIR}${repoInfo.name}`
  };
}

async function fetchDirectoryContents(path: string, token: string, owner: string, repo: string): Promise<GitHubContent[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch directory contents');
    }
    
    return await response.json();
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
    console.log('Download complete for:', localPath);
}

export async function cloneRepository(repoUrl: string, token: string) {
    await removeRepository();
    try {
        const repoInfo = parseRepoUrl(repoUrl);
        if (!repoInfo) {
            throw new Error('Invalid repository URL');
        }

        const { owner, name } = repoInfo;
        setRepoInfo(owner, name);

        await ensureReposDirExists();
        const localRepoDir = `${REPOS_DIR}${name}`;
        console.log('Cloning to directory:', localRepoDir);

        // Check if repository already exists
        const dirInfo = await FileSystem.getInfoAsync(localRepoDir);
        if (dirInfo.exists) {
            console.log('Repository already exists');
            return true;
        }

        // Create the target directory
        await FileSystem.makeDirectoryAsync(localRepoDir, { intermediates: true });

        const trackedFiles: { path: string; sha: string }[] = [];

        // Recursively fetch and download all files
        async function processDirectory(path: string = '', currentDir: string = localRepoDir) {
            const contents = await fetchDirectoryContents(path, token, owner, name);
            
            for (const item of contents) {
                const localItemPath = `${currentDir}/${item.name}`;
                
                if (item.type === 'dir') {
                    await FileSystem.makeDirectoryAsync(localItemPath, { intermediates: true });
                    await processDirectory(item.path, localItemPath);
                } else if (item.type === 'file' && item.download_url) {
                    await downloadFile(item.download_url, localItemPath, token);
                    
                    // Track markdown files for syncing
                    if (item.name.endsWith('.md')) {
                        trackedFiles.push({
                            path: item.path,
                            sha: item.sha
                        });
                    }
                }
            }
        }

        await processDirectory();
        console.log('Repository contents downloaded successfully');

        // Initialize file tracking with the collected files
        initializeTracking(trackedFiles, true);

        return true;
    } catch (error) {
        console.error('Error in cloneRepository:', error);
        return false;
    }
}

export async function ensureReposDirExists() {
    const dirInfo = await FileSystem.getInfoAsync(REPOS_DIR);
    if (!dirInfo.exists) {
        console.log('Creating repos directory...');
        await FileSystem.makeDirectoryAsync(REPOS_DIR, { intermediates: true });
    }
}

export async function listMarkdownFiles() {
    try {
        const { repoDir } = await getRepoInfo();
        // console.log('Checking repository directory:', repoDir);
        const dirInfo = await FileSystem.getInfoAsync(repoDir);
        // console.log('Directory info:', dirInfo);
        
        if (!dirInfo.exists) {
            console.log('Repository directory does not exist');
            return [];
        }

        // List all files recursively
        const getFilesInDir = async (dir: string): Promise<string[]> => {
            // console.log('Scanning directory:', dir);
            const files = await FileSystem.readDirectoryAsync(dir);
            // console.log('Files in directory:', files);
            let results: string[] = [];
            
            for (const file of files) {
                const fullPath = `${dir}/${file}`;
                const info = await FileSystem.getInfoAsync(fullPath);
                // console.log('File info for', file, ':', info);
                
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
        // console.log('Found markdown files:', files);
        return files;
    } catch (error) {
        console.error('Error listing markdown files:', error);
        return [];
    }
}

export async function readMarkdownFile(filename: string) {
    try {
        const { repoDir } = await getRepoInfo();
        const fullPath = `${repoDir}/${filename}`;
        const content = await FileSystem.readAsStringAsync(fullPath);
        return content;
    } catch (error) {
        console.error('Error reading markdown file:', error);
        throw error;
    }
}

export async function removeRepository() {
    try {
        const { repoDir } = await getRepoInfo();
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

export async function getDirectoryStructure(dir?: string): Promise<FileTreeItem[]> {
  try {
    const { repoDir } = await getRepoInfo();
    const baseDir = dir || repoDir;
    const dirInfo = await FileSystem.getInfoAsync(baseDir);
    if (!dirInfo.exists) {
      return [];
    }

    const contents = await FileSystem.readDirectoryAsync(baseDir);
    const items: FileTreeItem[] = [];

    for (const name of contents) {
      const path = `${baseDir}/${name}`;
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
            // Always include directories and get their children
            item.children = await getDirectoryStructure(path);
            items.push(item);
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

export async function ensureNotesDirectoryExists() {
    const { repoDir } = await getRepoInfo();
    const notesDir = `${repoDir}/notes`;
    const dirInfo = await FileSystem.getInfoAsync(notesDir);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(notesDir, { intermediates: true });
    }
}

export async function ensureRepoExists() {
    const { repoDir } = await getRepoInfo();
    const dirInfo = await FileSystem.getInfoAsync(repoDir);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(repoDir, { intermediates: true });
    }
    return repoDir;
}

export async function createNewNote(): Promise<{ filePath: string; filename: string }> {
    const { repoDir } = await getRepoInfo();
    
    // Find an available filename
    let counter = 0;
    let filename = 'untitled.md';
    let filePath = `${repoDir}/${filename}`;
    
    // Keep incrementing counter until we find an unused filename
    while (true) {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (!fileInfo.exists) {
            break;
        }
        counter++;
        filename = counter === 0 ? 'untitled.md' : `untitled_${counter}.md`;
        filePath = `${repoDir}/${filename}`;
    }
    
    const initialContent = '# New Note\n\nStart writing here...\n';
    await FileSystem.writeAsStringAsync(filePath, initialContent);
    
    // Sync the new file to GitHub
    try {
        await commitFile({
            path: filePath,
            content: initialContent,
            message: `Create new note: ${filename}`
        });
    } catch (error) {
        console.error('Failed to sync new note to GitHub:', error);
        // Note is still created locally even if GitHub sync fails
    }
    
    return { filePath, filename };
}

export async function deleteLocalFile(path: string, sha?: string): Promise<boolean> {
    try {
        // Delete locally
        await FileSystem.deleteAsync(path, { idempotent: true });
        console.log('Successfully deleted file locally:', path);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
}

export async function deleteItems(paths: string[]): Promise<boolean> {
  try {
    for (const path of paths) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          console.log('Deleting file:', path);
          // Get the file's metadata before deleting
          const metadata = await getFileMetadata(path);
          
          // Delete from GitHub first if we have the SHA
          // if (metadata?.sha) {
          //   console.log('Deleting from GitHub first:', path);
          //   await deleteFile(path, metadata.sha);
          //   await deleteFileMetadata(path);
          // }
          
          // Then delete locally
          await deleteLocalFile(path);
          console.log('Successfully deleted:', path);
        } else {
          console.log('File does not exist:', path);
        }
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error);
        // Continue with other files even if one fails
        continue;
      }
    }
    return true;
  } catch (error) {
    console.error('Error in deleteItems:', error);
    return false;
  }
}

export async function createFolder(folderName: string, parentPath?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { repoDir } = await getRepoInfo();
        const fullPath = parentPath 
            ? `${repoDir}/${parentPath}/${folderName}`
            : `${repoDir}/${folderName}`;

        // Check if folder already exists
        const folderInfo = await FileSystem.getInfoAsync(fullPath);
        if (folderInfo.exists) {
            return { 
                success: false, 
                error: 'A folder with this name already exists' 
            };
        }

        // Create the folder
        await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
        console.log('Created folder:', fullPath);

        return { success: true };
    } catch (error) {
        console.error('Error creating folder:', error);
        return { 
            success: false, 
            error: 'Failed to create folder' 
        };
    }
}
