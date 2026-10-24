import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Confetti from '../../components/Confetti';
import DuoButton from '../../components/DuoButton';
import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { formatBRL, formatDateLong } from '../../utils/format';
import { feedback } from '../../services/feedback';

export default function BookingSuccessScreen({ route, navigation }: RootScreenProps<'BookingSuccess'>) {
  const { bookings } = useApp();
  const booking = bookings.find((b) => b.id === route.params.bookingId);

  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // pequena pausa para a transição terminar e então: 🎉
    const t = setTimeout(() => {
      feedback.celebrate();
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 16 }),
        Animated.timing(spin, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 200);
    return () => clearTimeout(t);
  }, [pop, spin]);

  if (!booking) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <Confetti />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.badge,
            {
              transform: [
                { scale: pop },
                { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark" size={64} color={colors.white} />
        </Animated.View>

        <FadeInView delay={350}>
          <Text style={styles.title}>Pedido enviado!</Text>
          <Text style={styles.subtitle}>
            {booking.providerName.split(' ')[0]} vai confirmar em breve. Acompanhe o status em Pedidos.
          </Text>
        </FadeInView>

        <FadeInView delay={500} style={{ alignSelf: 'stretch' }}>
          <Card style={{ marginTop: spacing.xl }}>
            <Line icon="briefcase"text={booking.serviceTitle} />
            <Line icon="calendar" text={`${formatDateLong(booking.date)} às ${booking.time}`} />
            <Line icon="location" text={booking.address} />
            <Line icon="wallet" text={`${formatBRL(booking.price)} • ${route.params.payment.toUpperCase()}`} />
          </Card>
        </FadeInView>
      </View>

      <FadeInView delay={650} style={styles.bottom}>
        <DuoButton title="Ver meus pedidos" onPress={() => navigation.goBack()} />
      </FadeInView>
    </SafeAreaView>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 8,
    borderBottomColor: colors.primaryDark,
    marginBottom: spacing.xl,
  },
  title: { fontSize: 30, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  line: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  lineText: { marginLeft: 10, fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  bottom: { padding: spacing.lg },
});
