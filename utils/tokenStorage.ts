import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'github_token';
const REPO_URL_KEY = 'github_repo_url';

export async function saveToken(token: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
        console.error('Error saving token:', error);
        throw error;
    }
}

export async function getToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Error getting token:', error);
        return null;
    }
}

export async function removeToken(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Error removing token:', error);
        throw error;
    }
}

export async function saveRepoUrl(url: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(REPO_URL_KEY, url);
    } catch (error) {
        console.error('Error saving repository URL:', error);
        throw error;
    }
}

export async function getRepoUrl(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(REPO_URL_KEY);
    } catch (error) {
        console.error('Error getting repository URL:', error);
        return null;
    }
}

export async function removeRepoUrl(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(REPO_URL_KEY);
    } catch (error) {
        console.error('Error removing repository URL:', error);
        throw error;
    }
}
