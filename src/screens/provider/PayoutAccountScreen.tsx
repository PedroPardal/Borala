import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import DuoButton from '../../components/DuoButton';
import TextField from '../../components/TextField';
import { useApp } from '../../context/AppContext';
import { RootScreenProps } from '../../navigation/types';
import { PayoutAccountForm } from '../../types';
import { colors, spacing } from '../../theme';
import { feedback } from '../../services/feedback';
import { firebaseErrorMessage } from '../../services/firebase';
import { createPayoutAccount } from '../../services/payments';

const COMPANY_TYPES: { id: NonNullable<PayoutAccountForm['companyType']>; label: string }[] = [
  { id: 'MEI', label: 'MEI' },
  { id: 'LIMITED', label: 'Limitada' },
  { id: 'INDIVIDUAL', label: 'Individual' },
  { id: 'ASSOCIATION', label: 'Associação' },
];

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
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [birth, setBirth] = useState('');
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
        <Text style={styles.doneTitle}>Conta de recebimento ativa</Text>
        <Text style={styles.muted}>
          Você já recebe por Pix e cartão. Os repasses caem na sua conta Asaas: acesse pelo e-mail que o Asaas enviou para
          você, e de lá faça o saque para o seu banco.
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
        'Conta criada!',
        'Agora você recebe por Pix e cartão. O Asaas vai te mandar um e-mail para acessar a conta; ele pode pedir documentos para liberar os saques.',
      );
      navigation.goBack();
    } catch (e) {
      feedback.error();
      Alert.alert('Não foi possível criar a conta', firebaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.bold}>Por que preciso disso?</Text>
          <Text style={styles.muted}>
            O pagamento por Pix ou cartão passa pela BoraLá e é repassado a você quando o serviço é concluído. Para isso, o
            Asaas (nosso parceiro de pagamentos) abre uma conta no seu nome. Clientes preferem Pix, e você ainda quita as
            comissões dos serviços em dinheiro.
          </Text>
        </Card>

        <Text style={styles.h}>Seus dados</Text>
        <TextField icon="id-card" placeholder="CPF ou CNPJ" keyboardType="number-pad" value={cpfCnpj} onChangeText={setCpfCnpj} maxLength={18} />
        {isCompany ? (
          <View style={styles.chips}>
            {COMPANY_TYPES.map((t) => (
              <Chip key={t.id} label={t.label} selected={companyType === t.id} onPress={() => setCompanyType(t.id)} />
            ))}
          </View>
        ) : (
          <TextField
            icon="calendar"
            placeholder="Data de nascimento (dd/mm/aaaa)"
            keyboardType="number-pad"
            value={birth}
            onChangeText={(v) => setBirth(maskDate(v))}
            maxLength={10}
          />
        )}
        <TextField icon="call" placeholder="Celular com DDD" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={15} />
        <TextField
          icon="wallet"
          placeholder="Renda mensal aproximada (R$)"
          keyboardType="decimal-pad"
          value={income}
          onChangeText={(v) => setIncome(v.replace(/[^\d,]/g, ''))}
        />

        <Text style={styles.h}>Endereço</Text>
        <TextField icon="location" placeholder="CEP" keyboardType="number-pad" value={cep} onChangeText={setCep} maxLength={9} />
        <TextField icon="home" placeholder="Rua" value={street} onChangeText={setStreet} />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField icon="keypad" placeholder="Número" value={number} onChangeText={setNumber} />
          </View>
          <View style={{ flex: 1.4 }}>
            <TextField icon="business" placeholder="Complemento" value={complement} onChangeText={setComplement} />
          </View>
        </View>
        <TextField icon="map" placeholder="Bairro" value={district} onChangeText={setDistrict} />

        <DuoButton title="Criar conta de recebimento" icon="checkmark-circle" disabled={!valid} loading={loading} onPress={submit} sound="none" />
        <Text style={[styles.muted, { marginTop: spacing.md, textAlign: 'center' }]}>
          Seus dados vão direto para o Asaas e não ficam visíveis para clientes.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  done: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  doneTitle: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textAlign: 'left' },
  h: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 12 },
  row: { flexDirection: 'row' },
});
