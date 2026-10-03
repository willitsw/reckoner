import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import type { MediaAsset, ProcessId, StepId } from '@/src/domain/types';
import { captureImage, pickImage } from '@/src/modules/process/pick-image';

/** Read-only definition images for the run screen (no attach/caption/delete). */
export function DefinitionMediaView({
  assets,
  testID,
  coverOnly = false,
}: {
  assets: MediaAsset[];
  testID: string;
  /** When true, show only the cover (or first image) as a compact header visual. */
  coverOnly?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const visible = coverOnly
    ? (() => {
        const cover = assets.find((asset) => asset.isCover) ?? assets[0];
        return cover ? [cover] : [];
      })()
    : assets;
  if (visible.length === 0) return null;

  return (
    <View testID={testID} style={styles.wrap}>
      {visible.map((asset) => (
        <View
          key={asset.id}
          testID={`media-row-${asset.id}`}
          style={[
            styles.row,
            coverOnly && styles.coverRow,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}>
          <Image
            testID={`media-thumb-${asset.id}`}
            source={{ uri: asset.storagePath }}
            style={coverOnly ? styles.coverThumb : styles.thumb}
            accessibilityLabel={asset.caption || 'Process image'}
          />
          {!coverOnly && asset.caption.trim() ? (
            <Text style={[styles.readCaption, { color: colors.textSecondary }]}>{asset.caption}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function MediaStrip({
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
  const [busy, setBusy] = useState(false);
  const attachTestId =
    stepId === null ? 'process-attach-image' : `step-attach-image-${stepId}`;
  const cameraTestId =
    stepId === null ? 'process-camera-image' : `step-camera-image-${stepId}`;

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

  async function attach(from: 'library' | 'camera') {
    await run(async () => {
      const picked = from === 'camera' ? await captureImage() : await pickImage();
      if (!picked) return;
      await getContainer().media.attachImage({
        processId,
        stepId,
        storagePath: picked.uri,
        contentType: picked.contentType,
        byteSize: picked.byteSize,
      });
    });
  }

  return (
    <View
      testID={stepId === null ? 'process-media' : `step-media-${stepId}`}
      style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Images</Text>
        <View style={styles.headerActions}>
          <Pressable
            testID={attachTestId}
            disabled={busy || disabled}
            onPress={() => void attach('library')}>
            <Text
              style={{
                color: busy || disabled ? colors.border : colors.tint,
                fontWeight: '600',
              }}>
              Add image
            </Text>
          </Pressable>
          <Pressable
            testID={cameraTestId}
            disabled={busy || disabled}
            onPress={() => void attach('camera')}>
            <Text
              style={{
                color: busy || disabled ? colors.border : colors.textSecondary,
                fontWeight: '600',
              }}>
              Camera
            </Text>
          </Pressable>
        </View>
      </View>

      {assets.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Optional photos for this {stepId ? 'step' : 'process'}.
        </Text>
      ) : (
        assets.map((asset) => (
          <MediaRow
            key={asset.id}
            asset={asset}
            disabled={busy || disabled}
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

function MediaRow({
  asset,
  disabled,
  onUpdate,
  onRemove,
}: {
  asset: MediaAsset;
  disabled: boolean;
  onUpdate: (patch: { caption?: string; isCover?: boolean }) => void;
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
      <Image
        testID={`media-thumb-${asset.id}`}
        source={{ uri: asset.storagePath }}
        style={styles.thumb}
        accessibilityLabel={asset.caption || 'Process image'}
      />
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
          <Pressable
            testID={`media-cover-${asset.id}`}
            disabled={disabled || asset.isCover}
            onPress={() => onUpdate({ isCover: true })}>
            <Text
              style={{
                color: asset.isCover ? colors.textSecondary : colors.tint,
                fontWeight: '600',
              }}>
              {asset.isCover ? 'Cover' : 'Set cover'}
            </Text>
          </Pressable>
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
  coverRow: {
    alignSelf: 'flex-start',
    borderWidth: 0,
    padding: 0,
    backgroundColor: 'transparent',
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#D6D3D1' },
  coverThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#D6D3D1' },
  readCaption: { flex: 1, fontSize: 14, lineHeight: 20 },
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
