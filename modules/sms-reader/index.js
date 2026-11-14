import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

const SmsReader = requireOptionalNativeModule('SmsReader');

export async function requestSmsPermission() {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Access Permission',
        message: 'MoneyFollows requires permission to read bank SMS and UPI notification alerts to automatically update your ledger.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('SMS permission error', err);
    return false;
  }
}

export async function readDeviceSms(limit = 1000) {
  if (Platform.OS !== 'android' || !SmsReader) {
    return [];
  }

  const hasPermission = await requestSmsPermission();
  if (!hasPermission) {
    throw new Error('READ_SMS permission was denied by user.');
  }

  return await SmsReader.readRecentSms(limit);
}

export function isDeviceSmsAvailable() {
  return Platform.OS === 'android' && !!SmsReader;
}
