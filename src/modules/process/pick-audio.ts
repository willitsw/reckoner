import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
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
  await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
}

/** Start an in-app recording (iOS first; experimental on web). */
export async function startAudioRecording(): Promise<ActiveAudioRecording> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone access is needed to record audio.');
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  const recorder = new AudioModule.AudioRecorder({});
  await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
  recorder.record();

  let finished = false;

  return {
    async stop() {
      if (finished) return null;
      finished = true;
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) return null;
        return {
          uri,
          // HIGH_QUALITY preset is AAC-in-M4A on iOS / similar on Android.
          contentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
          byteSize: null,
        };
      } finally {
        await resetRecordingMode();
        try {
          recorder.release();
        } catch {
          // Best-effort cleanup.
        }
      }
    },
    async cancel() {
      if (finished) return;
      finished = true;
      try {
        await recorder.stop();
      } catch {
        // Best-effort cleanup.
      } finally {
        await resetRecordingMode();
        try {
          recorder.release();
        } catch {
          // Best-effort cleanup.
        }
      }
    },
  };
}
