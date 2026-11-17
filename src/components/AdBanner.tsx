import React, { useState } from 'react';
import { View } from 'react-native';
import { bannerUnitId, getAdsModule } from '../services/ads';
import { useOnline } from '../services/network';
import { makeStyles } from '../theme';

/** Banner do AdMob. Some sozinho no Expo Go, sem internet ou se o anúncio não carregar. */
export default function AdBanner() {
  const online = useOnline();
  const [failed, setFailed] = useState(false);
  const ads = getAdsModule();
  const unitId = bannerUnitId();
  if (!ads || !unitId || !online || failed) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(e) => {
          console.warn('[ads] banner não carregou', e);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { alignItems: 'center', marginVertical: 8 },
}));
