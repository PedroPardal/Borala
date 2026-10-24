import * as Location from 'expo-location';
import { GeoPoint } from '../types';

/** Distância em linha reta (fórmula de haversine), em km. */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pede permissão e devolve a posição atual (ou null se negar / falhar). */
export async function getCurrentPosition(): Promise<GeoPoint | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** "Bairro, Cidade" a partir das coordenadas, para mostrar no perfil do prestador. */
export async function describePosition(p: GeoPoint): Promise<string | undefined> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    if (!place) return undefined;
    return [place.district ?? place.subregion, place.city ?? place.region].filter(Boolean).join(', ') || undefined;
  } catch {
    return undefined;
  }
}
