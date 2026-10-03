import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import type { MediaAsset, ProcessId, StepId } from '@/src/domain/types';
import { useSession } from '@/src/modules/auth/session-context';
import { assertEntitlement } from '@/src/modules/billing/assert-entitlement';
import {
  pickAudio,
  startAudioRecording,
  type ActiveAudioRecording,
} from '@/src/modules/process/pick-audio';
import { definitionAudio } from '@/src/modules/process/split-definition-media';

/** Editor strip for definition audio — attach/record, caption, soft-delete. No cover. */
export function AudioStrip({
  processId,
  stepId = null,
  assets,
  onChanged,
  onError,
  disabled = false,
}: {
  processId: ProcessId;
  /** Null = process-level attachments. */
  stepId?: StepId | null;
  assets: MediaAsset[];
  onChanged: () => Promise<void> | void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<ActiveAudioRecording | null>(null);
  const audioAssets = definitionAudio(assets);
  const attachTestId =
    stepId === null ? 'process-attach-audio' : `step-attach-audio-${stepId}`;
  const recordTestId =
    stepId === null ? 'process-record-audio' : `step-record-audio-${stepId}`;

  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  useEffect(() => {
    return () => {
      void recordingRef.current?.cancel();
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function attachPicked() {
    await run(async () => {
      if (!session) throw new Error('Sign in to attach audio.');
      const { entitlements, media } = getContainer();
      const decision = await assertEntitlement(entitlements, session.user.id, 'attach_media');
      if (!decision.allowed) throw new Error('Upgrade to attach more media.');

      const picked = await pickAudio();
      if (!picked) return;
      await media.attachAudio({
        processId,
        stepId,
        storagePath: picked.uri,
        contentType: picked.contentType,
        byteSize: picked.byteSize,
      });
    });
  }

  async function toggleRecord() {
    if (busy || disabled) return;
    if (recording) {
      await run(async () => {
        if (!session) throw new Error('Sign in to attach audio.');
        const { entitlements, media } = getContainer();
        const decision = await assertEntitlement(entitlements, session.user.id, 'attach_media');
        if (!decision.allowed) throw new Error('Upgrade to attach more media.');

        const active = recording;
        setRecording(null);
        const picked = await active.stop();
        if (!picked) return;
        await media.attachAudio({
          processId,
          stepId,
          storagePath: picked.uri,
          contentType: picked.contentType,
          byteSize: picked.byteSize,
        });
      });
      return;
    }

    setBusy(true);
    try {
      if (!session) throw new Error('Sign in to attach audio.');
      const decision = await assertEntitlement(
        getContainer().entitlements,
        session.user.id,
        'attach_media',
      );
      if (!decision.allowed) throw new Error('Upgrade to attach more media.');
      const active = await startAudioRecording();
      setRecording(active);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const empty = audioAssets.length === 0;

  return (
    <View
      testID={stepId === null ? 'process-audio' : `step-audio-${stepId}`}
      style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Audio</Text>
        <View style={styles.headerActions}>
          <Pressable
            testID={attachTestId}
            disabled={busy || disabled || recording !== null}
            onPress={() => void attachPicked()}>
            <Text
              style={{
                color: busy || disabled || recording ? colors.border : colors.tint,
                fontWeight: '600',
              }}>
              Add audio
            </Text>
          </Pressable>
          <Pressable
            testID={recordTestId}
            disabled={(busy && !recording) || disabled}
            onPress={() => void toggleRecord()}>
            <Text
              style={{
                color: recording
                  ? colors.danger
                  : busy || disabled
                    ? colors.border
                    : colors.textSecondary,
                fontWeight: '600',
              }}>
              {recording ? 'Stop' : 'Record'}
            </Text>
          </Pressable>
        </View>
      </View>

      {empty ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Optional voice notes for this {stepId ? 'step' : 'process'}.
        </Text>
      ) : (
        audioAssets.map((asset) => (
          <AudioRow
            key={asset.id}
            asset={asset}
            disabled={busy || disabled || recording !== null}
            onUpdate={(patch) =>
              void run(() => getContainer().media.updateMedia(asset.id, patch).then(() => undefined))
            }
            onRemove={() => void run(() => getContainer().media.softDelete(asset.id))}
          />
        ))
      )}
    </View>
  );
}

function AudioRow({
  asset,
  disabled,
  onUpdate,
  onRemove,
}: {
  asset: MediaAsset;
  disabled: boolean;
  onUpdate: (patch: { caption?: string }) => void;
  onRemove: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [caption, setCaption] = useState(asset.caption);
  const captionRef = useRef(caption);
  captionRef.current = caption;
  useEffect(() => {
    setCaption(asset.caption);
    captionRef.current = asset.caption;
  }, [asset.caption, asset.id]);

  return (
    <View
      testID={`media-row-${asset.id}`}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View
        testID={`media-audio-${asset.id}`}
        accessibilityLabel={asset.caption || 'Process audio'}
        style={[styles.audioMark, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>Audio</Text>
        <View
          testID={`media-uploaded-${asset.id}`}
          accessibilityLabel="Uploaded"
          style={styles.statusMarker}
        />
      </View>
      <View style={styles.meta}>
        <TextInput
          testID={`media-caption-${asset.id}`}
          value={caption}
          editable={!disabled}
          onChangeText={(next) => {
            captionRef.current = next;
            setCaption(next);
          }}
          onBlur={() => {
            if (captionRef.current === asset.caption) return;
            onUpdate({ caption: captionRef.current });
          }}
          placeholder="Caption"
          placeholderTextColor={colors.textSecondary}
          style={[styles.caption, { color: colors.text, borderColor: colors.border }]}
        />
        <View style={styles.actions}>
          <View />
          <Pressable testID={`media-remove-${asset.id}`} disabled={disabled} onPress={onRemove}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  audioMark: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMarker: { width: 0, height: 0, overflow: 'hidden' },
  meta: { flex: 1, gap: 6 },
  caption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
