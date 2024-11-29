import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

interface AddTagModalProps {
  visible: boolean;
  onClose: () => void;
  onAddTag: (tag: string) => void;
}

export function AddTagModal({ visible, onClose, onAddTag }: AddTagModalProps) {
  const [tagText, setTagText] = useState('');

  const handleAdd = () => {
    if (tagText.trim()) {
      onAddTag(tagText.trim());
      setTagText('');
      onClose();
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.centeredView}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add Tag</Text>
          <TextInput
            style={styles.input}
            value={tagText}
            onChangeText={setTagText}
            placeholder="Enter tag name"
            placeholderTextColor="#666"
            autoFocus={true}
            autoCapitalize="none"
            onSubmitEditing={handleAdd}
          />
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.addButton]}
              onPress={handleAdd}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 16,
  },
  cancelButton: {
    backgroundColor: '#3a3a3a',
  },
  addButton: {
    backgroundColor: '#0A84FF',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
