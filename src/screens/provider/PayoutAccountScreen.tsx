import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { PayoutAccountForm } from '../../types';
import { colors, spacing, makeStyles } from '../../theme';
import { t, tList } from '../../i18n';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { createPayoutAccount } from '../../services/payments';

const COMPANY_IDS: NonNullable<PayoutAccountForm['companyType']>[] = ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'];
const companyTypes = () => {
  const labels = tList('payout.companyTypes');
  return COMPANY_IDS.map((id, i) => ({ id, label: labels[i] }));
};

const digits = (v: string) => v.replace(/\D/g, '');

/** "31/12/1990" → "1990-12-31" */
function toISO(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Formata a data enquanto digita: 31121990 → 31/12/1990 */
function maskDate(v: string) {
  const d = digits(v).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}

/**
 * Abre a conta de recebimento do prestador no Asaas (subconta). Com ela, ele passa a aceitar Pix e
 * cartão, e os repasses dos serviços concluídos caem nessa conta.
 */
export default function PayoutAccountScreen({ navigation }: RootScreenProps<'PayoutAccount'>) {
  const { loggedProvider, profile } = useApp();
  // já vem preenchido com o que a pessoa informou no cadastro com o Mélo
  const [cpfCnpj, setCpfCnpj] = useState(profile?.cpf ?? '');
  const [birth, setBirth] = useState(profile?.birthDate ? profile.birthDate.split('-').reverse().join('/') : '');
  const [companyType, setCompanyType] = useState<PayoutAccountForm['companyType']>('MEI');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [income, setIncome] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);

  if (loggedProvider?.acceptsOnlinePayment) {
    return (
      <View style={[styles.flex, styles.done]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.doneTitle}>{t('payout.activeTitle')}</Text>
        <Text style={styles.muted}>
          {t('payout.activeSub')}
        </Text>
      </View>
    );
  }

  const doc = digits(cpfCnpj);
  const isCompany = doc.length === 14;
  const incomeValue = Number(income.replace(/\./g, '').replace(',', '.'));
  const valid =
    (doc.length === 11 || isCompany) &&
    (isCompany || toISO(birth) !== '') &&
    digits(phone).length >= 10 &&
    incomeValue > 0 &&
    digits(cep).length === 8 &&
    street.trim().length >= 3 &&
    number.trim().length > 0 &&
    district.trim().length >= 2;

  const submit = async () => {
    if (!valid) return feedback.error();
    setLoading(true);
    try {
      await createPayoutAccount({
        cpfCnpj: doc,
        birthDate: isCompany ? undefined : toISO(birth),
        companyType: isCompany ? companyType : undefined,
        mobilePhone: digits(phone),
        incomeValue,
        postalCode: digits(cep),
        address: street.trim(),
        addressNumber: number.trim(),
        complement: complement.trim() || undefined,
        province: district.trim(),
      });
      feedback.celebrate();
      Alert.alert(
        t('payout.createdTitle'),
        t('payout.createdSub'),
      );
      navigation.goBack();
    } catch (e) {
      feedback.error();
      Alert.alert(t('payout.createFailed'), firebaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.bold}>{t('payout.whyTitle')}</Text>
          <Text style={styles.muted}>
            {t('payout.whyBody')}
          </Text>
        </Card>

        <Text style={styles.h}>{t('payout.yourData')}</Text>
        <TextField icon="id-card" placeholder={t('payout.cpfCnpj')} keyboardType="number-pad" value={cpfCnpj} onChangeText={setCpfCnpj} maxLength={18} />
        {isCompany ? (
          <View style={styles.chips}>
            {companyTypes().map((c) => (
              <Chip key={c.id} label={c.label} selected={companyType === c.id} onPress={() => setCompanyType(c.id)} />
            ))}
          </View>
        ) : (
          <TextField
            icon="calendar"
            placeholder={t('onb.birth')}
            keyboardType="number-pad"
            value={birth}
            onChangeText={(v) => setBirth(maskDate(v))}
            maxLength={10}
          />
        )}
        <TextField icon="call" placeholder={t('onb.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={15} />
        <TextField
          icon="wallet"
          placeholder={t('payout.income')}
          keyboardType="decimal-pad"
          value={income}
          onChangeText={(v) => setIncome(v.replace(/[^\d,]/g, ''))}
        />

        <Text style={styles.h}>{t('payout.address')}</Text>
        <TextField icon="location" placeholder={t('onb.cep')} keyboardType="number-pad" value={cep} onChangeText={setCep} maxLength={9} />
        <TextField icon="home" placeholder={t('onb.street')} value={street} onChangeText={setStreet} />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField icon="keypad" placeholder={t('onb.number')} value={number} onChangeText={setNumber} />
          </View>
          <View style={{ flex: 1.4 }}>
            <TextField icon="business" placeholder={t('onb.complement')} value={complement} onChangeText={setComplement} />
          </View>
        </View>
        <TextField icon="map" placeholder={t('onb.district')} value={district} onChangeText={setDistrict} />

        <DuoButton title={t('payout.create')} icon="checkmark-circle" disabled={!valid} loading={loading} onPress={submit} sound="none" />
        <Text style={[styles.muted, { marginTop: spacing.md, textAlign: 'center' }]}>
          {t('payout.privacy')}
        </Text>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  flex: { flex: 1, backgroundColor: colors.bg },
  done: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  doneTitle: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textAlign: 'left' },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 12 },
  row: { flexDirection: 'row' },
}));
