import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Rust from '../../modules/rust-logic';
export function SheetMusic({ uri }: { uri: string }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0), [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState<{ uri: string; width: number; height: number; pages: number }>();
  const [error, setError] = useState('');
  useEffect(() => { setPage(0); }, [uri]);
  useEffect(() => {
    let alive = true; setError(''); setRendered(undefined);
    Rust.renderPdfPage(uri, page, 1600).then(result => { if (alive) setRendered(result); }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [uri, page]);
  const control = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{ padding: 10, backgroundColor: '#eef2e9', borderRadius: 6, opacity: disabled ? .4 : 1 }}><Text style={{ color: '#335d4b' }}>{label}</Text></Pressable>;
  const imageWidth = Math.min(width - 90, 720) * zoom;
  return <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{control('Vorige bladsy', () => setPage(p => p - 1), page === 0)}<Text>Bladsy {page + 1} / {rendered?.pages ?? '…'}</Text>{control('Volgende bladsy', () => setPage(p => p + 1), !rendered || page + 1 >= rendered.pages)}{control(`Vergroot ${zoom * 100}%`, () => setZoom(z => z === 1 ? 1.5 : z === 1.5 ? 2 : 1))}</View>{error ? <Text accessibilityRole="alert">Bladmusiek kon nie vertoon word nie. {error}</Text> : rendered ? <ScrollView horizontal><Image accessibilityLabel={`Bladmusiek — bladsy ${page + 1}`} source={{ uri: rendered.uri }} style={{ width: imageWidth, height: imageWidth * rendered.height / rendered.width }} resizeMode="contain"/></ScrollView> : <ActivityIndicator color="#174e43"/>}</View>;
}
