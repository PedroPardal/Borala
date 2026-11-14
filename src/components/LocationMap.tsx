import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { GeoPoint } from '../types';
import { colors, radius as r, makeStyles } from '../theme';
import { t } from '../i18n';

// os tipos da WebView (componente de classe) não batem com os do React 19; o componente funciona igual
const Web = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;

/**
 * Mapa real (OpenStreetMap + Leaflet dentro de uma WebView): não precisa de chave de API.
 * - `radiusKm` desenha o círculo de atendimento do prestador.
 * - `draggable` deixa arrastar o pino (ou tocar no mapa) para ajustar o ponto; avisa em `onChange`.
 */
export default function LocationMap({
  center,
  radiusKm,
  draggable,
  onChange,
  height = 200,
  style,
}: {
  center: GeoPoint | null;
  radiusKm?: number;
  draggable?: boolean;
  onChange?: (p: GeoPoint) => void;
  height?: number;
  style?: ViewStyle;
}) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // o pino que o próprio usuário arrastou: não "devolver" para o mapa e causar pulo
  const lastFromMap = useRef<string | null>(null);

  // o HTML é montado uma vez; as mudanças seguintes vão por injectJavaScript
  const html = useMemo(() => buildHtml(!!draggable), [draggable]);

  useEffect(() => {
    if (!ready || !center) return;
    const key = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;
    if (key === lastFromMap.current) return;
    web.current?.injectJavaScript(`window.setPoint(${center.lat}, ${center.lng}); true;`);
  }, [ready, center?.lat, center?.lng]);

  useEffect(() => {
    if (!ready) return;
    web.current?.injectJavaScript(`window.setRadius(${radiusKm ?? 0}); true;`);
  }, [ready, radiusKm]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'error') setFailed(true);
      if (msg.type === 'move' && onChange) {
        lastFromMap.current = `${msg.lat.toFixed(6)},${msg.lng.toFixed(6)}`;
        onChange({ lat: msg.lat, lng: msg.lng });
      }
    } catch {
      // mensagem que não é do mapa
    }
  };

  return (
    <View style={[styles.wrap, { height }, style]}>
      {!center ? (
        <View style={styles.placeholder}>
          <Ionicons name="map-outline" size={36} color={colors.primary} />
          <Text style={styles.placeholderText}>{t('map.enable')}</Text>
        </View>
      ) : failed ? (
        <View style={styles.placeholder}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text style={styles.placeholderText}>{t('map.offline')}</Text>
        </View>
      ) : (
        <>
          <Web
            ref={web}
            originWhitelist={['*']}
            source={{ html }}
            onMessage={onMessage}
            onError={() => setFailed(true)}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            // o mapa precisa receber o gesto de arrastar sem rolar a tela junto
            nestedScrollEnabled
            setBuiltInZoomControls={false}
            style={styles.web}
          />
          {!ready && (
            <View style={[StyleSheet.absoluteFill, styles.loading]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          {draggable && ready && (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintText}>{t('map.drag')}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function buildHtml(draggable: boolean) {
  const orange = colors.primary;
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#eef2f7}
  .pin{width:26px;height:26px;border-radius:50% 50% 50% 0;background:${orange};transform:rotate(-45deg);
       border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .leaflet-control-attribution{font-size:9px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if (!window.L) { post({type:'error'}); }
  else {
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-15.78, -47.93], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var icon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [26,26], iconAnchor: [13,30] });
    var marker = null, circle = null, radiusKm = 0;
    function drawCircle(){
      if (circle) { map.removeLayer(circle); circle = null; }
      if (marker && radiusKm > 0) {
        circle = L.circle(marker.getLatLng(), { radius: radiusKm * 1000, color: '${orange}', weight: 2, fillOpacity: 0.15 }).addTo(map);
        map.fitBounds(circle.getBounds(), { padding: [12,12] });
      }
    }
    function moved(ll){ drawCircle(); post({ type: 'move', lat: ll.lat, lng: ll.lng }); }
    window.setPoint = function(lat, lng){
      var ll = L.latLng(lat, lng);
      if (!marker) {
        marker = L.marker(ll, { icon: icon, draggable: ${draggable} }).addTo(map);
        marker.on('dragend', function(){ moved(marker.getLatLng()); });
      } else { marker.setLatLng(ll); }
      if (radiusKm > 0) drawCircle(); else map.setView(ll, 16);
    };
    window.setRadius = function(km){ radiusKm = km; drawCircle(); };
    ${draggable ? "map.on('click', function(e){ if (marker) { marker.setLatLng(e.latlng); moved(e.latlng); } });" : ''}
    post({ type: 'ready' });
  }
</script></body></html>`;
}

const styles = makeStyles(() => ({
  wrap: { width: '100%', borderRadius: r.md, overflow: 'hidden', backgroundColor: colors.primaryLight },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  placeholderText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  hint: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hintText: { color: '#fff', fontSize: 11, fontWeight: '800' },
}));
