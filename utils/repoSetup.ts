import { getToken, getRepoUrl } from './tokenStorage';

export async function isRepoConfigured(): Promise<boolean> {
  try {
    const [token, repoUrl] = await Promise.all([
      getToken(),
      getRepoUrl()
    ]);
    
    return !!(token && repoUrl);
  } catch (error) {
    console.error('Error checking repo configuration:', error);
    return false;
  }
}
