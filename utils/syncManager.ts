import { status, commit, initializeTracking } from './fileTracker';
import { getRepoInfo } from './fileSystem';
import { getToken } from './tokenStorage';
import { AppState, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getFileInfo } from './githubSync';

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let appStateSubscription: { remove: () => void } | null = null;

/**
 * Handle file conflicts by prompting user
 */
async function handleConflict(fileName: string): Promise<'local' | 'remote'> {
    return new Promise((resolve) => {
        Alert.alert(
            'Sync Conflict',
            `The note "${fileName}" has been modified both locally and on GitHub. Which version would you like to keep?`,
            [
                {
                    text: 'Keep My Changes',
                    onPress: () => resolve('local'),
                    style: 'default'
                },
                {
                    text: 'Use GitHub Version',
                    onPress: () => resolve('remote'),
                    style: 'default'
                }
            ],
            { cancelable: false }
        );
    });
}

/**
 * Check for conflicts and handle sync for a single file
 */
async function syncFile(repoDir: string, change: FileStatus, token: string, owner: string, repo: string): Promise<boolean> {
    try {
        // Get GitHub's current state
        const githubFile = await getFileInfo(change.path);
        
        // If file doesn't exist on GitHub or SHA matches, safe to push our changes
        if (!githubFile || githubFile.sha === change.sha) {
            const result = await commit(
                repoDir,
                [change],
                'Auto-sync changes',
                token,
                owner,
                repo
            );
            return result.success;
        }

        // Check if we have local changes to this file
        const localChanges = await status(repoDir);
        const hasLocalChanges = localChanges.some(c => c.path === change.path && c.status === 'modified');

        // If no local changes, just take GitHub's version
        if (!hasLocalChanges) {
            const fullPath = `${repoDir}/${change.path}`;
            await FileSystem.writeAsStringAsync(fullPath, githubFile.content);
            await initializeTracking([{
                path: change.path,
                sha: githubFile.sha
            }]);
            console.log('Updated local file with GitHub version:', change.path);
            return true;
        }

        // We have local changes and different content - ask user what to do
        const choice = await handleConflict(change.path);
        
        if (choice === 'local') {
            // Keep local changes but use GitHub's SHA for the update
            const result = await commit(
                repoDir,
                [{ ...change, sha: githubFile.sha }], // Use GitHub's SHA
                'Resolved conflict - kept local changes',
                token,
                owner,
                repo
            );
            return result.success;
        } else {
            // Use GitHub's version
            const fullPath = `${repoDir}/${change.path}`;
            await FileSystem.writeAsStringAsync(fullPath, githubFile.content);
            // Update file tracking metadata with GitHub's version
            await initializeTracking([{
                path: change.path,
                sha: githubFile.sha
            }]);
            console.log('Updated local file with GitHub version:', change.path);
            return true;
        }
    } catch (error) {
        console.error('Error syncing file:', change.path, error);
        return false;
    }
}

/**
 * Performs a single sync operation
 */
async function performSync() {
    if (isSyncing) {
        console.log('Sync already in progress, skipping...');
        return;
    }

    try {
        isSyncing = true;
        
        const { repoDir, owner, name: repo } = await getRepoInfo();
        if (!repoDir || !owner || !repo) {
            console.log('No repository configured, skipping sync');
            return;
        }

        const token = await getToken();
        if (!token) {
            console.log('No GitHub token available, skipping sync');
            return;
        }

        // Check for changes
        const changes = await status(repoDir);
        if (changes.length === 0) {
            return;
        }

        console.log('Changes detected:', changes.length, 'files');
        
        // Handle each changed file
        for (const change of changes) {
            await syncFile(repoDir, change, token, owner, repo);
        }
    } catch (error) {
        console.error('Error during sync:', error);
    } finally {
        isSyncing = false;
    }
}

/**
 * Handle app state changes
 */
function handleAppStateChange(nextAppState: string) {
    if (nextAppState === 'active') {
        console.log('App has come to the foreground, triggering sync');
        performSync();
    }
}

/**
 * Starts the background sync process
 */
export function startBackgroundSync() {
    if (syncInterval) {
        console.log('Background sync already running');
        return;
    }

    // Start periodic sync
    syncInterval = setInterval(performSync, 5 * 60 * 1000); // Sync every 5 minutes
    
    // Add app state listener
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    console.log('Background sync started');
}

/**
 * Stops the background sync process
 */
export function stopBackgroundSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;

        // Remove app state listener
        if (appStateSubscription) {
            appStateSubscription.remove();
            appStateSubscription = null;
        }
        
        console.log('Background sync stopped');
    }
}

/**
 * Force an immediate sync operation
 */
export function forceSync() {
    return performSync();
}

/**
 * Performs a full sync by checking all files on GitHub
 */
export async function performFullSync() {
    if (isSyncing) {
        console.log('Sync already in progress, skipping full sync');
        return;
    }

    console.log('Starting full sync from GitHub');
    try {
        isSyncing = true;
        const { repoDir, owner, name: repo } = await getRepoInfo();
        const token = await getToken();
        
        if (!token || !repoDir || !owner || !repo) {
            console.error('Missing required info for sync');
            return;
        }

        // Get local changes first to check for conflicts
        const localChanges = await status(repoDir);
        const locallyModifiedFiles = new Set(localChanges.map(c => c.path));

        // Get all files from GitHub recursively
        async function getGitHubContents(path = ''): Promise<{ path: string; sha: string }[]> {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents${path}`, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const items = await response.json();
            let allFiles = [];
            
            for (const item of items) {
                if (item.type === 'dir') {
                    const subFiles = await getGitHubContents('/' + item.path);
                    allFiles.push(...subFiles);
                } else if (item.name.endsWith('.md')) {
                    allFiles.push({ path: item.path, sha: item.sha });
                }
            }
            
            return allFiles;
        }

        // Get all GitHub files
        const githubFiles = await getGitHubContents();
        console.log('Found files on GitHub:', githubFiles.map(f => f.path));

        // Check each file
        for (const file of githubFiles) {
            const localPath = `${repoDir}/${file.path}`;
            const githubFile = await getFileInfo(file.path);
            
            if (!githubFile) continue;

            // Check if file exists locally
            const fileExists = await FileSystem.getInfoAsync(localPath);
            
            if (!fileExists.exists) {
                // File doesn't exist locally, download it
                console.log('Downloading new file:', file.path);
                const dir = localPath.substring(0, localPath.lastIndexOf('/'));
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                await FileSystem.writeAsStringAsync(localPath, githubFile.content);
                await initializeTracking([{
                    path: file.path,
                    sha: githubFile.sha
                }]);
            } else if (locallyModifiedFiles.has(file.path)) {
                // File exists and has local changes - use conflict resolution
                await syncFile(repoDir, { path: file.path, status: 'modified', sha: file.sha }, token, owner, repo);
            } else {
                // File exists but no local changes - just update from GitHub
                console.log('Updating file from GitHub:', file.path);
                await FileSystem.writeAsStringAsync(localPath, githubFile.content);
                await initializeTracking([{
                    path: file.path,
                    sha: githubFile.sha
                }]);
            }
        }

        console.log('Full sync complete');
    } catch (error) {
        console.error('Error during full sync:', error);
        throw error; // Re-throw to let caller handle it
    } finally {
        isSyncing = false;
    }
}
