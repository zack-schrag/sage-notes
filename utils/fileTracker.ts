import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { getRepoInfo } from './fileSystem';

interface FileStatus {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed';
    oldPath?: string;  // Only for renamed files
    sha?: string;      // Current SHA from GitHub, if it exists
}

interface FileMetadata {
    path: string;
    sha: string;
    content: string;   // Store the actual content for comparison
}

// In-memory cache of file metadata from the last commit
let lastCommitFiles: Map<string, FileMetadata> = new Map();

// Path to our tracking metadata file
const TRACKING_FILE = `${FileSystem.documentDirectory}file_tracking.json`;

/**
 * Load tracking data from disk
 */
async function loadTrackingData() {
    try {
        const fileInfo = await FileSystem.getInfoAsync(TRACKING_FILE);
        if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(TRACKING_FILE);
            const data = JSON.parse(content);
            lastCommitFiles = new Map(Object.entries(data));
            console.log(`Loaded tracking data for ${lastCommitFiles.size} files`);
        }
    } catch (error) {
        console.error('Error loading tracking data:', error);
    }
}

/**
 * Save tracking data to disk
 */
async function saveTrackingData() {
    try {
        const data = Object.fromEntries(lastCommitFiles);
        await FileSystem.writeAsStringAsync(TRACKING_FILE, JSON.stringify(data));
        console.log(`Saved tracking data for ${lastCommitFiles.size} files`);
    } catch (error) {
        console.error('Error saving tracking data:', error);
    }
}

// Load tracking data when module is imported
loadTrackingData();

/**
 * Get the absolute file path within the repository
 */
function getAbsolutePath(relativePath: string, repoDir: string): string {
    // Remove any leading slashes from the relative path
    const cleanPath = relativePath.replace(/^\/+/, '');
    return `${repoDir}/${cleanPath}`;
}

/**
 * Initialize or update the file tracking system with current GitHub state
 * @param files Array of files from GitHub with their SHAs
 * @param reset If true, clear existing state before initializing
 */
export async function initializeTracking(files: { path: string; sha: string }[], reset: boolean = false) {
    try {
        const { repoDir } = await getRepoInfo();
        if (!repoDir) {
            throw new Error('Repository directory not found');
        }

        // Only clear existing state if reset is true
        if (reset) {
            console.log('Resetting file tracking state');
            lastCommitFiles.clear();
        }
        
        for (const file of files) {
            try {
                const fullPath = getAbsolutePath(file.path, repoDir);
                
                // Check if file exists before trying to read it
                const fileInfo = await FileSystem.getInfoAsync(fullPath);
                if (!fileInfo.exists) {
                    console.log(`File not found, skipping: ${fullPath}`);
                    continue;
                }

                // Read the current content
                const content = await FileSystem.readAsStringAsync(fullPath);
                
                lastCommitFiles.set(file.path, {
                    path: file.path,
                    sha: file.sha,
                    content: content
                });
            } catch (error) {
                console.error(`Error initializing tracking for ${file.path}:`, error);
            }
        }
        
        // Save tracking data after initialization
        await saveTrackingData();
        
        console.log(`Tracking state updated. Total tracked files: ${lastCommitFiles.size}`);
    } catch (error) {
        console.error('Error in initializeTracking:', error);
    }
}

/**
 * Compare file contents directly instead of using hashes
 */
async function hasFileChanged(path: string, lastKnown?: FileMetadata): Promise<boolean> {
    try {
        if (!lastKnown) return true; // New file
        
        const { repoDir } = await getRepoInfo();
        if (!repoDir) return true;

        const fullPath = getAbsolutePath(path, repoDir);
        
        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(fullPath);
        if (!fileInfo.exists) return true;

        const content = await FileSystem.readAsStringAsync(fullPath);
        return content !== lastKnown.content; // Direct content comparison
    } catch (error) {
        console.error('Error checking file changes:', error);
        return true; // Assume changed if we can't check
    }
}

/**
 * Get the status of all tracked files
 */
export async function status(repoDir: string): Promise<FileStatus[]> {
    console.log('Starting status check...');
    // console.log('Current tracked files:', Array.from(lastCommitFiles.entries()));
    
    const changes: FileStatus[] = [];
    const currentFiles = new Set<string>();

    // Helper function to recursively scan directory
    async function scanDirectory(dir: string) {
        const entries = await FileSystem.readDirectoryAsync(dir);
        console.log(`Scanning directory ${dir}, found entries:`, entries);
        
        for (const entry of entries) {
            const fullPath = `${dir}/${entry}`;
            const info = await FileSystem.getInfoAsync(fullPath);
            
            if (info.isDirectory) {
                await scanDirectory(fullPath);
                continue;
            }

            // Only track markdown files
            if (!entry.endsWith('.md')) continue;

            // Get path relative to repo directory
            const relativePath = fullPath.replace(`${repoDir}/`, '');
            console.log(`Processing file: ${relativePath}`);
            currentFiles.add(relativePath);

            const lastKnown = lastCommitFiles.get(relativePath);
            // console.log(`Last known state for ${relativePath}:`, lastKnown);
            
            if (!lastKnown) {
                console.log(`${relativePath} appears to be a new file`);
                changes.push({
                    path: relativePath,
                    status: 'added'
                });
            } else if (await hasFileChanged(relativePath, lastKnown)) {
                console.log(`${relativePath} appears to be modified`);
                changes.push({
                    path: relativePath,
                    status: 'modified',
                    sha: lastKnown.sha
                });
            } else {
                console.log(`${relativePath} is unchanged`);
            }
        }
    }

    // Scan all current files
    await scanDirectory(repoDir);

    // Check for deleted files
    for (const [path, metadata] of lastCommitFiles.entries()) {
        if (!currentFiles.has(path)) {
            console.log(`${path} appears to be deleted`);
            changes.push({
                path,
                status: 'deleted',
                sha: metadata.sha
            });
        }
    }

    // For debugging
    if (changes.length > 0) {
        console.log('Changes detected:', changes);
    } else {
        console.log('No changes detected');
    }

    return changes;
}

/**
 * Convert string content to base64
 */
function encodeBase64(str: string): string {
    return Buffer.from(str, 'utf8').toString('base64');
}

/**
 * Commit all changed files to GitHub
 */
export async function commit(
    repoDir: string,
    changes: FileStatus[],
    commitMessage: string,
    githubToken: string,
    owner: string,
    repo: string
): Promise<{ success: boolean; error?: string; changedFiles: { path: string; sha: string }[] }> {
    const result = {
        success: false,
        changedFiles: []
    };

    try {
        for (const change of changes) {
            console.log(`Committing ${change.status} file: ${change.path}`);
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${change.path}`;
            
            switch (change.status) {
                case 'added':
                case 'modified': {
                    const content = await FileSystem.readAsStringAsync(getAbsolutePath(change.path, repoDir));
                    const base64Content = encodeBase64(content);
                    
                    const response = await fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: commitMessage,
                            content: base64Content,
                            sha: change.sha, // Only included for modified files
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to ${change.status} file ${change.path}. Status code: ${response.status}. Response: ${await response.text()}`);
                    }

                    const data = await response.json();
                    result.changedFiles.push({
                        path: change.path,
                        sha: data.content.sha
                    });
                    break;
                }
                
                case 'deleted': {
                    const response = await fetch(apiUrl, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: commitMessage,
                            sha: change.sha,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete file ${change.path}. Status code: ${response.status}. Response: ${await response.text()}`);
                    }

                    // Remove the deleted file from tracking
                    lastCommitFiles.delete(change.path);
                    console.log(`Removed ${change.path} from tracking`);
                    break;
                }
                
                case 'renamed': {
                    if (!change.oldPath) continue;

                    // Delete old file
                    await fetch(
                        `https://api.github.com/repos/${owner}/${repo}/contents/${change.oldPath}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                message: `${commitMessage} (rename from ${change.oldPath})`,
                                sha: change.sha,
                            }),
                        }
                    );

                    // Remove the old path from tracking
                    lastCommitFiles.delete(change.oldPath);

                    // Create new file
                    const content = await FileSystem.readAsStringAsync(getAbsolutePath(change.path, repoDir));
                    const base64Content = encodeBase64(content);
                    
                    const response = await fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: `${commitMessage} (rename from ${change.oldPath})`,
                            content: base64Content,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to rename file from ${change.oldPath} to ${change.path}`);
                    }

                    const data = await response.json();
                    result.changedFiles.push({
                        path: change.path,
                        sha: data.content.sha
                    });
                    break;
                }
            }
        }

        // Update our tracking state with the new SHAs
        for (const file of result.changedFiles) {
            lastCommitFiles.set(file.path, {
                path: file.path,
                sha: file.sha,
                content: await FileSystem.readAsStringAsync(getAbsolutePath(file.path, repoDir))
            });
        }
        
        // Save tracking data after successful commit
        await saveTrackingData();
        
        result.success = true;
        return result;
    } catch (error) {
        console.error('Error during commit:', error);
        result.error = error.message;
        return result;
    }
}
