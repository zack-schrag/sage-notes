import { getToken } from './tokenStorage';
import { Buffer } from 'buffer';

const REPO_OWNER = 'zack-schrag';
const REPO_NAME = 'notes';

interface CommitFileOptions {
    path: string;
    content: string;
    message?: string;
}

// Get the relative path from the full file path, preserving folder structure
// Input: .../repos/notes/folder1/folder2/file.md
// Output: folder1/folder2/file.md
function getRelativePath(fullPath: string): string | null {
    // Look for /repos/REPO_NAME/ in the path and get everything after it
    const match = fullPath.match(new RegExp(`repos\/${REPO_NAME}\/(.+)`));
    if (!match) return null;
    return match[1];
}

export async function commitFile({ path: fullPath, content, message = 'Update note' }: CommitFileOptions) {
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

        const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${relativePath}`;
        console.log('GitHub API URL:', apiUrl);

        try {
            // First get the current file (if it exists) to get its SHA
            console.log('Fetching current file info...');
            let sha: string | undefined;
            const getResponse = await fetch(apiUrl, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                }
            });
            
            console.log('Get file response status:', getResponse.status);
            if (!getResponse.ok) {
                const errorData = await getResponse.json().catch(() => null);
                console.error('Error getting file:', {
                    status: getResponse.status,
                    statusText: getResponse.statusText,
                    error: errorData
                });
            }
            
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
                console.log('Existing file found, SHA:', sha);
            }

            // Create or update the file
            console.log('Sending PUT request to update file...');
            const requestBody = {
                message,
                content: Buffer.from(content).toString('base64'),
                sha,
                branch: 'main'
            };
            console.log('Request body (excluding content):', {
                message: requestBody.message,
                sha: requestBody.sha,
                branch: requestBody.branch
            });

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('Update response status:', response.status);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Error updating file:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('File successfully updated');
            return result;
        } catch (error) {
            console.error('Detailed GitHub API error:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
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

// Keep track of pending changes and active commits
let pendingChanges: { [path: string]: NodeJS.Timeout } = {};
let activeCommits: Set<string> = new Set();

export function isActivelyCommitting(path: string): boolean {
    return activeCommits.has(path);
}

export function scheduleCommit(path: string, content: string, delay = 30000) {
    console.log('Scheduling commit for:', path);
    // Clear any existing timeout for this file
    if (pendingChanges[path]) {
        console.log('Clearing existing commit timeout');
        clearTimeout(pendingChanges[path]);
    }

    // Schedule new commit
    pendingChanges[path] = setTimeout(async () => {
        try {
            console.log('Executing scheduled commit for:', path);
            await commitFile({ path, content });
            delete pendingChanges[path];
            console.log('Scheduled commit completed');
        } catch (error) {
            console.error('Error in scheduled commit:', error);
            activeCommits.delete(path); // Ensure we clean up if there's an error
        }
    }, delay);
    console.log('Commit scheduled with delay:', delay, 'ms');
}

export function hasPendingChanges(path: string): boolean {
    return !!pendingChanges[path];
}
