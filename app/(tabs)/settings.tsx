import { StyleSheet, Platform, Pressable, View, TextInput, SafeAreaView } from 'react-native';
import React from 'react';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { cloneRepository, removeRepository } from '@/utils/fileSystem';
import { saveToken, getToken, removeToken } from '@/utils/tokenStorage';

export default function SettingsScreen() {
  const [isCloning, setIsCloning] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [githubToken, setGithubToken] = React.useState('');
  const [showToken, setShowToken] = React.useState(false);

  // Load token on component mount
  React.useEffect(() => {
    const loadToken = async () => {
      const savedToken = await getToken();
      if (savedToken) {
        setGithubToken(savedToken);
      }
    };
    loadToken();
  }, []);

  const handleCloneRepo = async () => {
    if (!githubToken.trim()) {
      alert('Please enter your GitHub token');
      return;
    }

    try {
      setIsCloning(true);
      await saveToken(githubToken);
      await cloneRepository(githubToken);
    } catch (error) {
      console.error('Error in handleCloneRepo:', error);
      alert('Failed to clone repository. Please check your token and try again.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleRemoveRepo = async () => {
    try {
      setIsRemoving(true);
      await removeRepository();
      await removeToken();
      setGithubToken('');
    } catch (error) {
      console.error('Error in handleRemoveRepo:', error);
      alert('Failed to remove repository');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>GitHub Repository</ThemedText>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter GitHub Token"
              placeholderTextColor="#666"
              value={githubToken}
              onChangeText={setGithubToken}
              secureTextEntry={!showToken}
            />
            <Pressable
              onPress={() => setShowToken(!showToken)}
              style={styles.showHideButton}
            >
              <ThemedText>{showToken ? 'Hide' : 'Show'}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleCloneRepo}
              style={[styles.button, styles.cloneButton]}
              disabled={isCloning}
            >
              <ThemedText style={styles.buttonText}>
                {isCloning ? 'Cloning...' : 'Clone Repository'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleRemoveRepo}
              style={[styles.button, styles.removeButton]}
              disabled={isRemoving}
            >
              <ThemedText style={styles.buttonText}>
                {isRemoving ? 'Removing...' : 'Remove Repository'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    backgroundColor: '#1a1a1a',
  },
  showHideButton: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cloneButton: {
    backgroundColor: '#2ecc71',
  },
  removeButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
