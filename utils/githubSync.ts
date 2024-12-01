import { ensureRepoExists } from './fileSystem';
import { getToken, getRepoUrl } from './tokenStorage';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { parseRepoUrl } from './githubUtils';

let repoOwner = '';
let repoName = '';

interface CommitFileOptions {
    path: string;
    content: string;
    message?: string;
    oldPath?: string;
    oldFileSha?: string;
}

// Track file metadata (sha, url, etc)
interface FileMetadata {
    sha: string;
    url: string;
    htmlUrl: string;
}

let fileMetadata: { [path: string]: FileMetadata } = {};

// Track which files we've cached
const fileCache = new Map<string, { sha: string, content: string }>();

export function setRepoInfo(owner: string, name: string) {
    repoOwner = owner;
    repoName = name;
}

// Get the relative path from the full file path, preserving folder structure
// Input: .../repos/notes/folder1/folder2/file.md
// Output: folder1/folder2/file.md
export function getRelativePath(fullPath: string): string | null {
    // Look for /repos/REPO_NAME/ in the path and get everything after it
    const match = fullPath.match(new RegExp(`repos\/${repoName}\/(.+)`));
    if (!match) return null;
    return match[1];
}

export async function getFileMetadata(fullPath: string): Promise<FileMetadata | null> {
    return fileMetadata[fullPath] || null;
}

export async function updateFileMetadata(path: string, metadata: FileMetadata) {
    fileMetadata[path] = metadata;
}

export async function deleteFileMetadata(path: string) {
    delete fileMetadata[path];
}

export async function commitFile({ path: fullPath, content, message = 'Update note', oldPath, oldFileSha }: CommitFileOptions) {
    console.log('Attempting to commit file:', fullPath);
    activeCommits.add(fullPath);
    
    try {
        const token = await getToken();
        if (!token) {
            console.error('GitHub token not found');
            throw new Error('No GitHub token found');
        }
        console.log('GitHub token found');

        const relativePath = getRelativePath(fullPath);
        if (!relativePath) {
            console.error('Failed to parse relative path from:', fullPath);
            throw new Error('Invalid file path format');
        }
        console.log('Relative path:', relativePath);

        // If this is a rename operation
        if (oldPath && oldFileSha) {
            console.log('Rename operation detected. Old path:', oldPath);
            const oldRelativePath = getRelativePath(oldPath);
            if (!oldRelativePath) {
                throw new Error('Invalid old file path format');
            }

            console.log('Deleting old file first...');
            // Delete the old file first
            const deleteUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${oldRelativePath}`;
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Delete ${oldRelativePath} (rename to ${relativePath})`,
                    sha: oldFileSha,
                    branch: 'main'
                })
            });

            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                console.error('Failed to delete old file:', errorData);
                throw new Error(`Failed to delete old file during rename: ${errorData.message}`);
            }

            // Remove metadata for the old file
            deleteFileMetadata(oldPath);
            console.log('Successfully deleted old file');
            
            // Add a small delay to ensure GitHub's API has processed the delete
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${relativePath}`;
        
        // Get current file metadata if it exists
        let sha: string | undefined;
        const getResponse = await fetch(apiUrl, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            }
        });
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
            updateFileMetadata(fullPath, {
                sha: fileData.sha,
                url: fileData.url,
                htmlUrl: fileData.html_url
            });
        }

        // Create or update the file
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: oldPath ? `Rename ${getRelativePath(oldPath)} to ${relativePath}` : message,
                content: Buffer.from(content).toString('base64'),
                sha,
                branch: 'main'
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error updating file:', errorData);
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        // Update metadata for the new file
        updateFileMetadata(fullPath, {
            sha: result.content.sha,
            url: result.content.url,
            htmlUrl: result.content.html_url
        });

        console.log('File successfully updated');
        return result;
    } catch (error) {
        console.error('Detailed GitHub API error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    } finally {
        activeCommits.delete(fullPath);
    }
}

export async function deleteFile(path: string, sha?: string, message = 'Delete note') {
    console.log('Attempting to delete file:', path);
    
    try {
        const token = await getToken();
        if (!token) {
            console.error('GitHub token not found');
            throw new Error('No GitHub token found');
        }

        // If we have a SHA, delete from GitHub
        if (sha) {
            const relativePath = getRelativePath(path);
            if (!relativePath) {
                console.error('Failed to parse relative path from:', path);
                throw new Error('Invalid file path format');
            }

            const deleteUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${relativePath}`;
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sha,
                    branch: 'main'
                })
            });

            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                console.error('Failed to delete file from GitHub:', errorData);
                throw new Error(`Failed to delete file from GitHub: ${errorData.message}`);
            }

            console.log('Successfully deleted file from GitHub');
        }

        return true;
    } catch (error) {
        console.error('Error in deleteFile:', error);
        throw error;
    }
}

export async function getFileInfo(relativePath: string): Promise<{ sha: string; content: string } | null> {
    try {
        const token = await getToken();
        if (!token) {
            throw new Error('No GitHub token found');
        }

        const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${relativePath}`;
        const response = await fetch(fileUrl, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const fileData = await response.json();
        return {
            sha: fileData.sha,
            content: Buffer.from(fileData.content, 'base64').toString('utf8')
        };
    } catch (error) {
        console.error('Error getting file info:', error);
        throw error;
    }
}

export function clearFileCache(path?: string) {
    if (path) {
        fileCache.delete(path);
    } else {
        fileCache.clear();
    }
}

async function getFileFromGithub(path: string, forceFresh = false): Promise<{ content: string; sha: string } | null> {
    try {
        // Check cache first unless forceFresh is true
        if (!forceFresh && fileCache.has(path)) {
            return fileCache.get(path)!;
        }

        const token = await getToken();
        if (!token) {
            throw new Error('No GitHub token found');
        }

        const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        const response = await fetch(fileUrl, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const fileData = await response.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        const result = { content, sha: fileData.sha };
        fileCache.set(path, result);
        return result;
    } catch (error: any) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function syncFile(path: string): Promise<{ content: string; sha: string } | null> {
    // Clear cache for this file to ensure fresh data
    clearFileCache(path);
    return getFileFromGithub(path, true);
}

export async function syncAllFiles(): Promise<void> {
    // Clear entire cache before syncing
    clearFileCache();
    
    try {
        const token = await getToken();
        if (!token) {
            throw new Error('No GitHub token found');
        }

        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const files = await response.json();
        for (const file of files) {
            if (file.type === 'file' && file.path.endsWith('.md')) {
                await getFileFromGithub(file.path, true);
            }
        }
    } catch (error) {
        console.error('Failed to sync all files:', error);
        throw error;
    }
}

// Keep track of pending changes and active commits
let pendingChanges: { [path: string]: {
    timeout: NodeJS.Timeout,
    content: string
}} = {};
let activeCommits: Set<string> = new Set();

export function isActivelyCommitting(path: string): boolean {
    return activeCommits.has(path);
}

export async function scheduleCommit(path: string, content: string, delay = 30000) {
    // Check if file exists on GitHub and has been modified
    const repoUrl = await getRepoUrl();
    if (!repoUrl) return;

    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) return;

    const relativePath = getRelativePath(path);
    if (!relativePath) return;

    const fileInfo = await getFileInfo(relativePath);
    const currentMetadata = await getFileMetadata(path);
    
    if (fileInfo && currentMetadata && fileInfo.sha !== currentMetadata.sha) {
        return new Promise((resolve) => {
            Alert.alert(
                'File Modified',
                'This file has been modified on GitHub. How would you like to proceed?',
                [
                    {
                        text: 'View on GitHub',
                        onPress: () => {
                            if (currentMetadata.htmlUrl) {
                                Linking.openURL(currentMetadata.htmlUrl);
                            }
                            resolve(false);
                        }
                    },
                    {
                        text: 'Keep My Changes',
                        onPress: async () => {
                            try {
                                await commitFile({ 
                                    path, 
                                    content,
                                    message: 'Resolve conflict: keep local changes' 
                                });
                                resolve(true);
                            } catch (error) {
                                console.error('Error resolving conflict:', error);
                                Alert.alert('Error', 'Failed to save changes. Please try again.');
                                resolve(false);
                            }
                        }
                    },
                    {
                        text: 'Use GitHub Version',
                        onPress: async () => {
                            const content = Buffer.from(fileInfo.content, 'base64').toString('utf8');
                            await FileSystem.writeAsStringAsync(path, content);
                            await updateFileMetadata(path, {
                                sha: fileInfo.sha,
                                url: fileInfo.url,
                                htmlUrl: fileInfo.html_url
                            });
                            resolve(false);
                        }
                    }
                ],
                { cancelable: false }
            );
        });
    }

    // Clear any existing timeout for this path
    if (pendingChanges[path]) {
        clearTimeout(pendingChanges[path].timeout);
    }

    // Schedule the new commit
    pendingChanges[path] = {
        timeout: setTimeout(() => commitPendingChange(path), delay),
        content
    };
}

// Commit a specific pending change
async function commitPendingChange(path: string) {
    if (!pendingChanges[path]) return;
    
    const { content } = pendingChanges[path];
    delete pendingChanges[path];
    
    try {
        await commitFile({ path, content });
    } catch (error) {
        console.error('Failed to commit file:', path, error);
    }
}

// Commit all pending changes immediately
export async function commitAllPendingChanges() {
    console.log('Committing all pending changes...');
    const paths = Object.keys(pendingChanges);
    
    // Clear all timeouts first
    for (const path of paths) {
        clearTimeout(pendingChanges[path].timeout);
    }
    
    // Commit all pending changes
    const commitPromises = paths.map(path => {
        const { content } = pendingChanges[path];
        delete pendingChanges[path];
        return commitFile({ path, content }).catch(error => {
            console.error('Failed to commit file:', path, error);
        });
    });
    
    await Promise.all(commitPromises);
    console.log('All pending changes committed');
}

export function hasPendingChanges(path: string): boolean {
    return !!pendingChanges[path];
}

export async function syncFromGitHub(): Promise<void> {
    try {
        console.log('[GitHub] Starting sync');
        const token = await getToken();
        const repoUrl = await getRepoUrl();
        
        if (!token || !repoUrl) {
            console.error('Missing token or repo URL');
            return;
        }

        const repoInfo = parseRepoUrl(repoUrl);
        if (!repoInfo) {
            throw new Error('Invalid repository URL');
        }

        setRepoInfo(repoInfo.owner, repoInfo.name);

        const baseDir = await ensureRepoExists();
        console.log('[GitHub] Base directory:', baseDir);

        // Recursively get all files from GitHub
        async function getGitHubContents(path = ''): Promise<{ name: string, path: string, type: string, url: string, html_url: string }[]> {
            const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents${path}`, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const items = await response.json();
            let allItems = [];
            
            for (const item of items) {
                if (item.type === 'dir') {
                    const subItems = await getGitHubContents('/' + item.path);
                    allItems.push(...subItems);
                } else {
                    allItems.push(item);
                }
            }
            
            return allItems;
        }

        // Get all GitHub files recursively
        console.log('[GitHub] Fetching all files recursively...');
        const files = await getGitHubContents();
        const githubFiles = files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.md'));
        console.log('[GitHub] Found files:', githubFiles.map(f => f.path));

        // Get all local files recursively
        async function getLocalFiles(dir: string): Promise<string[]> {
            const items = await FileSystem.readDirectoryAsync(dir);
            let files = [];
            
            for (const item of items) {
                const fullPath = `${dir}/${item}`;
                const info = await FileSystem.getInfoAsync(fullPath);
                
                if (info.isDirectory) {
                    const subFiles = await getLocalFiles(fullPath);
                    files.push(...subFiles);
                } else if (item.toLowerCase().endsWith('.md')) {
                    files.push(fullPath.substring(baseDir.length + 1));
                }
            }
            
            return files;
        }

        const localFiles = await getLocalFiles(baseDir);
        console.log('[GitHub] Local files:', localFiles);
        
        // Delete local files that don't exist on GitHub
        const githubPaths = new Set(githubFiles.map(f => f.path));
        for (const localFile of localFiles) {
            if (!githubPaths.has(localFile)) {
                console.log('[GitHub] Deleting removed file:', localFile);
                const localPath = `${baseDir}/${localFile}`;
                await FileSystem.deleteAsync(localPath);
                await deleteFileMetadata(localPath);
            }
        }
        
        // Process each GitHub file
        for (const file of githubFiles) {
            const localPath = `${baseDir}/${file.path}`;
            try {
                // Ensure directory exists
                const dir = localPath.substring(0, localPath.lastIndexOf('/'));
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                
                // Fetch the file content
                console.log('[GitHub] Fetching content for:', file.path);
                const contentResponse = await fetch(file.url, {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    }
                });
                
                if (!contentResponse.ok) {
                    throw new Error(`Failed to fetch file content: ${contentResponse.status}`);
                }

                const contentData = await contentResponse.json();
                const content = Buffer.from(contentData.content, 'base64').toString('utf8');
                await FileSystem.writeAsStringAsync(localPath, content);
                
                // Update metadata
                await updateFileMetadata(localPath, {
                    sha: contentData.sha,
                    url: file.url,
                    htmlUrl: file.html_url
                });
                
                console.log('[GitHub] Saved file:', file.path);
            } catch (error) {
                console.error(`Error syncing file ${file.path}:`, error);
            }
        }
        console.log('[GitHub] Sync complete');
    } catch (error) {
        console.error('Error syncing from GitHub:', error);
        throw error;
    }
}

async function getFileContent(path: string): Promise<string | null> {
    // implementation
}
