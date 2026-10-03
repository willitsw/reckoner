import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export type PickedAudio = {
  uri: string;
  contentType: string | null;
  byteSize: number | null;
};

export type ActiveAudioRecording = {
  stop: () => Promise<PickedAudio | null>;
  cancel: () => Promise<void>;
};

/** Library / files picker. Returns null on cancel. */
export async function pickAudio(): Promise<PickedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    contentType: asset.mimeType ?? null,
    byteSize: asset.size ?? null,
  };
}

async function resetRecordingMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
}

/** Start an in-app recording (iOS first; experimental on web). */
export async function startAudioRecording(): Promise<ActiveAudioRecording> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone access is needed to record audio.');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  let finished = false;

  return {
    async stop() {
      if (finished) return null;
      finished = true;
      try {
        await recording.stopAndUnloadAsync();
      } finally {
        await resetRecordingMode();
      }
      const uri = recording.getURI();
      if (!uri) return null;
      return {
        uri,
        // HIGH_QUALITY preset is AAC-in-M4A on iOS / similar on Android.
        contentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        byteSize: null,
      };
    },
    async cancel() {
      if (finished) return;
      finished = true;
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // Best-effort cleanup.
      } finally {
        await resetRecordingMode();
      }
    },
  };
}
