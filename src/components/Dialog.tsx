import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { space, type, useTheme } from '@/theme';

type Button = { label: string; onPress: () => void; tone?: 'primary' | 'danger' };

// Material dialog: only for decisions that must interrupt
export function Dialog({ visible, title, body, children, buttons, onDismiss }: { visible: boolean; title: string; body?: string; children?: ReactNode; buttons: Button[]; onDismiss: () => void }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <View style={[styles.box, { backgroundColor: c.ground }]}>
          <Text style={[type.title, { color: c.ink }]}>{title}</Text>
          {body ? <Text style={[type.bodySmall, { color: c.inkMuted }]}>{body}</Text> : null}
          {children}
          <View style={styles.buttons}>
            {buttons.map((b) => (
              <Pressable key={b.label} onPress={b.onPress} style={styles.btn} accessibilityRole="button" android_ripple={{ color: c.rule }}>
                <Text style={[type.label, { color: b.tone === 'danger' ? c.danger : c.primary }]}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Dialog with one text field
export function PromptDialog({ visible, title, body, initial = '', placeholder, confirm = 'Save', secure, onSubmit, onDismiss, extra }: {
  visible: boolean; title: string; body?: string; initial?: string; placeholder?: string; confirm?: string; secure?: boolean;
  onSubmit: (value: string) => void; onDismiss: () => void; extra?: Button;
}) {
  const { c } = useTheme();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  return (
    <Dialog
      visible={visible}
      title={title}
      body={body}
      onDismiss={onDismiss}
      buttons={[...(extra ? [extra] : []), { label: 'Cancel', onPress: onDismiss }, { label: confirm, onPress: () => onSubmit(value) }]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        autoFocus
        secureTextEntry={secure}
        onSubmitEditing={() => onSubmit(value)}
        selectionColor={c.primary}
        cursorColor={c.primary}
        style={[type.body, styles.input, { color: c.ink, borderColor: c.primary }]}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: space(6) },
  box: { borderRadius: 28, padding: space(6), gap: space(4), elevation: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(2) },
  btn: { minHeight: 48, minWidth: 48, paddingHorizontal: space(3), justifyContent: 'center', alignItems: 'center', borderRadius: 20, overflow: 'hidden' },
  input: { borderWidth: 2, borderRadius: 4, paddingHorizontal: space(4), paddingVertical: space(3) },
});
