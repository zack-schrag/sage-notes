import { getToken } from './tokenStorage';
import { Buffer } from 'buffer';

const REPO_OWNER = 'zack-schrag';
const REPO_NAME = 'notes';

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

// Get the relative path from the full file path, preserving folder structure
// Input: .../repos/notes/folder1/folder2/file.md
// Output: folder1/folder2/file.md
export function getRelativePath(fullPath: string): string | null {
    // Look for /repos/REPO_NAME/ in the path and get everything after it
    const match = fullPath.match(new RegExp(`repos\/${REPO_NAME}\/(.+)`));
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
            const deleteUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${oldRelativePath}`;
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

        const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${relativePath}`;
        
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

            const deleteUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${relativePath}`;
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

// Keep track of pending changes and active commits
let pendingChanges: { [path: string]: {
    timeout: NodeJS.Timeout,
    content: string
}} = {};
let activeCommits: Set<string> = new Set();

export function isActivelyCommitting(path: string): boolean {
    return activeCommits.has(path);
}

export function scheduleCommit(path: string, content: string, delay = 3000) {
    console.log('Scheduling commit for:', path);
    // Clear any existing timeout for this file
    if (pendingChanges[path]) {
        clearTimeout(pendingChanges[path].timeout);
    }

    // Store both the timeout and the content
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
