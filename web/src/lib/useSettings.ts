import { useQuery } from '@tanstack/react-query';
import api from './api';

export interface GeneralSettings {
  companyName:    string;
  companyEmail:   string;
  companyPhone:   string;
  companyAddress: string;
  currency:       string;
  currencySymbol: string;
  dateFormat:     string;
  timezone:       string;
  fiscalYearStart:string;
  language:       string;
}

const DEFAULTS: GeneralSettings = {
  companyName:    'Al Khadim LLC',
  companyEmail:   'info@alkhadim.ae',
  companyPhone:   '',
  companyAddress: '',
  currency:       'AED',
  currencySymbol: 'د.إ',
  dateFormat:     'DD/MM/YYYY',
  timezone:       'Asia/Dubai',
  fiscalYearStart:'01',
  language:       'en',
};

export function useSettings() {
  const { data, isLoading } = useQuery<GeneralSettings>({
    queryKey: ['site-config-general'],
    queryFn:  () => api.get('/site-config/general').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const settings: GeneralSettings = { ...DEFAULTS, ...data };
  const fmtCurrency = (amount: number) =>
    `${settings.currency} ${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return { settings, isLoading, fmtCurrency };
}
